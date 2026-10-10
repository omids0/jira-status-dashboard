import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildStatic } from '../src/staticBuild.js';
import { loadConfig } from '../src/config.js';
import { startFakeJira } from '../test-support/fakeJira.js';

let jira, tmp, config;

before(async () => {
  jira = await startFakeJira();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jd-static-'));
  config = loadConfig({ DATA_DIR: path.join(tmp, 'data'), PROJECTS_CONFIG: path.join(tmp, 'none.json') });
});

after(async () => {
  await jira.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const run = (over = {}) => buildStatic({
  baseUrl: jira.url,
  token: 'good-token',
  projects: ['DMA', 'ABC'],
  outDir: path.join(tmp, 'dist'),
  dataDir: config.dataDir,
  projectConfig: config.projectConfig,
  ...over
});

test('writes one page per project plus index.html', async () => {
  const { written, failed } = await run();
  assert.deepEqual(written, ['DMA', 'ABC']);
  assert.deepEqual(failed, []);
  const dist = path.join(tmp, 'dist');
  assert.deepEqual(fs.readdirSync(dist).sort(), ['ABC.html', 'DMA.html', 'index.html']);
  assert.equal(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'), fs.readFileSync(path.join(dist, 'DMA.html'), 'utf8'));
});

test('pages are static: no login/logout, project select jumps between files, noindex, no token', async () => {
  await run();
  const html = fs.readFileSync(path.join(tmp, 'dist', 'DMA.html'), 'utf8');
  assert.match(html, /ردیاب پروژه DMA/);
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.match(html, /location\.href=this\.value\+'\.html'/);
  assert.match(html, /<option value="ABC">ABC — ABC project<\/option>/);
  assert.match(html, /<option value="DMA" selected>/);
  assert.ok(!html.includes('action="/logout"'));
  assert.ok(!html.includes('refresh=1'));
  assert.ok(!html.includes('good-token'));
  assert.match(html, /آماده برای فرانت/);
  assert.match(html, /Sprint Two/);
});

test('a failing project fails the build report but the others are still written', async () => {
  const { written, failed } = await run({ projects: ['DMA', 'ZZZ'], outDir: path.join(tmp, 'dist2') });
  assert.deepEqual(written, ['DMA']);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].key, 'ZZZ');
});

test('bad token, bad URL and bad project keys are rejected up front', async () => {
  await assert.rejects(run({ token: 'wrong' }), /Jira 401/);
  await assert.rejects(run({ baseUrl: 'nope' }), /JIRA_BASE_URL/);
  await assert.rejects(run({ token: '' }), /JIRA_TOKEN/);
  await assert.rejects(run({ projects: [''] }), /PROJECTS is empty/);
  await assert.rejects(run({ projects: ['dma; drop'] }), /Invalid project key/);
});
