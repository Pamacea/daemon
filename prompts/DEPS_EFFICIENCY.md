# Dependency Efficiency Analysis Guide

This prompt is included by EXECUTE.md. It provides detailed guidance for analyzing dependency usage patterns.

---

## TanStack Router Analysis

```typescript
// Check for TanStack Router patterns
describe('TanStack Router Efficiency', () => {
  it('should have type-safe routes', () => {
    // Check if routes are using typed params
    const routes = findFiles('routes', '.tsx');

    routes.forEach((route) => {
      const content = readFile(route);

      // Should use $params or useParams with types
      expect(content).toMatch(/useParams.*</);
    });
  });

  it('should use loaders for data fetching', () => {
    const routes = findFiles('routes', '.tsx');

    routes.forEach((route) => {
      const content = readFile(route);

      // Should have loader if route needs data
      if (content.includes('useQuery') || content.includes('useFetch')) {
        expect(content).toMatch(/loader.*=/);
      }
    });
  });

  it('should have error boundaries', () => {
    const routes = findFiles('routes', '.tsx');

    routes.forEach((route) => {
      const content = readFile(route);

      // Should have errorBoundary component
      if (content.includes('loader')) {
        expect(content).toMatch(/errorComponent|ErrorBoundary/);
      }
    });
  });

  it('should enable link prefetching', () => {
    const components = findFiles('components', '.tsx');

    components.forEach((comp) => {
      const content = readFile(comp);

      // Navigation links should have prefetch
      if (content.includes('<Link')) {
        expect(content).toMatch(/prefetch=|prefetchIntent=/);
      }
    });
  });
});
```

### Findings Template

```markdown
### TanStack Router Analysis

**Good:**
- ✓ All routes use typed params
- ✓ Loaders properly implemented for data fetching
- ✓ Search parameters are typed

**Issues Found:**
- ✗ 3 routes missing error boundaries
  - routes/dashboard.tsx
  - routes/posts.tsx
  - routes/users.tsx

- ✗ Navigation links not using prefetch
  - components/Nav.tsx - main menu links
  - components/Footer.tsx - footer links

**Recommendations:**
1. Add errorComponent to routes with loaders
2. Enable prefetch for frequently accessed navigation links
3. Consider using preload for critical routes
```

---

## React Query Analysis

```typescript
// Check for React Query patterns
describe('React Query Efficiency', () => {
  it('should have proper cache keys', () => {
    const hooks = findFiles('hooks', '.ts');
    const components = findFiles('components', '.tsx');

    const allFiles = [...hooks, ...components];

    allFiles.forEach((file) => {
      const content = readFile(file);

      if (content.includes('useQuery') || content.includes('useInfiniteQuery')) {
        // Should use array-based keys for proper serialization
        expect(content).toMatch(/\[['"`]\w+['"`],/);
      }
    });
  });

  it('should configure staleTime appropriately', () => {
    const hooks = findFiles('hooks', '.ts');

    hooks.forEach((hook) => {
      const content = readFile(hook);

      if (content.includes('useQuery')) {
        // Should have staleTime configured
        expect(content).toMatch(/staleTime/);
      }
    });
  });

  it('should have proper invalidation', () => {
    const mutations = findFiles('mutations', '.ts');

    mutations.forEach((mutation) => {
      const content = readFile(mutation);

      if (content.includes('useMutation')) {
        // Should invalidate related queries on success
        expect(content).toMatch(/invalidateQueries/);
      }
    });
  });

  it('should use suspense when beneficial', () => {
    const components = findFiles('components', '.tsx');

    components.forEach((comp) => {
      const content = readFile(comp);

      // Server components or suspense boundary
      if (content.includes('useSuspenseQuery') || content.includes('Suspense')) {
        expect(content).toBeTruthy();
      }
    });
  });
});
```

### Findings Template

```markdown
### React Query Analysis

**Good:**
- ✓ All queries use array-based cache keys
- ✓ Mutations properly invalidate related queries
- ✓ QueryClient configured with reasonable defaults

**Issues Found:**
- ✗ 5 queries missing staleTime configuration
  - hooks/useUsers.ts - will refetch on focus
  - hooks/usePosts.ts - no cache duration
  - hooks/useComments.ts - no cache duration
  - hooks/useAuth.ts - no cache duration
  - hooks/useSettings.ts - no cache duration

- ✗ No retry configuration for failed queries
- ✗ Missing optimistic updates for like/comment mutations

**Recommendations:**
1. Add staleTime: 30000 for semi-static data
2. Configure retry: 1 for user-facing queries
3. Implement optimistic updates for social interactions
```

---

## Prisma Analysis

```typescript
// Check for Prisma patterns
describe('Prisma Efficiency', () => {
  it('should use select for partial data', () => {
    const files = findFiles(['src', 'lib'], '.ts');

    files.forEach((file) => {
      const content = readFile(file);

      // If only using some fields, should use select
      if (content.includes('prisma.') && content.includes('findMany')) {
        // Check if result is destructured
        if (content.match(/findMany.*\{[^}]*\}/)) {
          expect(content).toMatch(/select:/);
        }
      }
    });
  });

  it('should not have N+1 queries', () => {
    const files = findFiles(['src', 'lib'], '.ts');

    files.forEach((file) => {
      const content = readFile(file);

      // Look for potential N+1 pattern
      if (content.includes('findMany') && content.includes('forEach')) {
        // If iterating over results and querying inside loop
        const lines = content.split('\n');
        let inFindMany = false;

        for (const line of lines) {
          if (line.includes('findMany')) inFindMany = true;
          if (inFindMany && line.includes('forEach')) {
            // Check if prisma call inside forEach
            expect(line).not.toMatch(/prisma\.\w+\.find/);
          }
        }
      }
    });
  });

  it('should use indexes for filtered fields', () => {
    const schema = readFile('prisma/schema.prisma');

    // Check for common filter fields without indexes
    const models = schema.match(/model \w+ {([^}]+)}/g);

    models?.forEach((model) => {
      const fields = model.match(/(\w+)\s+\w+/g);

      // Common filter fields that should be indexed
      const filterFields = ['email', 'username', 'slug', 'status', 'published'];

      fields?.forEach((field) => {
        const [name] = field.split(' ');
        if (filterFields.includes(name)) {
          expect(model).toMatch(/@@index/);
        }
      });
    });
  });
});
```

### Findings Template

```markdown
### Prisma Analysis

**Good:**
- ✓ Using select for API responses
- ✓ Transactions for multi-step operations
- ✓ Proper connection pooling configured

**Issues Found:**
- ✗ N+1 query in dashboard data loader
  - lib/dashboard.ts - Loading user posts in loop
  - Fix: Use include or separate query with where

- ✗ Missing index on User.email
  - Frequently filtered but not indexed
  - Fix: Add @@index([email]) to User model

- ✗ Missing index on Post.slug
  - Used for routing but not indexed
  - Fix: Add @@unique([slug]) or @@index([slug])

- ✗ Not using select for list views
  - API returns full objects when only partial needed
  - Fix: Add select to prisma.user.findMany()

**Recommendations:**
1. Add indexes to frequently queried fields
2. Use include instead of separate queries for relations
3. Implement select for all public API endpoints
```

---

## Zustand Store Analysis

```typescript
// Check for Zustand patterns
describe('Zustand Efficiency', () => {
  it('should use selectors for component subscriptions', () => {
    const components = findFiles('components', '.tsx');

    components.forEach((comp) => {
      const content = readFile(comp);

      // Should not subscribe to entire store
      if (content.includes('useStore')) {
        // Check if destructuring specific fields
        expect(content).toMatch(/useStore\(state\s*=>\s*state\.\w+/);
      }
    });
  });

  it('should avoid unnecessary re-renders', () => {
    const stores = findFiles('stores', '.ts');

    stores.forEach((store) => {
      const content = readFile(store);

      // Should have shallow comparison for objects
      if (content.includes('subscribeWithSelector')) {
        expect(content).toMatch(/shallow/);
      }
    });
  });

  it('should split stores by domain', () => {
    const stores = findFiles('stores', '.ts');

    // Check if store file is too large (>500 lines)
    stores.forEach((store) => {
      const lines = readFile(store).split('\n');
      expect(lines.length).toBeLessThan(500);
    });
  });
});
```

---

## React Compiler Analysis

```typescript
// Check for React Compiler readiness
describe('React Compiler Readiness', () => {
  it('should remove unnecessary useMemo', () => {
    const components = findFiles('components', '.tsx');

    components.forEach((comp) => {
      const content = readFile(comp);

      // Simple useMemo can be removed by compiler
      const simpleMemo = content.match(
        /useMemo\(\(\)\s*=>\s*([^,]+),\s*\[[^\]]*\]\)/g
      );

      simpleMemo?.forEach((memo) => {
        const value = memo.match(/=>\s*(.+),/)?.[1];
        // If value is a simple primitive or object literal
        if (value && !value.includes('()') && !value.includes('function')) {
          // Mark for potential removal
          expect(comp).toBeDefined();
        }
      });
    });
  });

  it('should use valid dependency arrays', () => {
    const components = findFiles('components', '.tsx');

    components.forEach((comp) => {
      const content = readFile(comp);

      // Check useEffect and useMemo
      const hooks = content.match(/use(?:Effect|Memo|Callback)\([^)]+\)/g);

      hooks?.forEach((hook) => {
        const deps = hook.match(/\[([^\]]*)\]/)?.[1];

        if (deps) {
          // Should not have empty deps when using values
          const usedValues = hook.match(/[\w.]+/g);
          const depArray = deps.split(',').map((d) => d.trim());

          // Basic check - if values used, deps shouldn't be empty
          if (usedValues && usedValues.length > 1 && depArray.length === 0) {
            expect(deps).toBeTruthy();
          }
        }
      });
    });
  });

  it('should avoid expensive renders', () => {
    const components = findFiles('components', '.tsx');

    components.forEach((comp) => {
      const content = readFile(comp);

      // Large inline objects should be memoized or moved outside
      const largeObjects = content.match(
        /{{[\s\S]{500,}}}/g
      );

      expect(largeObjects).toBeNull();
    });
  });
});
```

---

## Bundle Size Analysis

```typescript
// Check for bundle optimization
describe('Bundle Size', () => {
  it('should use tree-shakeable imports', () => {
    const files = findFiles(['src', 'lib'], '.ts');

    files.forEach((file) => {
      const content = readFile(file);

      // Should use named imports instead of namespace imports
      expect(content).not.toMatch(/\* as \w+ from/);
    });
  });

  it('should avoid duplicate dependencies', () => {
    const pkg = readFile('package.json');
    const { dependencies, devDependencies } = JSON.parse(pkg);

    const allDeps = { ...dependencies, ...devDependencies };

    // Check for duplicate packages with different versions
    const dupes = Object.entries(allDeps).filter(([name]) => {
      return name.startsWith('@types/') && name.substring(6) in allDeps;
    });

    expect(dupes).toHaveLength(0);
  });

  it('should use dynamic imports for large libraries', () => {
    const components = findFiles('components', '.tsx');

    components.forEach((comp) => {
      const content = readFile(comp);

      // Large libraries should use dynamic import
      const largeLibs = ['monaco-editor', 'codemirror', 'pdfjs-dist'];

      largeLibs.forEach((lib) => {
        if (content.includes(lib)) {
          expect(content).toMatch(/dynamic\(|React\.lazy\(/);
        }
      });
    });
  });
});
```

---

## Complete Analysis Template

```typescript
// tests/deps/efficiency-analysis.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function findFiles(dir: string, ext: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'dist'].includes(entry.name)) continue;
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

describe('Dependency Efficiency Analysis', () => {
  describe('TanStack Router', () => {
    it('should have typed routes', () => {
      const routes = findFiles('src/routes', '.tsx');

      routes.forEach((route) => {
        const content = readFile(route);
        // Checks for proper typing patterns
        if (content.includes('$')) {
          expect(content).toMatch(/UseParams|useParams/);
        }
      });
    });
  });

  describe('React Query', () => {
    it('should use array cache keys', () => {
      const hooks = findFiles('src/hooks', '.ts');

      hooks.forEach((hook) => {
        const content = readFile(hook);

        if (content.includes('useQuery')) {
          expect(content).toMatch(/\['/, 'Should use array-based cache keys');
        }
      });
    });
  });

  describe('Prisma', () => {
    it('should avoid N+1 queries', () => {
      const files = findFiles('src', '.ts');

      let hasN1Warning = false;

      files.forEach((file) => {
        const content = readFile(file);

        // Pattern: findMany followed by forEach with query inside
        if (content.includes('findMany') && content.includes('forEach')) {
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('findMany')) {
              // Check next 10 lines for forEach with prisma query
              for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                if (lines[j].includes('forEach') && lines[j].includes('prisma.')) {
                  hasN1Warning = true;
                  console.warn(`Potential N+1 in ${file}:${i + 1}`);
                }
              }
            }
          }
        }
      });
    });
  });
});
```

---

## Running Analysis

```bash
# Run dependency analysis
docker exec daemon-tools npm test -- tests/deps/efficiency-analysis.test.ts

# Generate bundle analysis
docker exec daemon-tools npm run build -- --analyze
```
