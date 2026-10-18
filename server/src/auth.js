import jwt from 'jsonwebtoken';
import { query } from './db.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET is not set.');

// Staff and public users live in different tables, so a token says which
// table its id refers to. A public token can never pass a staff check.
export function signStaffToken(staff) {
  return jwt.sign(
    { kind: 'staff', sub: staff.id, role: staff.role, shelterId: staff.shelter_id },
    SECRET,
    { expiresIn: '12h' }, // about one shift
  );
}

export function signPublicToken(user) {
  return jwt.sign({ kind: 'public', sub: user.id }, SECRET, { expiresIn: '7d' });
}

function readToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// Any logged-in user. Sets req.auth.
export function requireAuth(req, res, next) {
  const auth = readToken(req);
  if (!auth) return res.status(401).json({ error: 'Please log in.' });
  req.auth = auth;
  next();
}

// Staff only, optionally limited to certain roles.
//   requireStaff()               -> volunteer or authority
//   requireStaff('authority')    -> authority only
// Re-checks the staff row on every request, so when an authority
// deactivates a volunteer they're locked out immediately rather than
// when their token expires.
export function requireStaff(...roles) {
  return async (req, res, next) => {
    const auth = readToken(req);
    if (!auth) return res.status(401).json({ error: 'Please log in.' });
    if (auth.kind !== 'staff') return res.status(403).json({ error: 'Shelter staff only.' });
    try {
      const { rows } = await query(
        'select id, role, shelter_id, active from staff where id = $1',
        [auth.sub],
      );
      const staff = rows[0];
      if (!staff || !staff.active) return res.status(401).json({ error: 'This account is no longer active.' });
      if (roles.length && !roles.includes(staff.role)) {
        return res.status(403).json({ error: 'You don\'t have permission to do that.' });
      }
      req.auth = { ...auth, role: staff.role, shelterId: staff.shelter_id };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requirePublic(req, res, next) {
  const auth = readToken(req);
  if (!auth) return res.status(401).json({ error: 'Please log in.' });
  if (auth.kind !== 'public') return res.status(403).json({ error: 'Public accounts only.' });
  req.auth = auth;
  next();
}
