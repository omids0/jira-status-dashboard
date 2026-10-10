// A tiny stand-in for Jira Data Center, just enough REST for the dashboard.
import http from 'node:http';

const cat = (key) => ({ key, name: key });
const status = (name, key) => ({ name, statusCategory: cat(key) });
const DONE = status('Done', 'done');
const WIP = status('In Progress', 'indeterminate');
const TODO = status('BackLog', 'new');

const story = (key, summary, st, extra = {}) => ({ key, fields: { summary, status: st, ...extra } });
const sub = (key, parent, st, component, histories = []) => ({
  key,
  fields: { status: st, components: component ? [{ name: component }] : [], parent: { key: parent } },
  changelog: { histories }
});

const now = new Date().toISOString();
const doneToday = [{ created: now, items: [{ field: 'status', toString: 'Done' }] }];

export const DATA = {
  DMA: {
    stories: [
      story('DMA-1', 'US-AAA-01: finished story', DONE),
      story('DMA-2', 'US-AAA-02: backend done, frontend waiting', WIP),
      story('DMA-3', 'US-BBB-01: frontend running', WIP),
      story('DMA-4', 'US-BBB-02: not started', TODO)
    ],
    subtasks: [
      sub('DMA-10', 'DMA-2', DONE, 'Back-End', doneToday),
      sub('DMA-11', 'DMA-2', DONE, 'Back-End', doneToday),
      sub('DMA-12', 'DMA-3', DONE, 'Back-End', doneToday),
      sub('DMA-13', 'DMA-3', WIP, 'Front-End')
    ],
    sprints: [
      { id: 1, name: 'Sprint One', state: 'closed', startDate: '2026-09-01T00:00:00.000+03:30', endDate: '2026-09-10T00:00:00.000+03:30', keys: ['DMA-1', 'DMA-2'] },
      { id: 2, name: 'Sprint Two', state: 'future', keys: ['DMA-2', 'DMA-3', 'DMA-4'] }
    ]
  },
  ABC: {
    stories: [
      story('ABC-1', 'Plain title one', DONE, { customfield_1: 'ABC-100' }),
      story('ABC-2', 'Plain title two', TODO, { customfield_1: 'ABC-100' })
    ],
    subtasks: [],
    sprints: []
  }
};

const EPICS = { 'ABC-100': 'Onboarding epic' };

// `pages(req, res, url)` may serve non-API content (e.g. a fake Jira HTML page
// and the bundled dashboard.js) and returns true when it handled the request.
export function startFakeJira({ token = 'good-token', sessionCookie = 'JSESSIONID=ok', pages = null } = {}) {
  const calls = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (pages?.(req, res, url)) return;
    calls.push(url.pathname + url.search);
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const bearerOk = req.headers.authorization === `Bearer ${token}`;
    const cookieOk = (req.headers.cookie || '').split(/;\s*/).includes(sessionCookie);
    if (!bearerOk && !cookieOk) return send(401, { errorMessages: ['nope'] });

    const p = url.pathname;
    if (p === '/rest/api/2/myself') return send(200, { displayName: 'Test User' });
    if (p === '/rest/api/2/project') return send(200, Object.keys(DATA).map((k) => ({ key: k, name: `${k} project` })));
    const proj = /^\/rest\/api\/2\/project\/(\w+)$/.exec(p);
    if (proj) return DATA[proj[1]] ? send(200, { key: proj[1] }) : send(404, {});
    if (p === '/rest/api/2/status') return send(200, [DONE, WIP, TODO]);
    if (p === '/rest/api/2/field') return send(200, [{ id: 'customfield_1', schema: { custom: 'com.pyxis.greenhopper.jira:gh-epic-link' } }]);

    if (p === '/rest/api/2/search') {
      const jql = url.searchParams.get('jql');
      let issues;
      if (jql.startsWith('key in')) {
        issues = Object.entries(EPICS).map(([key, summary]) => ({ key, fields: { summary } }));
      } else {
        const project = /project = (\w+)/.exec(jql)?.[1] || /\(([A-Z]+)-/.exec(jql)?.[1];
        const data = DATA[project];
        if (!data) return send(400, { errorMessages: [`project ${project} does not exist`] });
        if (jql.includes('subTaskIssueTypes()')) issues = data.subtasks.filter((s) => s.fields.status.statusCategory.key === 'done');
        else if (jql.startsWith('parent in')) {
          const parents = /\(([^)]*)\)/.exec(jql)[1].split(',');
          issues = data.subtasks.filter((s) => parents.includes(s.fields.parent.key));
        } else if (jql.includes('sprint =')) {
          const id = Number(/sprint = (\d+)/.exec(jql)[1]);
          const keys = data.sprints.find((s) => s.id === id)?.keys || [];
          issues = data.stories.filter((s) => keys.includes(s.key));
        } else issues = data.stories;
      }
      return send(200, { total: issues.length, issues });
    }

    if (p === '/rest/agile/1.0/board') {
      const project = url.searchParams.get('projectKeyOrId');
      return send(200, { values: DATA[project]?.sprints.length ? [{ id: 7, name: 'Board' }] : [] });
    }
    if (/^\/rest\/agile\/1.0\/board\/7\/sprint$/.test(p)) {
      return send(200, { isLast: true, values: DATA.DMA.sprints.map(({ keys, ...rest }) => rest) });
    }
    return send(404, {});
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        calls,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}
