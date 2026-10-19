import { createContext, useContext, useEffect, useState } from 'react';
import { loadSession, saveSession } from './api.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  useEffect(() => {
    const onSignedOut = () => setSession(null);
    window.addEventListener('reunite:signed-out', onSignedOut);
    return () => window.removeEventListener('reunite:signed-out', onSignedOut);
  }, []);

  const value = {
    user: session?.user ?? null,
    signIn(next) { saveSession(next); setSession(next); },
    signOut() { saveSession(null); setSession(null); },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
