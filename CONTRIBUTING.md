# Contributing to gitstats

## Getting started

```sh
git clone https://github.com/rayhanlimon/gitstats.git
cd gitstats
npm test
```

## Guidelines

- Keep the project zero-dependency: no runtime dependencies.
- Node.js >= 18, ESM (`"type": "module"`).
- Add or update tests in `test/` for every behaviour change.
- Run `npm test` before opening a pull request; all tests must pass.
- Match the existing code style (2-space indent, concise comments).
