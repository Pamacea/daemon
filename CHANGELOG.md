# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Additional framework support
- Enhanced test patterns
- Performance benchmarking comparisons
- CI/CD integration templates

## [1.0.0] - 2026-02-09

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
- Dependency analysis (TanStack Router, React Query, Prisma, Zustand, React Compiler)
- Docker toolkit with pre-configured tools (~500 MB)
- Vitest, Testing Library (React, Vue, Svelte, Solid), Happy DOM
- Playwright (Chromium) for E2E testing
- k6 for load testing
- Lighthouse for performance metrics
- Comprehensive reporting with coverage and performance data
- Cross-platform support (Linux, macOS, Windows)
- Automatic test failure categorization and fix suggestions
- MIT License
- Complete documentation

## [1.0.0-alpha] - 2025-02-07

### Added
- Initial alpha release
- Core framework and database detection
- Basic test generation templates
- Docker container setup
