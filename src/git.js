// gitstats: thin wrapper around the git CLI.
import { execFileSync } from 'node:child_process';

export function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function isGitRepo(cwd) {
  try {
    git(['rev-parse', '--is-inside-work-tree'], cwd);
    return true;
  } catch {
    return false;
  }
}

export function repoRoot(cwd) {
  return git(['rev-parse', '--show-toplevel'], cwd).trim();
}

export function commitLog(cwd, opts = {}) {
  const args = ['log', '--pretty=format:%H\t%an\t%ae\t%aI\t%s'];
  if (opts.since) args.push('--since=' + opts.since);
  if (opts.until) args.push('--until=' + opts.until);
  if (opts.path) args.push('--', opts.path);
  const out = git(args, cwd).trim();
  if (!out) return [];
  return out.split('\n').map((line) => {
    const [hash, author, email, date, ...rest] = line.split('\t');
    return { hash, author, email, date, subject: rest.join('\t') };
  });
}

export function numstat(cwd, hash) {
  const out = git(['show', '--numstat', '--format=', hash], cwd).trim();
  if (!out) return [];
  const rows = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [added, removed, file] = line.split('\t');
    if (added === '-' || removed === '-') continue; // binary
    rows.push({ file, added: Number(added), removed: Number(removed) });
  }
  return rows;
}

export function branchList(cwd) {
  return git(['branch', '--format=%(refname:short)'], cwd).trim().split('\n').filter(Boolean);
}

export function totalCommitCount(cwd) {
  try {
    return Number(git(['rev-list', '--count', 'HEAD'], cwd).trim());
  } catch {
    return 0;
  }
}
