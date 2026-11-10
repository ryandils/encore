import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkContext, validateHandoff } from './context-check.mjs';

const valid = ['Task', 'Outcome', 'Changes', 'Verification', 'Context impact', 'Learning note', 'Next step']
  .map(heading => `## ${heading}\n\nSpecific evidence for ${heading}.`).join('\n\n');

test('handoff sections must be populated and a literal template is rejected', () => {
  assert.deepEqual(validateHandoff(valid, 'template'), []);
  assert.ok(validateHandoff(valid.replace('Specific evidence for Verification.', 'TODO'), 'template').length);
  assert.ok(validateHandoff(valid.replace('## Learning note', '## Other'), 'template').length);
  assert.ok(validateHandoff(valid, valid).length);
});

test('real Git diff gate handles docs, code, staged handoffs, commits, deletion, and missing base', () => {
  const root = mkdtempSync(join(tmpdir(), 'encore-context-'));
  function git(...args) {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.error?.message);
    return r.stdout.trim();
  }
  try {
    git('init');
    git('config', 'user.name', 'Harness Test');
    git('config', 'user.email', 'test@example.invalid');
    mkdirSync(join(root, 'docs/handoffs'), { recursive: true });
    writeFileSync(join(root, 'README.md'), 'baseline\n');
    writeFileSync(join(root, 'docs/handoffs/TEMPLATE.md'), 'template\n');
    writeFileSync(join(root, 'code.mjs'), 'export const value = 1;\n');
    git('add', '.'); git('commit', '-m', 'baseline');
    const base = git('rev-parse', 'HEAD');
    writeFileSync(join(root, 'README.md'), 'docs edit\n');
    assert.equal(checkContext({ root, base }).required, false);
    writeFileSync(join(root, 'code.mjs'), 'export const value = 2;\n');
    assert.throws(() => checkContext({ root, base }), /add and stage/);
    const handoff = join(root, 'docs/handoffs/task-change.md');
    writeFileSync(handoff, valid);
    assert.throws(() => checkContext({ root, base }), /add and stage/);
    git('add', 'docs/handoffs/task-change.md');
    assert.equal(checkContext({ root, base }).required, true);
    git('add', '.'); git('commit', '-m', 'change');
    assert.equal(checkContext({ root, base }).handoffs.length, 1);
    rmSync(handoff);
    assert.throws(() => checkContext({ root, base }), /add and stage/);
    assert.throws(() => checkContext({ root, base: 'not-a-ref' }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
