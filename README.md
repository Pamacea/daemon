# Daemon

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/v/release/Pamacea/daemon)](https://github.com/Pamacea/daemon/releases/latest)
[![CI](https://github.com/Pamacea/daemon/actions/workflows/ci.yml/badge.svg)](https://github.com/Pamacea/daemon/actions)


> AI-powered automated test generation and code review for web applications.

**v0.7.0** — Rust support, NestJS analysis, Scoring system, and more!

## Quick Start

```bash
# From your project directory
npx --yes @oalacea/daemon@latest
```

First run installs the testing toolkit (~500 MB Docker image, takes 2-3 minutes).

## What You Need

- **Docker** - [Install](https://docs.docker.com/get-docker/)
- **AI coding agent** - Claude Code, Cursor, Windsurf, Aider, Codex...

## New in v0.7.0

| Feature | Description |
|---------|-------------|
| 🦀 **Rust Support** | Axum, Actix-web, Rocket frameworks with dedicated templates |
| 🎯 **NestJS Analysis** | Pattern validation, DI checks, decorator verification |
| 📊 **Scoring System** | 5-dimension code quality scoring (coverage, quality, performance, security, docs) |
| 🔍 **Code Review** | Static analysis, security scanning, dependency analysis |
| 🛠️ **Extended Toolkit** | Rust toolchain, Lighthouse, security tools, accessibility tools |

## Features

| Category | Features |
|----------|----------|
| **Unit Tests** | Components, hooks, utils, validators, stores |
| **Integration Tests** | API routes, database operations (with transaction rollback) |
| **E2E Tests** | User flows, form interactions, navigation (Playwright) |
| **Backend Performance** | API load testing (k6), DB query benchmarks |
| **Frontend Performance** | Core Web Vitals, LCP, FID, CLS (Lighthouse) |
| **Code Quality** | ESLint, TypeScript, complexity analysis |
| **Security** | Snyk, npm audit, dependency vulnerabilities |
| **Accessibility** | Pa11y, axe-core CI integration |
| **Rust Support** | Axum, Actix, Rocket templates and tests |
| **NestJS Support** | Controllers, services, guards, pipes, interceptors |

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Daemon Workflow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. DETECT     Auto-detect framework, database, language     │
│              ↓                                               │
│  2. ANALYZE   Static analysis, security scan, dependencies   │
│              ↓                                               │
│  3. SCORE     5-dimension quality scoring                    │
│              ↓                                               │
│  4. GENERATE  Framework-specific test templates              │
│              ↓                                               │
│  5. EXECUTE   Run tests in Docker container                 │
│              ↓                                               │
│  6. FIX      Auto-fix applicable issues                     │
│              ↓                                               │
│  7. REPORT   Comprehensive coverage and quality report       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Available Commands

```bash
# Full analysis with scoring and test generation
npx @oalacea/daemon

# Code review with detailed report
npx @oalacea/daemon review

# Quality score only
npx @oalacea/daemon score

# Generate tests only
npx @oalacea/daemon test

# Docker container commands
docker exec daemon-tools vitest run
docker exec daemon-tools playwright test
docker exec daemon-tools k6 run performance/test.js
```

## Framework Support

| Framework | Detection | Unit | Integration | E2E | Score | Review |
|-----------|-----------|------|-------------|-----|-------|--------|
| **Next.js** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Remix** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SvelteKit** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Nuxt** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Astro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vite + React** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vite + Vue** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vite + Svelte** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Angular** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Solid** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Express** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Fastify** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **NestJS** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Axum** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Actix-web** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Rocket** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Toolkit Tools

The Docker container includes 50+ tools:

### Testing
- **Vitest** - Fast unit test runner
- **Playwright** - E2E testing (Chromium, Firefox)
- **@testing-library/*** - Component testing
- **k6** - Load testing
- **supertest** - HTTP assertions
- **MSW** - API mocking

### Code Quality
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking

### Performance
- **Lighthouse** - Web vitals
- **Clinic** - Node.js profiling
- **k6** - Load testing

### Security
- **Snyk** - Dependency scanning
- **npm audit** - Security audit

### Accessibility
- **Pa11y** - Accessibility testing
- **axe-core** - A11y validation

### Rust Toolchain
- **rustc, cargo** - Compiler and package manager
- **rustfmt** - Code formatter
- **clippy** - Linter
- **cargo-nextest** - Parallel test runner
- **cargo-audit** - Security audit

## Output Example

```
╔═══════════════════════════════════════════════════════════╗
║                    DAEMON REPORT v0.7.0                   ║
╠═══════════════════════════════════════════════════════════╣
║                                                             ║
║  Framework: Next.js 14                                      ║
║  Language: TypeScript                                       ║
║  Test Runner: Vitest                                         ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │  QUALITY SCORE                                      │   ║
║  │  Overall: 82/100 (B)                                │   ║
║  │                                                     │   ║
║  │  Coverage    ████████████████░░ 85/100            │   ║
║  │  Quality     ██████████████░░░░ 78/100            │   ║
║  │  Performance ████████████████░░ 88/100            │   ║
║  │  Security    ████████████░░░░░░ 75/100            │   ║
║  │  Docs        ██████████░░░░░░░░ 70/100            │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │  TESTS GENERATED                                    │   ║
║  │  ✓ Unit: 45 created, 42 passing, 3 fixed            │   ║
║  │  ✓ Integration: 12 created, 12 passing               │   ║
║  │  ✓ E2E: 8 created, 7 passing, 1 manual review       │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │  PERFORMANCE                                        │   ║
║  │  ✓ Backend: p95 = 145ms (PASS < 500ms)              │   ║
║  │  ✓ Frontend: Lighthouse 85/100                      │   ║
║  │    - LCP: 2.1s ✓ (target: <2.5s)                   │   ║
║  │    - FID: 56ms ✓ (target: <100ms)                  │   ║
║  │    - CLS: 0.05 ✓ (target: <0.1)                    │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │  CODE REVIEW ISSUES                                 │   ║
║  │  🔴 Critical: 3  |  🟠 High: 8                     │   ║
║  │  🟡 Medium: 15  |  🟢 Low: 16                      │   ║
║  │  Fixable: 28 | Auto-fix available: --fix flag       │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║  Total Tests: 245                                          ║
║  Passing: 238                                               ║
║  Failing: 2 (requires manual review)                        ║
║  Coverage: 84%                                              ║
╚═══════════════════════════════════════════════════════════╝
```

## Configuration

Create `daemon.config.js` in your project root:

```javascript
// daemon.config.js
export default {
  scoring: {
    weights: {
      coverage: 0.30,
      quality: 0.25,
      performance: 0.20,
      security: 0.15,
      documentation: 0.10,
    },
    thresholds: {
      coverage: { excellent: 80, good: 60 },
      performance: { lighthouse: 85 },
    },
  },

  review: {
    analyzers: ['static', 'security', 'dependencies', 'nestjs', 'rust'],
    exclude: ['node_modules/**', 'dist/**'],
    autoFix: { enabled: false },
  },

  nestjs: {
    analyzeModules: true,
    checkCircularDeps: true,
    checkSingleResponsibility: true,
    maxDependencies: 5,
  },

  rust: {
    framework: 'axum', // or 'actix', 'rocket'
    testRunner: 'cargo-nextest',
  },

  docker: {
    image: 'daemon-tools:0.7.0',
    keepRunning: false,
  },
};
```

## Documentation

- [**Scoring System**](docs/scoring.md) - How code quality is measured
- [**Code Review**](docs/review.md) - Review workflow and options
- [**Rust Support**](docs/rust-support.md) - Rust frameworks and templates
- [**NestJS Support**](docs/nestjs-support.md) - NestJS patterns and best practices
- [**Templates**](templates/README.md) - Available test templates
- [**Docker**](bin/README.md) - Container tools and usage

## Safety

- ✅ Transaction rollback for database tests
- ✅ Never modifies production data
- ✅ Git integration for safe rollbacks
- ✅ Non-destructive testing modes
- ✅ Dry-run for all fixes

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
docker exec daemon-tools lighthouse http://host.docker.internal:3000

# Mobile audit
docker exec daemon-tools lighthouse http://host.docker.internal:3000 --form-factor=mobile

# All categories
docker exec daemon-tools lighthouse http://host.docker.internal:3000 --only-categories=performance,accessibility,best-practices,seo
```

### Rust tools

```bash
# Run Rust tests
docker exec daemon-tools cargo test

# Run clippy
docker exec daemon-tools cargo clippy

# Format code
docker exec daemon-tools cargo fmt
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Daemon CI

on: [pull_request]

jobs:
  daemon:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Daemon
        run: npx @oalacea/daemon score --min=80
```

### GitLab CI

```yaml
daemon:
  stage: test
  script:
    - npx @oalacea/daemon review --json > report.json
  artifacts:
    reports:
      codequality: report.json
```

## Related Projects

- **Guardian** - Security testing: `npx @oalacea/guardian`

## License

MIT — Use at your own risk.

## Credits

Built for modern web development teams who care about code quality.
