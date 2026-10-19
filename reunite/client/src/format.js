export function ageText(min, max) {
  if (min == null && max == null) return 'Age unknown';
  if (min === max || max == null) return `Age ${min}`;
  if (min == null) return `Age ${max}`;
  return `Age ${min}–${max}`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const when = (iso) => (iso ? dateFmt.format(new Date(iso)) : '');
