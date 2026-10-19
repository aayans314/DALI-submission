import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';
import { PersonSummary } from '../components/PersonRow.jsx';

export default function Duplicates() {
  const [flags, setFlags] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => api('/api/duplicates').then(setFlags).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  async function scan() {
    setBusy(true); setError(''); setMessage('');
    try {
      const { checked, newFlags } = await api('/api/duplicates/scan', { method: 'POST', body: {} });
      setMessage(`Checked ${checked} ${checked === 1 ? 'person' : 'people'}. ${
        newFlags ? `Found ${newFlags} new possible ${newFlags === 1 ? 'duplicate' : 'duplicates'}.` : 'Nothing new found.'}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(flag, action, keep) {
    setBusy(true); setError(''); setMessage('');
    try {
      if (action === 'merge') {
        await api(`/api/duplicates/${flag.id}/merge`, { method: 'POST', body: { keepId: keep.id } });
        setMessage(`Merged into one record for ${keep.name}.`);
      } else {
        await api(`/api/duplicates/${flag.id}/dismiss`, { method: 'POST', body: {} });
        setMessage('Marked as different people.');
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const side = (flag, person) => (
    <div className="pair-side">
      <PersonSummary person={person} showDescription />
      <div className="small muted" style={{ marginTop: '0.4rem' }}>
        {person.here ? 'Checked in here' : person.status === 'left' ? 'Left the shelters' : 'At another shelter'}
      </div>
      <button className="btn" disabled={busy} onClick={() => resolve(flag, 'merge', person)}>Keep this record</button>
    </div>
  );

  return (
    <main className="page stack">
      <h1>Possible duplicates</h1>
      <p className="muted">
        The same person can get registered twice, at two shelters or by two volunteers. Merging keeps one record and
        combines where they've been.
      </p>
      <button className="btn btn-quiet btn-block" disabled={busy} onClick={scan}>
        {busy ? 'Checking…' : 'Check everyone here for duplicates'}
      </button>

      {message && <div className="notice success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}
      {!flags && !error && <p className="muted">Loading…</p>}
      {flags && flags.length === 0 && <p>Nothing to review right now.</p>}

      {flags && flags.map((f) => (
        <section key={f.id} className="section stack">
          <div className="pair">
            {side(f, f.a)}
            {side(f, f.b)}
          </div>
          <button className="btn btn-quiet btn-block" disabled={busy} onClick={() => resolve(f, 'dismiss')}>
            These are different people
          </button>
        </section>
      ))}

      <Link to="/staff">Back to people here</Link>
    </main>
  );
}
