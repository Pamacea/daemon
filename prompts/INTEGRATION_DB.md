# Database Integration Test Guide

This prompt is included by EXECUTE.md. It provides detailed guidance for database integration testing.

---

## Transaction Rollback Pattern

**CRITICAL**: Always use transaction rollback to prevent test data pollution.

### Setup

```typescript
// tests/db/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const db = {
  prisma,
  transaction: null as PrismaClient | null,

  async begin() {
    // Start a transaction
    this.transaction = await prisma.$transaction(
      async (tx) => tx,
      {
        maxWait: 5000,
        timeout: 10000,
      }
    ) as PrismaClient;
  },

  async rollback() {
    if (this.transaction) {
      await this.transaction.$disconnect();
      this.transaction = null;
    }
  },

  get user() {
    return this.transaction?.$extends(prisma.user) || prisma.user;
  }
};

// Seed data helpers
export async function seedUsers(count = 5) {
  const users = Array.from({ length: count }, (_, i) => ({
    email: `user${i}@test.com`,
    name: `User ${i}`
  }));

  if (db.transaction) {
    return await db.transaction.user.createMany({ data: users });
  }
  return await prisma.user.createMany({ data: users });
}
```

---

## CRUD Test Templates

### Create Tests

```typescript
describe('User Creation', () => {
  beforeEach(async () => {
    await db.begin();
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should create user with valid data', async () => {
    const user = await db.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        age: 25
      }
    });

    expect(user).toMatchObject({
      email: 'test@example.com',
      name: 'Test User',
      age: 25
    });
    expect(user.id).toBeDefined();
  });

  it('should enforce unique email', async () => {
    await db.user.create({
      data: { email: 'test@example.com', name: 'User 1' }
    });

    await expect(
      db.user.create({
        data: { email: 'test@example.com', name: 'User 2' }
      })
    ).rejects.toThrow(/unique/i);
  });

  it('should validate required fields', async () => {
    await expect(
      db.user.create({ data: { name: 'User' } }) // Missing email
    ).rejects.toThrow();
  });
});
```

### Read Tests

```typescript
describe('User Reading', () => {
  beforeEach(async () => {
    await db.begin();
    await seedUsers(10);
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should find user by id', async () => {
    const created = await db.user.findFirst();
    const found = await db.user.findUnique({
      where: { id: created!.id }
    });

    expect(found).toEqual(created);
  });

  it('should find user by email', async () => {
    const found = await db.user.findUnique({
      where: { email: 'user0@test.com' }
    });

    expect(found).toBeDefined();
    expect(found?.email).toBe('user0@test.com');
  });

  it('should return null for non-existent user', async () => {
    const found = await db.user.findUnique({
      where: { id: 'non-existent-id' }
    });

    expect(found).toBeNull();
  });

  it('should paginate results', async () => {
    const page1 = await db.user.findMany({
      take: 5,
      skip: 0,
      orderBy: { email: 'asc' }
    });

    const page2 = await db.user.findMany({
      take: 5,
      skip: 5,
      orderBy: { email: 'asc' }
    });

    expect(page1).toHaveLength(5);
    expect(page2).toHaveLength(5);
    expect(page1[0].email).not.toBe(page2[0].email);
  });
});
```

### Update Tests

```typescript
describe('User Updates', () => {
  let user: any;

  beforeEach(async () => {
    await db.begin();
    user = await db.user.create({
      data: { email: 'test@example.com', name: 'Test' }
    });
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should update user fields', async () => {
    const updated = await db.user.update({
      where: { id: user.id },
      data: { name: 'Updated Name' }
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.email).toBe(user.email); // Unchanged
  });

  it('should handle concurrent updates', async () => {
    const update1 = db.user.update({
      where: { id: user.id },
      data: { name: 'Name 1' }
    });

    const update2 = db.user.update({
      where: { id: user.id },
      data: { name: 'Name 2' }
    });

    const [result1, result2] = await Promise.allSettled([update1, update2]);

    // Both should succeed, last write wins
    expect(result1.status).toBe('fulfilled');
    expect(result2.status).toBe('fulfilled');
  });
});
```

### Delete Tests

```typescript
describe('User Deletion', () => {
  let user: any;

  beforeEach(async () => {
    await db.begin();
    user = await db.user.create({
      data: { email: 'test@example.com', name: 'Test' }
    });
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should delete user', async () => {
    await db.user.delete({ where: { id: user.id } });

    const found = await db.user.findUnique({
      where: { id: user.id }
    });

    expect(found).toBeNull();
  });

  it('should handle delete of non-existent user', async () => {
    await expect(
      db.user.delete({ where: { id: 'non-existent' } })
    ).rejects.toThrow();
  });
});
```

---

## Relationship Tests

```typescript
describe('User-Posts Relationship', () => {
  beforeEach(async () => {
    await db.begin();
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should create user with posts', async () => {
    const user = await db.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test',
        posts: {
          create: [
            { title: 'Post 1', content: 'Content 1' },
            { title: 'Post 2', content: 'Content 2' }
          ]
        }
      },
      include: { posts: true }
    });

    expect(user.posts).toHaveLength(2);
  });

  it('should eager load posts', async () => {
    const user = await db.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test',
        posts: {
          create: [{ title: 'Post 1', content: 'Content' }]
        }
      }
    });

    const withPosts = await db.user.findUnique({
      where: { id: user.id },
      include: { posts: true }
    });

    expect(withPosts?.posts).toHaveLength(1);
  });

  it('should prevent orphan posts', async () => {
    const user = await db.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test',
        posts: {
          create: [{ title: 'Post 1', content: 'Content' }]
        }
      }
    });

    await db.user.delete({ where: { id: user.id } });

    const posts = await db.post.findMany({
      where: { userId: user.id }
    });

    expect(posts).toHaveLength(0); // Cascade delete
  });
});
```

---

## Performance Tests

```typescript
describe('Query Performance', () => {
  beforeEach(async () => {
    await db.begin();
    // Seed 1000 users
    await db.user.createMany({
      data: Array.from({ length: 1000 }, (_, i) => ({
        email: `user${i}@test.com`,
        name: `User ${i}`
      }))
    });
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should use index for email lookup', async () => {
    const start = Date.now();
    await db.user.findUnique({
      where: { email: 'user500@test.com' }
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50); // Should be fast with index
  });

  it('should not have N+1 query', async () => {
    // Add posts to users
    for (let i = 0; i < 10; i++) {
      await db.user.update({
        where: { email: `user${i}@test.com` },
        data: {
          posts: {
            create: [{ title: `Post ${i}`, content: `Content ${i}` }]
          }
        }
      });
    }

    // Good: Eager loading
    const usersWithPosts = await db.user.findMany({
      take: 10,
      include: { posts: true }
    });

    // Verify this doesn't trigger N+1
    // (in real test, use query logging)
    expect(usersWithPosts).toHaveLength(10);
  });
});
```

---

## Database-Specific Patterns

### Prisma with SQLite (Test Database)

```typescript
// tests/db/prisma-test.ts
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

beforeAll(async () => {
  // Use in-memory SQLite for tests
  process.env.DATABASE_URL = 'file:./test.db';
  execSync('npx prisma migrate reset --force');
  prisma = new PrismaClient();
});

afterAll(async () => {
  await prisma.$disconnect();
  execSync('rm test.db');
});
```

### Neon/Supabase (Direct Connection)

```typescript
// Use a test schema for Neon/Supabase
beforeEach(async () => {
  await prisma.$executeRaw`
    CREATE SCHEMA IF NOT EXISTS test_schema;
    SET search_path TO test_schema;
  `;
});

afterEach(async () => {
  await prisma.$executeRaw`
    DROP SCHEMA test_schema CASCADE;
  `;
});
```
