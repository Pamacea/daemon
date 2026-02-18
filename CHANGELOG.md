# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
