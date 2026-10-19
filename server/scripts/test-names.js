// Tests for the in-house matcher. No database needed.  npm test
import assert from 'node:assert/strict';
import { persons } from '../db/seed-data.js';
import {
  normalizeName, nysiis, jaroWinkler, nameSimilarity, scoreCandidate, nameIndex,
  mergeHistories, DUPLICATE_MIN, LOOKUP_MIN,
} from '../src/lib/names.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; } catch (err) { console.error(`FAIL ${name}\n  ${err.message}`); process.exitCode = 1; }
};

test('normalize', () => {
  assert.equal(normalizeName("  Margaret O'Neill "), 'margaret oneill');
  assert.equal(normalizeName('José Hernández'), 'jose hernandez');
  assert.equal(normalizeName('JOSE HERNANDEZ'), 'jose hernandez');
  assert.equal(normalizeName('Garcia-Lopez'), 'garcia lopez');
});

test('nysiis sound-alikes', () => {
  assert.equal(nysiis('pierce'), nysiis('peirce'));
  assert.equal(nysiis('john'), nysiis('jhon'));
  assert.equal(nysiis('john'), 'JAN');
  assert.notEqual(nysiis('johnson'), nysiis('okafor'));
});

test('jaro-winkler', () => {
  assert.ok(jaroWinkler('ramires', 'ramirez') > 0.9);
  assert.ok(jaroWinkler('martha', 'marhta') > 0.95);
  assert.ok(jaroWinkler('smith', 'okafor') < 0.6);
});

const sim = (a, b) => nameSimilarity(normalizeName(a), normalizeName(b));
test('name similarity', () => {
  assert.ok(sim('Lucas Ramirez', 'Lucas Ramires') > 0.9);
  assert.ok(sim('Rajesh Shah', 'Raj Sha') > 0.85, 'nickname + typo');
  assert.ok(sim('Margaret ONeill', 'Peggy Oneil') > 0.85, 'nickname + spelling');
  assert.ok(sim('Shah Raj', 'Raj Shah') === 1, 'order-insensitive');
  assert.ok(sim('Maria', 'Maria Lopez') < 0.75, 'one shared first name is weak');
  assert.equal(sim('Unknown', 'Unknown'), 0, 'placeholders never match');
  assert.ok(sim('Michael Johnson', 'Grace Okafor') < 0.2);
});

test('index keys catch nickname and phonetic matches', () => {
  const overlap = (a, b) => nameIndex(a).keys.some((k) => nameIndex(b).keys.includes(k));
  assert.ok(overlap('Peggy', "Margaret O'Neill"));
  assert.ok(overlap('Jon Peirce', 'Jonathan Pierce'));
  assert.ok(overlap('Rajesh Shah', 'Raj Sha'));
  assert.deepEqual(nameIndex('Unknown').keys, []);
});

// Run the duplicate check over every pair in the seed, exactly like the
// server does, and make sure only the planted duplicates get flagged.
test('seed duplicates: finds the planted ones, nothing else', () => {
  const rows = persons.map((p) => ({
    name: p.name, name_norm: normalizeName(p.name),
    age_min: p.age?.[0] ?? null, age_max: p.age?.[1] ?? null, home_area: p.home ?? null,
  }));
  const flagged = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const { score } = scoreCandidate(
        { names: [a.name_norm], ageMin: a.age_min, ageMax: a.age_max, homeArea: a.home_area }, b);
      if (score >= DUPLICATE_MIN) flagged.push(`${a.name} / ${b.name} (${score})`);
    }
  }
  const expected = ["Margaret O'Neill / Peggy Oneil", 'Jonathan Pierce / Jon Peirce', 'JOSE HERNANDEZ / José Hernández'];
  for (const e of expected) assert.ok(flagged.some((f) => f.startsWith(e)), `missing ${e}; got ${flagged.join(', ')}`);
  assert.equal(flagged.length, expected.length, `unexpected flags: ${flagged.join(', ')}`);
  console.log('  duplicate pairs:', flagged.join('; '));
});

test('two different Michael Johnsons are not duplicates', () => {
  const { score } = scoreCandidate(
    { names: ['michael johnson'], ageMin: 22, ageMax: 25, homeArea: 'Grant Ave' },
    { name_norm: 'michael johnson', age_min: 60, age_max: 65, home_area: 'Ridge Rd' });
  assert.ok(score < DUPLICATE_MIN, `score ${score}`);
});

test('a volunteer lookup with just a name still finds people', () => {
  const { score } = scoreCandidate({ names: ['peggy oneill'] },
    { name_norm: 'margaret oneill', age_min: 78, age_max: 82, home_area: null });
  assert.ok(score >= LOOKUP_MIN, `score ${score}`);
});

test('merge histories: transfer recorded twice', () => {
  // Margaret (Riverside -> Fairgrounds) + Peggy (Fairgrounds, opened an hour later)
  const h = (hrs) => new Date(Date.UTC(2026, 9, 18) - hrs * 3600e3).toISOString();
  const r = mergeHistories(
    [{ shelter_id: 2, arrived_at: h(112), left_at: h(95) }, { shelter_id: 4, arrived_at: h(95), left_at: null }],
    [{ shelter_id: 4, arrived_at: h(94), left_at: null }],
  );
  assert.equal(r.history.length, 2);
  assert.deepEqual(r.history.map((s) => s.shelter_id), [2, 4]);
  assert.equal(r.currentShelterId, 4);
  assert.equal(r.status, 'sheltered');
});

test('merge histories: walked to another shelter without being moved', () => {
  // Jonathan (Riverside, never closed) + Jon (St. Brendan's, later)
  const h = (hrs) => new Date(Date.UTC(2026, 9, 18) - hrs * 3600e3).toISOString();
  const r = mergeHistories(
    [{ shelter_id: 2, arrived_at: h(108), left_at: null }],
    [{ shelter_id: 3, arrived_at: h(60), left_at: null }],
  );
  assert.equal(r.history[0].left_at, h(60), 'old stay closed when the new one began');
  assert.equal(r.currentShelterId, 3);
});

console.log(`${passed} tests passed`);
