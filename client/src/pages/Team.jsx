import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useSession } from '../session.jsx';

// Coordinators only: add and deactivate volunteers at their shelter.
export default function Team() {
  const { user } = useSession();
  const [staff, setStaff] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => api('/api/staff').then(setStaff).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function add(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const v = await api('/api/staff', { method: 'POST', body: form });
      setMessage(`${v.name} can now log in with ${v.email} and the temporary password you set.`);
      setForm({ name: '', email: '', password: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(s) {
    if (!window.confirm(`Deactivate ${s.name}? They'll be logged out right away.`)) return;
    setError(''); setMessage('');
    try {
      await api(`/api/staff/${s.id}/deactivate`, { method: 'POST', body: {} });
      setMessage(`${s.name} can no longer log in.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page stack">
      <h1>Volunteers at {user.shelterName}</h1>
      {message && <div className="notice success" role="status">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}

      {staff && (
        <ul className="people">
          {staff.map((s) => (
            <li key={s.id} className="person-row spread">
              <div>
                <div className="person-name" style={{ fontSize: 'var(--step-0)' }}>{s.name}</div>
                <div className="person-meta small">
                  {s.email}{s.role === 'authority' ? ', coordinator' : ''}{s.active ? '' : ', deactivated'}
                </div>
              </div>
              {s.role === 'volunteer' && s.active && (
                <button className="linkish" onClick={() => deactivate(s)}>Deactivate</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="section stack" onSubmit={add}>
        <h2>Add a volunteer</h2>
        <p className="muted small">Only add people you've vetted. Volunteers can look up anyone in the system.</p>
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={form.name} onChange={set('name')} required />
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label className="field">
          <span className="field-label">Temporary password</span>
          <span className="field-hint">At least 8 characters. Give it to them in person.</span>
          <input className="input" value={form.password} onChange={set('password')} required autoComplete="off" />
        </label>
        <button className="btn btn-block" disabled={busy}>{busy ? 'Adding…' : 'Add volunteer'}</button>
      </form>

      <Link to="/staff">Back to people here</Link>
    </main>
  );
}
