// Pure helpers for the seed: no database access, so they can be checked
// on their own with `npm run seed:check`.

const HOUR = 60 * 60 * 1000;

export function validateSeed({ shelters, staff, persons }) {
  const errors = [];
  const shelterCodes = new Set(shelters.map((s) => s.code));
  const staffByKey = new Map();

  staff.forEach((s) => {
    if (!shelterCodes.has(s.shelter)) errors.push(`staff ${s.key}: unknown shelter ${s.shelter}`);
    if (s.createdBy) {
      const creator = staffByKey.get(s.createdBy);
      if (!creator) errors.push(`staff ${s.key}: createdBy ${s.createdBy} missing or listed later`);
      else if (creator.role !== 'authority') errors.push(`staff ${s.key}: created by a non-authority`);
      else if (creator.shelter !== s.shelter) errors.push(`staff ${s.key}: created by another shelter's authority`);
    }
    staffByKey.set(s.key, s);
  });

  persons.forEach((p, i) => {
    const label = `person #${i + 1} (${p.name})`;
    if (!p.history?.length) errors.push(`${label}: empty history`);
    if (p.age && p.age[0] > p.age[1]) errors.push(`${label}: age_min > age_max`);

    p.history.forEach((h, j) => {
      if (!shelterCodes.has(h.at)) errors.push(`${label}: unknown shelter ${h.at}`);
      const by = staffByKey.get(h.by);
      if (!by) errors.push(`${label}: unknown staff ${h.by}`);
      else if (by.shelter !== h.at) errors.push(`${label}: ${h.by} doesn't work at ${h.at}`);
      if (h.left != null && h.left >= h.arrived) errors.push(`${label}: left before arriving`);
      const next = p.history[j + 1];
      if (next) {
        if (h.left == null) errors.push(`${label}: stay ${j + 1} never ended but has a later stay`);
        else if (next.arrived > h.left) errors.push(`${label}: stay ${j + 2} starts before stay ${j + 1} ends`);
      }
    });

    const last = p.history[p.history.length - 1];
    if (p.status === 'left' && last.left == null) errors.push(`${label}: status left but last stay is open`);
    if (p.status !== 'left' && last.left != null) errors.push(`${label}: still sheltered but last stay is closed`);
  });

  return errors;
}

// Turn one seed person into a row for the persons table.
export function buildPersonRow(p, { shelterIds, staffIds, now = Date.now() }) {
  const iso = (hoursAgo) => (hoursAgo == null ? null : new Date(now - hoursAgo * HOUR).toISOString());
  const last = p.history[p.history.length - 1];
  const left = p.status === 'left';

  return {
    name: p.name,
    age_min: p.age ? p.age[0] : null,
    age_max: p.age ? p.age[1] : null,
    home_area: p.home ?? null,
    description: p.desc ?? null,
    is_minor: Boolean(p.minor),
    do_not_disclose: Boolean(p.doNotDisclose),
    current_shelter_id: left ? null : shelterIds[last.at],
    status: left ? 'left' : 'sheltered',
    created_by: staffIds[p.history[0].by],
    created_at: iso(p.history[0].arrived),
    shelter_history: p.history.map((h) => ({
      shelter_id: shelterIds[h.at],
      arrived_at: iso(h.arrived),
      left_at: iso(h.left),
      staff_id: staffIds[h.by],
    })),
  };
}
