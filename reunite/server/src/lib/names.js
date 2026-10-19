// In-house name matching. Nothing here calls an outside service: names of
// people in shelters never leave our server and database.
//
// Pieces:
//   normalizeName   "José O'Neill-Hernández" -> "jose oneill hernandez"
//   nysiis          phonetic key designed for matching names in records
//                   ("Pierce" and "Peirce" -> PARC)
//   jaroWinkler     typo tolerance ("Ramires" vs "Ramirez" -> 0.97)
//   nickname groups "Peggy" ~ "Margaret", "Raj" ~ "Rajesh"
//   scoreCandidate  combines name, age range and home area into 0-100

import { nameGroups } from '../../db/name-groups.js';

// Score thresholds (0-100).
export const LOOKUP_MIN = 45;     // show in a volunteer's "already registered?" lookup
export const DUPLICATE_MIN = 75;  // flag two records as a likely duplicate
export const MATCH_MIN = 60;      // send a search match to a volunteer to ask about

// ---------------------------------------------------------------- normalize

export function normalizeName(raw) {
  const s = String(raw ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/['’`]/g, '')                           // o'neill -> oneill
    .replace(/[^a-z]+/g, ' ')                        // hyphens, digits, punctuation -> space
    .trim();
  // Names in non-Latin scripts would normalize to nothing; keep them as typed.
  return s || String(raw ?? '').trim().toLowerCase();
}

const tokens = (norm) => norm.split(' ').filter(Boolean);

const PLACEHOLDERS = new Set(['unknown', 'unk', 'none', 'na', 'noname', 'anon', 'anonymous']);
const isPlaceholder = (toks) => toks.length === 0 || toks.every((t) => PLACEHOLDERS.has(t));

// ---------------------------------------------------------------- nicknames

const groupsByName = new Map();
nameGroups.forEach((group, i) => {
  for (const n of group) {
    if (!groupsByName.has(n)) groupsByName.set(n, new Set());
    groupsByName.get(n).add(i + 1);
  }
});

function sameNicknameGroup(a, b) {
  const ga = groupsByName.get(a);
  const gb = groupsByName.get(b);
  if (!ga || !gb) return false;
  for (const g of ga) if (gb.has(g)) return true;
  return false;
}

// ---------------------------------------------------------------- NYSIIS

const VOWELS = 'AEIOU';
const isVowel = (c) => c !== undefined && VOWELS.includes(c);

export function nysiis(word) {
  let w = String(word).toUpperCase().replace(/[^A-Z]/g, '');
  if (!w) return '';

  if (w.startsWith('MAC')) w = 'MCC' + w.slice(3);
  else if (w.startsWith('KN')) w = 'NN' + w.slice(2);
  else if (w.startsWith('K')) w = 'C' + w.slice(1);
  else if (w.startsWith('PH') || w.startsWith('PF')) w = 'FF' + w.slice(2);
  else if (w.startsWith('SCH')) w = 'SSS' + w.slice(3);

  if (w.endsWith('EE') || w.endsWith('IE')) w = w.slice(0, -2) + 'Y';
  else if (/(DT|RT|RD|NT|ND)$/.test(w)) w = w.slice(0, -2) + 'D';

  const n = w.split('');
  let key = n[0];

  for (let i = 1; i < n.length; i++) {
    const c = n[i];
    if (isVowel(c)) {
      if (c === 'E' && n[i + 1] === 'V') { n[i] = 'A'; n[i + 1] = 'F'; }
      else n[i] = 'A';
    } else if (c === 'Q') n[i] = 'G';
    else if (c === 'Z') n[i] = 'S';
    else if (c === 'M') n[i] = 'N';
    else if (c === 'K') n[i] = n[i + 1] === 'N' ? 'N' : 'C';
    else if (c === 'S' && n[i + 1] === 'C' && n[i + 2] === 'H') { n[i + 1] = 'S'; n[i + 2] = 'S'; }
    else if (c === 'P' && n[i + 1] === 'H') { n[i] = 'F'; n[i + 1] = 'F'; }
    else if (c === 'H' && (!isVowel(n[i - 1]) || !isVowel(n[i + 1]))) n[i] = n[i - 1];
    else if (c === 'W' && isVowel(n[i - 1])) n[i] = n[i - 1];

    if (n[i] !== key[key.length - 1]) key += n[i];
  }

  if (key.length > 1 && key.endsWith('S')) key = key.slice(0, -1);
  if (key.endsWith('AY')) key = key.slice(0, -2) + 'Y';
  if (key.length > 1 && key.endsWith('A')) key = key.slice(0, -1);
  return key;
}

// ---------------------------------------------------------------- Jaro-Winkler

export function jaroWinkler(a, b) {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;

  const range = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aHit = new Array(la).fill(false);
  const bHit = new Array(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const lo = Math.max(0, i - range);
    const hi = Math.min(i + range + 1, lb);
    for (let j = lo; j < hi; j++) {
      if (!bHit[j] && a[i] === b[j]) { aHit[i] = bHit[j] = true; matches++; break; }
    }
  }
  if (!matches) return 0;

  let transpositions = 0;
  for (let i = 0, k = 0; i < la; i++) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / la + matches / lb + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  while (prefix < Math.min(4, la, lb) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

// ---------------------------------------------------------------- similarity

// One-letter phonetic keys ("Sha" -> S) match far too much, so ignore them.
const usefulKey = (k) => k.length >= 2;

export function tokenSimilarity(x, y) {
  if (x === y) return 1;
  if (sameNicknameGroup(x, y)) return 0.9;
  let s = 0;
  const jw = jaroWinkler(x, y);
  if (jw >= 0.85) s = jw * 0.95;
  const kx = nysiis(x);
  if (usefulKey(kx) && kx === nysiis(y)) s = Math.max(s, 0.85);
  if ((x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y))) s = Math.max(s, 0.6);
  return s;
}

// 0..1. Order-insensitive ("Shah Raj" == "Raj Shah"). If one name has fewer
// parts ("Maria" vs "Maria Lopez"), the score is discounted because a single
// shared first name is weak evidence.
export function nameSimilarity(normA, normB) {
  const ta = tokens(normA);
  const tb = tokens(normB);
  if (isPlaceholder(ta) || isPlaceholder(tb)) return 0;

  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Set();
  let total = 0;
  for (const s of short) {
    let best = 0;
    let bestJ = -1;
    long.forEach((l, j) => {
      if (used.has(j)) return;
      const v = tokenSimilarity(s, l);
      if (v > best) { best = v; bestJ = j; }
    });
    if (bestJ >= 0) used.add(bestJ);
    total += best;
  }
  let score = total / short.length;
  if (short.length < long.length) score *= short.length === 1 ? 0.7 : 0.9;
  return score;
}

const AREA_STOPWORDS = new Set(['st', 'street', 'rd', 'road', 'ave', 'avenue', 'ln', 'lane',
  'dr', 'drive', 'blvd', 'ct', 'court', 'the', 'of', 'and']);

// 0..1, or null if either side is missing. Containment, so "Seabreeze"
// fully matches "Seabreeze Nursing Home, Port Willet".
export function areaSimilarity(a, b) {
  if (!a || !b) return null;
  const ta = tokens(normalizeName(a)).filter((t) => !AREA_STOPWORDS.has(t));
  const tb = tokens(normalizeName(b)).filter((t) => !AREA_STOPWORDS.has(t));
  if (!ta.length || !tb.length) return null;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const hits = short.filter((s) => long.some((l) => s === l || jaroWinkler(s, l) >= 0.9)).length;
  return hits / short.length;
}

// Years between two age ranges (0 if they overlap), or null if unknown.
export function ageGap(a, b) {
  if (a.ageMin == null || a.ageMax == null || b.ageMin == null || b.ageMax == null) return null;
  return Math.max(0, a.ageMin - b.ageMax, b.ageMin - a.ageMax);
}

// query:  { names: [normalized...], ageMin, ageMax, homeArea }
// person: a persons row (needs name_norm, age_min, age_max, home_area)
export function scoreCandidate(query, person) {
  const name = Math.max(0, ...query.names.map((n) => nameSimilarity(n, person.name_norm)));
  let score = name * 70;

  const gap = ageGap(query, { ageMin: person.age_min, ageMax: person.age_max });
  if (gap === null) score += 5;
  else if (gap === 0) score += 20;
  else if (gap <= 2) score += 10;
  else if (gap > 5) score -= 30; // ages clearly don't fit: strong evidence it's someone else

  const area = areaSimilarity(query.homeArea, person.home_area);
  score += area === null ? 3 : area * 10;

  return { score: Math.round(Math.max(0, Math.min(100, score))), nameScore: name, ageGap: gap };
}

// ---------------------------------------------------------------- index keys

// Stored on each person so the database can cheaply pre-filter candidates
// before we score them here:
//   p:XXXX  phonetic key of each name part
//   g:N     nickname group of each name part
export function nameIndex(raw) {
  const norm = normalizeName(raw);
  const toks = tokens(norm);
  const keys = new Set();
  if (!isPlaceholder(toks)) {
    for (const t of toks) {
      const k = nysiis(t);
      if (usefulKey(k)) keys.add(`p:${k}`);
      for (const g of groupsByName.get(t) ?? []) keys.add(`g:${g}`);
    }
  }
  return { norm, keys: [...keys] };
}

// ---------------------------------------------------------------- merging

// Combine two shelter histories into one chain. Overlapping stays are
// closed when the next one starts; back-to-back stays at the same shelter
// become one stay.
export function mergeHistories(h1, h2) {
  const t = (iso) => new Date(iso).getTime();
  const all = [...h1, ...h2].map((s) => ({ ...s })).sort((x, y) => t(x.arrived_at) - t(y.arrived_at));
  const out = [];
  for (const s of all) {
    const prev = out[out.length - 1];
    const overlaps = prev && (prev.left_at === null || t(prev.left_at) >= t(s.arrived_at));
    if (prev && overlaps && prev.shelter_id === s.shelter_id) {
      prev.left_at = prev.left_at === null || s.left_at === null
        ? null
        : new Date(Math.max(t(prev.left_at), t(s.left_at))).toISOString();
      continue;
    }
    if (prev && overlaps) prev.left_at = s.arrived_at;
    out.push(s);
  }
  const last = out[out.length - 1];
  const open = last && last.left_at === null;
  return { history: out, currentShelterId: open ? last.shelter_id : null, status: open ? 'sheltered' : 'left' };
}
