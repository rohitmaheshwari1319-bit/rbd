// Tiny fetch-based API client. Adds auth header automatically and lifts JSON.
const BASE = '/api';
const TOKEN_KEY = 'rbd.token';

export function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const token = getToken();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    signal
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get:    (p, o) => request(p, { ...o, method: 'GET' }),
  post:   (p, body, o) => request(p, { ...o, method: 'POST', body }),
  patch:  (p, body, o) => request(p, { ...o, method: 'PATCH', body }),
  put:    (p, body, o) => request(p, { ...o, method: 'PUT', body }),
  delete: (p, o) => request(p, { ...o, method: 'DELETE' })
};
