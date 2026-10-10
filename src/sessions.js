import crypto from 'node:crypto';

export const COOKIE_NAME = 'jd_sid';

/**
 * In-memory sessions: the Jira token lives only here — never on disk, never
 * sent to the browser (the cookie carries just an opaque random id).
 */
export function createSessionStore({ ttlMs }) {
  const sessions = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) if (now - s.lastSeen > ttlMs) sessions.delete(id);
  }, 60_000);
  sweep.unref();

  return {
    create(data) {
      const id = crypto.randomBytes(32).toString('hex');
      sessions.set(id, { ...data, lastSeen: Date.now(), cache: {}, meta: {} });
      return id;
    },
    get(id) {
      const s = id && sessions.get(id);
      if (!s) return null;
      if (Date.now() - s.lastSeen > ttlMs) {
        sessions.delete(id);
        return null;
      }
      s.lastSeen = Date.now();
      return s;
    },
    destroy(id) {
      sessions.delete(id);
    },
    close() {
      clearInterval(sweep);
    }
  };
}

export function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
