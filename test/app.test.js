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

const form = (data) => ({
  method: 'POST',
  redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(data)
});

function cookieOf(res) {
  return (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
}

async function login(extra = {}) {
  const res = await fetch(`${base}/login`, form({ baseUrl: jira.url, token: 'good-token', ...extra }));
  return { res, cookie: cookieOf(res) };
}

test('unauthenticated visitors are sent to /login', async () => {
  const res = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
  assert.match(await (await fetch(`${base}/login`)).text(), /Personal Access Token/);
});

test('bad token is rejected on the login page, no session cookie', async () => {
  const res = await fetch(`${base}/login`, form({ baseUrl: jira.url, token: 'wrong' }));
  assert.equal(res.status, 400);
  assert.equal(cookieOf(res), '');
  assert.match(await res.text(), /Jira توکن رو قبول نکرد/);
});

test('invalid base URL and project key are rejected before touching Jira', async () => {
  const before = jira.calls.length;
  const a = await fetch(`${base}/login`, form({ baseUrl: 'ftp://nope', token: 'x' }));
  const b = await fetch(`${base}/login`, form({ baseUrl: jira.url, token: 'good-token', project: 'bad key; DROP' }));
  assert.equal(a.status, 400);
  assert.equal(b.status, 400);
  assert.equal(jira.calls.length, before);
});

test('login with a project goes straight to its report (DMA, US-prefix modules)', async () => {
  const { res, cookie } = await login({ project: 'dma' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/');
  assert.match((res.headers.getSetCookie()[0]), /HttpOnly/i);

  const html = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  assert.match(html, /ردیاب پروژه DMA/);
  assert.match(html, /Test User/);
  assert.match(html, /آماده برای فرانت/);
  assert.match(html, /فرانت در حال انجام/);
  assert.match(html, /Sprint One/);
  assert.match(html, /Sprint Two/);
  assert.match(html, /AAA/);
  assert.ok(!html.includes('good-token'), 'token must never reach the browser');
});

test('parallel list is scoped to the planning sprint (no active one -> next future)', async () => {
  const { cookie } = await login({ project: 'DMA' });
  const html = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  const plan = html.slice(html.indexOf('هم‌زمان صدا بزنی'));
  assert.ok(plan.includes('اسپرینت بعدی (اسپرینت فعالی نیست)'));
  assert.match(plan, /Sprint Two/);
  assert.match(plan, /DMA-2/);
});

test('the true-completion numbers are right', async () => {
  const { cookie } = await login({ project: 'DMA' });
  const html = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  // 1 done, 2 in progress (DMA-2 backend-only, DMA-3 frontend running), 1 backlog -> 25% / 50% / 25%
  assert.match(html, /1 از 4 استوری/);
  assert.match(html, /2 از 4 استوری/);
});

test('no project at login -> picker -> pick ABC, grouped by epic', async () => {
  const { res, cookie } = await login();
  assert.equal(res.headers.get('location'), '/projects');
  const picker = await (await fetch(`${base}/projects`, { headers: { cookie } })).text();
  assert.match(picker, /<option value="DMA">/);
  assert.match(picker, /<option value="ABC">/);

  const pick = await fetch(`${base}/projects`, { ...form({ project: 'abc' }), headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(pick.headers.get('location'), '/');
  const html = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  assert.match(html, /ردیاب پروژه ABC/);
  assert.match(html, /Onboarding epic/);
  assert.match(html, /هیچ اسپرینتی برای این پروژه پیدا نشد/);
});

test('unknown project is bounced back to the picker with a message', async () => {
  const { cookie } = await login();
  const pick = await fetch(`${base}/projects`, { ...form({ project: 'ZZZ' }), headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.match(decodeURIComponent(pick.headers.get('location')), /ZZZ.*پیدا نشد/);
});

test('?project= switches project on the fly', async () => {
  const { cookie } = await login({ project: 'DMA' });
  const html = await (await fetch(`${base}/?project=ABC`, { headers: { cookie } })).text();
  assert.match(html, /ردیاب پروژه ABC/);
});

test('history snapshot is written per Jira+project', async () => {
  const { cookie } = await login({ project: 'DMA' });
  await fetch(`${base}/?refresh=1`, { headers: { cookie } });
  const files = fs.readdirSync(path.join(dataDir, 'history'));
  assert.ok(files.some((f) => f.endsWith('__DMA.json')), files.join(','));
});

test('report is cached briefly: a plain reload does not re-query Jira', async () => {
  const { cookie } = await login({ project: 'DMA' });
  await fetch(`${base}/?refresh=1`, { headers: { cookie } });
  const calls = jira.calls.length;
  await fetch(`${base}/`, { headers: { cookie } });
  assert.equal(jira.calls.length, calls);
});

test('logout destroys the session', async () => {
  const { cookie } = await login({ project: 'DMA' });
  const out = await fetch(`${base}/logout`, { method: 'POST', redirect: 'manual', headers: { cookie } });
  assert.equal(out.status, 302);
  const after = await fetch(`${base}/`, { redirect: 'manual', headers: { cookie } });
  assert.equal(after.headers.get('location'), '/login');
});

test('healthz answers without a session', async () => {
  assert.equal(await (await fetch(`${base}/healthz`)).text(), 'ok');
});
