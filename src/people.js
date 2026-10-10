import { getStatusCategories, jiraGet, jqlSearchAll } from './jiraClient.js';

const UNASSIGNED = { id: '__unassigned__', name: 'بدون مسئول' };

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

const personOf = (user) => (user ? { id: user.key || user.name || user.accountId || user.displayName, name: user.displayName || user.name || '؟' } : UNASSIGNED);

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Status transitions of one issue, oldest first, each tagged with the status
 * category it moved from/to (new | indeterminate | done).
 */
function statusMoves(issue, categories) {
  const moves = [];
  for (const h of issue.changelog?.histories || []) {
    for (const item of h.items || []) {
      if (item.field !== 'status') continue;
      moves.push({ at: new Date(h.created), from: categories[item.fromString], to: categories[item.toString] });
    }
  }
  return moves.sort((a, b) => a.at - b.at);
}

/**
 * Per-person activity for the last `days` calendar days (today included),
 * read from Jira only — it shows recorded activity, not quality:
 *  - sub-tasks finished in the window (backend / frontend / other), with how
 *    long each took from first "In Progress" to its last "Done"
 *  - reopened: work moved from a Done status back to an open one in the window
 *  - hours logged (worklogs started in the window)
 *  - what each person holds right now (assigned, In Progress)
 */
export async function loadPeopleReport(session, projectKey, cfg, days = 7) {
  const categories = await getStatusCategories(session);
  const windowStart = startOfDay(new Date());
  windowStart.setDate(windowStart.getDate() - (days - 1));
  const inWindow = (d) => d >= windowStart;

  const [touched, active, logged] = await Promise.all([
    jqlSearchAll(
      session,
      `project = ${projectKey} AND issuetype in subTaskIssueTypes() AND updated >= -${days + 1}d ORDER BY key`,
      ['summary', 'status', 'assignee', 'components', 'parent', 'created'],
      { expand: 'changelog' }
    ),
    jqlSearchAll(
      session,
      `project = ${projectKey} AND statusCategory = "In Progress" AND assignee is not EMPTY ORDER BY updated DESC`,
      ['summary', 'status', 'assignee', 'issuetype', 'updated']
    ),
    jqlSearchAll(session, `project = ${projectKey} AND worklogDate >= -${days}d ORDER BY key`, ['summary', 'worklog'])
  ]);

  const people = new Map();
  const get = (user) => {
    const p = personOf(user);
    if (!people.has(p.id)) {
      people.set(p.id, { ...p, done: [], reopened: [], inProgress: [], loggedSeconds: 0 });
    }
    return people.get(p.id);
  };

  for (const issue of touched) {
    const moves = statusMoves(issue, categories);
    const person = get(issue.fields.assignee);
    const component = issue.fields.components?.[0]?.name || null;
    const lane = component === cfg.components.backend ? 'backend' : component === cfg.components.frontend ? 'frontend' : 'other';
    const base = { key: issue.key, summary: issue.fields.summary, parentKey: issue.fields.parent?.key || null, lane };

    for (const m of moves) {
      if (m.from === 'done' && m.to !== 'done' && inWindow(m.at)) person.reopened.push({ ...base, at: m.at.toISOString() });
    }

    const isDoneNow = issue.fields.status?.statusCategory?.key === 'done';
    const lastDone = [...moves].reverse().find((m) => m.to === 'done');
    if (!isDoneNow || !lastDone || !inWindow(lastDone.at)) continue;
    const started = moves.find((m) => m.to === 'indeterminate')?.at || new Date(issue.fields.created);
    person.done.push({ ...base, doneAt: lastDone.at.toISOString(), hours: Math.max(0, (lastDone.at - started) / 36e5) });
  }

  for (const issue of active) {
    get(issue.fields.assignee).inProgress.push({
      key: issue.key,
      summary: issue.fields.summary,
      type: issue.fields.issuetype?.name || '',
      status: issue.fields.status?.name || '',
      updated: issue.fields.updated
    });
  }

  for (const issue of logged) {
    // search embeds at most ~20 worklogs per issue; fetch the rest when truncated
    let worklogs = issue.fields.worklog?.worklogs || [];
    if ((issue.fields.worklog?.total || 0) > worklogs.length) {
      worklogs = (await jiraGet(session, `/rest/api/2/issue/${issue.key}/worklog`)).worklogs || worklogs;
    }
    for (const w of worklogs) {
      if (inWindow(new Date(w.started))) get(w.author).loggedSeconds += w.timeSpentSeconds || 0;
    }
  }

  const list = [...people.values()]
    .filter((p) => p.done.length || p.reopened.length || p.inProgress.length || p.loggedSeconds)
    .map((p) => {
      const count = (lane) => p.done.filter((d) => d.lane === lane).length;
      return {
        ...p,
        done: p.done.sort((a, b) => a.doneAt.localeCompare(b.doneAt)),
        counts: { done: p.done.length, backend: count('backend'), frontend: count('frontend'), other: count('other') },
        loggedHours: Math.round((p.loggedSeconds / 3600) * 10) / 10,
        medianHours: median(p.done.map((d) => d.hours))
      };
    })
    // alphabetical on purpose: this is not a ranking
    .sort((a, b) => (a.id === UNASSIGNED.id) - (b.id === UNASSIGNED.id) || a.name.localeCompare(b.name, 'fa'));

  return { days, since: windowStart.toISOString(), people: list };
}
