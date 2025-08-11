import { test, expect, Page } from '@playwright/test';

// Helper function to mock authentication
async function mockAuth(page: Page) {
  await page.addInitScript(() => {
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

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('should display board with tasks', async ({ page }) => {
    // Navigate to a project board
    await page.goto('/projects/test-project/boards/test-board');
    
    // Check for board columns
    await expect(page.getByText('Todo')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('should create a new task', async ({ page }) => {
    await page.goto('/projects/test-project/boards/test-board');
    
    // Click add task button
    await page.getByRole('button', { name: /add task|new task/i }).click();
    
    // Fill in task details
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/title/i).fill('Test Task');
    await dialog.getByLabel(/description/i).fill('This is a test task description');
    await dialog.getByLabel(/priority/i).fill('5');
    
    // Select stage
    await dialog.getByRole('combobox', { name: /stage/i }).selectOption('dev');
    
    // Create task
    await dialog.getByRole('button', { name: /create/i }).click();
    
    // Task should appear in the board
    await expect(page.getByText('Test Task')).toBeVisible();
  });

  test('should drag task between columns', async ({ page }) => {
    await page.goto('/projects/test-project/boards/test-board');
    
    // Get a task from Todo column
    const task = page.locator('.task-card').first();
    const taskTitle = await task.textContent();
    
    // Get the In Progress column
    const inProgressColumn = page.locator('.board-column').filter({ hasText: 'In Progress' });
    
    // Drag and drop
    await task.dragTo(inProgressColumn);
    
    // Task should now be in In Progress column
    await expect(inProgressColumn.getByText(taskTitle!)).toBeVisible();
  });

  test('should open task drawer on click', async ({ page }) => {
    await page.goto('/projects/test-project/boards/test-board');
    
    // Click on a task
    const task = page.locator('.task-card').first();
    await task.click();
    
    // Task drawer should open
    const drawer = page.locator('.task-drawer');
    await expect(drawer).toBeVisible();
    
    // Check for task details
    await expect(drawer.getByRole('heading')).toBeVisible();
    await expect(drawer.getByText(/description/i)).toBeVisible();
    await expect(drawer.getByText(/priority/i)).toBeVisible();
  });

  test('should update task details', async ({ page }) => {
    await page.goto('/projects/test-project/boards/test-board');
    
    // Open task drawer
    const task = page.locator('.task-card').first();
    await task.click();
    
    const drawer = page.locator('.task-drawer');
    
    // Edit task title
    await drawer.getByRole('button', { name: /edit/i }).click();
    await drawer.getByLabel(/title/i).clear();
    await drawer.getByLabel(/title/i).fill('Updated Task Title');
    
    // Save changes
    await drawer.getByRole('button', { name: /save/i }).click();
    
    // Check if task was updated
    await expect(page.getByText('Updated Task Title')).toBeVisible();
  });

  test('should add checklist items', async ({ page }) => {
    await page.goto('/projects/test-project/boards/test-board');
    
    // Open task drawer
    const task = page.locator('.task-card').first();
    await task.click();
    
    const drawer = page.locator('.task-drawer');
    
    // Add checklist item
    await drawer.getByRole('button', { name: /add checklist item/i }).click();
    await drawer.getByPlaceholder(/new item/i).fill('Complete unit tests');
    await drawer.getByPlaceholder(/new item/i).press('Enter');
    
    // Checklist item should be added
    await expect(drawer.getByText('Complete unit tests')).toBeVisible();
    
    // Toggle checklist item
    const checkbox = drawer.getByRole('checkbox', { name: /complete unit tests/i });
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  });

  test('should add messages to task', async ({ page }) => {
    await page.goto('/projects/test-project/boards/test-board');
    
    // Open task drawer
    const task = page.locator('.task-card').first();
    await task.click();
    
    const drawer = page.locator('.task-drawer');
    
    // Add a message
    const messageInput = drawer.getByPlaceholder(/add a message/i);
    await messageInput.fill('This task needs review');
    await messageInput.press('Enter');
    
    // Message should appear
    await expect(drawer.getByText('This task needs review')).toBeVisible();
  });

  test('should filter tasks by stage', async ({ page }) => {
    await page.goto('/projects/test-project/boards/test-board');
    
    // Click on stage filter
    await page.getByRole('button', { name: /filter by stage/i }).click();
    await page.getByRole('option', { name: /dev/i }).click();
    
    // Only dev stage tasks should be visible
    const tasks = page.locator('.task-card');
    const count = await tasks.count();
    
    for (let i = 0; i < count; i++) {
      const task = tasks.nth(i);
      await expect(task.getByText(/dev/i)).toBeVisible();
    }
  });
});