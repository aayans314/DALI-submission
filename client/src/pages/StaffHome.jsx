import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import PersonRow from '../components/PersonRow.jsx';

export default function StaffHome() {
  const { user } = useSession();
  const [q, setQ] = useState('');
  const [people, setPeople] = useState(null);
  const [dupes, setDupes] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api(`/api/persons${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        .then((rows) => { if (live) { setPeople(rows); setError(''); } })
        .catch((err) => live && setError(err.message));
    }, q ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    api('/api/duplicates').then((rows) => setDupes(rows.length)).catch(() => {});
  }, []);

  return (
    <main className="page stack">
      <Link className="btn btn-block" to="/staff/check-in">Check someone in</Link>

      {dupes > 0 && (
        <Link className="notice notice-link" to="/staff/duplicates">
          <strong>{dupes === 1 ? '1 possible duplicate' : `${dupes} possible duplicates`} to review.</strong>{' '}
          Someone may have been registered twice.
        </Link>
      )}

      <section className="section">
        <div className="spread">
          <h2>People here</h2>
          {people && <span className="muted">{people.length}{people.length === 300 ? '+' : ''}</span>}
        </div>
        <label className="field" style={{ margin: '0.5rem 0 0.75rem' }}>
          <span className="sr-only">Search people here</span>
          <input className="input" type="search" placeholder="Name or reference code" value={q}
            onChange={(e) => setQ(e.target.value)} />
        </label>

        {error && <div className="error" role="alert">{error}</div>}
        {!people && !error && <p className="muted">Loading…</p>}
        {people && people.length === 0 && (
          <p className="muted">
            {q ? 'No one here matches that. They may be at another shelter: try "Check someone in".' : 'No one is checked in here yet.'}
          </p>
        )}
        {people && people.length > 0 && (
          <ul className="people">
            {people.map((p) => <li key={p.id}><PersonRow person={p} /></li>)}
          </ul>
        )}
      </section>

      <section className="section row">
        <Link to="/staff/duplicates">Duplicates</Link>
        {user.role === 'authority' && <Link to="/staff/team">Volunteers</Link>}
      </section>
    </main>
  );
}
