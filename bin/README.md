# Daemon Docker Container - Documentation

**Version:** 0.7.0
**Purpose:** Automated testing and quality tools for web applications

## Overview

The Daemon Docker container provides a comprehensive suite of testing, security, performance, and code quality tools. All operations run inside the container for consistent and reproducible results.

## Quick Start

```bash
# Build the container
docker build -t daemon:0.7.0 -f bin/Dockerfile .

# Run the container
docker run -d --name daemon daemon:0.7.0

# Execute commands
docker exec -it daemon help
docker exec -it daemon vitest run
```

## Available Tools

### Testing Frameworks

| Tool | Version | Purpose | Command |
|------|---------|---------|---------|
| **Vitest** | Latest | Fast unit testing | `vitest` |
| **Playwright** | Latest | E2E testing | `playwright` |
| **Testing Library** | Latest | Component testing | Available globally |
| **Happy DOM** | Latest | JSDOM alternative | Available globally |

### Performance Tools

| Tool | Version | Purpose | Command |
|------|---------|---------|---------|
| **k6** | v1.5.0 | Load testing | `k6 run <script>` |
| **Lighthouse** | Latest | Performance audit | `lighthouse <url>` |
| **Clinic** | Latest | Node.js profiling | `clinic <command>` |

### Rust Toolchain

| Tool | Purpose | Command |
|------|---------|---------|
| **rustc** | Rust compiler | `rustc <file>` |
| **cargo** | Package manager | `cargo <command>` |
| **rustfmt** | Code formatter | `cargo fmt` |
| **clippy** | Linter | `cargo clippy` |
| **cargo-nextest** | Test runner | `cargo nextest` |
| **cargo-audit** | Security audit | `cargo audit` |
| **cargo-watch** | Watch mode | `cargo watch` |

### Code Quality Tools

| Tool | Purpose | Command |
|------|---------|---------|
| **ESLint** | JavaScript/TypeScript linting | `eslint <files>` |
| **Prettier** | Code formatting | `prettier <files>` |
| **TypeScript** | Type checking | `tsc` |

### Security Tools

| Tool | Purpose | Command |
|------|---------|---------|
| **Snyk** | Dependency scanning | `snyk test` |
| **npm audit** | npm security audit | `npm audit` |
| **cargo-audit** | Rust security audit | `cargo audit` |

### Accessibility Tools

| Tool | Purpose | Command |
|------|---------|---------|
| **Pa11y** | Accessibility testing | `pa11y <url>` |
| **pa11y-ci** | CI accessibility testing | `pa11y-ci` |
| **axe-core** | axe CLI | `axe <url>` |

### API Testing & Mocking

| Tool | Purpose | Command |
|------|---------|---------|
| **supertest** | HTTP assertions | Available in Node |
| **MSW** | API mocking | Available in Node |
| **axios** | HTTP client | Available in Node |
| **got** | HTTP client | Available in Node |

### Database Tools

| Tool | Purpose | Command |
|------|---------|---------|
| **Prisma** | ORM & CLI | `prisma <command>` |

### Reporting & Output

| Tool | Purpose | Command |
|------|---------|---------|
| **cli-table3** | Table formatting | Available in Node |
| **chalk** | Terminal colors | Available in Node |
| **ora** | Terminal spinners | Available in Node |
| **listr2** | Task lists | Available in Node |
| **boxen** | Box formatting | Available in Node |

### Additional Utilities

| Tool | Purpose | Command |
|------|---------|---------|
| **rimraf** | Cross-platform rm | Available in Node |
| **cross-env** | Environment variables | Available in Node |
| **nodemon** | Auto-restart server | `nodemon` |
| **tsx** | TypeScript execute | `tsx <file>` |
| **ts-node** | TypeScript execute | `ts-node <file>` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Node environment |
| `TZ` | `Europe/Paris` | Container timezone |
| `DEBIAN_FRONTEND` | `noninteractive` | Non-interactive mode |

## Exposed Ports

| Port | Purpose |
|------|---------|
| 9323 | Vitest UI |
| 3000 | Default app port |
| 5173 | Vite dev server |
| 8080 | Alternative app port |

## Extending the Dockerfile

To add custom tools, create a `Dockerfile.custom`:

```dockerfile
FROM daemon:0.7.0

# Add custom Node packages
RUN npm install -g your-package

# Add system packages
USER root
RUN apt-get update && apt-get install -y your-package
USER daemon

# Set custom working directory
WORKDIR /workspace
```

Build with:
```bash
docker build -f Dockerfile.custom -t daemon:custom .
```

## Common Workflows

### Running Tests

```bash
# Unit tests with coverage
docker exec -it daemon vitest run --coverage

# E2E tests
docker exec -it daemon playwright test

# Run specific test file
docker exec -it daemon vitest run path/to/test.test.ts
```

### Performance Testing

```bash
# Run k6 test
docker exec -it daemon k6 run tests/performance/load.js

# Lighthouse audit
docker exec -it daemon lighthouse https://example.com --output html --output-path /app/reports/lighthouse.html
```

### Security Scanning

```bash
# Snyk scan
docker exec -it daemon snyk test --json > /app/reports/snyk.json

# npm audit
docker exec -it daemon npm audit --json > /app/reports/npm-audit.json

# Cargo audit
docker exec -it daemon cargo audit --json > /app/reports/cargo-audit.json
```

### Accessibility Testing

```bash
# Pa11y test
docker exec -it daemon pa11y https://example.com > /app/reports/pa11y.json

# Axe-core test
docker exec -it daemon axe https://example.com
```

### Code Quality

```bash
# ESLint check
docker exec -it daemon eslint src/

# Prettier format
docker exec -it daemon prettier --write src/

# Rust format
docker exec -it daemon cargo fmt

# Rust linter
docker exec -it daemon cargo clippy
```

## Container Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Daemon Container                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │           Entry Point (docker-entrypoint.sh)    │    │
│  │   - Environment setup                            │    │
│  │   - Command routing                              │    │
│  │   - Cleanup on exit                              │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │                  Tool Layers                     │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  • Testing Frameworks (Vitest, Playwright)      │    │
│  │  • Performance Tools (k6, Lighthouse)           │    │
│  │  • Security Tools (Snyk, audit)                 │    │
│  │  • Code Quality (ESLint, Prettier)              │    │
│  │  • Accessibility (Pa11y, axe-core)              │    │
│  │  • Rust Toolchain (rustc, cargo, clippy)        │    │
│  │  • Database (Prisma)                            │    │
│  │  • Reporting (cli-table3, chalk, etc.)          │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │           Working Directory (/app)               │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  • /app/logs       - Test logs                  │    │
│  │  • /app/reports    - Generated reports           │    │
│  │  • /app/temp       - Temporary files             │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │            User Context (daemon:1001)            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Health Check

The container includes a health check that runs every 30 seconds:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' daemon
```

## Troubleshooting

### Container exits immediately

Check logs:
```bash
docker logs daemon
```

### Permission issues

The container runs as user `daemon` (UID 1001). Ensure mounted volumes have correct permissions.

### Rust not found

Ensure the entrypoint script is executable and the PATH is set correctly.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.7.0 | 2025-03-14 | Added Rust toolchain, security tools, accessibility tools, reporting tools |
| 0.6.x | Earlier | Initial version with Node.js, Vitest, Playwright, k6, Lighthouse |

## License

MIT

---

*Generated for Daemon v0.7.0*
