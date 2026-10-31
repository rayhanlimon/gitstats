import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isGitRepo, repoRoot, commitLog, numstat } from '../src/git.js';
import { authorStats, commitFrequencyByDay, commitFrequencyByHour, fileChurn, topFilesByChurn, activityHeatmap, summarize } from '../src/analyze.js';

const CLI = path.resolve('/home/shadow/git/gitstats/bin/gitstats.js');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function makeRepo() {
  const d = mkdtempSync(path.join(tmpdir(), 'gs-'));
  git(d, ['init', '-q']);
  git(d, ['config', 'user.name', 'Alice']);
  git(d, ['config', 'user.email', 'alice@example.com']);
  writeFileSync(path.join(d, 'a.txt'), 'hello\n');
  git(d, ['add', 'a.txt']);
  git(d, ['commit', '-q', '-m', 'first commit']);
  writeFileSync(path.join(d, 'a.txt'), 'hello\nworld\n');
  git(d, ['add', 'a.txt']);
  git(d, ['commit', '-q', '-m', 'second commit', '--date=2026-10-30T10:00:00']);
  git(d, ['config', 'user.name', 'Bob']);
  git(d, ['config', 'user.email', 'bob@example.com']);
  writeFileSync(path.join(d, 'b.txt'), 'x\n');
  git(d, ['add', 'b.txt']);
  git(d, ['commit', '-q', '-m', 'third commit']);
  return d;
}

test('isGitRepo true inside, false outside', () => {
  const d = makeRepo();
  assert.equal(isGitRepo(d), true);
  const outside = mkdtempSync(path.join(tmpdir(), 'gs-'));
  assert.equal(isGitRepo(outside), false);
  rmSync(d, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

test('repoRoot returns top-level', () => {
  const d = makeRepo();
  assert.equal(repoRoot(d), d);
  rmSync(d, { recursive: true, force: true });
});

test('commitLog parses commits', () => {
  const d = makeRepo();
  const c = commitLog(d);
  assert.equal(c.length, 3);
  assert.equal(c[0].author, 'Bob');
  assert.equal(c[2].author, 'Alice');
  assert.match(c[0].subject, /third commit/);
  rmSync(d, { recursive: true, force: true });
});

test('commitLog --since filters', () => {
  const d = makeRepo();
  const c = commitLog(d, { since: '2026-10-30' });
  assert.ok(c.length >= 1);
  rmSync(d, { recursive: true, force: true });
});

test('numstat parses added/removed', () => {
  const d = makeRepo();
  const c = commitLog(d);
  const ns = numstat(d, c[1].hash);
  assert.ok(ns.length >= 1);
  assert.equal(ns[0].file, 'a.txt');
  assert.equal(ns[0].added, 1);
  assert.equal(ns[0].removed, 0);
  rmSync(d, { recursive: true, force: true });
});

test('authorStats groups and sorts', () => {
  const commits = [
    { author: 'Alice', email: 'a@x', date: '2026-10-30T10:00:00Z' },
    { author: 'Alice', email: 'a@x', date: '2026-10-30T11:00:00Z' },
    { author: 'Bob', email: 'b@x', date: '2026-10-30T12:00:00Z' }
  ];
  const s = authorStats(commits);
  assert.equal(s[0].author, 'Alice');
  assert.equal(s[0].commits, 2);
  assert.equal(s[1].commits, 1);
});

test('commitFrequencyByDay groups by date', () => {
  const commits = [
    { date: '2026-10-30T10:00:00Z' },
    { date: '2026-10-30T11:00:00Z' },
    { date: '2026-10-31T09:00:00Z' }
  ];
  const d = commitFrequencyByDay(commits);
  assert.equal(d.length, 2);
  assert.equal(d[0].date, '2026-10-30');
  assert.equal(d[0].count, 2);
});

test('commitFrequencyByHour buckets 0..23', () => {
  const commits = [{ date: '2026-10-30T10:00:00Z' }, { date: '2026-10-30T10:30:00Z' }];
  const h = commitFrequencyByHour(commits);
  assert.equal(h.length, 24);
  assert.equal(h[10].count, 2);
  assert.equal(h[0].count, 0);
});

test('fileChurn aggregates and sorts', () => {
  const ns = [
    { file: 'a.txt', added: 5, removed: 2 },
    { file: 'a.txt', added: 1, removed: 0 },
    { file: 'b.txt', added: 10, removed: 0 }
  ];
  const c = fileChurn(ns);
  assert.equal(c[0].file, 'b.txt');
  assert.equal(c[0].churn, 10);
  assert.equal(c[1].file, 'a.txt');
  assert.equal(c[1].added, 6);
  assert.equal(c[1].removed, 2);
  assert.equal(c[1].touches, 2);
});

test('topFilesByChurn limits', () => {
  const ns = [
    { file: 'a.txt', added: 1, removed: 0 },
    { file: 'b.txt', added: 2, removed: 0 },
    { file: 'c.txt', added: 3, removed: 0 }
  ];
  assert.equal(topFilesByChurn(ns, 2).length, 2);
  assert.equal(topFilesByChurn(ns, 2)[0].file, 'c.txt');
});

test('activityHeatmap is 7x24', () => {
  const commits = [{ date: '2026-10-30T10:00:00Z' }];
  const g = activityHeatmap(commits);
  assert.equal(g.length, 7);
  assert.equal(g[0].length, 24);
  const total = g.flat().reduce((s, n) => s + n, 0);
  assert.equal(total, 1);
});

test('summarize produces expected shape', () => {
  const commits = [
    { author: 'Alice', email: 'a@x', date: '2026-10-30T10:00:00Z' },
    { author: 'Bob', email: 'b@x', date: '2026-10-31T09:00:00Z' }
  ];
  const ns = [{ file: 'a.txt', added: 5, removed: 2 }];
  const s = summarize(commits, ns);
  assert.equal(s.commits, 2);
  assert.equal(s.authors, 2);
  assert.equal(s.files, 1);
  assert.equal(s.added, 5);
  assert.equal(s.removed, 2);
  assert.equal(s.daysActive, 2);
  assert.ok(s.busiestDay);
  assert.equal(s.topFiles[0].file, 'a.txt');
});

test('CLI: not a git repo exits 2', () => {
  const d = mkdtempSync(path.join(tmpdir(), 'gs-'));
  let code = 0;
  try { execFileSync(process.execPath, [CLI], { cwd: d }); }
  catch (e) { code = e.status; }
  assert.equal(code, 2);
  rmSync(d, { recursive: true, force: true });
});

test('CLI: summary on a real repo', () => {
  const d = makeRepo();
  const out = execFileSync(process.execPath, [CLI], { cwd: d, encoding: 'utf8' });
  assert.match(out, /Commits:/);
  assert.match(out, /Authors:/);
  assert.match(out, /Top files by churn:/);
  assert.match(out, /Alice/);
  rmSync(d, { recursive: true, force: true });
});

test('CLI: --json summary', () => {
  const d = makeRepo();
  const out = execFileSync(process.execPath, [CLI, '--json'], { cwd: d, encoding: 'utf8' });
  const parsed = JSON.parse(out);
  assert.equal(parsed.commits, 3);
  assert.equal(parsed.authors, 2);
  rmSync(d, { recursive: true, force: true });
});

test('CLI: --authors', () => {
  const d = makeRepo();
  const out = execFileSync(process.execPath, [CLI, '--authors'], { cwd: d, encoding: 'utf8' });
  assert.match(out, /Alice/);
  assert.match(out, /Bob/);
  rmSync(d, { recursive: true, force: true });
});

test('CLI: --files 2', () => {
  const d = makeRepo();
  const out = execFileSync(process.execPath, [CLI, '--files', '2'], { cwd: d, encoding: 'utf8' });
  assert.match(out, /Top files by churn:/);
  rmSync(d, { recursive: true, force: true });
});

test('CLI: --heatmap', () => {
  const d = makeRepo();
  const out = execFileSync(process.execPath, [CLI, '--heatmap'], { cwd: d, encoding: 'utf8' });
  assert.match(out, /Activity heatmap/);
  rmSync(d, { recursive: true, force: true });
});

test('CLI: --version and --help', () => {
  const d = mkdtempSync(path.join(tmpdir(), 'gs-'));
  const v = execFileSync(process.execPath, [CLI, '--version'], { cwd: d, encoding: 'utf8' });
  assert.match(v, /^0\.1\.0$/m);
  const h = execFileSync(process.execPath, [CLI, '--help'], { cwd: d, encoding: 'utf8' });
  assert.match(h, /summarize a git repository/);
  rmSync(d, { recursive: true, force: true });
});

test('CLI: --since filters commits', () => {
  const d = makeRepo();
  const out = execFileSync(process.execPath, [CLI, '--json', '--since', '2099-01-01'], { cwd: d, encoding: 'utf8' });
  const parsed = JSON.parse(out);
  assert.equal(parsed.commits, 0);
  rmSync(d, { recursive: true, force: true });
});