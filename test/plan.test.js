import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInsights, pickPlanningSprint } from '../src/report.js';

const row = (key, moduleId, { beDone = 2, beTotal = 2, feDone = 0, feTotal = 0 } = {}) => ({
  key, summary: key, moduleId, moduleLabel: moduleId,
  subtaskInfo: { beDone, beTotal, feDone, feTotal, otherDone: 0, otherTotal: 0, stale: false }
});

const report = (inProgressRows) => ({ modules: [], inProgressRows });
const keysOf = (insights) => insights.parallelPlan.now.map((r) => r.key);

test('pickPlanningSprint: active wins, else earliest future, else null', () => {
  const closed = { id: 1, name: 'S1', state: 'closed', keys: [] };
  const future2 = { id: 3, name: 'S3', state: 'future', startDate: '2026-11-01T00:00:00Z', keys: [] };
  const future1 = { id: 2, name: 'S2', state: 'future', startDate: '2026-10-01T00:00:00Z', keys: [] };
  const active = { id: 4, name: 'S4', state: 'active', keys: [] };

  assert.equal(pickPlanningSprint([closed, future2, future1, active]).name, 'S4');
  assert.equal(pickPlanningSprint([closed, future2, future1]).name, 'S2');
  assert.equal(pickPlanningSprint([closed]), null);
  assert.equal(pickPlanningSprint(null), null);
});

test('parallel plan only offers stories from the planning sprint', () => {
  const r = report([row('A-1', 'M1'), row('B-1', 'M2'), row('C-1', 'M3')]);
  const sprint = { name: 'Sprint 9', state: 'active', keys: ['A-1', 'C-1'] };
  const insights = computeInsights(r, sprint);

  assert.deepEqual(keysOf(insights), ['A-1', 'C-1']);
  assert.deepEqual(insights.parallelPlan.outsideSprint.map((x) => x.key), ['B-1']);
  assert.equal(insights.parallelPlan.sprint.name, 'Sprint 9');
});

test('without sprint data every ready story is a candidate', () => {
  const r = report([row('A-1', 'M1'), row('B-1', 'M2')]);
  const insights = computeInsights(r, null);
  assert.deepEqual(keysOf(insights), ['A-1', 'B-1']);
  assert.equal(insights.parallelPlan.sprint, null);
});

test('frontend in flight blocks its module even when that story is outside the sprint', () => {
  const r = report([
    row('A-1', 'M1'),
    row('A-2', 'M1', { feTotal: 3 }),
    row('B-1', 'M2')
  ]);
  const sprint = { name: 'Sprint 9', state: 'future', keys: ['A-1', 'B-1'] };
  const insights = computeInsights(r, sprint);

  assert.deepEqual(keysOf(insights), ['B-1']);
  assert.deepEqual(insights.parallelPlan.blockedModules, ['M1']);
});

test('one story per module even inside the sprint', () => {
  const r = report([row('A-1', 'M1'), row('A-2', 'M1')]);
  const sprint = { name: 'Sprint 9', state: 'active', keys: ['A-1', 'A-2'] };
  const insights = computeInsights(r, sprint);

  assert.deepEqual(keysOf(insights), ['A-1']);
  assert.deepEqual(insights.parallelPlan.queued.map((x) => x.key), ['A-2']);
});
