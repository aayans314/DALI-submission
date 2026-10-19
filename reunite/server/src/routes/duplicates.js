import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { requireStaff } from '../auth.js';
import { ah, audit, HttpError } from '../lib/util.js';
import { mergeHistories } from '../lib/names.js';
import { runDuplicateCheck, toCard } from '../lib/persons.js';
import { matchNewPerson, declinePendingFor } from '../lib/matching.js';

const router = Router();
router.use(requireStaff());

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Bad id.');
  return id;
};

// Open flags where at least one of the two people is at my shelter.
// A flag involving a do-not-disclose person is only shown to the shelter
// that person is at.
router.get('/', ah(async (req, res) => {
  const me = req.auth.shelterId;
  const { rows } = await pool.query(
    `select f.id, f.score, row_to_json(a) as a, row_to_json(b) as b
       from duplicate_flags f
       join persons a on a.id = f.person_a
       join persons b on b.id = f.person_b
      where f.status = 'open'
        and (a.current_shelter_id = $1 or b.current_shelter_id = $1)
      order by f.score desc, f.created_at`,
    [me],
  );
  const hidden = (p) => p.do_not_disclose && p.current_shelter_id !== me;
  res.json(rows
    .filter((r) => !hidden(r.a) && !hidden(r.b))
    .map((r) => ({ id: r.id, score: Number(r.score), a: toCard(r.a, me), b: toCard(r.b, me) })));
}));

// Check everyone at my shelter against the whole database.
router.post('/scan', ah(async (req, res) => {
  const { rows } = await pool.query(
    `select * from persons where current_shelter_id = $1 and status = 'sheltered'`,
    [req.auth.shelterId],
  );
  let newFlags = 0;
  for (const p of rows) newFlags += (await runDuplicateCheck(pool, p)).length;
  await audit(req.auth, 'duplicates.scan', { detail: { checked: rows.length, newFlags } });
  res.json({ checked: rows.length, newFlags });
}));

// Merge two records into one. body: { keepId }
router.post('/:id/merge', ah(async (req, res) => {
  const flagId = idParam(req);
  const keepId = Number(req.body.keepId);
  const me = req.auth.shelterId;

  const kept = await withTransaction(async (db) => {
    const { rows: [flag] } = await db.query('select * from duplicate_flags where id = $1 for update', [flagId]);
    if (!flag || flag.status !== 'open') throw new HttpError(404, 'Someone already handled this one.');
    if (![flag.person_a, flag.person_b].includes(keepId)) throw new HttpError(400, 'Choose which of the two records to keep.');
    const otherId = keepId === flag.person_a ? flag.person_b : flag.person_a;

    const { rows } = await db.query('select * from persons where id = any($1::int[]) for update', [[keepId, otherId]]);
    const keep = rows.find((r) => r.id === keepId);
    const other = rows.find((r) => r.id === otherId);
    if (!keep || !other || keep.status === 'merged' || other.status === 'merged') {
      throw new HttpError(409, 'One of these records was already merged.');
    }
    if (keep.current_shelter_id !== me && other.current_shelter_id !== me) {
      throw new HttpError(403, 'Neither person is checked in at your shelter.');
    }

    // The kept record's details win; gaps are filled from the other one.
    const { history, currentShelterId, status } = mergeHistories(keep.shelter_history, other.shelter_history);
    const ages = keep.age_min == null ? [other.age_min, other.age_max] : [keep.age_min, keep.age_max];
    const description = keep.description && other.description && keep.description !== other.description
      ? `${keep.description} | ${other.description}`
      : keep.description ?? other.description;

    await db.query(
      `update persons set shelter_history = $2, current_shelter_id = $3, status = $4,
         age_min = $5, age_max = $6, home_area = $7, description = $8, photo_path = $9,
         is_minor = $10, do_not_disclose = $11, updated_at = now()
       where id = $1`,
      [keepId, JSON.stringify(history), currentShelterId, status, ages[0], ages[1],
        keep.home_area ?? other.home_area, description, keep.photo_path ?? other.photo_path,
        keep.is_minor || other.is_minor,
        keep.do_not_disclose || other.do_not_disclose], // if either record asked not to be found, honor it
    );
    await db.query(
      `update persons set status = 'merged', merged_into = $2, current_shelter_id = null, updated_at = now()
        where id = $1`,
      [otherId, keepId],
    );

    // Point anything that referenced the old record at the kept one.
    await db.query(
      `delete from matches m where m.person_id = $1
          and exists (select 1 from matches k where k.person_id = $2 and k.request_id = m.request_id)`,
      [otherId, keepId],
    );
    await db.query('update matches set person_id = $2 where person_id = $1', [otherId, keepId]);
    await db.query('update search_requests set requester_person_id = $2 where requester_person_id = $1', [otherId, keepId]);
    await db.query(
      `update duplicate_flags set status = 'merged', resolved_by = $2
        where id = $1 or (status = 'open' and (person_a = $3 or person_b = $3))`,
      [flagId, req.auth.sub, otherId],
    );
    await audit(req.auth, 'duplicates.merge', { targetType: 'person', targetId: keepId, detail: { mergedId: otherId } }, db);

    const { rows: [result] } = await db.query('select * from persons where id = $1', [keepId]);
    return result;
  });

  // The kept record may now be a duplicate of someone the other one wasn't.
  await runDuplicateCheck(pool, kept);
  if (kept.do_not_disclose) await declinePendingFor(pool, kept.id);
  else await matchNewPerson(pool, kept);
  res.json({ keptId: kept.id, here: kept.current_shelter_id === me });
}));

// "These are different people."
router.post('/:id/dismiss', ah(async (req, res) => {
  const flagId = idParam(req);
  const me = req.auth.shelterId;
  const { rows } = await pool.query(
    `update duplicate_flags f set status = 'not_duplicate', resolved_by = $2
       from persons a, persons b
      where f.id = $1 and f.status = 'open'
        and a.id = f.person_a and b.id = f.person_b
        and (a.current_shelter_id = $3 or b.current_shelter_id = $3)
      returning f.id`,
    [flagId, req.auth.sub, me],
  );
  if (!rows[0]) throw new HttpError(404, 'Someone already handled this one.');
  await audit(req.auth, 'duplicates.dismiss', { targetType: 'duplicate_flag', targetId: flagId });
  res.json({ ok: true });
}));

export default router;
