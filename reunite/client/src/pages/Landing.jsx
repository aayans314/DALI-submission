import { Link, Navigate } from 'react-router';
import { useSession } from '../session.jsx';

export default function Landing() {
  const { user } = useSession();
  if (user?.kind === 'staff') return <Navigate to="/staff" replace />;
  if (user?.kind === 'public') return <Navigate to="/search" replace />;

  return (
    <main className="page stack">
      <h1>Find family separated by the hurricane</h1>
      <p className="muted">
        Shelters across the region record who has arrived. We check every one of them, and nothing is shared until
        the person you're looking for agrees.
      </p>

      <Link className="door" to="/login">
        <strong>I'm looking for someone</strong>
        Tell us who you're looking for. We'll keep checking as new people arrive.
      </Link>
      <Link className="door" to="/staff/login">
        <strong>I work at a shelter</strong>
        Check people in and confirm matches.
      </Link>

      <p className="notice">
        No phone? Any volunteer at any shelter can search for you.
      </p>
    </main>
  );
}
