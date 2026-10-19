// Turns search requests into matches for a volunteer to ask about.
// Runs both ways: when a search is filed (against everyone sheltered), and
// when a person is registered or changes (against every open search), so a
// search keeps working as new people arrive.
import { normalizeName, scoreCandidate, MATCH_MIN } from './names.js';
import { findCandidates } from './persons.js';

const MAX_MATCHES_PER_SEARCH = 5; // don't flood volunteers with weak candidates

// A private person's matches are declined on the spot: no volunteer is ever
// asked, and the searcher sees the same "no confirmed match yet" as always.
async function insertMatch(db, requestId, person, score) {
  await db.query(
    `insert into matches (request_id, person_id, score, status) values ($1, $2, $3, $4)
     on conflict (request_id, person_id) do nothing`,
    [requestId, person.id, score, person.do_not_disclose ? 'declined' : 'pending_volunteer'],
  );
}

export async function matchRequest(db, request) {
  const candidates = await findCandidates(db, {
    names: request.names, ageMin: request.age_min, ageMax: request.age_max, homeArea: request.home_area,
  }, { excludeId: request.requester_person_id });

  const picks = candidates
    .filter((c) => c.score >= MATCH_MIN && c.person.status === 'sheltered')
    .slice(0, MAX_MATCHES_PER_SEARCH);
  for (const c of picks) await insertMatch(db, request.id, c.person, c.score);
}

export async function matchNewPerson(db, person) {
  if (person.status !== 'sheltered') return;
  const { rows } = await db.query(
    `select * from search_requests
      where status = 'open' and requester_person_id is distinct from $1`,
    [person.id],
  );
  for (const r of rows) {
    const { score } = scoreCandidate({
      names: r.names.map(normalizeName), ageMin: r.age_min, ageMax: r.age_max, homeArea: r.home_area,
    }, person);
    if (score >= MATCH_MIN) await insertMatch(db, r.id, person, score);
  }
}

// Someone just asked to be private: withdraw anything still waiting on them.
export async function declinePendingFor(db, personId) {
  await db.query(
    `update matches set status = 'declined', updated_at = now()
      where person_id = $1 and status in ('pending_volunteer', 'pending_person', 'pending_authority')`,
    [personId],
  );
}
