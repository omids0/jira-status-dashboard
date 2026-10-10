// Real-browser test of the INSTALLED plugin on a real Jira Data Center.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { BASE } from './jira-api.mjs';

const shots = 'ci-shots';
fs.mkdirSync(shots, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
};
const isOurs = (s) => /jira-status-dashboard|jira-dashboard/.test(s || '');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const login = await context.request.post(`${BASE}/rest/auth/1/session`, { data: { username: 'admin', password: 'admin' } });
  check('logged in to Jira through its REST session API', login.ok(), String(login.status()));

  const page = await context.newPage();
  const ourErrors = [];
  page.on('pageerror', (e) => { if (isOurs(e.stack)) ourErrors.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && isOurs(m.text())) ourErrors.push(m.text()); });

  await page.goto(`${BASE}/browse/DMA`, { waitUntil: 'domcontentloaded' });
  const link = page.locator('#jira-status-dashboard-link');
  await link.waitFor({ timeout: 60000 });
  check('menu item is in the Jira top navigation', await link.isVisible(), (await link.innerText()).trim());
  await page.screenshot({ path: `${shots}/1-jira-with-menu-item.png` });

  await link.click();
  const frame = page.frameLocator('#jira-dashboard-overlay iframe');
  await frame.locator('select#jd-project').waitFor({ timeout: 60000 });
  const options = await frame.locator('select#jd-project option').allInnerTexts();
  check('clicking it opens the dashboard with the project list (cookie session, no token)', options.some((o) => o.startsWith('DMA')), options.join(' | '));
  check('logged-in user name shown', (await frame.locator('.who').innerText()).trim().length > 0);
  await page.screenshot({ path: `${shots}/2-overlay-home.png` });

  await frame.locator('select#jd-project').selectOption('DMA');
  await frame.locator('h1', { hasText: 'ردیاب پروژه DMA' }).waitFor({ timeout: 120000 });
  const text = await frame.locator('body').innerText();
  check('DMA report renders from real Jira data', text.includes('ردیاب پروژه DMA'));
  const counts = /(\d+) از (\d+) استوری/.exec(text);
  check('report counted the seeded stories', Boolean(counts) && Number(counts[2]) >= 1, counts ? counts[0] : 'no counts');
  check('sprint section rendered', text.includes('اسپرینت'));
  await page.screenshot({ path: `${shots}/3-dma-report.png` });

  await page.keyboard.press('Escape');
  check('Escape closes the overlay', (await page.locator('#jira-dashboard-overlay').count()) === 0);

  await page.goto(`${BASE}/secure/Dashboard.jspa#jira-status-dashboard`, { waitUntil: 'domcontentloaded' });
  await page.frameLocator('#jira-dashboard-overlay iframe').locator('select#jd-project').waitFor({ timeout: 60000 });
  check('deep link <jira>/secure/Dashboard.jspa#jira-status-dashboard opens it directly', true);

  check('no errors from the dashboard script', ourErrors.length === 0, ourErrors.join(' | '));
} catch (e) {
  check('e2e flow completed', false, e.message.split('\n')[0]);
  const page = browser.contexts()[0]?.pages()[0];
  if (page) await page.screenshot({ path: `${shots}/failure.png` }).catch(() => {});
} finally {
  await browser.close();
}

fs.writeFileSync(`${shots}/results.json`, JSON.stringify(results, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
