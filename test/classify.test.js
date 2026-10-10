import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStory } from '../src/classify.js';

const components = { backend: 'Back-End', frontend: 'Front-End' };
const be = (done) => ({ done, component: 'Back-End' });
const fe = (done) => ({ done, component: 'Front-End' });
const classify = (rawCategory, subs) => classifyStory({ rawCategory, subs, components });

test('story already Done / not started pass through', () => {
  assert.equal(classify('done', []).trueState, 'done');
  assert.equal(classify('new', []).trueState, 'backlog');
});

test('finished backend with NO frontend sub-tasks is not complete', () => {
  const r = classify('indeterminate', [be(true), be(true)]);
  assert.equal(r.trueState, 'inprogress');
  assert.equal(r.subtaskInfo.stale, false);
  assert.equal(r.backendDone, true);
  assert.equal(r.frontendDone, false);
});

test('all lanes done but story status never flipped = stale, counted Done', () => {
  const r = classify('indeterminate', [be(true), fe(true)]);
  assert.equal(r.trueState, 'done');
  assert.equal(r.subtaskInfo.stale, true);
});

test('frontend-only story is Done once its frontend is Done', () => {
  assert.equal(classify('indeterminate', [fe(true)]).trueState, 'done');
  assert.equal(classify('indeterminate', [fe(false)]).trueState, 'inprogress');
});

test('unfinished frontend keeps the story in progress', () => {
  const r = classify('indeterminate', [be(true), fe(false)]);
  assert.equal(r.trueState, 'inprogress');
  assert.deepEqual([r.subtaskInfo.feDone, r.subtaskInfo.feTotal], [0, 1]);
});

test('project without lane components: judged by all sub-tasks', () => {
  const plain = (done) => ({ done, component: null });
  assert.equal(classify('indeterminate', [plain(true), plain(true)]).trueState, 'done');
  assert.equal(classify('indeterminate', [plain(true), plain(false)]).trueState, 'inprogress');
  assert.equal(classify('indeterminate', []).trueState, 'inprogress');
});
