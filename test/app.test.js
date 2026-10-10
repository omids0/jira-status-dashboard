import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { startFakeJira } from '../test-support/fakeJira.js';

let jira, app, server, base, dataDir;

before(async () => {
  jira = await startFakeJira();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jd-test-'));
  const config = loadConfig({ DATA_DIR: dataDir, PROJECTS_CONFIG: path.join(dataDir, 'none.json') });
  app = createApp(config);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  app.close();
  await new Promise((r) => server.close(r));
  await jira.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const formPost = (data, cookie) => ({
  method: 'POST',
  redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
  body: new URLSearchParams(data)
});

const cookieOf = (res) => (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');

async function login(extra = {}) {
  const res = await fetch(`${base}/login`, formPost({ baseUrl: jira.url, token: 'good-token', ...extra }));
  return { res, cookie: cookieOf(res) };
}

const get = async (cookie, url = '/') => (await fetch(`${base}${url}`, { headers: { cookie } })).text();

test('unauthenticated visitors are sent to /login', async () => {
  const res = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
  const page = await (await fetch(`${base}/login`)).text();
  assert.match(page, /Personal Access Token/);
  assert.ok(!page.includes('name="project"'), 'project is chosen after login, not on the login form');
  assert.match(page, /دریافت توکن/);
  assert.match(page, /Personal Access Tokens/);
  assert.ok(page.includes('/plugins/servlet/personal-access-tokens'));
});

test('bad token is rejected on the login page, no session cookie', async () => {
  const res = await fetch(`${base}/login`, formPost({ baseUrl: jira.url, token: 'wrong' }));
  assert.equal(res.status, 400);
  assert.equal(cookieOf(res), '');
  assert.match(await res.text(), /Jira توکن را نپذیرفت/);
});

test('invalid base URL is rejected before touching Jira', async () => {
  const before = jira.calls.length;
  const res = await fetch(`${base}/login`, formPost({ baseUrl: 'ftp://nope', token: 'x' }));
  assert.equal(res.status, 400);
  assert.equal(jira.calls.length, before);
});

test('login lands on a page with a project select box and no report yet', async () => {
  const { res, cookie } = await login();
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/');
  assert.match(res.headers.getSetCookie()[0], /HttpOnly/i);

  const html = await get(cookie);
  assert.match(html, /<select name="project"/);
  assert.match(html, /<option value="DMA">DMA — DMA project<\/option>/);
  assert.match(html, /<option value="ABC">ABC — ABC project<\/option>/);
  assert.ok(html.includes('<h2>انتخاب پروژه</h2>'));
  assert.ok(!html.includes('ردیاب پروژه'), 'no report before a project is chosen');
  assert.ok(!html.includes('good-token'), 'token must never reach the browser');
});

test('choosing DMA in the select shows its report, with DMA selected', async () => {
  const { cookie } = await login();
  const html = await get(cookie, '/?project=DMA');
  assert.match(html, /ردیاب پروژه DMA/);
  assert.match(html, /<option value="DMA" selected>/);
  assert.match(html, /Test User/);
  assert.match(html, /آماده‌ی شروع فرانت‌اند/);
  assert.match(html, /فرانت‌اند در حال انجام/);
  assert.match(html, /Sprint One/);
  assert.match(html, /Sprint Two/);
  assert.match(html, /AAA/);
});

test('the choice sticks for the session: plain / keeps showing the project', async () => {
  const { cookie } = await login();
  await get(cookie, '/?project=DMA');
  assert.match(await get(cookie), /ردیاب پروژه DMA/);
});

test('parallel list is scoped to the planning sprint (no active one -> next future)', async () => {
  const { cookie } = await login();
  const html = await get(cookie, '/?project=DMA');
  const plan = html.slice(html.indexOf('اقدامات پیشنهادی به تفکیک نقش'));
  assert.ok(plan.includes('اسپرینت فعالی وجود ندارد؛ مبنا اسپرینت بعدی است'));
  assert.match(plan, /Sprint Two/);
  assert.match(plan, /DMA-2/);
});

test('the true-completion numbers are right', async () => {
  const { cookie } = await login();
  const html = await get(cookie, '/?project=DMA');
  // 1 done, 2 in progress (DMA-2 backend-only, DMA-3 frontend running), 1 backlog
  assert.match(html, /1 از 4 استوری/);
  assert.match(html, /2 از 4 استوری/);
});

test('switching to ABC groups by epic and has no sprints', async () => {
  const { cookie } = await login();
  await get(cookie, '/?project=DMA');
  const html = await get(cookie, '/?project=abc');
  assert.match(html, /ردیاب پروژه ABC/);
  assert.match(html, /<option value="ABC" selected>/);
  assert.match(html, /Onboarding epic/);
  assert.match(html, /اسپرینتی برای این پروژه یافت نشد/);
});

test('unknown project bounces back to the select with a message', async () => {
  const { cookie } = await login();
  const html = await get(cookie, '/?project=ZZZ');
  assert.match(html, /خواندن پروژه ZZZ ممکن نشد/);
  assert.match(html, /<select name="project"/);
  assert.ok(!html.includes('ردیاب پروژه ZZZ'));
});

test('malformed project key is refused without querying Jira for it', async () => {
  const { cookie } = await login();
  await get(cookie);
  const calls = jira.calls.length;
  const html = await get(cookie, `/?project=${encodeURIComponent('A" OR 1=1')}`);
  assert.match(html, /کلید پروژه معتبر نیست/);
  assert.equal(jira.calls.length, calls);
});

test('history snapshot is written per Jira+project', async () => {
  const { cookie } = await login();
  await get(cookie, '/?project=DMA&refresh=1');
  const files = fs.readdirSync(path.join(dataDir, 'history'));
  assert.ok(files.some((f) => f.endsWith('__DMA.json')), files.join(','));
});

test('report is cached briefly: a plain reload does not re-query Jira', async () => {
  const { cookie } = await login();
  await get(cookie, '/?project=DMA&refresh=1');
  const calls = jira.calls.length;
  await get(cookie);
  assert.equal(jira.calls.length, calls);
});

test('logout destroys the session', async () => {
  const { cookie } = await login();
  const out = await fetch(`${base}/logout`, { method: 'POST', redirect: 'manual', headers: { cookie } });
  assert.equal(out.status, 302);
  const after = await fetch(`${base}/`, { redirect: 'manual', headers: { cookie } });
  assert.equal(after.headers.get('location'), '/login');
});

test('healthz answers without a session', async () => {
  assert.equal(await (await fetch(`${base}/healthz`)).text(), 'ok');
});
