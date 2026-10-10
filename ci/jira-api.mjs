// Tiny admin client for the throwaway CI Jira (basic auth admin/admin).
export const BASE = process.env.JIRA_URL || 'http://localhost:2990/jira';
const AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');

export async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: AUTH, Accept: 'application/json', 'X-Atlassian-Token': 'no-check', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return json;
}
