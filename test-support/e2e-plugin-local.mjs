// Local check of the plugin's page script before it ever meets a real Jira:
// a fake Jira page carrying the same top-menu link the plugin's web-item renders.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { startFakeJira } from './fakeJira.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = (await build({
  entryPoints: [path.join(root, 'src/browser/plugin.js')],
  bundle: true, format: 'iife', platform: 'browser', write: false
})).outputFiles[0].text;

const page = (body) => `<!doctype html><html><head><title>Fake Jira</title><script src="/plugin.js"></script></head><body>${body}</body></html>`;
const jira = await startFakeJira({
  pages(req, res, url) {
    if (url.pathname === '/plugin.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(bundle); return true; }
    if (url.pathname === '/secure/Dashboard.jspa' || url.pathname === '/browse/DMA') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page('<nav><a id="jira-status-dashboard-link" href="/secure/Dashboard.jspa#jira-status-dashboard">ردیاب پروژه</a></nav><h1>Jira</h1>'));
      return true;
    }
    return false;
  }
});

let ok = true;
const check = (name, pass, extra = '') => { ok &&= pass; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'JSESSIONID', value: 'ok', url: jira.url }]);
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));

  await p.goto(`${jira.url}/browse/DMA`);
  check('plugin script alone does not open anything', (await p.locator('#jira-dashboard-overlay').count()) === 0);

  await p.locator('#jira-status-dashboard-link').click();
  await p.frameLocator('#jira-dashboard-overlay iframe').locator('select#jd-project').waitFor({ timeout: 10000 });
  check('clicking the menu item opens the dashboard (and does not navigate away)', p.url().endsWith('/browse/DMA'));

  await p.keyboard.press('Escape');
  await p.goto(`${jira.url}/secure/Dashboard.jspa#jira-status-dashboard`);
  await p.frameLocator('#jira-dashboard-overlay iframe').locator('select#jd-project').waitFor({ timeout: 10000 });
  check('deep link with #jira-status-dashboard opens it on load', true);
  check('hash is cleaned from the address bar', !p.url().includes('#jira-status-dashboard'));

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('flow completed', false, e.message.split('\n')[0]);
} finally {
  await browser.close();
  await jira.close();
}
process.exit(ok ? 0 : 1);
