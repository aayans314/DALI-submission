import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { requireStaff } from '../auth.js';
import { ah, audit, cleanText, HttpError } from '../lib/util.js';
import { newReferenceCode } from '../lib/refcode.js';
import { normalizeName, LOOKUP_MIN } from '../lib/names.js';
import {
  findCandidates, runDuplicateCheck, toCard, toDetail, shelterNameMap,
  readPersonInput, normalizeReferenceCode,
} from '../lib/persons.js';
import { matchNewPerson, declinePendingFor } from '../lib/matching.js';
import { readSearchInput, createSearch, searchViews } from '../lib/searches.js';

const router = Router();
router.use(requireStaff());

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Bad id.');
  return id;
};

// Hide do-not-disclose people from staff at other shelters.
const visibleTo = (me) => (p) => !p.do_not_disclose || p.current_shelter_id === me;

// ---------------------------------------------------------------- list
// People currently checked in at my shelter, optionally filtered by name
// or reference code.
router.get('/', ah(async (req, res) => {
  const me = req.auth.shelterId;
  const q = cleanText(req.query.q, 100);
  const params = [me];
  let filter = '';
  if (q) {
    params.push(`%${normalizeName(q)}%`, normalizeReferenceCode(q));
    filter = 'and (name_norm like $2 or reference_code = $3)';
  }
  const { rows } = await pool.query(
    `select * from persons where current_shelter_id = $1 and status = 'sheltered' ${filter}
      order by updated_at desc limit 300`,
    params,
  );
  res.json(rows.map((p) => toCard(p, me)));
}));

// ---------------------------------------------------------------- lookup
// "Is this person already registered somewhere?" Used at check-in, before
// creating a new record. By reference code, or by name (+ optional age).
router.post('/lookup', ah(async (req, res) => {
  const me = req.auth.shelterId;

  if (cleanText(req.body.referenceCode)) {
    const code = normalizeReferenceCode(req.body.referenceCode);
    if (!code) throw new HttpError(400, 'Reference codes have 6 letters and numbers, like K7P-QX4.');
    let { rows } = await pool.query('select * from persons where reference_code = $1', [code]);
    let p = rows[0];
    // A merged record's code still works: follow it to the record that was kept.
    for (let i = 0; p && p.status === 'merged' && i < 5; i++) {
      ({ rows } = await pool.query('select * from persons where id = $1', [p.merged_into]));
      p = rows[0];
    }
    await audit(req.auth, 'person.lookup', { detail: { by: 'code', found: Boolean(p) } });
    return res.json({ results: p ? [{ ...toCard(p, me), score: 100 }] : [] });
  }

  if (!cleanText(req.body.name)) throw new HttpError(400, 'Enter a name or a reference code.');
  const { fields, error } = readPersonInput({ name: req.body.name, ageMin: req.body.ageMin, ageMax: req.body.ageMax });
  if (error) throw new HttpError(400, error);

  const candidates = await findCandidates(pool, {
    names: [fields.name], ageMin: fields.age_min, ageMax: fields.age_max, homeArea: cleanText(req.body.homeArea),
  });
  const results = candidates
    .filter((c) => c.score >= LOOKUP_MIN && visibleTo(me)(c.person))
    .slice(0, 10)
    .map((c) => ({ ...toCard(c.person, me), score: c.score }));

  await audit(req.auth, 'person.lookup', { detail: { by: 'name', name: fields.name, results: results.length } });
  res.json({ results });
}));

// ---------------------------------------------------------------- create
router.post('/', ah(async (req, res) => {
  const me = req.auth.shelterId;
  const { fields, error } = readPersonInput(req.body);
  if (error) throw new HttpError(400, error);

  const history = [{ shelter_id: me, arrived_at: new Date().toISOString(), left_at: null, staff_id: req.auth.sub }];
  let person;
  for (let attempt = 0; !person; attempt++) {
    try {
      const { rows } = await pool.query(
        `insert into persons (name, name_norm, name_keys, age_min, age_max, home_area, description,
           is_minor, do_not_disclose, reference_code, current_shelter_id, shelter_history, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         returning *`,
        [fields.name, fields.name_norm, fields.name_keys, fields.age_min ?? null, fields.age_max ?? null,
          fields.home_area ?? null, fields.description ?? null, fields.is_minor ?? false,
          fields.do_not_disclose ?? false, newReferenceCode(), me, JSON.stringify(history), req.auth.sub],
      );
      person = rows[0];
    } catch (err) {
      // Reference code collision is astronomically unlikely, but retry anyway.
      if (err.code === '23505' && err.constraint === 'persons_reference_code_key' && attempt < 5) continue;
      throw err;
    }
  }
  await audit(req.auth, 'person.create', { targetType: 'person', targetId: person.id });

  const flagged = await runDuplicateCheck(pool, person);
  await matchNewPerson(pool, person); // maybe someone is already looking for them
  res.status(201).json({
    person: toDetail(person, await shelterNameMap(pool)),
    possibleDuplicates: flagged
      .filter((c) => visibleTo(me)(c.person))
      .map((c) => ({ ...toCard(c.person, me), score: c.score })),
  });
}));

// ---------------------------------------------------------------- detail
router.get('/:id', ah(async (req, res) => {
  const id = idParam(req);
  const { rows } = await pool.query('select * from persons where id = $1', [id]);
  const p = rows[0];
  if (!p) throw new HttpError(404, 'No one with that id.');
  if (p.status === 'merged') return res.json({ mergedInto: p.merged_into });
  if (p.current_shelter_id !== req.auth.shelterId) {
    throw new HttpError(403, 'This person isn\'t checked in at your shelter. Use "Check someone in" to look them up.');
  }
  await audit(req.auth, 'person.view', { targetType: 'person', targetId: id });
  res.json(toDetail(p, await shelterNameMap(pool)));
}));

// ---------------------------------------------------------------- edit
router.patch('/:id', ah(async (req, res) => {
  const id = idParam(req);
  const { fields, error } = readPersonInput(req.body, { requireName: false });
  if (error) throw new HttpError(400, error);
  const cols = Object.keys(fields); // fixed whitelist from readPersonInput
  if (!cols.length) throw new HttpError(400, 'Nothing to change.');

  const sets = cols.map((c, i) => `${c} = $${i + 3}`).join(', ');
  const { rows } = await pool.query(
    `update persons set ${sets}, updated_at = now()
      where id = $1 and current_shelter_id = $2 and status = 'sheltered'
      returning *`,
    [id, req.auth.shelterId, ...cols.map((c) => fields[c])],
  );
  if (!rows[0]) throw new HttpError(404, 'That person isn\'t checked in at your shelter.');
  await audit(req.auth, 'person.update', { targetType: 'person', targetId: id, detail: { fields: cols } });

  if (fields.do_not_disclose === true) await declinePendingFor(pool, id);
  if (cols.some((c) => ['name', 'age_min', 'age_max', 'home_area'].includes(c))) {
    await runDuplicateCheck(pool, rows[0]);
    await matchNewPerson(pool, rows[0]);
  }
  res.json(toDetail(rows[0], await shelterNameMap(pool)));
}));

// ---------------------------------------------------------------- transfer in
// The person is standing at my desk but is registered elsewhere (or left
// and came back). Close their open stay and start one here.
router.post('/:id/check-in', ah(async (req, res) => {
  const id = idParam(req);
  const me = req.auth.shelterId;

  const person = await withTransaction(async (db) => {
    const { rows } = await db.query('select * from persons where id = $1 for update', [id]);
    const p = rows[0];
    if (!p) throw new HttpError(404, 'No one with that id.');
    if (p.status === 'merged') throw new HttpError(409, 'This record was merged into another one. Look them up again.');
    if (p.current_shelter_id === me) throw new HttpError(409, 'They\'re already checked in here.');

    const now = new Date().toISOString();
    const history = p.shelter_history.map((s) => (s.left_at ? s : { ...s, left_at: now }));
    history.push({ shelter_id: me, arrived_at: now, left_at: null, staff_id: req.auth.sub });

    const { rows: [updated] } = await db.query(
      `update persons set shelter_history = $2, current_shelter_id = $3, status = 'sheltered', updated_at = now()
        where id = $1 returning *`,
      [id, JSON.stringify(history), me],
    );
    await audit(req.auth, 'person.check_in', { targetType: 'person', targetId: id, detail: { from: p.current_shelter_id } }, db);
    return updated;
  });

  await matchNewPerson(pool, person);
  res.json(toDetail(person, await shelterNameMap(pool)));
}));

// ---------------------------------------------------------------- check out
// Left the shelter system (went to family, a hotel, a hospital...).
router.post('/:id/check-out', ah(async (req, res) => {
  const id = idParam(req);
  const reason = cleanText(req.body.reason, 200);

  await withTransaction(async (db) => {
    const { rows } = await db.query(
      `select * from persons where id = $1 and current_shelter_id = $2 and status = 'sheltered' for update`,
      [id, req.auth.shelterId],
    );
    const p = rows[0];
    if (!p) throw new HttpError(404, 'That person isn\'t checked in at your shelter.');

    const now = new Date().toISOString();
    const history = p.shelter_history.map((s) => (s.left_at ? s : { ...s, left_at: now }));
    await db.query(
      `update persons set shelter_history = $2, current_shelter_id = null, status = 'left', updated_at = now()
        where id = $1`,
      [id, JSON.stringify(history)],
    );
    await audit(req.auth, 'person.check_out', { targetType: 'person', targetId: id, detail: { reason } }, db);
  });

  res.json({ ok: true });
}));

// ---------------------------------------------------------------- searches
// A volunteer searching on behalf of someone here who has no phone.

async function personHere(id, me) {
  const { rows } = await pool.query(
    `select * from persons where id = $1 and current_shelter_id = $2 and status = 'sheltered'`, [id, me]);
  if (!rows[0]) throw new HttpError(404, 'That person isn\'t checked in at your shelter.');
  return rows[0];
}

router.get('/:id/searches', ah(async (req, res) => {
  const p = await personHere(idParam(req), req.auth.shelterId);
  const { rows } = await pool.query(
    'select * from search_requests where requester_person_id = $1 order by created_at desc', [p.id]);
  res.json(await searchViews(pool, rows));
}));

router.post('/:id/searches', ah(async (req, res) => {
  const p = await personHere(idParam(req), req.auth.shelterId);
  const { fields, error } = readSearchInput(req.body);
  if (error) throw new HttpError(400, error);
  const request = await createSearch(pool, { requesterPersonId: p.id, staffId: req.auth.sub }, fields);
  await audit(req.auth, 'search.create', { targetType: 'search_request', targetId: request.id, detail: { for: p.id } });
  res.status(201).json((await searchViews(pool, [request]))[0]);
}));

router.post('/:id/searches/:sid/close', ah(async (req, res) => {
  const p = await personHere(idParam(req), req.auth.shelterId);
  const { rows } = await pool.query(
    `update search_requests set status = 'closed'
      where id = $1 and requester_person_id = $2 and status = 'open' returning *`,
    [Number(req.params.sid), p.id]);
  if (!rows[0]) throw new HttpError(404, 'That search is already closed.');
  await audit(req.auth, 'search.close', { targetType: 'search_request', targetId: rows[0].id });
  res.json((await searchViews(pool, rows))[0]);
}));

export default router;
