// Staff: the consent step. A volunteer asks the person in front of them,
// a coordinator approves anything involving a minor.
import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { requireStaff } from '../auth.js';
import { ah, audit, HttpError } from '../lib/util.js';
import { toCard } from '../lib/persons.js';

const router = Router();
router.use(requireStaff());

const MATCH_SELECT = `
  select m.id, m.score, m.status, row_to_json(p) as person, row_to_json(r) as request,
         pu.name as seeker_public_name, pu.contact as seeker_contact,
         rp.name as seeker_person_name, rs.name as seeker_shelter_name, rs.address as seeker_shelter_address,
         ps.name as found_shelter_name, ps.address as found_shelter_address
    from matches m
    join persons p on p.id = m.person_id
    join search_requests r on r.id = m.request_id
    left join public_users pu on pu.id = r.public_user_id
    left join persons rp on rp.id = r.requester_person_id
    left join shelters rs on rs.id = rp.current_shelter_id
    left join shelters ps on ps.id = p.current_shelter_id`;

// Who is looking. How to reach them is only included once the person said yes.
function seekerView(row, reveal) {
  const r = row.request;
  const fromShelter = r.requester_person_id != null;
  return {
    name: fromShelter ? row.seeker_person_name : row.seeker_public_name,
    viaShelter: fromShelter,
    relationship: r.relationship,
    names: r.names,
    ageMin: r.age_min,
    ageMax: r.age_max,
    homeArea: r.home_area,
    description: r.description,
    contact: !reveal ? undefined
      : fromShelter
        ? `At ${row.seeker_shelter_name ?? 'a shelter'}${row.seeker_shelter_address ? `, ${row.seeker_shelter_address}` : ''}`
        : row.seeker_contact,
  };
}

const view = (row, me) => ({
  id: row.id,
  score: Number(row.score),
  status: row.status,
  person: toCard(row.person, me),
  seeker: seekerView(row, row.status === 'accepted'),
});

router.get('/', ah(async (req, res) => {
  const me = req.auth.shelterId;
  const [toAsk, toApprove, found] = await Promise.all([
    pool.query(`${MATCH_SELECT} where m.status in ('pending_volunteer', 'pending_person') and p.current_shelter_id = $1
                 and r.status = 'open' order by m.score desc`, [me]),
    req.auth.role === 'authority'
      ? pool.query(`${MATCH_SELECT} where m.status = 'pending_authority' and p.current_shelter_id = $1
                     and r.status = 'open' order by m.created_at`, [me])
      : { rows: [] },
    // Good news for people here who had a volunteer search for them.
    pool.query(`${MATCH_SELECT} where m.status = 'accepted' and rp.current_shelter_id = $1
                 and r.status = 'open' order by m.updated_at desc`, [me]),
  ]);
  res.json({
    toAsk: toAsk.rows.map((r) => view(r, me)),
    toApprove: toApprove.rows.map((r) => view(r, me)),
    found: found.rows.map((r) => ({
      ...view(r, me),
      requesterPersonId: r.request.requester_person_id,
      requestId: r.request.id,
      foundAt: r.found_shelter_name
        ? `${r.found_shelter_name}${r.found_shelter_address ? `, ${r.found_shelter_address}` : ''}`
        : 'Has since left the shelters',
    })),
  });
}));

async function loadForUpdate(db, id, me) {
  const { rows } = await db.query(`${MATCH_SELECT} where m.id = $1 for update of m`, [id]);
  const row = rows[0];
  if (!row || row.request.status !== 'open') throw new HttpError(404, 'This match is no longer open.');
  if (row.person.current_shelter_id !== me) throw new HttpError(403, 'This person isn\'t checked in at your shelter.');
  return row;
}

// body: { decision: 'yes' | 'no' | 'not_them' }
router.post('/:id/decision', ah(async (req, res) => {
  const id = Number(req.params.id);
  const { decision } = req.body;
  if (!['yes', 'no', 'not_them'].includes(decision)) throw new HttpError(400, 'Choose what they said.');
  const me = req.auth.shelterId;

  const result = await withTransaction(async (db) => {
    const row = await loadForUpdate(db, id, me);
    if (!['pending_volunteer', 'pending_person'].includes(row.status)) throw new HttpError(409, 'Someone already answered this one.');
    const next = decision !== 'yes' ? 'declined' : row.person.is_minor ? 'pending_authority' : 'accepted';
    await db.query('update matches set status = $2, reviewed_by = $3, updated_at = now() where id = $1', [id, next, req.auth.sub]);
    await audit(req.auth, 'match.decision', { targetType: 'match', targetId: id, detail: { decision } }, db);
    return view({ ...row, status: next }, me);
  });
  res.json(result);
}));

// Coordinators only. body: { approve: true | false }
router.post('/:id/approve', ah(async (req, res) => {
  if (req.auth.role !== 'authority') throw new HttpError(403, 'Only a coordinator can approve this.');
  const id = Number(req.params.id);
  const me = req.auth.shelterId;

  const result = await withTransaction(async (db) => {
    const row = await loadForUpdate(db, id, me);
    if (row.status !== 'pending_authority') throw new HttpError(409, 'This one doesn\'t need approval.');
    const next = req.body.approve === true ? 'accepted' : 'declined';
    await db.query('update matches set status = $2, reviewed_by = $3, updated_at = now() where id = $1', [id, next, req.auth.sub]);
    await audit(req.auth, 'match.approve', { targetType: 'match', targetId: id, detail: { approve: next === 'accepted' } }, db);
    return view({ ...row, status: next }, me);
  });
  res.json(result);
}));

export default router;
