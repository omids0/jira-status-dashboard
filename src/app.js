import express from 'express';
import { collectReportData } from './reportData.js';
import { createHistory } from './history.js';
import { COOKIE_NAME, createSessionStore, readCookie } from './sessions.js';
import { JiraError, getMyself, isValidProjectKey, listProjects, normalizeBaseUrl } from './jiraClient.js';
import { renderError, renderHome, renderLogin } from './render/pages.js';
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
  // Anything else (timeout, 500) keeps the session and shows the error.
  function handleJiraFailure(req, res, err) {
    console.error(err.message);
    if (err instanceof JiraError && err.status === 401) {
      endSession(req, res);
      res.redirect(loginUrl('توکن Jira معتبر نیست یا منقضی شده است؛ لطفاً دوباره وارد شوید.'));
      return;
    }
    res.status(err instanceof JiraError && err.status === 0 ? 502 : 500).send(
      renderError({ title: 'خطا در خواندن از Jira', message: err.message, backHref: '/', backLabel: 'برگشت' })
    );
  }

  async function projectsOf(session, { refresh = false } = {}) {
    if (refresh || !session.meta.projects) session.meta.projects = await listProjects(session);
    return session.meta.projects;
  }

  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  app.get('/login', (req, res) => {
    res.send(renderLogin({
      lockedBaseUrl: config.jiraBaseUrl,
      baseUrl: String(req.query.baseUrl || ''),
      error: String(req.query.error || '')
    }));
  });

  app.post('/login', async (req, res) => {
    const baseUrl = config.jiraBaseUrl || normalizeBaseUrl(req.body.baseUrl);
    const token = String(req.body.token || '').trim();
    const page = (error) => res.status(400).send(
      renderLogin({ lockedBaseUrl: config.jiraBaseUrl, baseUrl: req.body.baseUrl, error })
    );

    if (!baseUrl) return page('آدرس Jira معتبر نیست (باید با http:// یا https:// شروع شود).');
    if (!token) return page('وارد کردن توکن الزامی است.');

    const candidate = { baseUrl, token };
    try {
      const me = await getMyself(candidate);
      const initial = parseProject(config.defaultProject);
      startSession(req, res, {
        ...candidate,
        user: me.displayName || me.name || '',
        projectKey: isValidProjectKey(initial) ? initial : null
      });
      res.redirect('/');
    } catch (err) {
      console.error(err.message);
      if (err instanceof JiraError && err.isAuth) return page('Jira توکن را نپذیرفت (۴۰۱/۴۰۳).');
      return page(err instanceof JiraError ? err.message : 'ورود ناموفق بود');
    }
  });

  async function buildReportData(session, projectKey, { refresh }) {
    const cached = session.cache[projectKey];
    if (!refresh && cached && Date.now() - cached.at < config.reportCacheMs) return cached.data;
    const data = await collectReportData(session, projectKey, config.projectConfig(projectKey), history);
    session.cache[projectKey] = { at: Date.now(), data };
    return data;
  }

  app.get('/', requireSession, async (req, res) => {
    const session = req.session;
    const refresh = req.query.refresh === '1';

    try {
      const projects = await projectsOf(session, { refresh });
      const home = (error) => res.send(renderHome({ projects, user: session.user, error }));

      const wanted = req.query.project ? parseProject(req.query.project) : null;
      if (wanted) {
        if (!isValidProjectKey(wanted)) return home('کلید پروژه معتبر نیست');
        session.projectKey = wanted;
      }
      if (!session.projectKey) return home('');

      let data;
      try {
        data = await buildReportData(session, session.projectKey, { refresh });
      } catch (err) {
        if (err instanceof JiraError && (err.status === 400 || err.status === 404)) {
          console.error(err.message);
          const bad = session.projectKey;
          session.projectKey = null;
          return home(`خواندن پروژه ${bad} ممکن نشد؛ پروژه وجود ندارد یا به آن دسترسی ندارید.`);
        }
        throw err;
      }

      res.send(renderReport(data.report, {
        previous: data.previous,
        insights: data.insights,
        sprints: data.sprints,
        people: data.people,
        user: session.user,
        projects,
        dailySubtasks: data.daily.subtasks,
        dailyStories: data.daily.stories
      }));
    } catch (err) {
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
