import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { query } from './db.js';
import authRoutes from './routes/auth.js';
import staffRoutes from './routes/staff.js';
import shelterRoutes from './routes/shelters.js';
import personRoutes from './routes/persons.js';
import duplicateRoutes from './routes/duplicates.js';
import searchRoutes from './routes/searches.js';
import matchRoutes from './routes/matches.js';

const app = express();

// Render sits behind a proxy; needed so rate limiting sees real client IPs.
app.set('trust proxy', 1);

// CLIENT_ORIGIN can be a comma-separated list (local dev + deployed site).
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins }));

// Room for a compressed photo or a photographed paper sheet.
app.use(express.json({ limit: '6mb' }));

// Health check for Render. Doesn't touch the database, so a database
// hiccup doesn't make Render restart the server.
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// The frontend calls this on load to wake the server and the DB connection.
app.get('/api/health/db', async (_req, res) => {
  try {
    await query('select 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/duplicates', duplicateRoutes);
app.use('/api/searches', searchRoutes);
app.use('/api/matches', matchRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That upload is too large. Try a smaller photo.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our end. Please try again.' : err.message });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Reunite API listening on port ${port}`));
