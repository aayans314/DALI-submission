// Wipes the database, applies the schema, and loads demo data.
//   npm run db:reset -- --yes
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { newReferenceCode } from '../src/lib/refcode.js';
import { shelters, staff, staffEmail, publicUsers, persons, DEMO_PASSWORD } from '../db/seed-data.js';
import { nameGroups } from '../db/name-groups.js';
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
  for (const u of publicUsers) {
    await client.query(
      'insert into public_users (name, contact, password_hash) values ($1, $2, $3)',
      [u.name, u.contact, hash],
    );
  }

  // Persons
  for (const p of persons) {
    const r = buildPersonRow(p, { shelterIds, staffIds });
    await client.query(
      `insert into persons (name, age_min, age_max, home_area, description, is_minor,
         do_not_disclose, reference_code, current_shelter_id, shelter_history, status,
         created_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
      [r.name, r.age_min, r.age_max, r.home_area, r.description, r.is_minor,
        r.do_not_disclose, newReferenceCode(), r.current_shelter_id,
        JSON.stringify(r.shelter_history), r.status, r.created_by, r.created_at],
    );
  }

  // Nickname groups
  for (const [i, group] of nameGroups.entries()) {
    for (const name of group) {
      await client.query('insert into name_groups (group_id, name) values ($1, $2)', [i + 1, name]);
    }
  }

  await client.query('commit');
  console.log(`Done: ${shelters.length} shelters, ${staff.length} staff, ${publicUsers.length} public users, ${persons.length} persons.`);
  console.log(`All demo accounts use the password "${DEMO_PASSWORD}".`);
} catch (err) {
  await client.query('rollback');
  console.error('Reset failed, nothing was changed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
