import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api.js';
import { PersonSummary } from '../components/PersonRow.jsx';
import PersonForm from '../components/PersonForm.jsx';
import RefTag from '../components/RefTag.jsx';

// Check-in has four steps on one screen:
//   find    -> ask for their name (or reference code)
//   results -> are they already registered somewhere?
//   new     -> register them
//   done    -> show the reference slip
export default function CheckIn() {
  const navigate = useNavigate();
  const [step, setStep] = useState('find');
  const [query, setQuery] = useState({ name: '', ageMin: '', ageMax: '', referenceCode: '' });
  const [results, setResults] = useState([]);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setQuery({ ...query, [key]: e.target.value });

  async function find(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const body = query.referenceCode.trim()
        ? { referenceCode: query.referenceCode }
        : { name: query.name, ageMin: query.ageMin || null, ageMax: query.ageMax || null };
      const { results } = await api('/api/persons/lookup', { method: 'POST', body });
      setResults(results);
      setStep('results');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkInHere(person) {
    setBusy(true); setError('');
    try {
      await api(`/api/persons/${person.id}/check-in`, { method: 'POST', body: {} });
      navigate(`/staff/people/${person.id}`, { state: { flash: `${person.name} is now checked in here.` } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function register(values) {
    setBusy(true); setError('');
    try {
      const res = await api('/api/persons', { method: 'POST', body: values });
      setCreated(res);
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQuery({ name: '', ageMin: '', ageMax: '', referenceCode: '' });
    setResults([]); setCreated(null); setError(''); setStep('find');
  }

  if (step === 'find') {
    return (
      <main className="page">
        <form className="stack" onSubmit={find}>
          <h1>Check someone in</h1>
          <p className="muted">They may already be registered at another shelter. Look them up first.</p>
          <label className="field">
            <span className="field-label">Name</span>
            <input className="input" value={query.name} onChange={set('name')} autoComplete="off" autoFocus />
          </label>
          <div className="field">
            <span className="field-label" id="lookup-age">Age, if you know it</span>
            <div className="age-range" role="group" aria-labelledby="lookup-age">
              <input className="input" inputMode="numeric" aria-label="Youngest" placeholder="From"
                value={query.ageMin} onChange={set('ageMin')} />
              <span className="muted">to</span>
              <input className="input" inputMode="numeric" aria-label="Oldest" placeholder="To"
                value={query.ageMax} onChange={set('ageMax')} />
            </div>
          </div>
          <label className="field">
            <span className="field-label">Or their reference code</span>
            <span className="field-hint">From a slip or wristband another shelter gave them.</span>
            <input className="input" value={query.referenceCode} onChange={set('referenceCode')}
              autoComplete="off" autoCapitalize="characters" placeholder="K7P-QX4"
              style={{ fontFamily: 'var(--mono)', letterSpacing: '0.06em' }} />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn btn-block" disabled={busy}>{busy ? 'Looking…' : 'Look them up'}</button>
          <Link to="/staff">Cancel</Link>
        </form>
      </main>
    );
  }

  if (step === 'results') {
    return (
      <main className="page stack">
        <h1>{results.length ? 'Is this them?' : 'Not registered yet'}</h1>
        {results.length > 0 ? (
          <>
            <p className="muted">Check the details with them before you choose.</p>
            <ul className="people">
              {results.map((p) => (
                <li key={p.id} className="candidate">
                  <PersonSummary person={p} showDescription />
                  {p.here ? (
                    <Link className="btn btn-quiet btn-block" to={`/staff/people/${p.id}`}>
                      Already here. Open their record
                    </Link>
                  ) : (
                    <button className="btn btn-block" disabled={busy} onClick={() => checkInHere(p)}>
                      This is them. Check in here
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No one like that is registered at any shelter.</p>
        )}
        {error && <div className="error" role="alert">{error}</div>}
        <button className={results.length ? 'btn btn-quiet btn-block' : 'btn btn-block'} onClick={() => setStep('new')}>
          {results.length ? 'None of these. Register as new' : 'Register as new'}
        </button>
        <button className="linkish" onClick={() => setStep('find')}>Search again</button>
      </main>
    );
  }

  if (step === 'new') {
    return (
      <main className="page stack">
        <h1>Register someone new</h1>
        <PersonForm
          initial={{ name: query.name, ageMin: query.ageMin, ageMax: query.ageMax }}
          submitLabel="Register"
          busy={busy}
          error={error}
          onSubmit={register}
          onCancel={() => setStep('results')}
        />
      </main>
    );
  }

  // done
  const { person, possibleDuplicates } = created;
  return (
    <main className="page stack">
      <h1>{person.name} is checked in</h1>
      <RefTag code={person.referenceCode} name={person.name} />
      <p>
        Write this code on their wristband or slip. It works at any shelter and gets them found faster if they move.
      </p>
      {possibleDuplicates.length > 0 && (
        <div className="notice">
          <strong>This might be someone already registered</strong>, for example {possibleDuplicates[0].name}.{' '}
          <Link to="/staff/duplicates">Review possible duplicates</Link>
        </div>
      )}
      <button className="btn btn-quiet btn-block" onClick={() => window.print()}>Print slip</button>
      <button className="btn btn-block" onClick={reset}>Check in someone else</button>
      <Link to={`/staff/people/${person.id}`}>Open their record</Link>
    </main>
  );
}
