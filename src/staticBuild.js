import fs from 'node:fs';
import path from 'node:path';
import { collectReportData } from './reportData.js';
import { createHistory } from './history.js';
import { getMyself, isValidProjectKey, listProjects, normalizeBaseUrl } from './jiraClient.js';
import { renderReport } from './render/report.js';

/**
 * Renders one self-contained HTML file per project (KEY.html) plus index.html
 * (the first project) — a snapshot a static host can serve, with no server and
 * no login. Meant to run inside a scheduled CI job.
 */
export async function buildStatic({ baseUrl, token, projects, outDir, dataDir, projectConfig }) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) throw new Error('JIRA_BASE_URL is missing or not a valid http(s) URL');
  if (!token) throw new Error('JIRA_TOKEN is missing');
  const keys = [...new Set(projects.map((k) => k.trim().toUpperCase()).filter(Boolean))];
  if (keys.length === 0) throw new Error('PROJECTS is empty — set it to e.g. "DMA,DEKACP"');
  const invalid = keys.filter((k) => !isValidProjectKey(k));
  if (invalid.length) throw new Error(`Invalid project key(s): ${invalid.join(', ')}`);

  const session = { baseUrl: normalized, token, meta: {}, cache: {} };
  await getMyself(session); // fail fast on a bad token / unreachable Jira

  const names = Object.fromEntries((await listProjects(session)).map((p) => [p.key, p.name]));
  const nav = keys.map((key) => ({ key, name: names[key] || key }));
  const history = createHistory(dataDir);

  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  const failed = [];

  for (const key of keys) {
    try {
      const data = await collectReportData(session, key, projectConfig(key), history);
      const html = renderReport(data.report, {
        previous: data.previous,
        insights: data.insights,
        sprints: data.sprints,
        dailySubtasks: data.daily.subtasks,
        dailyStories: data.daily.stories,
        projects: nav,
        staticMode: true
      });
      fs.writeFileSync(path.join(outDir, `${key}.html`), html);
      written.push(key);
    } catch (err) {
      failed.push({ key, message: err.message });
    }
  }

  if (written.length) fs.copyFileSync(path.join(outDir, `${written[0]}.html`), path.join(outDir, 'index.html'));
  return { written, failed };
}
