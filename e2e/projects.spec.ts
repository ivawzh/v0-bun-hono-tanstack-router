import { test, expect, Page } from '@playwright/test';

// Helper function to mock authentication
async function mockAuth(page: Page) {
  await page.addInitScript(() => {
    // Mock localStorage with auth data
    localStorage.setItem('auth', JSON.stringify({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      },
      token: 'mock-token'
    }));
  });
}

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('should display projects page', async ({ page }) => {
    await page.goto('/projects');
    
    // Check for main elements
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
  });

  test('should create a new project', async ({ page }) => {
    await page.goto('/projects');
    
    // Click new project button
    await page.getByRole('button', { name: /new project/i }).click();
    
    // Fill in project details
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    await dialog.getByLabel(/project name/i).fill('Test Project');
    await dialog.getByLabel(/description/i).fill('This is a test project');
    
    // Submit form
    await dialog.getByRole('button', { name: /create/i }).click();
    
    // Check if project was created
    await expect(page.getByText('Test Project')).toBeVisible();
  });

  test('should navigate to project boards', async ({ page }) => {
    await page.goto('/projects');
    
    // Assuming there's at least one project
    const projectCard = page.locator('.project-card').first();
    await projectCard.click();
    
    // Should navigate to project boards
    await expect(page).toHaveURL(/\/projects\/[^/]+\/boards/);
    await expect(page.getByRole('heading', { name: /boards/i })).toBeVisible();
  });

  test('should edit project details', async ({ page }) => {
    await page.goto('/projects');
    
    // Click on project menu
    const menuButton = page.locator('.project-menu-button').first();
    await menuButton.click();
    
    // Click edit option
    await page.getByRole('menuitem', { name: /edit/i }).click();
    
    // Edit dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Update project name
    await dialog.getByLabel(/project name/i).clear();
    await dialog.getByLabel(/project name/i).fill('Updated Project Name');
    
    // Save changes
    await dialog.getByRole('button', { name: /save/i }).click();
    
    // Check if project was updated
    await expect(page.getByText('Updated Project Name')).toBeVisible();
  });

  test('should delete a project', async ({ page }) => {
    await page.goto('/projects');
    
    // Get project name before deletion
    const projectName = await page.locator('.project-name').first().textContent();
    
    // Click on project menu
    const menuButton = page.locator('.project-menu-button').first();
    await menuButton.click();
    
    // Click delete option
    await page.getByRole('menuitem', { name: /delete/i }).click();
    
    // Confirm deletion
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /confirm|delete/i }).click();
    
    // Project should be removed
    await expect(page.getByText(projectName!)).not.toBeVisible();
  });
});