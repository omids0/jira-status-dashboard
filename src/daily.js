import { getStatusCategories, jqlSearchAll } from './jiraClient.js';

// Local calendar date, NOT toISOString(): that converts to UTC first and shifts
// the date by a day for any positive UTC offset (e.g. Iran, UTC+3:30).
export function localDateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Real day-by-day history from Jira's own changelog, for the last `days`
 * calendar days (today included):
 *  - subtasks: backend / frontend sub-tasks that became Done that day
 *  - stories: stories that became *truly* Done that day — the day their LAST
 *    sub-task finished, not the day someone flipped the story's own status.
 * Only sub-tasks touched inside the window are fetched: a sub-task finished
 * in the window was necessarily updated in the window.
 */
export async function loadDailyCompletions(session, projectKey, cfg, doneStoryKeys, days = 7) {
  const doneKeys = new Set(doneStoryKeys);
  const categories = await getStatusCategories(session);
  const doneStatusNames = new Set(Object.keys(categories).filter((n) => categories[n] === 'done'));

  const subtasks = await jqlSearchAll(
    session,
    `project = ${projectKey} AND issuetype in subTaskIssueTypes() AND statusCategory = Done AND updated >= -${days + 1}d ORDER BY key`,
    ['components', 'parent'],
    { expand: 'changelog' }
  );

  const today = startOfDay(new Date());
  const windowStart = startOfDay(new Date());
  windowStart.setDate(windowStart.getDate() - (days - 1));

  const subtaskByDate = {};
  const storyByDate = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    const key = localDateKey(d);
    subtaskByDate[key] = { date: key, backend: 0, frontend: 0 };
    storyByDate[key] = { date: key, count: 0 };
  }

  const lastDoneByParent = {};
  for (const issue of subtasks) {
    const component = issue.fields.components?.[0]?.name || null;
    const parentKey = issue.fields.parent?.key || null;

    let doneAt = null;
    for (const h of issue.changelog?.histories || []) {
      for (const item of h.items || []) {
        if (item.field === 'status' && doneStatusNames.has(item.toString)) {
          const created = new Date(h.created);
          if (!doneAt || created > doneAt) doneAt = created;
        }
      }
    }
    if (!doneAt) continue;
    const day = startOfDay(doneAt);

    const lane = component === cfg.components.backend ? 'backend' : component === cfg.components.frontend ? 'frontend' : null;
    if (lane && day >= windowStart && day <= today) subtaskByDate[localDateKey(day)][lane] += 1;

    if (parentKey && doneKeys.has(parentKey) && (!lastDoneByParent[parentKey] || doneAt > lastDoneByParent[parentKey])) {
      lastDoneByParent[parentKey] = doneAt;
    }
  }

  for (const doneAt of Object.values(lastDoneByParent)) {
    const day = startOfDay(doneAt);
    if (day >= windowStart && day <= today) storyByDate[localDateKey(day)].count += 1;
  }

  const byDate = (a, b) => a.date.localeCompare(b.date);
  return {
    subtasks: Object.values(subtaskByDate).sort(byDate),
    stories: Object.values(storyByDate).sort(byDate)
  };
}
