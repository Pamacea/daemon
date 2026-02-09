# Daemon

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/v/release/Pamacea/daemon)](https://github.com/Pamacea/daemon/releases/latest)
[![CI](https://github.com/Pamacea/daemon/actions/workflows/ci.yml/badge.svg)](https://github.com/Pamacea/daemon/actions)



AI-powered automated test generation and remediation for web applications.

## Quick Start

```bash
# From your project directory
npx --yes @oalacea/daemon@latest
```

First run installs the testing toolkit (~500 MB Docker image, takes 2-3 minutes).

## What You Need

- **Docker** - [Install](https://docs.docker.com/get-docker/)
- **AI coding agent** - Claude Code, Cursor, Windsurf, Aider, Codex...

## Features

| Category | Features |
|----------|----------|
| **Unit Tests** | Components, hooks, utils, validators, stores |
| **Integration Tests** | API routes, database operations (with transaction rollback) |
| **E2E Tests** | User flows, form interactions, navigation (Playwright) |
| **Backend Performance** | API load testing (k6), DB query benchmarks |
| **Frontend Performance** | Core Web Vitals, LCP, FID, CLS (Lighthouse) |
| **Dependency Analysis** | TanStack Router, React Query, Prisma, Zustand, React Compiler |

## How It Works

1. **Analyze** - Auto-detects your framework, database, and existing tests
2. **Generate** - Creates tests based on your code patterns
3. **Execute** - Runs tests inside Docker container
4. **Fix** - Analyzes failures and applies corrections
5. **Report** - Provides comprehensive coverage and performance report

## Included Tools

The Docker toolkit includes:

| Category | Tools |
|----------|-------|
| Testing | Vitest, @testing-library/react, @testing-library/vue, @testing-library/svelte, @solidjs/testing-library, happy-dom |
| E2E | Playwright (Chromium) |
| Backend Performance | k6 (load testing) |
| Frontend Performance | Lighthouse (Core Web Vitals) |
| Utilities | supertest, MSW, @prisma/cli |

## Framework Support

| Framework | Detection | Status |
|-----------|-----------|--------|
| Next.js | ✅ | Full support |
| Remix | ✅ | Full support |
| SvelteKit | ✅ | Full support |
| Nuxt | ✅ | Full support |
| Astro | ✅ | Full support |
| Gatsby | ✅ | Full support |
| Vite | ✅ | Full support |
| Solid | ✅ | Full support |
| Vue | ✅ | Full support |
| Svelte | ✅ | Full support |
| Angular | ✅ | Full support |
| React Native | ✅ | Basic support |
| Express | ✅ | Full support |
| NestJS | ✅ | Full support |

## Output Example

```
✓ Unit Tests: 45 created, 42 passing, 3 fixed
✓ Integration: 12 created, 12 passing
✓ E2E: 8 created, 7 passing, 1 requires manual review
✓ Backend Performance: API p95 = 145ms (PASS)
✓ Frontend Performance: Lighthouse 85/100 (PASS)
  - LCP: 2.1s ✓ (target: <2.5s)
  - FID: 56ms ✓ (target: <100ms)
  - CLS: 0.05 ✓ (target: <0.1)
✓ Dependencies: 3 improvements suggested

## Summary
Total Tests: 245
Passing: 238
Failing: 2 (requires manual review)
Coverage: 84%
```

## Safety

- Always use transaction rollback for database tests
- Never modify production data
- Git integration for safe rollbacks
- Non-destructive testing modes available

## Troubleshooting

### Rebuild toolkit image

```bash
docker rm -f daemon-tools
docker rmi daemon-tools
npx --yes @oalacea/daemon@latest
```

### Run specific test

```bash
docker exec daemon-tools npm test -- Button.test.ts
```

### Debug test

```bash
docker exec daemon-tools npm test -- Button.test.ts --reporter=verbose
```

### Run Lighthouse audit

```bash
# Quick performance check
docker exec daemon-tools npx lighthouse http://host.docker.internal:3000 --output=json --output=html

# Mobile audit
docker exec daemon-tools npx lighthouse http://host.docker.internal:3000 --form-factor=mobile

# All categories
docker exec daemon-tools npx lighthouse http://host.docker.internal:3000 --only-categories=performance,accessibility,best-practices,seo
```

## Related

- **Guardian** - Security testing package: `npx @oalacea/guardian`

## License

MIT - Use at your own risk.

## Credits

Inspired by the need for comprehensive automated testing in modern web development.
