# E2E Test Guide (Playwright)

This prompt is included by EXECUTE.md. It provides detailed guidance for E2E testing.

---

## Playwright Setup

```typescript
// tests/e2e/setup.ts
import { test as base } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await use(page);
    // Logout after test
    await page.click('[data-testid="logout"]');
  },
});

export { expect } from '@playwright/test';
```

---

## Authentication Flows

### Login Flow

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect
    await expect(page).toHaveURL('/dashboard');

    // Should show user info
    await expect(page.locator('text=Welcome, Test')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('.error')).toContainText('Invalid credentials');

    // Should stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('input[name="email"]', 'not-an-email');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should show inline validation error
    await expect(page.locator('input[name="email"]'))
      .toHaveAttribute('aria-invalid', 'true');
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.fill('input[name="password"]', 'password123');
    const passwordInput = page.locator('input[name="password"]');

    // Initially masked
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle
    await page.click('button[aria-label="Show password"]');
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to hide
    await page.click('button[aria-label="Hide password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
```

### Registration Flow

```typescript
test.describe('Registration', () => {
  test('should complete full registration', async ({ page }) => {
    await page.goto('/register');

    // Step 1: Account details
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'SecurePass123!');
    await page.click('button:has-text("Continue")');

    // Step 2: Profile details
    await page.fill('input[name="name"]', 'New User');
    await page.selectOption('select[name="country"]', 'US');
    await page.click('button:has-text("Complete")');

    // Should redirect to onboarding
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test('should validate password strength', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'weak');
    await page.fill('input[name="confirmPassword"]', 'weak');

    await page.click('button[type="submit"]');

    // Should show password strength error
    await expect(page.locator('.password-strength')).toContainText('too weak');
  });
});
```

### Password Reset Flow

```typescript
test.describe('Password Reset', () => {
  test('should request password reset', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('.success'))
      .toContainText('Check your email for reset link');
  });

  test('should reset password with valid token', async ({ page, context }) => {
    // Simulate clicking email link with reset token
    const resetToken = 'valid-reset-token';
    await page.goto(`/reset-password?token=${resetToken}`);

    await page.fill('input[name="password"]', 'NewPass123!');
    await page.fill('input[name="confirmPassword"]', 'NewPass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/login');
    await expect(page.locator('.success'))
      .toContainText('Password updated successfully');
  });

  test('should reject invalid reset token', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token');
    await page.fill('input[name="password"]', 'NewPass123!');
    await page.fill('input[name="confirmPassword"]', 'NewPass123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error')).toContainText('Invalid or expired token');
  });
});
```

---

## CRUD Operations

### Create Flow

```typescript
test.describe('Create Post', () => {
  test('should create new post', async ({ page }) => {
    // Login first
    await login(page);

    await page.click('text=New Post');
    await expect(page).toHaveURL('/posts/new');

    await page.fill('input[name="title"]', 'Test Post');
    await page.fill('textarea[name="content"]', 'This is test content');
    await page.selectOption('select[name="category"]', 'technology');
    await page.click('button:has-text("Publish")');

    // Should redirect to post detail
    await expect(page).toHaveURL(/\/posts\/[a-z0-9]+/);
    await expect(page.locator('h1')).toContainText('Test Post');
  });

  test('should validate required fields', async ({ page }) => {
    await login(page);
    await page.click('text=New Post');
    await page.click('button:has-text("Publish")');

    // Should show validation errors
    await expect(page.locator('input[name="title"]'))
      .toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('textarea[name="content"]'))
      .toHaveAttribute('aria-invalid', 'true');
  });

  test('should save draft', async ({ page }) => {
    await login(page);
    await page.click('text=New Post');
    await page.fill('input[name="title"]', 'Draft Post');
    await page.click('button:has-text("Save Draft")');

    // Should show success message
    await expect(page.locator('.toast')).toContainText('Draft saved');

    // Should appear in drafts list
    await page.goto('/posts?status=draft');
    await expect(page.locator('text=Draft Post')).toBeVisible();
  });
});
```

### Read/View Flow

```typescript
test.describe('View Posts', () => {
  test('should show posts list', async ({ page }) => {
    await page.goto('/posts');

    // Should show posts
    await expect(page.locator('.post-card')).toHaveCount(10);

    // Should have pagination
    await expect(page.locator('.pagination')).toBeVisible();
  });

  test('should filter posts by category', async ({ page }) => {
    await page.goto('/posts');
    await page.click('button:has-text("Categories")');
    await page.click('a:has-text("Technology")');

    await expect(page).toHaveURL('/posts?category=technology');
    await expect(page.locator('.post-card').first()).toContainText('Technology');
  });

  test('should search posts', async ({ page }) => {
    await page.goto('/posts');
    await page.fill('input[name="search"]', 'test query');
    await page.press('input[name="search"]', 'Enter');

    await expect(page).toHaveURL(/search=test/);
  });

  test('should show post detail', async ({ page }) => {
    await page.goto('/posts');
    await page.click('.post-card:first-child');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.post-content')).toBeVisible();
  });
});
```

### Update Flow

```typescript
test.describe('Edit Post', () => {
  test('should update existing post', async ({ page }) => {
    await login(page);
    await page.goto('/posts/test-post-id');
    await page.click('button:has-text("Edit")');

    await expect(page).toHaveURL(/\/posts\/test-post-id\/edit/);

    await page.fill('input[name="title"]', 'Updated Title');
    await page.click('button:has-text("Save")');

    await expect(page.locator('h1')).toContainText('Updated Title');
  });

  test('should show preview', async ({ page }) => {
    await login(page);
    await page.goto('/posts/test-post-id/edit');
    await page.click('button:has-text("Preview")');

    await expect(page.locator('.preview-mode')).toBeVisible();
    await expect(page.locator('.preview-content')).toContainText('Updated Title');
  });
});
```

### Delete Flow

```typescript
test.describe('Delete Post', () => {
  test('should delete post with confirmation', async ({ page }) => {
    await login(page);
    await page.goto('/posts/test-post-id');
    await page.click('button:has-text("Delete")');

    // Should show confirmation dialog
    await expect(page.locator('.dialog')).toContainText(
      'Are you sure you want to delete this post?'
    );
    await page.click('.dialog button:has-text("Delete")');

    // Should redirect to posts list
    await expect(page).toHaveURL('/posts');
    await expect(page.locator('.toast')).toContainText('Post deleted');
  });

  test('should cancel delete', async ({ page }) => {
    await login(page);
    await page.goto('/posts/test-post-id');
    await page.click('button:has-text("Delete")');
    await page.click('.dialog button:has-text("Cancel")');

    // Should stay on page
    await expect(page).toHaveURL(/\/posts\/test-post-id/);
  });
});
```

---

## Navigation & Routing

```typescript
test.describe('Navigation', () => {
  test('should navigate via menu', async ({ page }) => {
    await page.goto('/');
    await page.click('a:has-text("About")');
    await expect(page).toHaveURL('/about');
  });

  test('should use browser back/forward', async ({ page }) => {
    await page.goto('/');
    await page.click('a:has-text("Posts")');
    await page.click('a:has-text("About")');

    await page.goBack();
    await expect(page).toHaveURL('/posts');

    await page.goForward();
    await expect(page).toHaveURL('/about');
  });

  test('should handle direct URL access', async ({ page }) => {
    await page.goto('/posts/test-post');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should show 404 for invalid routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.locator('h1')).toContainText('404');
    await expect(page.locator('text=Page not found')).toBeVisible();
  });
});
```

---

## Form Interactions

```typescript
test.describe('Multi-step Form', () => {
  test('should complete wizard', async ({ page }) => {
    await page.goto('/wizard');

    // Step 1
    await page.fill('input[name="field1"]', 'value1');
    await page.click('button:has-text("Next")');
    await expect(page.locator('.wizard')).toHaveClass(/step-2/);

    // Step 2
    await page.fill('input[name="field2"]', 'value2');
    await page.click('button:has-text("Next")');
    await expect(page.locator('.wizard')).toHaveClass(/step-3/);

    // Step 3
    await page.click('button:has-text("Complete")');
    await expect(page).toHaveURL('/success');
  });

  test('should navigate back in wizard', async ({ page }) => {
    await page.goto('/wizard');
    await page.fill('input[name="field1"]', 'value1');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Back")');

    // Values should be preserved
    await expect(page.locator('input[name="field1"]')).toHaveValue('value1');
  });
});
```

---

## Web Vitals Checks

```typescript
test.describe('Performance', () => {
  test('should have good LCP', async ({ page }) => {
    await page.goto('/');
    const metrics = await page.evaluate(() =>
      JSON.stringify(performance.getEntriesByType('navigation'))
    );
    const nav = JSON.parse(metrics)[0];

    // LCP should be under 2.5s
    expect(nav.loadEventEnd - nav.fetchStart).toBeLessThan(2500);
  });

  test('should not have layout shifts', async ({ page }) => {
    await page.goto('/');

    // Wait for page to settle
    await page.waitForLoadState('networkidle');

    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          let clsValue = 0;
          for (const entry of entries) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          resolve(clsValue);
        }).observe({ entryTypes: ['layout-shift'] });
      });
    });

    expect(cls).toBeLessThan(0.1);
  });
});
```

---

## Accessibility Tests

```typescript
test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (nodes) =>
      nodes.map((n) => n.tagName)
    );

    // Should start with h1
    expect(headings[0]).toBe('H1');

    // Should not skip levels
    for (let i = 1; i < headings.length; i++) {
      const current = parseInt(headings[i][1]);
      const previous = parseInt(headings[i - 1][1]);
      expect(current).toBeLessThanOrEqual(previous + 1);
    }
  });

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/');
    const images = await page.$$('img');
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    const focusable = await page.$$(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    for (const element of focusable) {
      await element.focus();
      await expect(element).toBeFocused();
    }
  });
});
```
