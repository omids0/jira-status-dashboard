import express from 'express';
import { computeInsights, loadReport } from './report.js';
import { loadDailyCompletions } from './daily.js';
import { loadSprints } from './sprints.js';
import { createHistory } from './history.js';
import { COOKIE_NAME, createSessionStore, readCookie } from './sessions.js';
import { JiraError, getMyself, getProject, isValidProjectKey, listProjects, normalizeBaseUrl } from './jiraClient.js';
import { renderError, renderLogin, renderProjects } from './render/pages.js';
import { renderReport } from './render/report.js';

const parseProject = (value) => String(value || '').trim().toUpperCase();

export function createApp(config) {
  const sessions = createSessionStore({ ttlMs: config.sessionTtlMs });
  const history = createHistory(config.dataDir);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer'
    });
    next();
  });

  const sidOf = (req) => readCookie(req, COOKIE_NAME);

  function startSession(req, res, data) {
    const old = sidOf(req);
    if (old) sessions.destroy(old);
    const id = sessions.create(data);
    res.cookie(COOKIE_NAME, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: config.sessionTtlMs,
      path: '/'
    });
  }

  function endSession(req, res) {
    sessions.destroy(sidOf(req));
    res.clearCookie(COOKIE_NAME, { path: '/' });
  }

  function requireSession(req, res, next) {
    const session = sessions.get(sidOf(req));
    if (!session) {
      res.redirect('/login');
      return;
    }
    req.session = session;
    next();
  }

  const loginUrl = (error) => `/login?error=${encodeURIComponent(error)}`;

  // Jira said "unauthenticated" -> the token died: drop the session and re-login.
  // Anything else (timeout, 500, bad project) keeps the session and shows the error.
  function handleJiraFailure(req, res, err, { backHref = '/projects' } = {}) {
    console.error(err.message);
    if (err instanceof JiraError && err.status === 401) {
      endSession(req, res);
      res.redirect(loginUrl('توکن Jira معتبر نیست یا منقضی شده — دوباره وارد شو'));
      return;
    }
    res.status(err instanceof JiraError && err.status === 0 ? 502 : 500).send(
      renderError({ title: 'خطا در خواندن از Jira', message: err.message, backHref, backLabel: 'برگشت' })
    );
  }

  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  app.get('/login', (req, res) => {
    res.send(renderLogin({
      lockedBaseUrl: config.jiraBaseUrl,
      baseUrl: String(req.query.baseUrl || ''),
      project: parseProject(req.query.project || config.defaultProject),
      error: String(req.query.error || '')
    }));
  });

  app.post('/login', async (req, res) => {
    const baseUrl = config.jiraBaseUrl || normalizeBaseUrl(req.body.baseUrl);
    const token = String(req.body.token || '').trim();
    const project = parseProject(req.body.project);
    const page = (error) => res.status(400).send(
      renderLogin({ lockedBaseUrl: config.jiraBaseUrl, baseUrl: req.body.baseUrl, project, error })
    );

    if (!baseUrl) return page('آدرس Jira معتبر نیست (باید http:// یا https:// داشته باشه)');
    if (!token) return page('توکن لازمه');
    if (project && !isValidProjectKey(project)) return page('کلید پروژه معتبر نیست (مثلاً DMA)');

    const candidate = { baseUrl, token };
    try {
      const me = await getMyself(candidate);
      if (project) await getProject(candidate, project);
      startSession(req, res, { ...candidate, user: me.displayName || me.name || '', projectKey: project || null });
      res.redirect(project ? '/' : '/projects');
    } catch (err) {
      console.error(err.message);
      if (err instanceof JiraError && err.status === 404 && project) return page(`پروژه ${project} پیدا نشد یا دسترسی نداری`);
      if (err instanceof JiraError && err.isAuth) return page('Jira توکن رو قبول نکرد (۴۰۱/۴۰۳)');
      return page(err instanceof JiraError ? err.message : 'ورود ناموفق بود');
    }
  });

  app.get('/projects', requireSession, async (req, res) => {
    try {
      const projects = await listProjects(req.session);
      res.send(renderProjects({ projects, current: req.session.projectKey || '', user: req.session.user, error: String(req.query.error || '') }));
    } catch (err) {
      handleJiraFailure(req, res, err, { backHref: '/' });
    }
  });

  app.post('/projects', requireSession, async (req, res) => {
    const project = parseProject(req.body.project);
    if (!isValidProjectKey(project)) {
      res.redirect(`/projects?error=${encodeURIComponent('کلید پروژه معتبر نیست')}`);
      return;
    }
    try {
      await getProject(req.session, project);
      req.session.projectKey = project;
      res.redirect('/');
    } catch (err) {
      if (err instanceof JiraError && (err.status === 404 || err.status === 403)) {
        res.redirect(`/projects?error=${encodeURIComponent(`پروژه ${project} پیدا نشد یا دسترسی نداری`)}`);
        return;
      }
      handleJiraFailure(req, res, err);
    }
  });

  async function buildReportData(session, projectKey, { refresh }) {
    const cached = session.cache[projectKey];
    if (!refresh && cached && Date.now() - cached.at < config.reportCacheMs) return cached.data;

    const cfg = config.projectConfig(projectKey);
    const [report, sprints] = await Promise.all([
      loadReport(session, projectKey, cfg),
      loadSprints(session, projectKey, cfg).catch((err) => {
        console.error(`sprints skipped: ${err.message}`);
        return null;
      })
    ]);
    const daily = await loadDailyCompletions(session, projectKey, cfg, report.doneStoryKeys, 7).catch((err) => {
      console.error(`daily charts skipped: ${err.message}`);
      return { subtasks: null, stories: null };
    });

    const host = new URL(session.baseUrl).host;
    const data = {
      report,
      sprints,
      daily,
      insights: computeInsights(report),
      previous: history.recordAndGetPrevious(`${host}__${projectKey}`, report)
    };
    session.cache[projectKey] = { at: Date.now(), data };
    return data;
  }

  app.get('/', requireSession, async (req, res) => {
    const session = req.session;
    const wanted = req.query.project ? parseProject(req.query.project) : null;
    if (wanted) {
      if (!isValidProjectKey(wanted)) {
        res.redirect(`/projects?error=${encodeURIComponent('کلید پروژه معتبر نیست')}`);
        return;
      }
      session.projectKey = wanted;
    }
    if (!session.projectKey) {
      res.redirect('/projects');
      return;
    }

    try {
      const { report, sprints, daily, insights, previous } = await buildReportData(session, session.projectKey, {
        refresh: req.query.refresh === '1'
      });
      res.send(renderReport(report, {
        previous, insights, sprints, user: session.user,
        dailySubtasks: daily.subtasks, dailyStories: daily.stories
      }));
    } catch (err) {
      if (err instanceof JiraError && (err.status === 400 || err.status === 404)) {
        console.error(err.message);
        const bad = session.projectKey;
        session.projectKey = null;
        res.redirect(`/projects?error=${encodeURIComponent(`خواندن پروژه ${bad} ممکن نشد — کلید یا دسترسی رو چک کن`)}`);
        return;
      }
      handleJiraFailure(req, res, err);
    }
  });

  app.post('/logout', (req, res) => {
    endSession(req, res);
    res.redirect('/login');
  });

  app.close = () => sessions.close();
  return app;
}
