import { classifyStory } from './classify.js';
import { getEpicLinkField, jqlQuote, jqlSearchAll } from './jiraClient.js';

const PARENT_CHUNK = 15; // keep JQL "parent in (...)" queries short
const OTHER_LABEL = 'سایر';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function storyJql(projectKey, cfg, extra = '') {
  const types = cfg.storyIssueTypes.map(jqlQuote).join(', ');
  const filter = cfg.storyJql ? ` AND (${cfg.storyJql})` : '';
  return `project = ${projectKey} AND issuetype in (${types})${filter}${extra}`;
}

async function epicNames(session, epicKeys) {
  const names = {};
  for (const group of chunk([...epicKeys], 50)) {
    const epics = await jqlSearchAll(session, `key in (${group.join(',')})`, ['summary']);
    for (const e of epics) names[e.key] = e.fields.summary;
  }
  return names;
}

/**
 * Assigns every story to a "module": the US-XXX prefix in its title, its
 * Epic, or one single bucket — whichever the project actually uses.
 */
async function assignModules(session, cfg, stories, epicField) {
  const pattern = new RegExp(cfg.modulePattern);
  const prefixOf = (s) => pattern.exec(s.fields.summary)?.[1] || null;
  const matched = stories.filter(prefixOf).length;

  let mode = cfg.moduleBy;
  if (mode === 'auto') {
    if (stories.length > 0 && matched / stories.length >= 0.5) mode = 'prefix';
    else mode = epicField ? 'epic' : 'none';
  }
  if (mode === 'epic' && !epicField) mode = 'none';

  if (mode === 'prefix') {
    return stories.map((s) => {
      const id = prefixOf(s) || OTHER_LABEL;
      return { id, label: cfg.moduleLabels[id] || id };
    });
  }
  if (mode === 'epic') {
    const keys = new Set(stories.map((s) => s.fields[epicField]).filter(Boolean));
    const names = keys.size ? await epicNames(session, keys) : {};
    return stories.map((s) => {
      const key = s.fields[epicField];
      return key ? { id: key, label: cfg.moduleLabels[key] || names[key] || key } : { id: 'NO_EPIC', label: 'بدون اپیک' };
    });
  }
  return stories.map(() => ({ id: 'ALL', label: 'همه' }));
}

export async function loadReport(session, projectKey, cfg) {
  const epicField = cfg.moduleBy === 'prefix' || cfg.moduleBy === 'none' ? null : await getEpicLinkField(session);
  const fields = ['summary', 'status', ...(epicField ? [epicField] : [])];
  const stories = await jqlSearchAll(session, `${storyJql(projectKey, cfg)} ORDER BY key`, fields);
  const moduleOf = await assignModules(session, cfg, stories, epicField);

  const inProgressKeys = stories
    .filter((s) => s.fields.status.statusCategory.key !== 'done' && s.fields.status.statusCategory.key !== 'new')
    .map((s) => s.key);

  const subtasksByParent = {};
  for (const group of chunk(inProgressKeys, PARENT_CHUNK)) {
    const items = await jqlSearchAll(session, `parent in (${group.join(',')})`, ['status', 'components', 'parent']);
    for (const item of items) {
      (subtasksByParent[item.fields.parent.key] ||= []).push({
        done: item.fields.status.statusCategory.key === 'done',
        component: item.fields.components?.[0]?.name || null
      });
    }
  }

  const rows = stories.map((s, i) => {
    const classified = classifyStory({
      rawCategory: s.fields.status.statusCategory.key,
      subs: subtasksByParent[s.key] || [],
      components: cfg.components
    });
    return { key: s.key, summary: s.fields.summary, moduleId: moduleOf[i].id, moduleLabel: moduleOf[i].label, ...classified };
  });

  const modules = {};
  for (const row of rows) {
    const m = (modules[row.moduleId] ||= { id: row.moduleId, label: row.moduleLabel, done: 0, inProgress: 0, backlog: 0, total: 0 });
    m.total += 1;
    if (row.trueState === 'done') m.done += 1;
    else if (row.trueState === 'inprogress') m.inProgress += 1;
    else m.backlog += 1;
  }
  const moduleList = Object.values(modules).sort((a, b) => b.total - a.total);

  const totals = {
    done: rows.filter((r) => r.trueState === 'done').length,
    inProgress: rows.filter((r) => r.trueState === 'inprogress').length,
    backlog: rows.filter((r) => r.trueState === 'backlog').length,
    total: rows.length,
    backendDoneStories: rows.filter((r) => r.backendDone).length,
    frontendDoneStories: rows.filter((r) => r.frontendDone).length
  };

  return {
    projectKey,
    baseUrl: session.baseUrl,
    generatedAt: new Date().toISOString(),
    lanes: cfg.components,
    modules: moduleList,
    totals,
    inProgressRows: rows
      .filter((r) => r.subtaskInfo !== null)
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    doneStoryKeys: rows.filter((r) => r.trueState === 'done').map((r) => r.key),
    storyIndex: Object.fromEntries(rows.map((r) => [r.key, r]))
  };
}

/**
 * The sprint the team is working in right now: the active one, else the next
 * upcoming one (between sprints "now" means "what we start next"). Null when
 * sprint data is unavailable or the board has nothing open.
 */
export function pickPlanningSprint(sprints) {
  if (!sprints) return null;
  const open = sprints.filter((s) => s.state === 'active' || s.state === 'future');
  const active = open.find((s) => s.state === 'active');
  if (active) return active;
  const startOf = (s) => (s.startDate ? new Date(s.startDate).getTime() : Infinity);
  return [...open].sort((a, b) => startOf(a) - startOf(b) || a.id - b.id)[0] || null;
}

/**
 * The "what actually needs a human's attention" bullets a raw table never surfaces.
 * `planningSprint` scopes the parallel-work suggestion to that sprint's stories.
 */
export function computeInsights(report, planningSprint = null) {
  const rows = report.inProgressRows;
  const readyForFrontend = rows.filter((r) => {
    const i = r.subtaskInfo;
    return i.beTotal > 0 && i.beDone === i.beTotal && i.feTotal === 0;
  });
  const noSubtaskYet = rows.filter((r) => {
    const i = r.subtaskInfo;
    return i.beTotal === 0 && i.feTotal === 0 && i.otherTotal === 0;
  });
  const staleDone = rows.filter((r) => r.subtaskInfo.stale);
  const zeroProgressModules = report.modules.filter((m) => m.done === 0 && m.total > 0);
  const leadModule = [...report.modules]
    .filter((m) => m.total > 0)
    .sort((a, b) => b.done / b.total - a.done / a.total)[0];

  // Which "backend Done, frontend not started" stories can be handed out
  // together without stepping on each other. Stories in the same module share
  // integration files (tab/route registry, one service file, one locale file),
  // so only ONE story per module is collision-free — and a module that already
  // has frontend work in flight is excluded entirely.
  // Frontend in flight blocks its module no matter which sprint it belongs to
  // (the shared files are the same); only the *candidates* are sprint-scoped.
  const frontendActive = (r) => r.subtaskInfo.feTotal > 0 && !r.subtaskInfo.stale;
  const modulesWithActiveFrontend = new Set(rows.filter(frontendActive).map((r) => r.moduleId));
  const sprintKeys = planningSprint ? new Set(planningSprint.keys) : null;
  const candidates = sprintKeys ? readyForFrontend.filter((r) => sprintKeys.has(r.key)) : readyForFrontend;
  const byModule = {};
  for (const r of candidates) {
    if (modulesWithActiveFrontend.has(r.moduleId)) continue;
    (byModule[r.moduleId] ||= []).push(r);
  }
  const groups = Object.values(byModule).map((list) =>
    [...list].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
  );
  const parallelPlan = {
    sprint: planningSprint ? { name: planningSprint.name, state: planningSprint.state } : null,
    outsideSprint: sprintKeys ? readyForFrontend.filter((r) => !sprintKeys.has(r.key)) : [],
    blockedModules: [...modulesWithActiveFrontend],
    now: groups.map((g) => g[0]),
    queued: groups.flatMap((g) => g.slice(1))
  };

  // What each role should do next, scoped to the planning sprint when known.
  const inScope = (key) => !sprintKeys || sprintKeys.has(key);
  const byKeyAsc = (a, b) => a.key.localeCompare(b.key, undefined, { numeric: true });
  const actions = {
    frontend: {
      readyNow: parallelPlan.now,
      afterThose: parallelPlan.queued,
      blockedModules: parallelPlan.blockedModules,
      inProgress: rows.filter((r) => frontendActive(r) && inScope(r.key)),
      readyOutsideSprint: parallelPlan.outsideSprint
    },
    backend: {
      // unfinished backend work, whether or not the frontend already started
      inProgress: rows.filter((r) => inScope(r.key) && r.subtaskInfo.beTotal > 0 && r.subtaskInfo.beDone < r.subtaskInfo.beTotal),
      // planned into the sprint but nobody has started (only meaningful with a sprint)
      notStarted: sprintKeys
        ? Object.values(report.storyIndex || {}).filter((s) => s.trueState === 'backlog' && sprintKeys.has(s.key)).sort(byKeyAsc)
        : []
    },
    management: {
      staleDone,
      noSubtasks: noSubtaskYet
    }
  };

  return { readyForFrontend, noSubtaskYet, staleDone, zeroProgressModules, leadModule, parallelPlan, actions };
}
