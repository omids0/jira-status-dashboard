// Bookmarklet entry: runs inside a Jira page and paints the dashboard in a
// full-screen overlay. Clicking the bookmark again just re-opens it.
import projectsFile from '../../config/projects.json';
import { makeProjectConfig } from '../projectConfig.js';
import { createBrowserApp } from './app.js';

const OVERLAY_ID = 'jira-dashboard-overlay';

function contextPath() {
  const meta = document.querySelector('meta[name="ajs-context-path"]');
  return (meta?.content || '').replace(/\/+$/, '');
}

function createOverlay() {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#fff;';
  const iframe = document.createElement('iframe');
  iframe.title = 'Jira status dashboard';
  iframe.style.cssText = 'border:0;width:100%;height:100%;display:block;';
  root.appendChild(iframe);
  document.body.appendChild(root);
  return { root, iframe };
}

function run() {
  document.getElementById(OVERLAY_ID)?.remove();
  const { root, iframe } = createOverlay();
  const close = () => {
    root.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);

  createBrowserApp({
    frame: { get document() { return iframe.contentDocument; } },
    baseUrl: location.origin + contextPath(),
    projectConfig: makeProjectConfig(projectsFile),
    storage: window.localStorage,
    onClose: close
  }).start();
}

run();
