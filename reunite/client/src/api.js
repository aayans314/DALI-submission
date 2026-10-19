// Talks to the Reunite API. The session lives in sessionStorage, not
// localStorage: shelter devices are shared, and closing the tab logs out.

export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const KEY = 'reunite.session';

export function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
}

export function saveSession(session) {
  if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
  else sessionStorage.removeItem(KEY);
}

export async function api(path, { method = 'GET', body } = {}) {
  const session = loadSession();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error('Can\'t reach the server. Check the internet connection and try again.');
  }
  const data = await res.json().catch(() => ({}));

  // Expired or deactivated: drop the session everywhere.
  if (res.status === 401 && session) {
    saveSession(null);
    window.dispatchEvent(new Event('reunite:signed-out'));
  }
  if (!res.ok) {
    const err = new Error(data.error || `Something went wrong (error ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}
