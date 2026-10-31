# gitstats

Zero-dependency CLI to summarize a git repository: commits, authors, file churn,
and an activity heatmap. Reads directly from `git`, no database, no config.

## Features

- Total commits, authors, files touched, lines added/removed
- Author leaderboard
- Top files by churn (added + removed)
- Commit frequency by day and by hour
- 7x24 activity heatmap (UTC)
- Date range and path filters
- JSON output for scripting

## Install

```sh
npm install -g gitstats
```

Or run from a clone:

```sh
git clone https://github.com/rayhanlimon/gitstats.git
cd gitstats
node bin/gitstats.js --help
```

## Usage

Run inside any git repository:

```sh
gitstats
```

Sample output:

```
Repository: /home/you/project
Commits:    142
Authors:    4
Files:      87
Added:      +12430
Removed:    -3120
Days active: 61
Busiest day: 2026-10-15 (9 commits)
Busiest hour: 10:00 (23 commits)

Top authors:
    87  Alice
    31  Bob
    18  Carol
     6  Dave

Top files by churn:
   1240  src/index.js
    890  README.md
```

Options:

```sh
gitstats --json                       # machine-readable
gitstats --authors                   # author leaderboard only
gitstats --files 20                  # top 20 files by churn
gitstats --heatmap                   # 7x24 activity grid
gitstats --since 2026-01-01          # commits on/after date
gitstats --until 2026-06-01          # commits before date
gitstats --path src/                  # restrict to a path
gitstats --top 10                    # limit author/file lists
gitstats /path/to/repo               # analyze another repo
```

## How it works

gitstats shells out to `git log` and `git show --numstat`, parses the output
in pure JavaScript, and aggregates. Binary files are skipped. On very large
repositories only the first 2000 commits are analyzed for file churn (commit
counts and author stats use the full history).

## Development

```sh
npm test
```

## License

MIT
