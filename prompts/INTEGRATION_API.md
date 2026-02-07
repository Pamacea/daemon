# API Integration Test Guide

This prompt is included by EXECUTE.md. It provides detailed guidance for API route testing.

---

## Setup for API Testing

```typescript
// tests/api/setup.ts
import { Hono } from 'hono';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/setup';

// Create test app
export function createTestApp() {
  const app = new Hono();

  // Import and register routes
  app.route('/api/users', userRoutes);
  app.route('/api/posts', postRoutes);

  return app;
}

// Helper for making requests
export async function request(app: Hono, path: string, init?: RequestInit) {
  const url = `http://localhost${path}`;
  return app.request(url, init);
}
```

---

## GET Request Tests

```typescript
describe('GET /api/users', () => {
  let app: Hono;

  beforeEach(async () => {
    app = createTestApp();
    await db.begin();
    await seedUsers(10);
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should return list of users', async () => {
    const response = await request(app, '/api/users');

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users).toHaveLength(10);
  });

  it('should support pagination', async () => {
    const response = await request(app, '/api/users?page=1&limit=5');

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users).toHaveLength(5);
    expect(data.page).toBe(1);
  });

  it('should return empty array when no users', async () => {
    await db.user.deleteMany();
    const response = await request(app, '/api/users');

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users).toHaveLength(0);
  });
});

describe('GET /api/users/:id', () => {
  let app: Hono;
  let testUser: any;

  beforeEach(async () => {
    app = createTestApp();
    await db.begin();
    testUser = await db.user.create({
      data: { email: 'test@example.com', name: 'Test' }
    });
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should return user by id', async () => {
    const response = await request(app, `/api/users/${testUser.id}`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(testUser.id);
  });

  it('should return 404 for non-existent user', async () => {
    const response = await request(app, '/api/users/non-existent-id');

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should include related data', async () => {
    await db.post.create({
      data: {
        title: 'Test Post',
        authorId: testUser.id
      }
    });

    const response = await request(app, `/api/users/${testUser.id}?include=posts`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.posts).toBeDefined();
    expect(data.posts).toHaveLength(1);
  });
});
```

---

## POST Request Tests

```typescript
describe('POST /api/users', () => {
  let app: Hono;

  beforeEach(async () => {
    app = createTestApp();
    await db.begin();
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should create user with valid data', async () => {
    const response = await request(app, '/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@example.com',
        name: 'New User',
        age: 25
      })
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.email).toBe('new@example.com');
  });

  it('should reject invalid email format', async () => {
    const response = await request(app, '/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        name: 'User'
      })
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('email');
  });

  it('should reject missing required fields', async () => {
    const response = await request(app, '/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User' }) // Missing email
    });

    expect(response.status).toBe(400);
  });

  it('should reject duplicate email', async () => {
    await db.user.create({
      data: { email: 'test@example.com', name: 'User 1' }
    });

    const response = await request(app, '/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'User 2'
      })
    });

    expect(response.status).toBe(409); // Conflict
    const data = await response.json();
    expect(data.error).toContain('already exists');
  });

  it('should handle extra fields gracefully', async () => {
    const response = await request(app, '/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@example.com',
        name: 'User',
        extraField: 'should be ignored'
      })
    });

    // Extra fields should be ignored, not cause error
    expect(response.status).toBe(201);
  });
});
```

---

## PUT/PATCH Request Tests

```typescript
describe('PATCH /api/users/:id', () => {
  let app: Hono;
  let testUser: any;

  beforeEach(async () => {
    app = createTestApp();
    await db.begin();
    testUser = await db.user.create({
      data: { email: 'test@example.com', name: 'Test' }
    });
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should update user fields', async () => {
    const response = await request(app, `/api/users/${testUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Updated Name');
    expect(data.email).toBe('test@example.com'); // Unchanged
  });

  it('should return 404 for non-existent user', async () => {
    const response = await request(app, '/api/users/unknown', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' })
    });

    expect(response.status).toBe(404);
  });

  it('should not allow updating email to existing', async () => {
    await db.user.create({
      data: { email: 'other@example.com', name: 'Other' }
    });

    const response = await request(app, `/api/users/${testUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'other@example.com' })
    });

    expect(response.status).toBe(409);
  });
});
```

---

## DELETE Request Tests

```typescript
describe('DELETE /api/users/:id', () => {
  let app: Hono;
  let testUser: any;

  beforeEach(async () => {
    app = createTestApp();
    await db.begin();
    testUser = await db.user.create({
      data: { email: 'test@example.com', name: 'Test' }
    });
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should delete user', async () => {
    const response = await request(app, `/api/users/${testUser.id}`, {
      method: 'DELETE'
    });

    expect(response.status).toBe(204); // No content

    // Verify deletion
    const found = await db.user.findUnique({
      where: { id: testUser.id }
    });
    expect(found).toBeNull();
  });

  it('should return 404 for non-existent user', async () => {
    const response = await request(app, '/api/users/unknown', {
      method: 'DELETE'
    });

    expect(response.status).toBe(404);
  });
});
```

---

## Authentication Tests

```typescript
describe('Auth Middleware', () => {
  let app: Hono;
  let token: string;

  beforeEach(async () => {
    app = createTestApp();
    await db.begin();
    const user = await db.user.create({
      data: { email: 'test@example.com', name: 'Test' }
    });
    token = generateToken(user);
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should allow access with valid token', async () => {
    const response = await request(app, '/api/protected', {
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.status).toBe(200);
  });

  it('should reject request without token', async () => {
    const response = await request(app, '/api/protected');

    expect(response.status).toBe(401);
  });

  it('should reject request with invalid token', async () => {
    const response = await request(app, '/api/protected', {
      headers: { Authorization: 'Bearer invalid-token' }
    });

    expect(response.status).toBe(401);
  });

  it('should reject expired token', async () => {
    const expiredToken = generateExpiredToken();
    const response = await request(app, '/api/protected', {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    expect(response.status).toBe(401);
  });
});
```

---

## Rate Limiting Tests

```typescript
describe('Rate Limiting', () => {
  let app: Hono;

  beforeEach(async () => {
    app = createTestApp();
  });

  it('should allow requests under limit', async () => {
    const promises = Array.from({ length: 10 }, () =>
      request(app, '/api/users')
    );

    const responses = await Promise.all(promises);
    responses.forEach(res => {
      expect(res.status).toBe(200);
    });
  });

  it('should block requests over limit', async () => {
    const promises = Array.from({ length: 100 }, () =>
      request(app, '/api/users')
    );

    const responses = await Promise.all(promises);
    const blockedCount = responses.filter(
      res => res.status === 429
    ).length;

    expect(blockedCount).toBeGreaterThan(0);
  });

  it('should include rate limit headers', async () => {
    const response = await request(app, '/api/users');

    expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });
});
```

---

## File Upload Tests

```typescript
describe('File Upload', () => {
  let app: Hono;

  beforeEach(async () => {
    app = createTestApp();
    await db.begin();
  });

  afterEach(async () => {
    await db.rollback();
  });

  it('should upload valid file', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['test content']), 'test.txt');

    const response = await request(app, '/api/upload', {
      method: 'POST',
      body: formData
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.url).toBeDefined();
  });

  it('should reject file larger than limit', async () => {
    const largeFile = new Blob(['x'.repeat(10 * 1024 * 1024)]); // 10MB
    const formData = new FormData();
    formData.append('file', largeFile, 'large.txt');

    const response = await request(app, '/api/upload', {
      method: 'POST',
      body: formData
    });

    expect(response.status).toBe(413); // Payload Too Large
  });

  it('should reject invalid file type', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['<script>alert(1)</script>']), 'test.html');

    const response = await request(app, '/api/upload', {
      method: 'POST',
      body: formData
    });

    expect(response.status).toBe(400);
  });
});
```
