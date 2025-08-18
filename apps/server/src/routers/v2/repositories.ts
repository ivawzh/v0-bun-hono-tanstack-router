/**
 * V2 Repositories Router
 * Repository management APIs within projects
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createRepository,
  getProjectRepositories,
  getRepository,
  updateRepository,
  deleteRepository,
  setDefaultRepository,
  getRepositoriesWithTaskCounts,
  isRepositoryAvailable
} from '../../services/v2/repositories';
import { requireProjectAccess, requireRepositoryAccess } from '../../lib/auth-v2';

const repositoriesRouter = new Hono();

// Feature flag check middleware
repositoriesRouter.use('*', async (c, next) => {
  if (!useV2APIs()) {
    return c.json({ 
      error: 'V2 Repositories API is not enabled', 
      hint: 'Set USE_V2_APIS=true to enable' 
    }, 400);
  }
  await next();
});

// Input validation schemas
const createRepositorySchema = z.object({
  name: z.string().min(1).max(100),
  repoPath: z.string().min(1),
  isDefault: z.boolean().optional().default(false),
  maxConcurrencyLimit: z.number().min(1).max(10).optional().default(1)
});

const updateRepositorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  repoPath: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  maxConcurrencyLimit: z.number().min(1).max(10).optional()
});

/**
 * GET /api/v2/projects/:projectId/repositories
 * Get all repositories for a project
 */
repositoriesRouter.get('/projects/:projectId/repositories', requireProjectAccess(), async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const includeTaskCounts = c.req.query('includeTaskCounts') === 'true';
    
    let repositories;
    if (includeTaskCounts) {
      repositories = await getRepositoriesWithTaskCounts(projectId);
    } else {
      repositories = await getProjectRepositories(projectId);
    }

    return c.json({ repositories });
  } catch (error) {
    console.error('Failed to get project repositories:', error);
    return c.json({ error: 'Failed to get repositories' }, 500);
  }
});

/**
 * POST /api/v2/projects/:projectId/repositories
 * Create a new repository in project
 */
repositoriesRouter.post('/projects/:projectId/repositories', 
  requireProjectAccess(), 
  zValidator('json', createRepositorySchema), 
  async (c) => {
    try {
      const projectId = c.req.param('projectId');
      const input = c.req.valid('json');
      
      const repository = await createRepository({
        projectId,
        ...input
      });

      return c.json({ repository }, 201);
    } catch (error) {
      console.error('Failed to create repository:', error);
      return c.json({ error: 'Failed to create repository' }, 500);
    }
  }
);

/**
 * GET /api/v2/repositories/:repositoryId
 * Get specific repository
 */
repositoriesRouter.get('/repositories/:repositoryId', requireRepositoryAccess(), async (c) => {
  try {
    const repository = c.get('repository');
    return c.json({ repository });
  } catch (error) {
    console.error('Failed to get repository:', error);
    return c.json({ error: 'Failed to get repository' }, 500);
  }
});

/**
 * PUT /api/v2/repositories/:repositoryId
 * Update repository
 */
repositoriesRouter.put('/repositories/:repositoryId', 
  requireRepositoryAccess(), 
  zValidator('json', updateRepositorySchema), 
  async (c) => {
    try {
      const repositoryId = c.req.param('repositoryId');
      const input = c.req.valid('json');

      const repository = await updateRepository(repositoryId, input);
      
      if (!repository) {
        return c.json({ error: 'Repository not found' }, 404);
      }

      return c.json({ repository });
    } catch (error) {
      console.error('Failed to update repository:', error);
      return c.json({ error: 'Failed to update repository' }, 500);
    }
  }
);

/**
 * PUT /api/v2/repositories/:repositoryId/default
 * Set repository as default for its project
 */
repositoriesRouter.put('/repositories/:repositoryId/default', requireRepositoryAccess(), async (c) => {
  try {
    const repositoryId = c.req.param('repositoryId');
    const projectId = c.get('projectId');

    const repository = await setDefaultRepository(projectId, repositoryId);
    
    if (!repository) {
      return c.json({ error: 'Repository not found' }, 404);
    }

    return c.json({ repository });
  } catch (error) {
    console.error('Failed to set default repository:', error);
    return c.json({ error: 'Failed to set default repository' }, 500);
  }
});

/**
 * GET /api/v2/repositories/:repositoryId/availability
 * Check if repository is available for new tasks
 */
repositoriesRouter.get('/repositories/:repositoryId/availability', requireRepositoryAccess(), async (c) => {
  try {
    const repositoryId = c.req.param('repositoryId');
    const isAvailable = await isRepositoryAvailable(repositoryId);
    
    return c.json({ 
      repositoryId,
      isAvailable 
    });
  } catch (error) {
    console.error('Failed to check repository availability:', error);
    return c.json({ error: 'Failed to check repository availability' }, 500);
  }
});

/**
 * DELETE /api/v2/repositories/:repositoryId
 * Delete repository
 */
repositoriesRouter.delete('/repositories/:repositoryId', requireRepositoryAccess(), async (c) => {
  try {
    const repositoryId = c.req.param('repositoryId');

    const repository = await deleteRepository(repositoryId);
    
    if (!repository) {
      return c.json({ error: 'Repository not found' }, 404);
    }

    return c.json({ success: true, repository });
  } catch (error) {
    console.error('Failed to delete repository:', error);
    
    if (error instanceof Error && (
      error.message.includes('active tasks') || 
      error.message.includes('additional repository')
    )) {
      return c.json({ error: error.message }, 400);
    }
    
    return c.json({ error: 'Failed to delete repository' }, 500);
  }
});

export default repositoriesRouter;