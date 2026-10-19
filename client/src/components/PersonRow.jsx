import { Link } from 'react-router';
import { ageText } from '../format.js';

export function Badges({ person }) {
  if (!person.isMinor && !person.doNotDisclose && person.status !== 'left') return null;
  return (
    <span className="badges">
      {person.isMinor && <span className="badge badge-minor">Minor</span>}
      {person.doNotDisclose && <span className="badge badge-private">Private</span>}
      {person.status === 'left' && <span className="badge">Left shelters</span>}
    </span>
  );
}

export function PersonSummary({ person, showDescription = false }) {
  return (
    <>
      <div>
        <span className="person-name">{person.name}</span>
        <Badges person={person} />
      </div>
      <div className="person-meta">
        {ageText(person.ageMin, person.ageMax)}
        {person.homeArea ? `, from ${person.homeArea}` : ''}
      </div>
      {showDescription && person.description && <div className="person-desc">{person.description}</div>}
    </>
  );
}

export default function PersonRow({ person }) {
  return (
    <Link className="person-row" to={`/staff/people/${person.id}`}>
      <PersonSummary person={person} />
    </Link>
  );
}
