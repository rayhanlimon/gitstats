// gitstats: pure analysis helpers over commit data.

export function authorStats(commits) {
  const map = new Map();
  for (const c of commits) {
    const key = c.author || c.email || 'unknown';
    const a = map.get(key) || { author: c.author, email: c.email, commits: 0 };
    a.commits += 1;
    map.set(key, a);
  }
  return [...map.values()].sort((x, y) => y.commits - x.commits);
}

export function commitFrequencyByDay(commits) {
  const map = new Map();
  for (const c of commits) {
    const day = (c.date || '').slice(0, 10);
    if (!day) continue;
    map.set(day, (map.get(day) || 0) + 1);
  }
  return [...map.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function commitFrequencyByHour(commits) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const c of commits) {
    const m = (c.date || '').match(/T(\d{2}):/);
    if (!m) continue;
    buckets[Number(m[1])].count += 1;
  }
  return buckets;
}

export function fileChurn(numstats) {
  // numstats: array of {file, added, removed}
  const map = new Map();
  for (const n of numstats) {
    const f = map.get(n.file) || { file: n.file, added: 0, removed: 0, touches: 0 };
    f.added += n.added;
    f.removed += n.removed;
    f.touches += 1;
    map.set(n.file, f);
  }
  return [...map.values()]
    .map((f) => ({ ...f, churn: f.added + f.removed }))
    .sort((a, b) => b.churn - a.churn);
}

export function topFilesByChurn(numstats, limit = 10) {
  return fileChurn(numstats).slice(0, limit);
}

export function activityHeatmap(commits) {
  // returns 7x24 grid: heatmap[weekday][hour] = count, weekday 0=Sunday
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const c of commits) {
    const d = new Date(c.date);
    if (Number.isNaN(d.getTime())) continue;
    grid[d.getUTCDay()][d.getUTCHours()] += 1;
  }
  return grid;
}

export function summarize(commits, numstats) {
  const authors = authorStats(commits);
  const days = commitFrequencyByDay(commits);
  const hours = commitFrequencyByHour(commits);
  const churn = fileChurn(numstats);
  const totalAdded = numstats.reduce((s, n) => s + n.added, 0);
  const totalRemoved = numstats.reduce((s, n) => s + n.removed, 0);
  const busiestDay = days.length ? days.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  const busiestHour = hours.reduce((a, b) => (b.count > a.count ? b : a));
  return {
    commits: commits.length,
    authors: authors.length,
    files: new Set(numstats.map((n) => n.file)).size,
    added: totalAdded,
    removed: totalRemoved,
    busiestDay,
    busiestHour: busiestHour.count > 0 ? busiestHour : null,
    topAuthors: authors.slice(0, 5),
    topFiles: churn.slice(0, 10),
    daysActive: days.length
  };
}
