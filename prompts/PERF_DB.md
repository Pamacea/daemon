# Database Performance Guide

This prompt is included by EXECUTE.md. It provides detailed guidance for database query performance testing.

---

## Query Benchmarking (Vitest)

```typescript
// tests/db/benchmarks.test.ts
import { bench, describe, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';

describe('Database Query Performance', () => {
  let userId: string;

  beforeAll(async () => {
    // Setup test data
    const user = await prisma.user.create({
      data: {
        email: 'bench@example.com',
        name: 'Benchmark User',
        posts: {
          create: Array.from({ length: 100 }, (_, i) => ({
            title: `Post ${i}`,
            content: `Content ${i}`.repeat(10),
          })),
        },
      },
    });
    userId = user.id;
  });

  describe('Index Usage', () => {
    bench('SELECT by indexed field (email)', async () => {
      await prisma.user.findUnique({
        where: { email: 'bench@example.com' },
      });
    });

    bench('SELECT by indexed field (id)', async () => {
      await prisma.user.findUnique({
        where: { id: userId },
      });
    });

    bench('SELECT by non-indexed field (name)', async () => {
      await prisma.user.findFirst({
        where: { name: 'Benchmark User' },
      });
    });
  });

  describe('Loading Strategies', () => {
    bench('N+1 pattern (bad)', async () => {
      const users = await prisma.user.findMany({ take: 10 });
      for (const user of users) {
        await prisma.post.findMany({
          where: { authorId: user.id },
        });
      }
    });

    bench('Eager loading with include (good)', async () => {
      await prisma.user.findMany({
        take: 10,
        include: { posts: true },
      });
    });

    bench('Eager loading with select (optimal)', async () => {
      await prisma.user.findMany({
        take: 10,
        select: {
          id: true,
          name: true,
          posts: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    });
  });

  describe('Pagination', () => {
    bench('Offset-based pagination', async () => {
      await prisma.user.findMany({
        skip: 50,
        take: 10,
      });
    });

    bench('Cursor-based pagination', async () => {
      await prisma.user.findMany({
        take: 10,
        cursor: { id: userId },
        skip: 1,
      });
    });
  });

  describe('Aggregations', () => {
    bench('COUNT query', async () => {
      await prisma.user.count();
    });

    bench('COUNT with index', async () => {
      await prisma.post.count({
        where: { authorId: userId },
      });
    });

    bench('Complex aggregation', async () => {
      await prisma.post.aggregate({
        where: { authorId: userId },
        _count: true,
        _avg: { likes: true },
        _sum: { views: true },
      });
    });
  });

  describe('Transaction Performance', () => {
    bench('Single write', async () => {
      await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          name: 'Test',
        },
      });
    });

    bench('Batch write (10 records)', async () => {
      await prisma.user.createMany({
        data: Array.from({ length: 10 }, (_, i) => ({
          email: `batch-${Date.now()}-${i}@example.com`,
          name: `User ${i}`,
        })),
      });
    });

    bench('Transaction with multiple writes', async () => {
      await prisma.$transaction([
        prisma.user.create({
          data: {
            email: `trans-${Date.now()}@example.com`,
            name: 'Trans User',
          },
        }),
        prisma.post.create({
          data: {
            title: 'Trans Post',
            content: 'Content',
            author: {
              connect: { email: `trans-${Date.now()}@example.com` },
            },
          },
        }),
      ]);
    });
  });
});
```

---

## Query Analysis

```typescript
// tests/db/analysis.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';

describe('Query Analysis', () => {
  describe('N+1 Detection', () => {
    it('should not have N+1 in user posts query', async () => {
      const queries: string[] = [];

      // Log queries (requires Prisma preview feature)
      const originalExecute = prisma.$queryRawUnsafe.bind(prisma);
      prisma.$queryRawUnsafe = (...args: any[]) => {
        queries.push(args[0]);
        return originalExecute(...args);
      };

      // Execute the query pattern
      const users = await prisma.user.findMany({
        take: 5,
        include: { posts: true },
      });

      // Should only be 2 queries (users + posts via join)
      // Not N+1 (1 for users + N for posts)
      expect(queries.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Index Usage', () => {
    it('should use index for email lookup', async () => {
      // This is a conceptual test - actual implementation varies
      // Use EXPLAIN ANALYZE for real verification

      const start = Date.now();
      await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });
      const indexedTime = Date.now() - start;

      // Compare with non-indexed lookup
      const start2 = Date.now();
      await prisma.user.findFirst({
        where: { name: 'Test User' },
      });
      const nonIndexedTime = Date.now() - start2;

      // Indexed should be faster (with significant data)
      expect(indexedTime).toBeLessThan(nonIndexedTime);
    });
  });

  describe('Connection Pool', () => {
    it('should handle concurrent queries efficiently', async () => {
      const start = Date.now();

      await Promise.all([
        prisma.user.findMany({ take: 10 }),
        prisma.post.findMany({ take: 10 }),
        prisma.comment.findMany({ take: 10 }),
      ]);

      const concurrentTime = Date.now() - start;

      // Sequential time
      const start2 = Date.now();
      await prisma.user.findMany({ take: 10 });
      await prisma.post.findMany({ take: 10 });
      await prisma.comment.findMany({ take: 10 });
      const sequentialTime = Date.now() - start2;

      // Concurrent should be faster
      expect(concurrentTime).toBeLessThan(sequentialTime);
    });
  });
});
```

---

## Prisma-Specific Patterns

### Include vs Select

```typescript
describe('Field Selection Performance', () => {
  it('should prefer select over include for large data', async () => {
    // Include loads all fields
    const start1 = Date.now();
    await prisma.user.findMany({
      take: 100,
      include: { posts: true },
    });
    const includeTime = Date.now() - start1;

    // Select loads only needed fields
    const start2 = Date.now();
    await prisma.user.findMany({
      take: 100,
      select: {
        id: true,
        name: true,
        posts: {
          select: { id: true, title: true },
        },
      },
    });
    const selectTime = Date.now() - start2;

    // Select should be faster for large datasets
    expect(selectTime).toBeLessThan(includeTime);
  });
});
```

### Lazy vs Eager Loading

```typescript
describe('Loading Strategy', () => {
  bench('Lazy loading (deferred)', async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      await prisma.post.findMany({
        where: { authorId: user.id },
      });
    }
  });

  bench('Eager loading (include)', async () => {
    await prisma.user.findUnique({
      where: { id: userId },
      include: { posts: true },
    });
  });
});
```

---

## Performance Assertions

```typescript
// tests/db/performance-assertions.test.ts
import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';

describe('Performance Assertions', () => {
  it('should return user list within 100ms', async () => {
    const start = Date.now();
    await prisma.user.findMany({ take: 50 });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should create user within 50ms', async () => {
    const start = Date.now();
    await prisma.user.create({
      data: {
        email: `perf-${Date.now()}@example.com`,
        name: 'Perf Test',
      },
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50);
  });

  it('should handle 100 concurrent queries without timeouts', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () =>
        prisma.user.findFirst({ where: { id: userId } })
      )
    );

    const failures = results.filter((r) => r.status === 'rejected');
    expect(failures).toHaveLength(0);
  });
});
```

---

## Migration Performance

```typescript
// tests/db/migration-performance.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';

describe('Migration Performance', () => {
  beforeAll(async () => {
    // Ensure clean state
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
  });

  it('should migrate 1000 records efficiently', async () => {
    const start = Date.now();

    // Batch insert
    await prisma.user.createMany({
      data: Array.from({ length: 1000 }, (_, i) => ({
        email: `migrate-${i}@example.com`,
        name: `User ${i}`,
      })),
      skipDuplicates: true,
    });

    const duration = Date.now() - start;

    // Should complete in reasonable time
    expect(duration).toBeLessThan(5000);
  });

  it('should update 1000 records efficiently', async () => {
    // First create
    await prisma.user.createMany({
      data: Array.from({ length: 1000 }, (_, i) => ({
        email: `update-${i}@example.com`,
        name: `User ${i}`,
      })),
    });

    const start = Date.now();

    // Batch update
    await prisma.user.updateMany({
      where: { email: { startsWith: 'update-' } },
      data: { name: 'Updated' },
    });

    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000);
  });
});
```

---

## Running DB Performance Tests

```bash
# Run all performance tests
docker exec daemon-tools npm test -- tests/db/benchmarks.test.ts --reporter=verbose

# Run specific benchmark
docker exec daemon-tools npm test -- tests/db/benchmarks.test.ts --bench

# Run with memory profiling
docker exec daemon-tools node --expose-gc -r ts-node/register tests/db/benchmarks.test.ts
```
