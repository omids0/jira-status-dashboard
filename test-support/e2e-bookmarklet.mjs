// Real-browser check of the bookmarklet: a fake "Jira" origin serves a plain page
// plus the REST API (cookie-auth only) and the bundled dashboard.js; Chrome loads
// the page, we run the same code the bookmark runs, and inspect the overlay.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startFakeJira } from './fakeJira.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2] || path.join(root, 'e2e-shots'); // screenshots (git-ignored)
fs.mkdirSync(shots, { recursive: true });

const bundle = fs.readFileSync(path.join(root, 'site', 'dashboard.js'));
const jira = await startFakeJira({
  pages(req, res, url) {
    if (url.pathname === '/secure/Dashboard.jspa') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "frame-ancestors 'self'" });
      res.end('<!doctype html><html><head><title>Fake Jira</title></head><body><h1>Dashboards</h1></body></html>');
      return true;
    }
    if (url.pathname === '/dashboard.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'X-Content-Type-Options': 'nosniff' });
      res.end(bundle);
      return true;
    }
    return false;
  }
});

const checks = [];
const check = (name, ok, extra = '') => { checks.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'fa-IR' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // --- not logged in: friendly message, no crash
  await page.goto(`${jira.url}/secure/Dashboard.jspa`);
  await page.addScriptTag({ url: `${jira.url}/dashboard.js` });
  let frame = page.frameLocator('#jira-dashboard-overlay iframe');
  await frame.locator('body').getByText('وارد Jira نشده‌اید').waitFor({ timeout: 10000 });
  check('logged-out user gets the "log in to Jira first" message', true);
  await page.keyboard.press('Escape');
  check('Escape closes the overlay', (await page.locator('#jira-dashboard-overlay').count()) === 0);

  // --- logged in (session cookie): the real flow
  await context.addCookies([{ name: 'JSESSIONID', value: 'ok', url: jira.url }]);
  await page.goto(`${jira.url}/secure/Dashboard.jspa`);
  await page.addScriptTag({ url: `${jira.url}/dashboard.js` });
  frame = page.frameLocator('#jira-dashboard-overlay iframe');
  await frame.locator('select#jd-project').waitFor({ timeout: 10000 });
  check('select box lists both projects', (await frame.locator('select#jd-project option').count()) >= 2);
  check('user name from Jira is shown', (await frame.locator('.who').innerText()).includes('Test User'));
  await page.screenshot({ path: path.join(shots, '1-home.png') });

  await frame.locator('select#jd-project').selectOption('DMA');
  await frame.locator('h1', { hasText: 'ردیاب پروژه DMA' }).waitFor({ timeout: 10000 });
  const text = await frame.locator('body').innerText();
  check('DMA report renders', text.includes('ردیاب پروژه DMA'));
  check('"ready for frontend" badge present', text.includes('آماده‌ی شروع فرانت‌اند'));
  check('sprints section present', text.includes('Sprint One') && text.includes('Sprint Two'));
  check('parallel list scoped to a sprint', text.includes('اسپرینت فعالی وجود ندارد؛ مبنا اسپرینت بعدی است'));
  check('select reflects DMA', (await frame.locator('select#jd-project').inputValue()) === 'DMA');
  check('no server-only controls (logout / refresh link)', (await frame.locator('form[action="/logout"], a[href*="refresh"]').count()) === 0);
  await page.screenshot({ path: path.join(shots, '2-dma-report.png'), fullPage: false });

  // --- the generation date reads day, month, year from the right (RTL), not "month year ... day"
  const order = await frame.locator('.subtitle bdi').evaluate((el) => {
    const node = el.firstChild;
    const words = node.textContent.split(' ');
    let offset = 0;
    return words.map((w) => {
      const r = document.createRange();
      r.setStart(node, offset);
      r.setEnd(node, offset + w.length);
      offset += w.length + 1;
      return { w, x: r.getBoundingClientRect().x };
    });
  });
  const xs = order.map((o) => o.x);
  check('date words run right-to-left in logical order (day first, on the right)', xs.every((x, i) => i === 0 || x < xs[i - 1]), order.map((o) => `${o.w}@${Math.round(o.x)}`).join('  '));

  // --- theme toggle: follows the OS by default, button flips it, choice persists
  const bg = () => frame.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await bg();
  await frame.locator('.theme-btn').click();
  const dark = await bg();
  check('toggle switches light -> dark', light !== dark && dark === 'rgb(20, 22, 27)', `${light} -> ${dark}`);
  await page.screenshot({ path: path.join(shots, '2b-dark.png') });
  check('choice stored in localStorage', (await page.evaluate(() => localStorage.getItem('jira-dashboard:theme'))) === 'dark');
  await frame.locator('#jd-close').click();
  await page.addScriptTag({ url: `${jira.url}/dashboard.js` });
  const reopened = page.frameLocator('#jira-dashboard-overlay iframe');
  await reopened.locator('select#jd-project').waitFor({ timeout: 10000 });
  check('dark theme is remembered when the dashboard is reopened', (await reopened.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(20, 22, 27)');
  await reopened.locator('.theme-btn').click();
  check('toggle switches back to light', (await reopened.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor)) === light);
  await reopened.locator('select#jd-project').selectOption('DMA');
  await reopened.locator('h1', { hasText: 'ردیاب پروژه DMA' }).waitFor({ timeout: 10000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => localStorage.removeItem('jira-dashboard:theme'));
  await page.keyboard.press('Escape');
  await page.addScriptTag({ url: `${jira.url}/dashboard.js` });
  const auto = page.frameLocator('#jira-dashboard-overlay iframe');
  await auto.locator('select#jd-project').waitFor({ timeout: 10000 });
  check('with no saved choice the OS dark preference applies', (await auto.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(20, 22, 27)');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.keyboard.press('Escape');
  await page.addScriptTag({ url: `${jira.url}/dashboard.js` });
  await page.frameLocator('#jira-dashboard-overlay iframe').locator('select#jd-project').waitFor({ timeout: 10000 });
  await page.frameLocator('#jira-dashboard-overlay iframe').locator('select#jd-project').selectOption('DMA');
  await page.frameLocator('#jira-dashboard-overlay iframe').locator('h1', { hasText: 'ردیاب پروژه DMA' }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(shots, '2c-light-again.png') });

  await frame.locator('select#jd-project').selectOption('ABC');
  await frame.locator('h1', { hasText: 'ردیاب پروژه ABC' }).waitFor({ timeout: 10000 });
  check('switching to ABC works (epic grouping)', (await frame.locator('body').innerText()).includes('Onboarding epic'));

  await frame.locator('#jd-refresh').click();
  await frame.locator('h1', { hasText: 'ردیاب پروژه ABC' }).waitFor({ timeout: 10000 });
  check('refresh keeps working', true);

  const remembered = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('jira-dashboard:')));
  check('history + last project stored in localStorage', remembered.some((k) => k.includes('history')) && remembered.some((k) => k.includes('last-project')), remembered.join(', '));

  await frame.locator('#jd-close').click();
  check('Close button removes the overlay', (await page.locator('#jira-dashboard-overlay').count()) === 0);

  // --- bookmarklet twice = reopen (still one overlay)
  await page.addScriptTag({ url: `${jira.url}/dashboard.js` });
  await page.addScriptTag({ url: `${jira.url}/dashboard.js` });
  check('running the bookmark twice leaves exactly one overlay', (await page.locator('#jira-dashboard-overlay').count()) === 1);

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  await jira.close();
}
process.exit(checks.every(Boolean) ? 0 : 1);
