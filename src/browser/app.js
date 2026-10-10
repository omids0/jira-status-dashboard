import { collectReportData } from '../reportData.js';
import { JiraError, getMyself, isValidProjectKey, listProjects } from '../jiraClient.js';
import { renderHome } from '../render/pages.js';
import { renderReport } from '../render/report.js';
import { createBrowserHistory } from './history.js';

const CACHE_MS = 60_000;
const LAST_PROJECT_KEY = 'jira-dashboard:last-project:';

/**
 * The dashboard running INSIDE a Jira page (via the bookmarklet). Same origin
 * as Jira, so requests carry the user's logged-in session: no token, no CORS.
 *
 * @param {object} deps
 * @param {{ document: Document }} deps.frame  where pages are painted (an overlay iframe)
 * @param {string} deps.baseUrl                Jira origin + context path
 * @param {(key:string)=>object} deps.projectConfig
 * @param {Storage} deps.storage
 * @param {() => void} deps.onClose
 */
export function createBrowserApp({ frame, baseUrl, projectConfig, storage, onClose }) {
  const session = { baseUrl, token: null, meta: {}, cache: {} };
  const history = createBrowserHistory(storage);
  const lastKey = LAST_PROJECT_KEY + new URL(baseUrl).host;
  let projects = [];
  let user = '';
  let current = null;
  let seq = 0; // drops answers from a project the user already switched away from

  const paint = (html) => {
    const doc = frame.document;
    doc.open();
    doc.write(html);
    doc.close();
    doc.getElementById('jd-project')?.addEventListener('change', (e) => openProject(e.target.value));
    doc.getElementById('jd-refresh')?.addEventListener('click', () => openProject(current, { refresh: true }));
    doc.getElementById('jd-close')?.addEventListener('click', onClose);
  };

  const showHome = (error = '') => paint(renderHome({ projects, user, error, embedded: true }));
  const showFatal = (error) => paint(renderHome({ projects: [], user, error, embedded: true, fatal: true }));

  const loading = (text) => paint(`<!doctype html><meta charset="utf-8"><body style="font-family:Tahoma,sans-serif;direction:rtl;text-align:center;padding:80px;color:#667">${text}</body>`);

  function describe(err) {
    if (err instanceof JiraError && err.status === 404) return 'این صفحه متعلق به Jira نیست. بوکمارک را هنگامی اجرا کنید که در خود Jira هستید (نه در سایت دیگر یا صفحه‌ی نصب).';
    if (err instanceof JiraError && err.status === 401) return 'وارد Jira نشده‌اید یا نشست شما منقضی شده است. ابتدا وارد Jira شوید و سپس دوباره بوکمارک را اجرا کنید.';
    if (err instanceof JiraError && err.status === 403) return 'Jira اجازه‌ی دسترسی نداد (۴۰۳).';
    return err.message;
  }

  async function openProject(key, { refresh = false } = {}) {
    if (!isValidProjectKey(key)) return showHome('کلید پروژه معتبر نیست');
    const mine = ++seq;
    current = key;
    storage.setItem(lastKey, key);

    const cached = session.cache[key];
    try {
      let data;
      if (!refresh && cached && Date.now() - cached.at < CACHE_MS) data = cached.data;
      else {
        loading(`در حال دریافت اطلاعات پروژه‌ی ${key} از Jira…`);
        data = await collectReportData(session, key, projectConfig(key), history);
        session.cache[key] = { at: Date.now(), data };
      }
      if (mine !== seq) return;
      paint(renderReport(data.report, {
        previous: data.previous, insights: data.insights, sprints: data.sprints, user,
        projects, dailySubtasks: data.daily.subtasks, dailyStories: data.daily.stories, embedded: true
      }));
    } catch (err) {
      if (mine !== seq) return;
      console.error('[jira-dashboard]', err);
      if (err instanceof JiraError && (err.status === 400 || err.status === 404)) {
        current = null;
        return showHome(`خواندن پروژه ${key} ممکن نشد؛ پروژه وجود ندارد یا به آن دسترسی ندارید.`);
      }
      showHome(describe(err));
    }
  }

  async function start() {
    loading('در حال اتصال به Jira…');
    try {
      const me = await getMyself(session);
      user = me.displayName || me.name || '';
      projects = await listProjects(session);
    } catch (err) {
      console.error('[jira-dashboard]', err);
      return showFatal(describe(err));
    }
    const remembered = storage.getItem(lastKey);
    if (remembered && projects.some((p) => p.key === remembered)) return openProject(remembered);
    showHome();
  }

  return { start, openProject };
}
