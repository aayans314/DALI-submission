// Wipes the database, applies the schema, and loads demo data.
//   npm run db:reset -- --yes
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { newReferenceCode } from '../src/lib/refcode.js';
import { shelters, staff, staffEmail, publicUsers, persons, searchRequests, DEMO_PASSWORD } from '../db/seed-data.js';
import { runDuplicateCheck } from '../src/lib/persons.js';
import { createSearch } from '../src/lib/searches.js';
import { nameIndex } from '../src/lib/names.js';
import { validateSeed, buildPersonRow } from '../db/build-seed.js';

if (!process.argv.includes('--yes')) {
  console.log('This deletes ALL data in the database at DATABASE_URL.');
  console.log('Re-run with:  npm run db:reset -- --yes');
  process.exit(0);
}

const errors = validateSeed({ shelters, staff, persons });
if (errors.length) {
  console.error('Seed data has problems, nothing was changed:\n' + errors.join('\n'));
  process.exit(1);
}

const sql = (file) => readFile(new URL(`../db/${file}`, import.meta.url), 'utf8');

const client = await pool.connect();
try {
  await client.query('begin');
  await client.query(await sql('reset.sql'));
  await client.query(await sql('schema.sql'));

  // Shelters
  const shelterIds = {};
  for (const s of shelters) {
    const { rows } = await client.query(
      'insert into shelters (code, name, address, capacity) values ($1, $2, $3, $4) returning id',
      [s.code, s.name, s.address, s.capacity],
    );
    shelterIds[s.code] = rows[0].id;
  }

  // Staff (one hash reused: bcrypt is deliberately slow)
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const staffIds = {};
  for (const s of staff) {
    const { rows } = await client.query(
      `insert into staff (shelter_id, role, name, email, password_hash, created_by)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [shelterIds[s.shelter], s.role, s.name, staffEmail(s.key), hash, s.createdBy ? staffIds[s.createdBy] : null],
    );
    staffIds[s.key] = rows[0].id;
  }

  // Public users
  const publicIds = {};
  for (const u of publicUsers) {
    const { rows } = await client.query(
      'insert into public_users (name, contact, password_hash) values ($1, $2, $3) returning id',
      [u.name, u.contact, hash],
    );
    publicIds[u.contact] = rows[0].id;
  }

  // Persons
  for (const p of persons) {
    const r = buildPersonRow(p, { shelterIds, staffIds });
    const idx = nameIndex(r.name);
    await client.query(
      `insert into persons (name, name_norm, name_keys, age_min, age_max, home_area, description,
         is_minor, do_not_disclose, reference_code, current_shelter_id, shelter_history, status,
         created_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
      [r.name, idx.norm, idx.keys, r.age_min, r.age_max, r.home_area, r.description,
        r.is_minor, r.do_not_disclose, newReferenceCode(), r.current_shelter_id,
        JSON.stringify(r.shelter_history), r.status, r.created_by, r.created_at],
    );
  }

  // Flag the planted duplicates so the review screen has something in it.
  const { rows: everyone } = await client.query(`select * from persons where status = 'sheltered' order by id`);
  let flags = 0;
  for (const p of everyone) flags += (await runDuplicateCheck(client, p)).length;

  // File the pre-made searches, which also creates their matches.
  for (const r of searchRequests) {
    const requester = r.by
      ? { publicUserId: publicIds[r.by] }
      : { requesterPersonId: everyone.find((p) => p.name === r.forPerson).id, staffId: staffIds[r.filedBy] };
    await createSearch(client, requester, {
      names: r.names, relationship: r.relationship, age_min: r.age[0], age_max: r.age[1],
      home_area: r.home ?? null, description: r.desc ?? null,
    });
  }
  const { rows: [m] } = await client.query(
    `select count(*) filter (where status = 'pending_volunteer')::int as pending,
            count(*) filter (where status = 'declined')::int as declined from matches`);

  await client.query('commit');
  console.log(`Done: ${shelters.length} shelters, ${staff.length} staff, ${publicUsers.length} public users, ${persons.length} persons.`);
  console.log(`All demo accounts use the password "${DEMO_PASSWORD}".`);
  console.log(`Flagged ${flags} likely duplicates. Filed ${searchRequests.length} searches: ${m.pending} matches waiting for a volunteer, ${m.declined} declined because the person is private.`);
} catch (err) {
  await client.query('rollback');
  console.error('Reset failed, nothing was changed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
