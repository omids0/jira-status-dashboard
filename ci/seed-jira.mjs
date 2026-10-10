// Seeds the CI Jira with a project shaped like a real one: US-prefixed stories,
// Back-End / Front-End sub-tasks (some Done), and an active sprint. Best effort:
// every step logs what it did, and the e2e only depends on the project existing.
import { api } from './jira-api.mjs';

const KEY = 'DMA';
const log = (...a) => console.log('[seed]', ...a);

async function ensureProject() {
  try { await api('GET', `/rest/api/2/project/${KEY}`); log('project exists'); return; } catch { /* create */ }
  const attempts = [
    { projectTypeKey: 'software', projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-scrum-classic' },
    { projectTypeKey: 'software', projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-scrum-template' },
    { projectTypeKey: 'business', projectTemplateKey: 'com.atlassian.jira-core-project-templates:jira-core-simplified-task-tracking' }
  ];
  for (const a of attempts) {
    try {
      await api('POST', '/rest/api/2/project', { key: KEY, name: 'Demo DMA', lead: 'admin', ...a });
      log('project created with', a.projectTemplateKey);
      return;
    } catch (e) { log('template failed:', e.message.split('\n')[0]); }
  }
  throw new Error('could not create project');
}

async function transitionToDone(key) {
  const { transitions } = await api('GET', `/rest/api/2/issue/${key}/transitions`);
  const done = transitions.find((t) => t.to?.statusCategory?.key === 'done');
  if (done) await api('POST', `/rest/api/2/issue/${key}/transitions`, { transition: { id: done.id } });
  return Boolean(done);
}

await ensureProject();
for (const name of ['Back-End', 'Front-End']) {
  try { await api('POST', '/rest/api/2/component', { project: KEY, name }); log('component', name); } catch (e) { log('component', name, 'skipped:', e.message.split('\n')[0]); }
}

const meta = await api('GET', `/rest/api/2/issue/createmeta?projectKeys=${KEY}`);
const types = meta.projects[0].issuetypes;
log('issue types:', types.map((t) => `${t.name}${t.subtask ? '(sub)' : ''}`).join(', '));
const storyType = types.find((t) => t.name === 'Story') || types.find((t) => !t.subtask);
const subType = types.find((t) => t.subtask);

const created = [];
const story = async (summary) => {
  const r = await api('POST', '/rest/api/2/issue', { fields: { project: { key: KEY }, issuetype: { id: storyType.id }, summary } });
  created.push(r.key);
  return r.key;
};
const sub = async (parent, summary, component) => {
  if (!subType) return null;
  const r = await api('POST', '/rest/api/2/issue', { fields: { project: { key: KEY }, issuetype: { id: subType.id }, parent: { key: parent }, summary, components: [{ name: component }] } });
  return r.key;
};

const s1 = await story('US-CAT-01: finished story');
const s2 = await story('US-CAT-02: backend done, frontend waiting');
const s3 = await story('US-BRD-01: frontend in progress');
const s4 = await story('US-BRD-02: not started');

for (const k of [await sub(s1, 'api', 'Back-End'), await sub(s1, 'ui', 'Front-End')]) if (k) await transitionToDone(k);
for (const k of [await sub(s2, 'api', 'Back-End')]) if (k) await transitionToDone(k);
const s3be = await sub(s3, 'api', 'Back-End');
if (s3be) await transitionToDone(s3be);
await sub(s3, 'ui', 'Front-End');
log('stories:', created.join(', '));

// Start the in-progress stories so their status category is "In Progress".
for (const k of [s2, s3]) {
  const { transitions } = await api('GET', `/rest/api/2/issue/${k}/transitions`);
  const wip = transitions.find((t) => t.to?.statusCategory?.key === 'indeterminate');
  if (wip) await api('POST', `/rest/api/2/issue/${k}/transitions`, { transition: { id: wip.id } });
}
await transitionToDone(s1);

try {
  const boards = await api('GET', `/rest/agile/1.0/board?projectKeyOrId=${KEY}`);
  const board = boards.values?.[0];
  if (board) {
    const sprint = await api('POST', '/rest/agile/1.0/sprint', { name: 'CI Sprint 1', originBoardId: board.id });
    await api('POST', `/rest/agile/1.0/sprint/${sprint.id}/issue`, { issues: [s2, s3, s4] });
    const start = new Date(); const end = new Date(Date.now() + 14 * 864e5);
    await api('POST', `/rest/agile/1.0/sprint/${sprint.id}`, { state: 'active', startDate: start.toISOString(), endDate: end.toISOString() });
    log('active sprint created on board', board.id);
  } else log('no board -> no sprint');
} catch (e) { log('sprint skipped:', e.message.split('\n')[0]); }
