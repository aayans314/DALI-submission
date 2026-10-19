import { useSession } from '../session.jsx';

// Placeholder until search requests land (next step).
export default function PublicHome() {
  const { user } = useSession();
  return (
    <main className="page stack">
      <h1>Hi, {user.name}</h1>
      <p>Searching for family is the next part we're building.</p>
      <p className="notice">
        In the meantime, any volunteer at any shelter can look someone up for you.
      </p>
    </main>
  );
}
