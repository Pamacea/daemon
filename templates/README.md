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
├── playwright/                  # Playwright E2E templates
│   ├── auth.spec.ts
│   └── crud.spec.ts
├── k6/                          # k6 backend performance templates
│   └── load-test.js
└── lighthouse/                  # Lighthouse frontend performance (via CLI)
    └── (run directly with npx lighthouse)
```

## Framework Support

| Framework | Template | Testing Library |
|-----------|----------|-----------------|
| React | `component.test.ts` | `@testing-library/react` |
| Vue | `vue-component.test.ts` | `@vue/test-utils` |
| Solid | `solid-component.test.ts` | `@solidjs/testing-library` |
| Svelte | `svelte-component.test.ts` | `@testing-library/svelte` |
| Angular | `angular-component.test.ts` | `@angular/core/testing` |

## Usage

Templates are used by the test generator agent to create new test files based on the detected framework and patterns.
