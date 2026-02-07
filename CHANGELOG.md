# Daemon - Changelog

## [1.0.0-alpha] - 2025-02-07

### Added
- Initial release
- Auto-detection for frameworks (Next.js, Remix, SvelteKit, Vite, etc.)
- Database detection (Prisma, Drizzle, Neon, Supabase, local Postgres)
- Unit test generation (components, hooks, utils)
- Integration test templates (API routes, DB with transaction rollback)
- E2E test templates (Playwright)
- Performance test templates (k6)
- Dependency efficiency analysis (TanStack Router, React Query, Prisma, Zustand, React Compiler)
- Docker container with all testing tools
- Cross-platform support (Linux, macOS, Windows)

### Features
- **Unit Tests**: Component, hook, and utility testing with Vitest
- **Integration Tests**: API route and database testing with Prisma
- **E2E Tests**: User flow testing with Playwright
- **Performance Tests**: API load testing with k6
- **Analysis**: Dependency pattern analysis and recommendations
- **Remediation**: Automatic test failure categorization and fix suggestions

### Tools Included
- Vitest
- @testing-library/react
- Playwright
- k6
- supertest
- MSW
- @prisma/cli

### Documentation
- Comprehensive prompt system for AI agent
- Test templates for all test types
- Fix engine for common test failures
- Performance analysis and reporting
