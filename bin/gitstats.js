#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGitRepo, repoRoot, commitLog, numstat, totalCommitCount } from '../src/git.js';
import { summarize, authorStats, commitFrequencyByDay, commitFrequencyByHour, topFilesByChurn, activityHeatmap } from '../src/analyze.js';

const VERSION = '0.1.0';
const argv = process.argv.slice(2);

function fail(msg, code = 2) {
  process.stderr.write('gitstats: ' + msg + '\n');
  process.exit(code);
}

function help() {
  console.log('gitstats ' + VERSION + ' - summarize a git repository');
  console.log('');
  console.log('Usage: gitstats [options] [path]');
  console.log('');
  console.log('Options:');
  console.log('  --json              machine-readable output');
  console.log('  --authors           author leaderboard only');
  console.log('  --files [N]         top N files by churn (default 10)');
  console.log('  --heatmap           7x24 activity heatmap');
  console.log('  --since <date>      include commits on/after date (ISO)');
  console.log('  --until <date>      include commits before date (ISO)');
  console.log('  --path <glob-ish>   restrict to a path (passed to git log)');
  console.log('  --top <N>           limit author/file lists');
  console.log('  --help, -h          show this help');
  console.log('  --version, -v       print version');
  console.log('');
  console.log('Path defaults to the current working directory.');
}

function parseArgs(a) {
  const o = { positional: [], files: 10, filesSet: false, top: 5 };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--json') o.json = true;
    else if (x === '--authors') o.authors = true;
    else if (x === '--files') { o.files = Number(a[++i]) || 10; o.filesSet = true; }
    else if (x === '--heatmap') o.heatmap = true;
    else if (x === '--since') o.since = a[++i];
    else if (x === '--until') o.until = a[++i];
    else if (x === '--path') o.path = a[++i];
    else if (x === '--top') o.top = Number(a[++i]) || 5;
    else if (x === '--help' || x === '-h') o.help = true;
    else if (x === '--version' || x === '-v') o.version = true;
    else if (x.startsWith('--')) fail('unknown option ' + x);
    else o.positional.push(x);
  }
  return o;
}

const opts = parseArgs(argv);
if (opts.help) { help(); process.exit(0); }
if (opts.version) { console.log(VERSION); process.exit(0); }

const target = opts.positional[0] || process.cwd();
if (!isGitRepo(target)) fail('not a git repository: ' + target);

const root = repoRoot(target);
const commits = commitLog(root, { since: opts.since, until: opts.until, path: opts.path });

// gather numstat for each commit (cap to keep it fast on huge repos)
const MAX = 2000;
const sample = commits.slice(0, MAX);
const numstats = [];
for (const c of sample) {
  try {
    for (const n of numstat(root, c.hash)) numstats.push(n);
  } catch { /* skip */ }
}

const summary = summarize(commits, numstats);

if (opts.authors) {
  const list = authorStats(commits).slice(0, opts.top);
  if (opts.json) console.log(JSON.stringify(list, null, 2));
  else for (const a of list) console.log(String(a.commits).padStart(6) + '  ' + a.author + ' <' + a.email + '>');
  process.exit(0);
}

if (opts.filesSet) {
  const list = topFilesByChurn(numstats, opts.files);
  if (opts.json) console.log(JSON.stringify(list, null, 2));
  else {
    console.log('Top files by churn:');
    for (const f of list) console.log(String(f.churn).padStart(7) + '  ' + f.file + '  (+' + f.added + ' / -' + f.removed + ', ' + f.touches + ' touches)');
  }
  if (!opts.json && !opts.heatmap && !opts.authors) {
    // fall through to summary unless only --files was requested? keep summary too
  }
}

if (opts.heatmap) {
  const grid = activityHeatmap(commits);
  if (opts.json) console.log(JSON.stringify(grid));
  else {
    console.log('Activity heatmap (rows=day Sun..Sat, cols=hour 0..23):');
    for (let d = 0; d < 7; d++) {
      console.log(grid[d].map((n) => String(n).padStart(3)).join(' '));
    }
  }
}

// default summary
if (!opts.authors && !opts.filesSet && !opts.heatmap) {
  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('Repository: ' + root);
    console.log('Commits:    ' + summary.commits + (commits.length > MAX ? ' (analyzed first ' + MAX + ')' : ''));
    console.log('Authors:    ' + summary.authors);
    console.log('Files:      ' + summary.files);
    console.log('Added:      +' + summary.added);
    console.log('Removed:    -' + summary.removed);
    console.log('Days active:' + ' ' + summary.daysActive);
    if (summary.busiestDay) console.log('Busiest day:' + ' ' + summary.busiestDay.date + ' (' + summary.busiestDay.count + ' commits)');
    if (summary.busiestHour) console.log('Busiest hour:' + ' ' + String(summary.busiestHour.hour).padStart(2, '0') + ':00 (' + summary.busiestHour.count + ' commits)');
    console.log('');
    console.log('Top authors:');
    for (const a of summary.topAuthors) console.log('  ' + String(a.commits).padStart(6) + '  ' + a.author);
    console.log('');
    console.log('Top files by churn:');
    for (const f of summary.topFiles) console.log('  ' + String(f.churn).padStart(7) + '  ' + f.file);
  }
}