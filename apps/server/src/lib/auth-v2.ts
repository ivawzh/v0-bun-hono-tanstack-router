/**
 * V2 Authorization Middleware
 * Project-user authorization system for multi-project access
 */

import { Context } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import * as v1Schema from '../db/schema/index';
import * as v2Schema from '../db/schema/v2';

interface AuthContext {
  userId: string;
  projectId?: string;
  hasProjectAccess?: boolean;
}

/**
 * Get project-user authorization for V2 multi-project system
 */
export async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  if (!useV2Schema()) {
    // V1 behavior: check if user owns the project
    const project = await db.select()
      .from(v1Schema.projects)
      .where(and(
        eq(v1Schema.projects.id, projectId),
        eq(v1Schema.projects.ownerId, userId)
      ))
      .limit(1);
    
    return project.length > 0;
  }

  // V2 behavior: check project membership
  const membership = await db.select()
    .from(v2Schema.projectUsers)
    .where(and(
      eq(v2Schema.projectUsers.userId, userId),
      eq(v2Schema.projectUsers.projectId, projectId)
    ))
    .limit(1);

  return membership.length > 0;
}

/**
 * Get all projects accessible to a user
 */
export async function getUserProjects(userId: string) {
  if (!useV2Schema()) {
    // V1 behavior: user owns projects directly
    return await db.select()
      .from(v1Schema.projects)
      .where(eq(v1Schema.projects.ownerId, userId));
  }

  // V2 behavior: projects through membership
  const projectsWithMembership = await db.select({
    project: v2Schema.projects,
    membership: v2Schema.projectUsers
  })
    .from(v2Schema.projects)
    .innerJoin(v2Schema.projectUsers, eq(v2Schema.projectUsers.projectId, v2Schema.projects.id))
    .where(eq(v2Schema.projectUsers.userId, userId));

  return projectsWithMembership.map(row => row.project);
}

/**
 * Get user agents (V2 only)
 */
export async function getUserAgents(userId: string) {
  if (!useV2Schema()) {
    throw new Error('User agents are only available in V2 schema. Enable with USE_V2_SCHEMA=true');
  }

  return await db.select()
    .from(v2Schema.agents)
    .where(eq(v2Schema.agents.userId, userId));
}

/**
 * Get project repositories (V2 only)
 */
export async function getProjectRepositories(projectId: string) {
  if (!useV2Schema()) {
    // V1 behavior: return repoAgents as repositories
    return await db.select({
      id: v1Schema.repoAgents.id,
      projectId: v1Schema.repoAgents.projectId,
      name: v1Schema.repoAgents.name,
      repoPath: v1Schema.repoAgents.repoPath,
      isDefault: v1Schema.repoAgents.isPaused, // Map isPaused to isDefault (inverted)
      maxConcurrencyLimit: 1, // Default limit
      lastTaskPushedAt: null,
      createdAt: v1Schema.repoAgents.createdAt,
      updatedAt: v1Schema.repoAgents.updatedAt
    })
      .from(v1Schema.repoAgents)
      .where(eq(v1Schema.repoAgents.projectId, projectId));
  }

  return await db.select()
    .from(v2Schema.repositories)
    .where(eq(v2Schema.repositories.projectId, projectId));
}

/**
 * Project authorization middleware for API routes
 */
export function requireProjectAccess() {
  return async (c: Context, next: () => Promise<void>) => {
    const userId = c.get('userId');
    const projectId = c.req.param('projectId') || c.req.query('projectId');

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!projectId) {
      return c.json({ error: 'Project ID required' }, 400);
    }

    const hasAccess = await checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      return c.json({ error: 'Project access denied' }, 403);
    }

    // Add project context to request
    c.set('projectId', projectId);
    c.set('hasProjectAccess', true);

    await next();
  };
}

/**
 * User agent ownership middleware (V2 only)
 */
export function requireAgentOwnership() {
  return async (c: Context, next: () => Promise<void>) => {
    if (!useV2Schema()) {
      return c.json({ error: 'User agents are only available in V2' }, 400);
    }

    const userId = c.get('userId');
    const agentId = c.req.param('agentId');

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!agentId) {
      return c.json({ error: 'Agent ID required' }, 400);
    }

    const agent = await db.select()
      .from(v2Schema.agents)
      .where(and(
        eq(v2Schema.agents.id, agentId),
        eq(v2Schema.agents.userId, userId)
      ))
      .limit(1);

    if (agent.length === 0) {
      return c.json({ error: 'Agent not found or access denied' }, 403);
    }

    c.set('agent', agent[0]);
    await next();
  };
}

/**
 * Repository project membership middleware (V2)
 */
export function requireRepositoryAccess() {
  return async (c: Context, next: () => Promise<void>) => {
    const userId = c.get('userId');
    const repositoryId = c.req.param('repositoryId');

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!repositoryId) {
      return c.json({ error: 'Repository ID required' }, 400);
    }

    if (!useV2Schema()) {
      // V1 behavior: check repoAgent project ownership
      const repoAgent = await db.select({
        repoAgent: v1Schema.repoAgents,
        project: v1Schema.projects
      })
        .from(v1Schema.repoAgents)
        .innerJoin(v1Schema.projects, eq(v1Schema.projects.id, v1Schema.repoAgents.projectId))
        .where(and(
          eq(v1Schema.repoAgents.id, repositoryId),
          eq(v1Schema.projects.ownerId, userId)
        ))
        .limit(1);

      if (repoAgent.length === 0) {
        return c.json({ error: 'Repository access denied' }, 403);
      }

      c.set('repository', repoAgent[0].repoAgent);
      c.set('projectId', repoAgent[0].project.id);
    } else {
      // V2 behavior: check repository project membership
      const repository = await db.select({
        repository: v2Schema.repositories,
        project: v2Schema.projects
      })
        .from(v2Schema.repositories)
        .innerJoin(v2Schema.projects, eq(v2Schema.projects.id, v2Schema.repositories.projectId))
        .where(eq(v2Schema.repositories.id, repositoryId))
        .limit(1);

      if (repository.length === 0) {
        return c.json({ error: 'Repository not found' }, 404);
      }

      const hasAccess = await checkProjectAccess(userId, repository[0].project.id);
      if (!hasAccess) {
        return c.json({ error: 'Repository access denied' }, 403);
      }

      c.set('repository', repository[0].repository);
      c.set('projectId', repository[0].project.id);
    }

    await next();
  };
}

/**
 * Helper to get auth context from Hono context
 */
export function getAuthContext(c: Context): AuthContext {
  return {
    userId: c.get('userId'),
    projectId: c.get('projectId'),
    hasProjectAccess: c.get('hasProjectAccess')
  };
}

/**
 * Schema-aware route wrapper
 * Automatically handles V1/V2 differences in route behavior
 */
export function schemaAwareRoute<T>(
  v1Handler: (c: Context) => Promise<T>,
  v2Handler: (c: Context) => Promise<T>
) {
  return async (c: Context): Promise<T> => {
    if (useV2Schema()) {
      return await v2Handler(c);
    } else {
      return await v1Handler(c);
    }
  };
}