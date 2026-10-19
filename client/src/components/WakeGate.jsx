import { useEffect, useState } from 'react';
import { API_BASE } from '../api.js';

// The free server sleeps after 15 idle minutes and takes up to a minute to
// wake. Hold the app until it answers, and say why we're waiting.
export default function WakeGate({ children }) {
  const [state, setState] = useState('waking'); // waking | slow | ready | failed
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    async function ping() {
      while (!cancelled && Date.now() - started < 90_000) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 15_000);
          const res = await fetch(`${API_BASE}/api/health/db`, { signal: ctrl.signal });
          clearTimeout(timer);
          // While waking, the host can answer with an HTML holding page, so
          // only a real JSON "ok" counts.
          const data = await res.json().catch(() => null);
          if (data?.ok) { if (!cancelled) setState('ready'); return; }
        } catch { /* not up yet */ }
        if (!cancelled && Date.now() - started > 3_000) setState('slow');
        await new Promise((r) => setTimeout(r, 2_500));
      }
      if (!cancelled) setState('failed');
    }

    ping();
    return () => { cancelled = true; };
  }, [attempt]);

  if (state === 'ready') return children;

  return (
    <main className="wake">
      <div className="wake-box" role="status" aria-live="polite">
        {state === 'failed' ? (
          <>
            <h1>Can't reach the server</h1>
            <p>Check the internet connection, then try again.</p>
            <button className="btn" onClick={() => { setState('waking'); setAttempt((a) => a + 1); }}>
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="pulse" aria-hidden="true" />
            <h1>Starting up</h1>
            {state === 'slow' && (
              <p className="muted">
                The server goes to sleep when no one is using it. Waking it up usually takes under a minute.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
