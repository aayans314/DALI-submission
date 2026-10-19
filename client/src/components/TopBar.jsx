import { Link, useNavigate } from 'react-router';
import { useSession } from '../session.jsx';

export default function TopBar() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const isStaff = user?.kind === 'staff';

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div>
          <Link to={isStaff ? '/staff' : '/search'} className="topbar-place" style={{ textDecoration: 'none' }}>
            {isStaff ? user.shelterName : 'Reunite'}
          </Link>
          <div className="topbar-who">
            {user?.name}{isStaff && user.role === 'authority' ? ', coordinator' : ''}
          </div>
        </div>
        <button className="linkish" onClick={() => { signOut(); navigate('/'); }}>Log out</button>
      </div>
    </header>
  );
}
