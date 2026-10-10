// Thin Jira Data Center REST client (Personal Access Token, Bearer auth).

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;

export class JiraError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'JiraError';
    this.status = status;
  }

  get isAuth() {
    return this.status === 401 || this.status === 403;
  }
}

export function normalizeBaseUrl(input) {
  try {
    const url = new URL(String(input).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function isValidProjectKey(key) {
  return typeof key === 'string' && /^[A-Z][A-Z0-9_]{1,19}$/.test(key);
}

export function jqlQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export async function jiraGet(session, path) {
  const url = `${session.baseUrl}${path}`;
  let res;
  try {
    // Server mode sends the Personal Access Token. Browser (bookmarklet) mode has
    // no token: the page is already on the Jira origin, so the logged-in session
    // cookie goes along with the request.
    res = await fetch(url, {
      headers: { ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}), Accept: 'application/json' },
      credentials: 'same-origin',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (err) {
    throw new JiraError(`Cannot reach Jira (${err.cause?.code || err.name}): ${session.baseUrl}`, 0);
  }
  if (!res.ok) {
    // Only quote JSON error bodies; an HTML error page (e.g. GitHub's 404) is noise.
    const raw = await res.text().catch(() => '');
    const body = /^\s*[{[]/.test(raw) ? `\n${raw.slice(0, 400)}` : '';
    throw new JiraError(`Jira ${res.status} on ${path.split('?')[0]}${body}`, res.status);
  }
  return res.json();
}

export async function jqlSearchAll(session, jql, fields, { expand } = {}) {
  const issues = [];
  let startAt = 0;
  for (;;) {
    const params = new URLSearchParams({
      jql,
      fields: fields.join(','),
      startAt: String(startAt),
      maxResults: String(PAGE_SIZE)
    });
    if (expand) params.set('expand', expand);
    const page = await jiraGet(session, `/rest/api/2/search?${params}`);
    issues.push(...page.issues);
    startAt += page.issues.length;
    if (startAt >= page.total || page.issues.length === 0) break;
  }
  return issues;
}

export const getMyself = (session) => jiraGet(session, '/rest/api/2/myself');

export async function listProjects(session) {
  const projects = await jiraGet(session, '/rest/api/2/project');
  return projects
    .map((p) => ({ key: p.key, name: p.name }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export const getProject = (session, key) => jiraGet(session, `/rest/api/2/project/${encodeURIComponent(key)}`);

/** Status name -> status category key ('new' | 'indeterminate' | 'done'), cached on the session. */
export async function getStatusCategories(session) {
  session.meta ||= {};
  if (!session.meta.statusCategories) {
    const statuses = await jiraGet(session, '/rest/api/2/status');
    session.meta.statusCategories = Object.fromEntries(statuses.map((s) => [s.name, s.statusCategory?.key]));
  }
  return session.meta.statusCategories;
}

/** Custom field id of "Epic Link", or null when the instance has none. */
export async function getEpicLinkField(session) {
  session.meta ||= {};
  if (session.meta.epicLinkField === undefined) {
    const fields = await jiraGet(session, '/rest/api/2/field');
    const f = fields.find((x) => x.schema?.custom === 'com.pyxis.greenhopper.jira:gh-epic-link');
    session.meta.epicLinkField = f ? f.id : null;
  }
  return session.meta.epicLinkField;
}
