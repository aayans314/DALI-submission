// Public users: file and follow their own searches.
import { Router } from 'express';
import { pool } from '../db.js';
import { requirePublic } from '../auth.js';
import { ah, audit, HttpError } from '../lib/util.js';
import { readSearchInput, createSearch, searchViews } from '../lib/searches.js';

const router = Router();
router.use(requirePublic);

// Searching for many people at once is a sign of fishing, not family.
const MAX_OPEN_SEARCHES = 10;

router.get('/', ah(async (req, res) => {
  const { rows } = await pool.query(
    'select * from search_requests where public_user_id = $1 order by created_at desc',
    [req.auth.sub],
  );
  res.json(await searchViews(pool, rows));
}));

router.post('/', ah(async (req, res) => {
  const { fields, error } = readSearchInput(req.body);
  if (error) throw new HttpError(400, error);

  const { rows: [{ open }] } = await pool.query(
    `select count(*)::int as open from search_requests where public_user_id = $1 and status = 'open'`,
    [req.auth.sub],
  );
  if (open >= MAX_OPEN_SEARCHES) {
    throw new HttpError(429, `You have ${open} open searches. Close one you no longer need before adding another.`);
  }

  const request = await createSearch(pool, { publicUserId: req.auth.sub }, fields);
  await audit(req.auth, 'search.create', { targetType: 'search_request', targetId: request.id });
  res.status(201).json((await searchViews(pool, [request]))[0]);
}));

router.post('/:id/close', ah(async (req, res) => {
  const { rows } = await pool.query(
    `update search_requests set status = 'closed'
      where id = $1 and public_user_id = $2 and status = 'open' returning *`,
    [Number(req.params.id), req.auth.sub],
  );
  if (!rows[0]) throw new HttpError(404, 'That search is already closed.');
  await audit(req.auth, 'search.close', { targetType: 'search_request', targetId: rows[0].id });
  res.json((await searchViews(pool, rows))[0]);
}));

export default router;
