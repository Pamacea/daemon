# Daemon Templates

This directory contains test templates for different frameworks and tools.

## Structure

```
templates/
├── vitest/                      # Vitest test templates
│   ├── component.test.ts        # React component template
│   ├── vue-component.test.ts    # Vue component template
│   ├── solid-component.test.ts  # Solid component template
│   ├── svelte-component.test.ts # Svelte component template
│   ├── angular-component.test.ts # Angular component template
│   ├── hook.test.ts             # React hooks template
│   └── api.test.ts              # API route template
├── rust/                        # Rust test templates
│   ├── unit.test.rs             # Basic unit test template
│   ├── integration.test.rs      # Integration test template
│   ├── axum-handler.test.rs     # Axum framework handler tests
│   ├── actix-controller.test.rs # Actix-web controller tests
│   ├── rocket-route.test.rs     # Rocket framework route tests
│   └── Cargo.toml               # Test dependencies configuration
├── nestjs/                      # NestJS test templates
│   ├── controller.spec.ts       # Controller unit tests
│   ├── service.spec.ts          # Service unit tests
│   ├── module.spec.ts           # Module tests
│   ├── guard.spec.ts            # Guard tests
│   ├── interceptor.spec.ts      # Interceptor tests
│   ├── pipe.spec.ts             # Pipe tests
│   ├── e2e/                     # E2E tests
│   │   ├── api.e2e-spec.ts      # API E2E tests
│   │   └── auth.e2e-spec.ts     # Auth E2E tests
│   └── fixtures/                # Test utilities
│       └── test-module.ts       # Module fixture
├── playwright/                  # Playwright E2E templates
│   ├── auth.spec.ts
│   └── crud.spec.ts
├── k6/                          # k6 backend performance templates
│   └── load-test.js
└── lighthouse/                  # Lighthouse frontend performance (via CLI)
    └── (run directly with npx lighthouse)
```

## Framework Support

### Frontend Frameworks

| Framework | Template | Testing Library |
|-----------|----------|-----------------|
| React | `component.test.ts` | `@testing-library/react` |
| Vue | `vue-component.test.ts` | `@vue/test-utils` |
| Solid | `solid-component.test.ts` | `@solidjs/testing-library` |
| Svelte | `svelte-component.test.ts` | `@testing-library/svelte` |
| Angular | `angular-component.test.ts` | `@angular/core/testing` |

### Backend Frameworks

| Framework | Templates | Testing Library |
|-----------|----------|-----------------|
| NestJS | `*.spec.ts` | `@nestjs/testing` |
| Rust - Axum | `axum-handler.test.rs` | `axum-test` |
| Rust - Actix | `actix-controller.test.rs` | `actix-rt` |
| Rust - Rocket | `rocket-route.test.rs` | Built-in |
| Rust - Generic | `unit.test.rs`, `integration.test.rs` | Built-in |
| Express | `api.test.ts` | `supertest` |
| Fastify | `api.test.ts` | `supertest` |

## Rust Templates

The Rust templates provide test coverage for common Rust web frameworks and general testing patterns:

### Unit Tests

- **unit.test.rs**: Basic unit test template including:
  - Test function examples
  - Error handling tests
  - Test fixtures
  - Assertion patterns

### Integration Tests

- **integration.test.rs**: Integration test template including:
  - API endpoint testing
  - Database operations
  - Test app setup helpers
  - Test database pool creation

### Framework-Specific Tests

- **axum-handler.test.rs**: Axum framework tests including:
  - Health check endpoint
  - GET/POST handler tests
  - Request/response validation
  - Error status code verification

- **actix-controller.test.rs**: Actix-web framework tests including:
  - Controller initialization
  - Route handler testing
  - Query parameter handling
  - JSON payload validation

- **rocket-route.test.rs**: Rocket framework tests including:
  - Route testing with blocking client
  - Authentication header handling
  - Form data testing
  - Status code assertions

### Configuration

- **Cargo.toml**: Test dependencies including:
  - `tokio-test` for async testing
  - `criterion` for benchmarks
  - Framework-specific test utilities

## NestJS Templates

The NestJS templates provide comprehensive test coverage for all NestJS components:

### Unit Tests

- **controller.spec.ts**: Tests for controllers including:
  - Route handlers
  - Request/response handling
  - Query parameters
  - DTO validation
  - Error handling

- **service.spec.ts**: Tests for services including:
  - Business logic
  - Repository mocking
  - CRUD operations
  - Transaction handling
  - Database errors

- **module.spec.ts**: Tests for modules including:
  - Provider availability
  - Dependency injection
  - Module configuration
  - Dynamic modules

- **guard.spec.ts**: Tests for guards including:
  - Authentication logic
  - Authorization checks
  - Role validation
  - Public route handling

- **interceptor.spec.ts**: Tests for interceptors including:
  - Request/response transformation
  - Logging behavior
  - Caching
  - Timeout handling

- **pipe.spec.ts**: Tests for pipes including:
  - Data transformation
  - Validation logic
  - Error handling
  - Custom business rules

### E2E Tests

- **api.e2e-spec.ts**: Full API testing including:
  - CRUD operations
  - Pagination/filtering/sorting
  - Error handling
  - Performance tests
  - CORS and rate limiting

- **auth.e2e-spec.ts**: Authentication testing including:
  - Registration flow
  - Login/logout
  - Token refresh
  - Password reset
  - Role-based access

### Fixtures

- **test-module.ts**: Common test utilities including:
  - Mock repository factory
  - Mock JWT service
  - Test module builder
  - Mock execution context
  - Test data generators

## Patterns Checked

The NestJS analyzer verifies:

### Dependency Injection
- Circular dependencies between services
- Proper provider exports
- Missing @Injectable decorators
- Constructor injection patterns

### Decorators
- @Controller with routes
- @Injectable on services/guards/pipes
- @UseGuards on protected routes
- @UsePipes for validation
- @UseInterceptors for cross-cutting concerns

### Single Responsibility
- Services with too many dependencies (>5)
- Controllers without route handlers
- Large service classes (potential refactoring)

### Error Handling
- Proper exception usage
- HTTP exception decorators
- Exception filters
- Error response format

### DTOs
- class-validator decorators
- class-transformer usage
- Partial types for updates
- Nested DTO validation

## Usage

Templates are used by the test generator agent to create new test files based on the detected framework and patterns.
