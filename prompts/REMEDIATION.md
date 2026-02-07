# Test Remediation Guide

This prompt is included by EXECUTE.md. It provides detailed guidance for fixing failing tests.

---

## Remediation Workflow

```
┌─────────────────┐
│ Test Fails      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Analyze Error   │
│ - Read output   │
│ - Categorize    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Determine Fix   │
│ - Test issue?   │ → Fix test
│ - Code bug?     │ → Fix code
│ - Setup issue?  │ → Fix setup
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Apply Fix       │
│ - Edit file     │
│ - Add mock      │
│ - Update config │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verify Fix      │
│ - Re-run test   │
│ - Check related │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Document        │
│ - Note fix      │
│ - Update report │
└─────────────────┘
```

---

## Error Categorization

### Test Setup Errors

```typescript
// Error: Cannot find module '@/components/Button'
// Cause: Import path incorrect or alias not configured

// Fix 1: Check import path
import { Button } from '@/components/Button'; // Correct
import { Button } from './components/Button'; // Relative path

// Fix 2: Configure path alias
// vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Mock Errors

```typescript
// Error: Cannot read property 'mockReturnValue' of undefined

// Fix: Add proper mock
vi.mock('@/lib/api', () => ({
  fetchUsers: vi.fn(),
}));

// Or mock the return value
vi.mocked(fetchUsers).mockResolvedValue([{ id: '1', name: 'Test' }]);
```

### Async Errors

```typescript
// Error: Expected promise to be resolved, but it was rejected

// Fix 1: Use async/await properly
it('should fetch user', async () => {
  const user = await fetchUser('1');
  expect(user).toBeDefined();
});

// Fix 2: Handle rejection
it('should reject for invalid id', async () => {
  await expect(fetchUser('invalid')).rejects.toThrow();
});
```

### Timeout Errors

```typescript
// Error: Test timeout of 5000ms exceeded

// Fix 1: Increase timeout for slow operations
it('should process large file', async () => {
  const result = await processFile('large.csv');
  expect(result).toBeDefined();
}, 10000); // 10 second timeout

// Fix 2: Fix the actual slow code
// - Optimize query
// - Add caching
// - Use Promise.all for parallel operations
```

---

## Common Fixes by Category

### Component Test Fixes

```typescript
// Issue: "querySelector" returns null for missing element
// Cause: Element not rendered or wrong selector

// Before (failing):
it('should show error message', () => {
  render(<Form />);
  expect(screen.getByText('Error')).toBeInTheDocument(); // Throws
});

// After (fixed):
it('should show error message when error exists', () => {
  render(<Form error="Invalid input" />);
  expect(screen.getByText('Invalid input')).toBeInTheDocument();
});

// Or with queryBy:
it('should not show error initially', () => {
  render(<Form />);
  expect(screen.queryByText('Error')).not.toBeInTheDocument();
});
```

### Hook Test Fixes

```typescript
// Issue: Hook state not updating
// Cause: Not using act() for state updates

// Before (failing):
it('should increment counter', () => {
  const { result } = renderHook(() => useCounter());
  result.current.increment();
  expect(result.current.count).toBe(1); // Fails - not updated yet
});

// After (fixed):
it('should increment counter', () => {
  const { result } = renderHook(() => useCounter());
  act(() => {
    result.current.increment();
  });
  expect(result.current.count).toBe(1);
});
```

### API Test Fixes

```typescript
// Issue: Test fails with ECONNREFUSED
// Cause: API server not running or wrong URL

// Fix 1: Mock the fetch
import { vi } from 'vitest';

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: 'test' }),
  })
);

// Fix 2: Use test server
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/api/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users: [] }));
  }
});

beforeAll(async () => {
  await new Promise((resolve) => server.listen(3001, resolve));
});

afterAll((done) => server.close(done));
```

### DB Test Fixes

```typescript
// Issue: Test modifies real data
// Cause: Not using transaction rollback

// Fix: Wrap in transaction
beforeEach(async () => {
  await db.beginTransaction();
});

afterEach(async () => {
  await db.rollbackTransaction();
});

// Issue: Tests interfere with each other
// Cause: Not cleaning up between tests

// Fix: Use beforeEach/afterEach
beforeEach(async () => {
  await db.reset(); // Clear test data
});

// Or use unique test data
it('should create user', async () => {
  const user = await db.user.create({
    data: { email: `test-${Date.now()}@example.com` }
  });
});
```

---

## Fix Templates

### Adding Missing Mock

```typescript
// Test file before fix
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth'); // Mock exists but no implementation

// Test file after fix
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

// Or with vi.mocked
vi.mocked(useAuth).mockReturnValue({
  user: { id: '1', name: 'Test' },
  login: vi.fn(),
  logout: vi.fn(),
});
```

### Fixing Async Issues

```typescript
// Before: Missing await
it('should delete post', async () => {
  deletePost('1'); // Not awaited
  const posts = await getPosts();
  expect(posts).not.toContain(post); // Fails
});

// After: Add await
it('should delete post', async () => {
  await deletePost('1');
  const posts = await getPosts();
  expect(posts).not.toContain(post);
});

// Before: Not waiting for state update
it('should update user', () => {
  const { result } = renderHook(() => useUser());
  result.current.setName('New Name');
  expect(result.current.user.name).toBe('New Name'); // Fails
});

// After: Use waitFor
it('should update user', async () => {
  const { result } = renderHook(() => useUser());
  act(() => {
    result.current.setName('New Name');
  });
  await waitFor(() => {
    expect(result.current.user.name).toBe('New Name');
  });
});
```

### Fixing Selector Issues

```typescript
// Before: Using textContent which includes nested text
it('should show welcome message', () => {
  render(<Dashboard name="John" />);
  expect(screen.getByText('Welcome')).toBeInTheDocument();
  // Fails because <div>Welcome <span>John</span></div>
  // textContent is "Welcome John", not "Welcome"
});

// After: Use more specific selector
it('should show welcome message', () => {
  render(<Dashboard name="John" />);
  expect(screen.getByText(/Welcome/)).toBeInTheDocument();
  // Or use testId
  expect(screen.getByTestId('welcome-message')).toBeInTheDocument();
});
```

---

## E2E Test Fixes

### Wait Issues

```typescript
// Before: Not waiting for element
test('should show dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  const heading = page.locator('h1');
  await expect(heading).toContainText('Dashboard'); // Fails
});

// After: Wait for element
test('should show dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForSelector('h1');
  const heading = page.locator('h1');
  await expect(heading).toContainText('Dashboard');
});

// Or use waitForLoadState
await page.waitForLoadState('networkidle');
```

### Navigation Issues

```typescript
// Before: Not waiting for navigation
test('should login', async ({ page }) => {
  await page.goto('/login');
  await page.click('button[type="submit"]');
  expect(page.url()).toContain('/dashboard'); // Fails
});

// After: Wait for navigation
test('should login', async ({ page }) => {
  await page.goto('/login');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
  expect(page.url()).toContain('/dashboard');
});
```

---

## Performance Test Fixes

### Threshold Adjustments

```javascript
// Before: Threshold too strict
export const options = {
  thresholds: {
    'http_req_duration': ['p(95)<100'], // Too strict
  },
};

// After: Realistic threshold
export const options = {
  thresholds: {
    'http_req_duration': ['p(95)<200', 'p(99)<500'],
  },
};
```

### Stage Configuration

```javascript
// Before: VUs ramp too fast
stages: [
  { duration: '1s', target: 100 }, // Instant spike
]

// After: Gradual ramp
stages: [
  { duration: '30s', target: 100 }, // Gradual ramp
]
```

---

## Fix Documentation Template

```markdown
### FIX-XXX: [Brief Description]

**File:** `path/to/file.ts:line`

**Error Message:**
```
Expected: X
Received: Y
```

**Root Cause:**
[Explanation of why the test failed]

**Fix Applied:**
[Description of the fix]

**Code Change:**
```typescript
// Before
[X code]

// After
[Y code]
```

**Verification:**
```bash
docker exec daemon-tools npm test -- specific.test.ts
# ✓ Pass
```

**Related Tests:**
- [ ] test-a.test.ts - Still passing
- [ ] test-b.test.ts - Still passing
```

---

## Batch Fix Strategy

When many tests fail with similar issues:

```bash
# 1. Group failures by error type
docker exec daemon-tools npm test 2>&1 | grep "Error:" | sort | uniq -c

# 2. Identify common patterns
# - Import errors → Fix vitest.config.ts
# - Mock errors → Create setup file with common mocks
# - Async errors → Add waitFor wrappers

# 3. Create shared setup
// tests/setup.ts
import { vi } from 'vitest';

// Common mocks
vi.mock('@/lib/api', () => ({
  fetch: vi.fn(),
  post: vi.fn(),
}));

// Common utilities
export async function waitForElement(screen, text) {
  return await waitFor(() => screen.getByText(text));
}

// 4. Run subset to verify
docker exec daemon-tools npm test -- --grep="pattern"
```
