import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireStaff } from '../auth.js';
import { ah, audit, cleanText, isEmail, HttpError } from '../lib/util.js';

const router = Router();
router.use(requireStaff('authority'));

// List staff at the authority's own shelter.
router.get('/', ah(async (req, res) => {
  const { rows } = await query(
    `select id, name, email, role, active, created_at
       from staff where shelter_id = $1 order by role, name`,
    [req.auth.shelterId],
  );
  res.json(rows);
}));

// Create a volunteer at the authority's own shelter.
// Authorities can't create other authorities (assumption: those are
// provisioned by county emergency management).
router.post('/', ah(async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const email = cleanText(req.body.email, 120)?.toLowerCase();
  const password = req.body.password;
  if (!name) throw new HttpError(400, 'Name is required.');
  if (!isEmail(email)) throw new HttpError(400, 'A valid email is required.');
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'Temporary password must be at least 8 characters.');
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `insert into staff (shelter_id, role, name, email, password_hash, created_by)
     values ($1, 'volunteer', $2, $3, $4, $5)
     on conflict (email) do nothing
     returning id, name, email, role, active, created_at`,
    [req.auth.shelterId, name, email, hash, req.auth.sub],
  );
  if (!rows[0]) throw new HttpError(409, 'Someone with that email already has a staff account.');

  await audit(req.auth, 'staff.create', { targetType: 'staff', targetId: rows[0].id });
  res.status(201).json(rows[0]);
}));

// Deactivate a volunteer at the authority's own shelter.
router.post('/:id/deactivate', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Bad staff id.');
  if (id === req.auth.sub) throw new HttpError(400, 'You can\'t deactivate your own account.');

  const { rows } = await query(
    `update staff set active = false
      where id = $1 and shelter_id = $2 and role = 'volunteer'
      returning id, name, active`,
    [id, req.auth.shelterId],
  );
  if (!rows[0]) throw new HttpError(404, 'No volunteer with that id at your shelter.');

  await audit(req.auth, 'staff.deactivate', { targetType: 'staff', targetId: id });
  res.json(rows[0]);
}));

export default router;
