import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/');
    
    // Check if login page elements are present
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('should redirect to Monster Auth on Google login', async ({ page }) => {
    await page.goto('/');
    
    // Click on Google login button
    const googleButton = page.getByRole('button', { name: /continue with google/i });
    await googleButton.click();
    
    // Should redirect to Monster Auth
    await page.waitForURL(/auth\..*monstermake\.limited/, { timeout: 10000 });
    
    const url = page.url();
    expect(url).toContain('monstermake.limited');
  });

  test('should handle OAuth callback', async ({ page, context }) => {
    // Mock OAuth callback with code
    const callbackUrl = 'http://localhost:8500/api/oauth/callback?code=test-code&state=test-state';
    
    // Set up mock authentication cookie
    await context.addCookies([
      {
        name: 'auth-token',
        value: 'mock-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }
    ]);
    
    // Navigate to callback URL
    const response = await page.goto(callbackUrl, { waitUntil: 'networkidle' });
    
    // Should redirect to frontend
    expect(page.url()).toContain('localhost:8302');
  });

  test('should protect authenticated routes', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/projects');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|signin|auth)?/);
  });
});