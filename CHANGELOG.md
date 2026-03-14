# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-03-14

### Added

#### 🎯 Multi-Dimensional Scoring System
- **9 quality dimensions**: test-coverage, code-quality, performance, security, accessibility, ui-ux, backend-logic, business-logic, **seo**
- Overall project score (0-100) with letter grades (A-F)
- Dimension-specific scoring with configurable weights
- Historical score tracking with trend analysis
- JSON storage in `.daemon/history/scores.json`

#### 🔍 SEO Scoring (NEW!)
- Meta tags validation (title, description, viewport, Open Graph, Twitter Cards)
- Heading structure analysis (H1-H6 hierarchy)
- Sitemap.xml and robots.txt detection
- Structured data (JSON-LD) validation
- Semantic HTML element usage
- Social media sharing readiness

#### 📊 CLI Commands
- `daemon score` - Display project quality scores
- `daemon score --dim <dimension>` - Score specific dimension
- `daemon score --trend` - View historical trends
- `daemon review` - Comprehensive code review
- `daemon review --fix` - Apply automatic fixes
- `daemon optimize` - Detect optimizations and bugs
- `daemon report` - Generate quality reports (HTML/MD/JSON/JUnit)
- `daemon history` - View score history and trends

#### 🛡️ Review & Fix Service
- Static code analysis (ESLint, TypeScript)
- Security scanning (OWASP Top 10, injection vulnerabilities)
- Dependency analysis (vulnerabilities, outdated packages)
- Performance issues detection
- Automatic fixing for common issues
- Test stub generation for uncovered code

#### ⚡ Optimization Service
- Bug detection (memory leaks, race conditions, null errors)
- Performance optimization detection (React, backend, bundle)
- Code smell detection (long functions, deep nesting, duplication)
- Refactoring suggestions
- Anti-pattern catalog

#### 📈 Reporting & History System
- HTML dashboard with animated score gauges
- Markdown reports for documentation
- JSON output for CI/CD integration
- JUnit XML for test result integration
- SVG chart generation (no external dependencies)
- Trend analysis (improving, stable, declining)
- Regression detection

#### 🦀 Rust Support (NEW!)
- Framework detection: Axum, Actix, Rocket
- Test templates: unit, integration, framework-specific
- Tools: cargo-nextest, cargo-audit, cargo-watch
- Criterion benchmarking support

#### 🪺 Enhanced NestJS Support
- Controller, Service, Module, Guard, Interceptor, Pipe test templates
- E2E test templates (API, authentication)
- Reusable test fixtures and utilities

#### 🐳 Enhanced Docker Container
- Rust toolchain (rustup, cargo, rustfmt, clippy)
- Code quality tools (ESLint, Prettier)
- Security scanning (Snyk, npm audit)
- Performance tools (Clinic, Lighthouse)
- Accessibility tools (pa11y, axe-core)
- Reporting utilities (cli-table3, chalk, ora)

### Changed
- Improved scoring algorithm with balanced dimension weights
- Enhanced type safety across all modules
- Better error handling and reporting

### Fixed
- All TypeScript strict mode errors resolved
- Import path corrections for cross-platform compatibility
- Docker entrypoint script added

## [Unreleased]

## [0.6.1] - 2026-02-18

### Fixed
- Windows-compatible clean script for cross-platform builds
- Correct bin path pointing to cli.js instead of index.js
- Added shebang (#!/usr/bin/env node) for executable CLI

## [0.6.0] - 2026-02-18

### Added
- Complete TypeScript migration with strict mode configuration
- Modular architecture with clean separation (core, services, shared, cli)
- Comprehensive error system with typed errors (DaemonError, CommandError, DockerError, ValidationError, FileError)
- Framework detection service (Next.js, Remix, SvelteKit, Nuxt, Vite, Astro, Gatsby, Angular)
- Docker management service with async operations
- Structured logging with ANSI colors and contexts
- Command executor with timeout and retry logic
- File system helper with JSON and directory operations
- CLI commands (init, detect, test) using command pattern
- 80 unit tests with >90% coverage target

### Changed
- Migrated from JavaScript to TypeScript
- Improved type safety across all modules
- Async/await migration from sync exec

## [0.5.1] - 2026-02-14

### Fixed
- Configuration validation fixes

## [0.5.0] - 2026-02-09

### Added
- Initial stable release of Daemon - AI-powered automated test generation
- CLI tool: `npx @oalacea/daemon@latest`
- Automated framework detection (Next.js, Remix, SvelteKit, Vite, etc.)
- Database detection (Prisma, Drizzle, Neon, Supabase, local Postgres)
- Unit test generation (components, hooks, utils, validators, stores)
- Integration test generation (API routes, database operations with transaction rollback)
- E2E test generation with Playwright (user flows, forms, navigation)
- Backend performance testing with k6 (API load testing, DB benchmarks)
- Frontend performance testing with Lighthouse (Core Web Vitals, LCP, FID, CLS)
- Docker toolkit with pre-configured tools (~500 MB)
- Cross-platform support (Linux, macOS, Windows)
- MIT License

[Unreleased]: https://github.com/Pamacea/daemon/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/Pamacea/daemon/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/Pamacea/daemon/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/Pamacea/daemon/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/Pamacea/daemon/releases/tag/v0.5.0
