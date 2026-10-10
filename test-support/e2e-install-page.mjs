// The install page must build a working bookmarklet that points at ITS OWN dashboard.js.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startFakeJira } from './fakeJira.js';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');

// "GitHub Pages": serves site/ under /jira-status-dashboard/ (a sub-path, like a project page)
const pages = http.createServer((req, res) => {
  const rel = new URL(req.url, 'http://x').pathname.replace(/^\/jira-status-dashboard\/?/, '') || 'index.html';
  const file = path.join(site, rel);
  if (!file.startsWith(site) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => pages.listen(0, '127.0.0.1', r));
const pagesUrl = `http://127.0.0.1:${pages.address().port}/jira-status-dashboard/`;

const jira = await startFakeJira({
  pages(req, res, url) {
    if (url.pathname !== '/secure/Dashboard.jspa') return false;
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "frame-ancestors 'self'" });
    res.end('<!doctype html><title>Fake Jira</title><body>Jira</body>');
    return true;
  }
});

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let ok = true;
const check = (name, pass, extra = '') => { ok &&= pass; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };
try {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'JSESSIONID', value: 'ok', url: jira.url }]);
  const page = await context.newPage();

  await page.goto(pagesUrl);
  const href = await page.locator('#bm').getAttribute('href');
  check('bookmark link is a javascript: URL', href.startsWith('javascript:'));
  const code = decodeURIComponent(href.slice('javascript:'.length));
  check('it loads dashboard.js from the same site/sub-path (fork-friendly)', code.includes(`${pagesUrl}dashboard.js`), code.match(/https?:[^']+/)?.[0]);

  // Jira page + a cross-origin script load (Pages origin != Jira origin), exactly like production
  await page.goto(`${jira.url}/secure/Dashboard.jspa`);
  await page.evaluate(code);
  const frame = page.frameLocator('#jira-dashboard-overlay iframe');
  await frame.locator('select#jd-project').waitFor({ timeout: 10000 });
  check('running the bookmarklet code on the Jira page opens the dashboard', true);
  await frame.locator('select#jd-project').selectOption('DMA');
  await frame.locator('h1', { hasText: 'ردیاب پروژه DMA' }).waitFor({ timeout: 10000 });
  check('report renders after choosing a project', true);
} catch (e) {
  check('flow completed', false, e.message.split('\n')[0]);
} finally {
  await browser.close();
  await jira.close();
  pages.close();
}
process.exit(ok ? 0 : 1);
