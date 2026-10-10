import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadPeopleReport } from '../src/people.js';
import { makeProjectConfig } from '../src/projectConfig.js';
import { peopleSection } from '../src/render/people.js';
import { startFakeJira } from '../test-support/fakeJira.js';

let jira, report;
const cfg = makeProjectConfig({})('DMA');

before(async () => {
  jira = await startFakeJira();
  report = await loadPeopleReport({ baseUrl: jira.url, token: 'good-token', meta: {} }, 'DMA', cfg, 7);
});
after(() => jira.close());

const person = (id) => report.people.find((p) => p.id === id);

test('done sub-tasks in the window are credited to their assignee, by lane', () => {
  const ali = person('ali');
  assert.deepEqual(ali.done.map((d) => d.key).sort(), ['DMA-10', 'DMA-11', 'DMA-12']);
  assert.deepEqual(ali.counts, { done: 3, backend: 3, frontend: 0, other: 0 });
});

test('cycle time runs from first In Progress to the last Done', () => {
  const d10 = person('ali').done.find((d) => d.key === 'DMA-10');
  assert.ok(Math.abs(d10.hours - 28) < 0.1, String(d10.hours));
  // reopened item: first In Progress 80h ago -> last Done 1h ago
  const d12 = person('ali').done.find((d) => d.key === 'DMA-12');
  assert.ok(Math.abs(d12.hours - 79) < 0.1, String(d12.hours));
});

test('a Done -> open move inside the window counts as reopened', () => {
  assert.deepEqual(person('ali').reopened.map((r) => r.key), ['DMA-12']);
  assert.deepEqual(person('sara').reopened, []);
});

test('only worklogs started inside the window are summed', () => {
  assert.equal(person('ali').loggedHours, 2);   // the 30-day-old hour is excluded
  assert.equal(person('sara').loggedHours, 1.5);
});

test('current workload lists what each person holds in progress', () => {
  assert.deepEqual(person('sara').inProgress.map((i) => i.key), ['DMA-13']);
  assert.equal(person('sara').counts.done, 0);
});

test('people are listed alphabetically, never ranked', () => {
  assert.deepEqual(report.people.map((p) => p.name), ['Ali Backend', 'Sara Frontend']);
});

test('rendered section: summary table, per-person cards, and the "not a quality score" note', () => {
  const html = peopleSection(report, jira.url);
  assert.match(html, /Ali Backend/);
  assert.match(html, /Sara Frontend/);
  assert.match(html, /بازگشتی/);
  assert.match(html, /به‌تنهایی معیار کیفیت یا عملکرد نیستند/);
  assert.match(html, /ترتیب الفبایی است، نه رتبه‌بندی/);
  assert.match(peopleSection(null, jira.url), /داده‌ی افراد از Jira دریافت نشد/);
});
