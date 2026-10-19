import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { SessionProvider, useSession } from './session.jsx';
import WakeGate from './components/WakeGate.jsx';
import TopBar from './components/TopBar.jsx';
import Landing from './pages/Landing.jsx';
import StaffLogin from './pages/StaffLogin.jsx';
import PublicAuth from './pages/PublicAuth.jsx';
import PublicHome from './pages/PublicHome.jsx';
import StaffHome from './pages/StaffHome.jsx';
import CheckIn from './pages/CheckIn.jsx';
import PersonPage from './pages/PersonPage.jsx';
import Duplicates from './pages/Duplicates.jsx';
import Team from './pages/Team.jsx';
import Matches from './pages/Matches.jsx';

function RequireStaff({ coordinator = false }) {
  const { user } = useSession();
  if (user?.kind !== 'staff') return <Navigate to="/staff/login" replace />;
  if (coordinator && user.role !== 'authority') return <Navigate to="/staff" replace />;
  return <Outlet />;
}

function RequirePublic() {
  const { user } = useSession();
  if (user?.kind !== 'public') return <Navigate to="/login" replace />;
  return <Outlet />;
}

function WithTopBar() {
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <WakeGate>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/login" element={<PublicAuth />} />

            <Route element={<RequirePublic />}>
              <Route element={<WithTopBar />}>
                <Route path="/search" element={<PublicHome />} />
              </Route>
            </Route>

            <Route path="/staff" element={<RequireStaff />}>
              <Route element={<WithTopBar />}>
                <Route index element={<StaffHome />} />
                <Route path="check-in" element={<CheckIn />} />
                <Route path="people/:id" element={<PersonPage />} />
                <Route path="duplicates" element={<Duplicates />} />
                <Route path="matches" element={<Matches />} />
                <Route element={<RequireStaff coordinator />}>
                  <Route path="team" element={<Team />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WakeGate>
      </SessionProvider>
    </BrowserRouter>
  );
}
