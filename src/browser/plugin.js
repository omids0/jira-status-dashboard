// Jira plugin entry: loaded on every Jira page as a web-resource. It does NOT
// open anything by itself; it waits for the top-menu item (web-item) to be
// clicked. The item's real href is "<dashboard>#jira-status-dashboard", so it
// still works as a deep link (and degrades to a normal link if JS fails).
import { openDashboard } from './overlay.js';

const LINK_ID = 'jira-status-dashboard-link';
const HASH = '#jira-status-dashboard';

if (!window.__jiraStatusDashboardPlugin) {
  window.__jiraStatusDashboardPlugin = true;

  document.addEventListener('click', (e) => {
    const link = e.target instanceof Element && e.target.closest(`#${LINK_ID}`);
    if (!link) return;
    e.preventDefault();
    openDashboard();
  }, true);

  const openFromHash = () => {
    if (location.hash !== HASH) return;
    history.replaceState(null, '', location.pathname + location.search);
    openDashboard();
  };
  window.addEventListener('hashchange', openFromHash);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openFromHash);
  else openFromHash();
}
