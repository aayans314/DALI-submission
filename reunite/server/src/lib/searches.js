import { cleanText } from './util.js';
import { readPersonInput } from './persons.js';
import { matchRequest } from './matching.js';

// body: { names: [...], relationship, ageMin, ageMax, homeArea, description }
export function readSearchInput(body) {
  const raw = Array.isArray(body.names) ? body.names : [body.names];
  const names = [...new Set(raw.map((n) => (typeof n === 'string' ? n.trim().slice(0, 100) : '')).filter(Boolean))].slice(0, 10);
  if (!names.length) return { error: 'Add at least one name they might go by.' };

  const { fields, error } = readPersonInput({
    name: names[0], ageMin: body.ageMin, ageMax: body.ageMax, homeArea: body.homeArea, description: body.description,
  });
  if (error) return { error };
  return {
    fields: {
      names,
      relationship: cleanText(body.relationship, 60),
      age_min: fields.age_min,
      age_max: fields.age_max,
      home_area: fields.home_area ?? null,
      description: fields.description ?? null,
    },
  };
}

// requester: { publicUserId } or { requesterPersonId, staffId }
export async function createSearch(db, requester, f) {
  const { rows: [request] } = await db.query(
    `insert into search_requests (public_user_id, requester_person_id, filed_by_staff_id,
       relationship, names, age_min, age_max, home_area, description)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
    [requester.publicUserId ?? null, requester.requesterPersonId ?? null, requester.staffId ?? null,
      f.relationship, f.names, f.age_min, f.age_max, f.home_area, f.description],
  );
  await matchRequest(db, request);
  return request;
}

// What the searcher sees. Only accepted matches are ever included, so a
// declined match and no match at all look exactly the same.
export async function searchViews(db, requests) {
  if (!requests.length) return [];
  const { rows } = await db.query(
    `select m.request_id, p.name, s.name as shelter_name, s.address as shelter_address
       from matches m
       join persons p on p.id = m.person_id
       left join shelters s on s.id = p.current_shelter_id
      where m.request_id = any($1::int[]) and m.status = 'accepted'`,
    [requests.map((r) => r.id)],
  );
  return requests.map((r) => ({
    id: r.id,
    names: r.names,
    relationship: r.relationship,
    ageMin: r.age_min,
    ageMax: r.age_max,
    homeArea: r.home_area,
    description: r.description,
    status: r.status,
    createdAt: r.created_at,
    found: rows.filter((m) => m.request_id === r.id)
      .map((m) => ({ name: m.name, shelterName: m.shelter_name, shelterAddress: m.shelter_address })),
  }));
}
