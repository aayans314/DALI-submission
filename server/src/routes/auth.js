import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { signStaffToken, signPublicToken, requireAuth } from '../auth.js';
import { ah, audit, cleanText, isEmail, HttpError } from '../lib/util.js';

const router = Router();

// Slow down password guessing: 10 attempts per IP per 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// Compared against when the account doesn't exist, so a wrong email takes
// as long as a wrong password and doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Email -> lowercase. Phone -> digits only (keeps a leading +).
function normalizeContact(raw) {
  const v = cleanText(raw, 120);
  if (!v) return null;
  if (v.includes('@')) return isEmail(v) ? v.toLowerCase() : null;
  const phone = v.replace(/(?!^\+)[^\d]/g, '');
  const digits = phone.replace('+', '');
  return digits.length >= 7 && digits.length <= 15 ? phone : null;
}

// ---------------------------------------------------------------- staff
router.post('/staff/login', loginLimiter, ah(async (req, res) => {
  const email = cleanText(req.body.email, 120)?.toLowerCase();
  const password = req.body.password;
  if (!email || typeof password !== 'string') throw new HttpError(400, 'Email and password are required.');

  const { rows } = await query(
    `select s.id, s.name, s.role, s.shelter_id, s.password_hash, s.active, sh.name as shelter_name
       from staff s join shelters sh on sh.id = s.shelter_id
      where s.email = $1`,
    [email],
  );
  const staff = rows[0];
  const ok = await bcrypt.compare(password, staff?.password_hash ?? DUMMY_HASH);
  if (!staff || !ok || !staff.active) throw new HttpError(401, 'Wrong email or password.');

  await audit({ kind: 'staff', sub: staff.id }, 'staff.login');
  res.json({
    token: signStaffToken(staff),
    user: { kind: 'staff', id: staff.id, name: staff.name, role: staff.role,
            shelterId: staff.shelter_id, shelterName: staff.shelter_name },
  });
}));

// ---------------------------------------------------------------- public
router.post('/public/register', loginLimiter, ah(async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const contact = normalizeContact(req.body.contact);
  const password = req.body.password;
  if (!name) throw new HttpError(400, 'Please enter your name.');
  if (!contact) throw new HttpError(400, 'Please enter a valid email or phone number.');
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters.');
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `insert into public_users (name, contact, password_hash) values ($1, $2, $3)
     on conflict (contact) do nothing
     returning id, name`,
    [name, contact, hash],
  );
  if (!rows[0]) throw new HttpError(409, 'An account with that email or phone already exists. Try logging in.');

  const user = rows[0];
  await audit({ kind: 'public', sub: user.id }, 'public.register');
  res.status(201).json({
    token: signPublicToken(user),
    user: { kind: 'public', id: user.id, name: user.name },
  });
}));

router.post('/public/login', loginLimiter, ah(async (req, res) => {
  const contact = normalizeContact(req.body.contact);
  const password = req.body.password;
  if (!contact || typeof password !== 'string') throw new HttpError(400, 'Email or phone, and password, are required.');

  const { rows } = await query(
    'select id, name, password_hash from public_users where contact = $1',
    [contact],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Wrong email/phone or password.');

  res.json({
    token: signPublicToken(user),
    user: { kind: 'public', id: user.id, name: user.name },
  });
}));

// ---------------------------------------------------------------- me
router.get('/me', requireAuth, ah(async (req, res) => {
  const { kind, sub } = req.auth;
  if (kind === 'staff') {
    const { rows } = await query(
      `select s.id, s.name, s.role, s.shelter_id, s.active, sh.name as shelter_name
         from staff s join shelters sh on sh.id = s.shelter_id where s.id = $1`,
      [sub],
    );
    const s = rows[0];
    if (!s || !s.active) throw new HttpError(401, 'This account is no longer active.');
    return res.json({ kind, id: s.id, name: s.name, role: s.role, shelterId: s.shelter_id, shelterName: s.shelter_name });
  }
  const { rows } = await query('select id, name, photo_path from public_users where id = $1', [sub]);
  if (!rows[0]) throw new HttpError(401, 'Account not found.');
  res.json({ kind, id: rows[0].id, name: rows[0].name, hasPhoto: Boolean(rows[0].photo_path) });
}));

export default router;
