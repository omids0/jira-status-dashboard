import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLE } from '../src/render/style.js';
import { shell } from '../src/render/shell.js';
import { toolbar } from '../src/render/toolbar.js';
import { renderReport } from '../src/render/report.js';
import { renderLogin } from '../src/render/pages.js';

const minimalReport = {
  projectKey: 'DMA',
  baseUrl: 'https://jira.example.com',
  generatedAt: '2026-10-10T13:47:00.000Z',
  lanes: { backend: 'Back-End', frontend: 'Front-End' },
  modules: [],
  totals: { done: 1, inProgress: 1, backlog: 2, total: 4 },
  inProgressRows: [],
  storyIndex: {}
};

test('theme: follows the OS unless a choice is saved, and prints in light', () => {
  assert.ok(STYLE.includes(':root:not([data-theme="light"])'), 'OS dark applies unless light was chosen');
  assert.ok(STYLE.includes(':root[data-theme="dark"]'), 'explicit dark wins over a light OS');
  assert.ok(/@media print\{[^}]*--bg:#fff/.test(STYLE), 'print forces light variables');
});

test('every page restores the saved theme before first paint and exposes the toggle', () => {
  const html = shell('t', '<p>x</p>');
  assert.ok(html.includes("localStorage.getItem(KEY)"));
  assert.ok(html.includes('window.__jdToggleTheme'));
  assert.ok(html.indexOf('__jdToggleTheme') < html.indexOf('<body>'), 'script runs in <head>, before the body paints');
  assert.ok(renderLogin({}).includes('__jdToggleTheme'));
});

test('toolbar has the theme button in both hosts', () => {
  for (const embedded of [false, true]) {
    assert.match(toolbar({ projects: [], embedded }), /class="tb-link theme-btn" onclick="__jdToggleTheme\(\)"/);
  }
});

test('generation date is RTL text, not an LTR .num isolate (which pushed the day to the end)', () => {
  const html = renderReport(minimalReport, { projects: [] });
  const subtitle = /<p class="subtitle">(.*?)<\/p>/s.exec(html)[1];
  assert.match(subtitle, /<bdi dir="rtl">/);
  assert.ok(!/class="num"[^>]*>[^<]*مهر|class="num"[^>]*>[^<]*،/.test(subtitle), 'no Persian date inside an .num span');
});

test('stat tiles keep their Persian sentence in an RTL container', () => {
  const html = renderReport(minimalReport, { projects: [] });
  assert.match(html, /<div class="stat-sub">1 از 4 استوری/);
  assert.ok(!html.includes('<div class="stat-sub num">'));
});

test('chart day labels are RTL even though the SVG itself is LTR', async () => {
  const { buildStoryChart } = await import('../src/render/charts.js');
  const svg = buildStoryChart([{ date: '2026-10-10', count: 1 }, { date: '2026-10-09', count: 0 }]);
  assert.match(svg, /direction:rtl;unicode-bidi:isolate/);
});
