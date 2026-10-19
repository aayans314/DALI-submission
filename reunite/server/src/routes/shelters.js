import { Router } from 'express';
import { query } from '../db.js';
import { ah } from '../lib/util.js';

const router = Router();

// Shelter names and addresses are public information during an evacuation.
// Nothing about who is at each one is exposed here.
router.get('/', ah(async (_req, res) => {
  const { rows } = await query('select id, name, address from shelters order by name');
  res.json(rows);
}));

export default router;
