import { query } from '../db.js';

// Express 4 doesn't catch rejected promises; wrap async handlers with this.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Record who did what. Pass a transaction client as `db` to log inside it.
export function audit(auth, action, { targetType = null, targetId = null, detail = null } = {}, db = { query }) {
  const staffId = auth?.kind === 'staff' ? auth.sub : null;
  const publicUserId = auth?.kind === 'public' ? auth.sub : null;
  return db.query(
    `insert into audit_log (staff_id, public_user_id, action, target_type, target_id, detail)
     values ($1, $2, $3, $4, $5, $6)`,
    [staffId, publicUserId, action, targetType, targetId, detail && JSON.stringify(detail)],
  );
}

// Small input helpers so routes stay readable.
export const cleanText = (v, max = 200) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

export const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
