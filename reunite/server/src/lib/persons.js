import { normalizeName, nameIndex, scoreCandidate, DUPLICATE_MIN } from './names.js';

// ---------------------------------------------------------------- candidates

// Pre-filter in the database (phonetic/nickname keys, or trigram similarity
// for typos), then score each candidate here.
export async function findCandidates(db, { names, ageMin = null, ageMax = null, homeArea = null },
  { excludeId = null, limit = 300 } = {}) {
  const norms = [...new Set(names.map(normalizeName).filter(Boolean))];
  if (!norms.length) return [];
  const keys = [...new Set(names.flatMap((n) => nameIndex(n).keys))];

  const { rows } = await db.query(
    `select * from persons
      where status <> 'merged'
        and ($3::int is null or id <> $3)
        and (name_keys && $1::text[] or name_norm % any($2::text[]))
      limit $4`,
    [keys, norms, excludeId, limit],
  );
  const query = { names: norms, ageMin, ageMax, homeArea };
  return rows
    .map((person) => ({ person, ...scoreCandidate(query, person) }))
    .sort((a, b) => b.score - a.score);
}

// Compare one person against everyone else and flag likely duplicates.
// Returns the newly flagged candidates.
export async function runDuplicateCheck(db, person) {
  const candidates = await findCandidates(db, {
    names: [person.name], ageMin: person.age_min, ageMax: person.age_max, homeArea: person.home_area,
  }, { excludeId: person.id });

  const flagged = [];
  for (const c of candidates) {
    if (c.score < DUPLICATE_MIN) break; // sorted by score
    const [a, b] = person.id < c.person.id ? [person.id, c.person.id] : [c.person.id, person.id];
    const { rowCount } = await db.query(
      `insert into duplicate_flags (person_a, person_b, score) values ($1, $2, $3)
       on conflict (person_a, person_b) do nothing`,
      [a, b, c.score],
    );
    if (rowCount) flagged.push(c);
  }
  return flagged;
}

// ---------------------------------------------------------------- views

// What any staff member may see about a person, e.g. in a re-check-in
// lookup or a duplicate review. Never says which shelter they're at;
// only whether they're at *your* shelter.
export function toCard(p, myShelterId) {
  const here = p.current_shelter_id === myShelterId;
  return {
    id: p.id,
    name: p.name,
    ageMin: p.age_min,
    ageMax: p.age_max,
    homeArea: p.home_area,
    description: p.description,
    isMinor: p.is_minor,
    hasPhoto: Boolean(p.photo_path),
    status: p.status,
    here,
    referenceCode: here ? p.reference_code : undefined,
  };
}

// Full record, only for staff at the person's current shelter.
export function toDetail(p, shelterNames) {
  return {
    ...toCard(p, p.current_shelter_id),
    doNotDisclose: p.do_not_disclose,
    referenceCode: p.reference_code,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    history: p.shelter_history.map((s) => ({
      shelterId: s.shelter_id,
      shelterName: shelterNames[s.shelter_id] ?? 'Unknown shelter',
      arrivedAt: s.arrived_at,
      leftAt: s.left_at,
    })),
  };
}

export async function shelterNameMap(db) {
  const { rows } = await db.query('select id, name from shelters');
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

// ---------------------------------------------------------------- input

const intOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 120 ? n : NaN;
};

// Validates person fields from a request body. Returns { fields } or { error }.
// Only keys present in the body are returned, so it works for edits too.
export function readPersonInput(body, { requireName = true } = {}) {
  const out = {};
  if ('name' in body || requireName) {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    if (!name) return { error: 'Enter a name, or "Unknown" if they can\'t give one.' };
    out.name = name;
  }
  if ('ageMin' in body || 'ageMax' in body) {
    let min = intOrNull(body.ageMin);
    let max = intOrNull(body.ageMax);
    if (Number.isNaN(min) || Number.isNaN(max)) return { error: 'Ages must be whole numbers from 0 to 120.' };
    if (min === null) min = max;
    if (max === null) max = min;
    if (min !== null && min > max) [min, max] = [max, min];
    out.age_min = min;
    out.age_max = max;
  }
  for (const [key, col, max] of [['homeArea', 'home_area', 120], ['description', 'description', 500]]) {
    if (key in body) out[col] = typeof body[key] === 'string' && body[key].trim() ? body[key].trim().slice(0, max) : null;
  }
  if ('isMinor' in body) out.is_minor = Boolean(body.isMinor);
  if ('doNotDisclose' in body) out.do_not_disclose = Boolean(body.doNotDisclose);

  // Anyone whose age range is entirely under 18 is a minor, whatever the box says.
  if (out.age_max != null && out.age_max < 18) out.is_minor = true;
  if (out.name) {
    const idx = nameIndex(out.name);
    out.name_norm = idx.norm;
    out.name_keys = idx.keys;
  }
  return { fields: out };
}

// "k7p qx4" / "K7PQX4" -> "K7P-QX4"
export function normalizeReferenceCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 6 ? `${s.slice(0, 3)}-${s.slice(3)}` : null;
}
