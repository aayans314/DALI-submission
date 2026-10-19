import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import { ageText } from '../format.js';
import { PersonSummary } from '../components/PersonRow.jsx';

// What the searcher told us, so the volunteer can check it against the person.
function Seeker({ seeker }) {
  const details = [
    seeker.ageMin != null ? ageText(seeker.ageMin, seeker.ageMax).replace('Age', 'age') : null,
    seeker.homeArea ? `from ${seeker.homeArea}` : null,
  ].filter(Boolean).join(', ');
  return (
    <div className="pair-side">
      <div className="small muted">
        {seeker.viaShelter ? 'Searching from another shelter' : 'Searching from their own phone'}
      </div>
      <div className="person-name">{seeker.name}</div>
      <div>
        {seeker.relationship ? `${seeker.relationship}, looking for ` : 'Looking for '}
        <strong>{seeker.names.join(', ')}</strong>
        {details ? `, ${details}` : ''}.
      </div>
      {seeker.description && <div className="person-desc">“{seeker.description}”</div>}
    </div>
  );
}

function Outcome({ m }) {
  if (m.status === 'accepted') {
    return (
      <div className="notice success" role="status">
        <strong>Connected.</strong> Tell {m.person.name} how to reach {m.seeker.name}: {m.seeker.contact}.
      </div>
    );
  }
  if (m.status === 'pending_authority') {
    return <div className="notice" role="status">They're under 18, so this goes to your coordinator before anything is shared.</div>;
  }
  return <div className="notice" role="status">Done. {m.seeker.name} won't be told anything about {m.person.name}.</div>;
}

export default function Matches() {
  const { user } = useSession();
  const [data, setData] = useState(null);
  const [done, setDone] = useState({}); // match id -> result after a decision
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api('/api/matches').then(setData).catch((err) => setError(err.message)); }, []);

  async function act(m, path, body) {
    setBusy(true); setError('');
    try {
      const result = await api(`/api/matches/${m.id}/${path}`, { method: 'POST', body });
      setDone({ ...done, [m.id]: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <main className="page">{error ? <div className="error" role="alert">{error}</div> : <p className="muted">Loading…</p>}</main>;
  }

  const nothing = !data.toAsk.length && !data.toApprove.length && !data.found.length;

  return (
    <main className="page stack">
      <h1>Matches</h1>
      {error && <div className="error" role="alert">{error}</div>}
      {nothing && <p>Nothing to do right now. New matches show up here as searches come in.</p>}

      {data.toApprove.length > 0 && (
        <section className="section stack">
          <h2>Needs your approval</h2>
          <p className="muted">
            These are minors, and they said yes. Before approving, check that the person searching is who they say
            they are, the way your shelter normally would.
          </p>
          {data.toApprove.map((m) => (
            <div key={m.id} className="stack">
              <div className="pair">
                <Seeker seeker={m.seeker} />
                <div className="pair-side"><div className="small muted">Here</div><PersonSummary person={m.person} showDescription /></div>
              </div>
              {done[m.id] ? <Outcome m={done[m.id]} /> : (
                <div className="row">
                  <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => act(m, 'approve', { approve: true })}>Approve</button>
                  <button className="btn btn-quiet" style={{ flex: 1 }} disabled={busy} onClick={() => act(m, 'approve', { approve: false })}>Don't share</button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {data.toAsk.length > 0 && (
        <section className="section stack">
          <h2>Ask about a match</h2>
          <p className="muted">
            Someone may be looking for a person here. Find them, check the details, and ask if they want to connect.
            If they say no, the searcher is never told.
          </p>
          {data.toAsk.map((m) => (
            <div key={m.id} className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
              <div className="pair">
                <Seeker seeker={m.seeker} />
                <div className="pair-side">
                  <div className="small muted">Could be this person here</div>
                  <PersonSummary person={m.person} showDescription />
                  <Link to={`/staff/people/${m.person.id}`} className="small">Open their record</Link>
                </div>
              </div>
              {done[m.id] ? <Outcome m={done[m.id]} /> : (
                <div className="stack">
                  <button className="btn btn-block" disabled={busy} onClick={() => act(m, 'decision', { decision: 'yes' })}>
                    They want to connect
                  </button>
                  <div className="row">
                    <button className="btn btn-quiet" style={{ flex: 1 }} disabled={busy} onClick={() => act(m, 'decision', { decision: 'no' })}>
                      They said no
                    </button>
                    <button className="btn btn-quiet" style={{ flex: 1 }} disabled={busy} onClick={() => act(m, 'decision', { decision: 'not_them' })}>
                      Not the same person
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {data.found.length > 0 && (
        <section className="section stack">
          <h2>Found for people here</h2>
          {data.found.map((m) => (
            <div key={m.id} className="notice success">
              <strong>{m.person.name} agreed to connect with {m.seeker.name}.</strong> They're at {m.foundAt}.{' '}
              <Link to={`/staff/people/${m.requesterPersonId}`}>Open {m.seeker.name}'s record</Link>
            </div>
          ))}
        </section>
      )}

      <Link to="/staff">Back to people here</Link>
      {user.role !== 'authority' && <p className="small muted">Matches involving minors go to your coordinator after you ask.</p>}
    </main>
  );
}
