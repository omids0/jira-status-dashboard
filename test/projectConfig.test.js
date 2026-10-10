import test from 'node:test';
import assert from 'node:assert/strict';
import { makeProjectConfig } from '../src/projectConfig.js';

test('unknown project gets the defaults', () => {
  const cfg = makeProjectConfig({})('ANY');
  assert.equal(cfg.storyJql, '');
  assert.deepEqual(cfg.components, { backend: 'Back-End', frontend: 'Front-End' });
  assert.equal(cfg.moduleBy, 'auto');
});

test('per-project settings override defaults, components merge key by key', () => {
  const cfgFor = makeProjectConfig({
    defaults: { moduleBy: 'prefix', moduleLabels: { A: 'a-default' } },
    projects: { DEK: { storyJql: 'labels = x', components: { frontend: 'UI' }, moduleLabels: { B: 'b' } } }
  });
  const dek = cfgFor('DEK');
  assert.equal(dek.storyJql, 'labels = x');
  assert.equal(dek.moduleBy, 'prefix');
  assert.deepEqual(dek.components, { backend: 'Back-End', frontend: 'UI' });
  assert.deepEqual(dek.moduleLabels, { A: 'a-default', B: 'b' });
  assert.equal(cfgFor('OTHER').storyJql, '');
});

test('the config of one project never leaks into another', () => {
  const cfgFor = makeProjectConfig({ projects: { A: { moduleLabels: { X: 'only A' } } } });
  cfgFor('A').moduleLabels.Y = 'mutated';
  assert.deepEqual(cfgFor('B').moduleLabels, {});
  assert.deepEqual(cfgFor('A').moduleLabels, { X: 'only A' });
});
