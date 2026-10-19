// Validates seed data without touching a database.  npm run seed:check
import { shelters, staff, persons, publicUsers } from '../db/seed-data.js';
import { nameGroups } from '../db/name-groups.js';
import { validateSeed, buildPersonRow } from '../db/build-seed.js';

const errors = validateSeed({ shelters, staff, persons });
if (errors.length) {
  console.error('Seed data has problems:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

// Fake ids just to exercise the row builder.
const shelterIds = Object.fromEntries(shelters.map((s, i) => [s.code, i + 1]));
const staffIds = Object.fromEntries(staff.map((s, i) => [s.key, i + 1]));
const rows = persons.map((p) => buildPersonRow(p, { shelterIds, staffIds }));

const count = (fn) => rows.filter(fn).length;
console.log('Seed data OK');
console.log(`  shelters:      ${shelters.length}`);
console.log(`  staff:         ${staff.length} (${staff.filter((s) => s.role === 'authority').length} authorities)`);
console.log(`  public users:  ${publicUsers.length}`);
console.log(`  persons:       ${rows.length}`);
console.log(`    minors:          ${count((r) => r.is_minor)}`);
console.log(`    do not disclose: ${count((r) => r.do_not_disclose)}`);
console.log(`    moved shelters:  ${count((r) => r.shelter_history.length > 1)}`);
console.log(`    left system:     ${count((r) => r.status === 'left')}`);
console.log(`    no age given:    ${count((r) => r.age_min == null)}`);
console.log(`  name groups:   ${nameGroups.length}`);
