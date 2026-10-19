import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api } from '../api.js';
import { useSession } from '../session.jsx';

export default function PublicAuth() {
  const { user, signIn } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState('register'); // register | login
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user?.kind === 'public') return <Navigate to="/search" replace />;
  const registering = mode === 'register';

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const session = registering
        ? await api('/api/auth/public/register', { method: 'POST', body: { name, contact, password } })
        : await api('/api/auth/public/login', { method: 'POST', body: { contact, password } });
      signIn(session);
      navigate('/search');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <form className="stack" onSubmit={submit}>
        <h1>{registering ? 'Create an account to search' : 'Log in'}</h1>
        {registering && (
          <p className="muted">
            We need a way to reach you if someone is found. You can log in from any phone or computer later.
          </p>
        )}
        {registering && (
          <label className="field">
            <span className="field-label">Your name</span>
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label className="field">
          <span className="field-label">Email or phone number</span>
          <input className="input" autoComplete="username" value={contact} onChange={(e) => setContact(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          {registering && <span className="field-hint">At least 8 characters.</span>}
          <input className="input" type="password" autoComplete={registering ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn btn-block" disabled={busy}>
          {busy ? 'One moment…' : registering ? 'Create account' : 'Log in'}
        </button>
        <button type="button" className="linkish" onClick={() => { setMode(registering ? 'login' : 'register'); setError(''); }}>
          {registering ? 'I already have an account' : 'I need to create an account'}
        </button>
        <Link to="/">Back</Link>
      </form>
    </main>
  );
}
