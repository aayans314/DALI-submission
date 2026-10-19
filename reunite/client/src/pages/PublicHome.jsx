import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';
import SearchForm from '../components/SearchForm.jsx';
import SearchCard from '../components/SearchCard.jsx';

export default function PublicHome() {
  const { user } = useSession();
  const [searches, setSearches] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/searches')
      .then((rows) => { setSearches(rows); if (!rows.length) setAdding(true); })
      .catch((err) => setError(err.message));
  }, []);

  async function start(values) {
    setBusy(true); setError('');
    try {
      const s = await api('/api/searches', { method: 'POST', body: values });
      setSearches([s, ...searches]);
      setAdding(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function close(search) {
    setBusy(true); setError('');
    try {
      const s = await api(`/api/searches/${search.id}/close`, { method: 'POST', body: {} });
      setSearches(searches.map((x) => (x.id === s.id ? s : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!searches) {
    return <main className="page">{error ? <div className="error" role="alert">{error}</div> : <p className="muted">Loading…</p>}</main>;
  }

  if (adding) {
    return (
      <main className="page stack">
        <h1>Who are you looking for?</h1>
        <p className="muted">
          We check every shelter now, and again whenever someone new arrives. If we find a likely match, a volunteer
          asks them first. You'll only see a result here if they agree.
        </p>
        <SearchForm busy={busy} error={error} onSubmit={start}
          onCancel={searches.length ? () => { setAdding(false); setError(''); } : undefined} />
      </main>
    );
  }

  return (
    <main className="page stack">
      <h1>Your searches</h1>
      <p className="muted">Hi {user.name}. Check back here, or log in from any phone or computer.</p>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn btn-block" onClick={() => setAdding(true)}>Look for someone else</button>
      <ul className="people">
        {searches.map((s) => <SearchCard key={s.id} search={s} busy={busy} onClose={close} />)}
      </ul>
    </main>
  );
}
