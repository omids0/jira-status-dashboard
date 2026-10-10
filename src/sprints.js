import { jiraGet, jqlSearchAll } from './jiraClient.js';
import { storyJql } from './report.js';

/**
 * Sprint membership straight from Jira Agile: the board's active/future
 * sprints plus the most recent closed ones, each with the story keys that
 * were ever planned into it. Story *state* is NOT read here — the renderer
 * joins these keys against the report's true-completion index.
 */
export async function loadSprints(session, projectKey, cfg) {
  const boards = await jiraGet(session, `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&type=scrum`);
  const board = boards.values?.[0];
  if (!board) return [];

  const sprints = [];
  let startAt = 0;
  for (;;) {
    const page = await jiraGet(session, `/rest/agile/1.0/board/${board.id}/sprint?state=active,future,closed&startAt=${startAt}&maxResults=50`);
    sprints.push(...page.values);
    startAt += page.values.length;
    if (page.isLast || page.values.length === 0) break;
  }

  const byStart = (a, b) => new Date(a.startDate || 8.64e15) - new Date(b.startDate || 8.64e15);
  const closed = sprints.filter((s) => s.state === 'closed').sort(byStart).slice(-cfg.recentClosedSprints);
  const open = sprints.filter((s) => s.state !== 'closed').sort(byStart);

  const out = [];
  for (const sp of [...closed, ...open]) {
    const issues = await jqlSearchAll(session, `${storyJql(projectKey, cfg, ` AND sprint = ${Number(sp.id)}`)} ORDER BY key`, ['summary']);
    out.push({
      id: sp.id,
      name: sp.name,
      state: sp.state,
      startDate: sp.startDate || null,
      endDate: sp.endDate || null,
      keys: issues.map((i) => i.key)
    });
  }
  return out;
}
