import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error')).toContainText('Invalid credentials');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');

    await page.click('text=About');
    await expect(page).toHaveURL('/about');

    await page.goBack();
    await expect(page).toHaveURL('/');

    await page.goForward();
    await expect(page).toHaveURL('/about');
  });
});

test.describe('Form Interaction', () => {
  test('should submit form successfully', async ({ page }) => {
    await page.goto('/form');

    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('.success')).toContainText('Form submitted');
  });

  test('should show validation errors', async ({ page }) => {
    await page.goto('/form');
    await page.click('button[type="submit"]');

    await expect(page.locator('input[name="name"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('input[name="email"]')).toHaveAttribute('aria-invalid', 'true');
  });
});
