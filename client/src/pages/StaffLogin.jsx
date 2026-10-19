import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api } from '../api.js';
import { useSession } from '../session.jsx';

export default function StaffLogin() {
  const { user, signIn } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user?.kind === 'staff') return <Navigate to="/staff" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const session = await api('/api/auth/staff/login', { method: 'POST', body: { email, password } });
      signIn(session);
      navigate('/staff');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <form className="stack" onSubmit={submit}>
        <h1>Shelter staff log in</h1>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="muted small">
          Volunteer accounts are created by your shelter's coordinator. If you don't have one, ask them.
        </p>
        <Link to="/">Back</Link>
      </form>
    </main>
  );
}
