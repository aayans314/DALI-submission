import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { ageText, when } from '../format.js';
import { Badges } from '../components/PersonRow.jsx';
import PersonForm from '../components/PersonForm.jsx';
import RefTag from '../components/RefTag.jsx';

const CHECKOUT_REASONS = ['Went to stay with family or friends', 'Went to a hotel', 'Went to a hospital', 'Other'];

export default function PersonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [person, setPerson] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('view'); // view | edit | checkout
  const [reason, setReason] = useState(CHECKOUT_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(location.state?.flash ?? '');

  // Reload only when the id changes, not whenever navigate's identity does.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    let live = true;
    setPerson(null); setError(''); setMode('view');
    api(`/api/persons/${id}`)
      .then((p) => {
        if (!live) return;
        if (p.mergedInto) navigateRef.current(`/staff/people/${p.mergedInto}`, { replace: true });
        else setPerson(p);
      })
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [id]);

  async function save(values) {
    setBusy(true); setError('');
    try {
      setPerson(await api(`/api/persons/${id}`, { method: 'PATCH', body: values }));
      setMode('view');
      setFlash('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    setBusy(true); setError('');
    try {
      await api(`/api/persons/${id}/check-out`, { method: 'POST', body: { reason } });
      navigate('/staff', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!person) {
    return (
      <main className="page stack">
        {error ? <div className="error" role="alert">{error}</div> : <p className="muted">Loading…</p>}
        <Link to="/staff">Back to people here</Link>
      </main>
    );
  }

  if (mode === 'edit') {
    return (
      <main className="page stack">
        <h1>Edit details</h1>
        <PersonForm initial={person} submitLabel="Save changes" busy={busy} error={error}
          onSubmit={save} onCancel={() => { setMode('view'); setError(''); }} />
      </main>
    );
  }

  const lastStay = person.history.length - 1;
  return (
    <main className="page stack">
      {flash && <div className="notice success" role="status">{flash}</div>}

      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>{person.name}<Badges person={person} /></h1>
        <div className="muted">
          {ageText(person.ageMin, person.ageMax)}
          {person.homeArea ? `, from ${person.homeArea}` : ''}
        </div>
      </div>

      <RefTag code={person.referenceCode} small />

      {person.description && <p>{person.description}</p>}
      {person.doNotDisclose && (
        <p className="notice">They asked not to be findable. Anyone searching for them is told there's no match.</p>
      )}
      {person.isMinor && (
        <p className="notice">Under 18. A coordinator must approve before any match is shared.</p>
      )}

      <section className="section">
        <h2>Where they've been</h2>
        <ol className="history">
          {person.history.map((s, i) => (
            <li key={`${s.shelterId}-${s.arrivedAt}`} className={i === lastStay && !s.leftAt ? 'current' : ''}>
              <strong>{s.shelterName}</strong>
              <div className="muted small">
                Arrived {when(s.arrivedAt)}{s.leftAt ? `, left ${when(s.leftAt)}` : ', here now'}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {error && <div className="error" role="alert">{error}</div>}

      {mode === 'checkout' ? (
        <section className="section stack">
          <label className="field">
            <span className="field-label">Where are they going?</span>
            <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              {CHECKOUT_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <button className="btn btn-danger btn-block" disabled={busy} onClick={checkOut}>
            {busy ? 'Checking out…' : 'Check out'}
          </button>
          <button className="btn btn-quiet btn-block" onClick={() => setMode('view')}>Cancel</button>
        </section>
      ) : (
        <section className="section stack">
          <button className="btn btn-quiet btn-block" onClick={() => { setMode('edit'); setFlash(''); }}>Edit details</button>
          <button className="btn btn-danger btn-block" onClick={() => setMode('checkout')}>Check out</button>
          <Link to="/staff">Back to people here</Link>
        </section>
      )}
    </main>
  );
}
