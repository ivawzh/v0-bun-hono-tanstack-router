/**
 * V2 Authorization Middleware
 * Project-user authorization system for multi-project access
 */

import type { Context } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema/index';

interface AuthContext {
  userId: string;
  projectId?: string;
  hasProjectAccess?: boolean;
}

/**
 * Get project-user authorization for V2 multi-project system
 */
export async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  // V2 behavior: check project membership
  const membership = await db.select()
    .from(schema.projectUsers)
    .where(and(
      eq(schema.projectUsers.userId, userId),
      eq(schema.projectUsers.projectId, projectId)
    ))
    .limit(1);

  return membership.length > 0;
}

/**
 * Get all projects accessible to a user
 */
export async function getUserProjects(userId: string) {
  // V2 behavior: projects through membership
  const projectsWithMembership = await db.select({
    project: schema.projects,
    membership: schema.projectUsers
  })
    .from(schema.projects)
    .innerJoin(schema.projectUsers, eq(schema.projectUsers.projectId, schema.projects.id))
    .where(eq(schema.projectUsers.userId, userId));

  return projectsWithMembership.map(row => row.project);
}

/**
 * Check if user has access to specific repository
 */
export async function checkRepositoryAccess(userId: string, repositoryId: string): Promise<{ hasAccess: boolean, projectId?: string, repository?: any }> {
  const repositoryWithProject = await db.select({
    repository: schema.repositories,
    project: schema.projects,
    membership: schema.projectUsers
  })
    .from(schema.repositories)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.repositories.projectId))
    .innerJoin(schema.projectUsers, eq(schema.projectUsers.projectId, schema.projects.id))
    .where(and(
      eq(schema.repositories.id, repositoryId),
      eq(schema.projectUsers.userId, userId)
    ))
    .limit(1);

  if (repositoryWithProject.length === 0) {
    return { hasAccess: false };
  }

  const result = repositoryWithProject[0];
  return {
    hasAccess: true,
    projectId: result.project.id,
    repository: result.repository
  };
}

/**
 * Check if user has access to specific agent
 */
export async function checkAgentAccess(userId: string, agentId: string): Promise<{ hasAccess: boolean, agent?: any, projectId?: string }> {
  const agentWithProject = await db.select({
    agent: schema.agents,
    project: schema.projects,
    membership: schema.projectUsers
  })
    .from(schema.agents)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.agents.projectId))
    .innerJoin(schema.projectUsers, eq(schema.projectUsers.projectId, schema.projects.id))
    .where(and(
      eq(schema.agents.id, agentId),
      eq(schema.projectUsers.userId, userId)
    ))
    .limit(1);

  if (agentWithProject.length === 0) {
    return { hasAccess: false };
  }

  const result = agentWithProject[0];
  return {
    hasAccess: true,
    agent: result.agent,
    projectId: result.project.id
  };
}

/**
 * Middleware factory for project access requirement
 */
export function requireProjectAccess() {
  return async (c: Context, next: () => Promise<void>) => {
    const userId = c.get('userId');
    const projectId = c.req.param('projectId') || c.get('projectId');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!projectId) {
      return c.json({ error: 'Project ID required' }, 400);
    }

    const hasAccess = await checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      return c.json({ error: 'Project access denied' }, 403);
    }

    c.set('projectId', projectId);
    c.set('hasProjectAccess', true);
    await next();
  };
}

/**
 * Middleware factory for repository access requirement
 */
export function requireRepositoryAccess() {
  return async (c: Context, next: () => Promise<void>) => {
    const userId = c.get('userId');
    const repositoryId = c.req.param('repositoryId');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!repositoryId) {
      return c.json({ error: 'Repository ID required' }, 400);
    }

    const { hasAccess, projectId, repository } = await checkRepositoryAccess(userId, repositoryId);
    if (!hasAccess) {
      return c.json({ error: 'Repository access denied' }, 403);
    }

    c.set('projectId', projectId);
    c.set('repository', repository);
    await next();
  };
}

/**
 * Middleware factory for agent ownership requirement
 */
export function requireAgentOwnership() {
  return async (c: Context, next: () => Promise<void>) => {
    const userId = c.get('userId');
    const agentId = c.req.param('agentId');

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!agentId) {
      return c.json({ error: 'Agent ID required' }, 400);
    }

    const { hasAccess, agent, projectId } = await checkAgentAccess(userId, agentId);
    if (!hasAccess) {
      return c.json({ error: 'Agent access denied' }, 403);
    }

    c.set('agent', agent);
    c.set('projectId', projectId);
    await next();
  };
}

/**
 * Schema-aware route helper (simplified for V2-only)
 */
export function schemaAwareRoute<T>(
  handler: (c: Context) => Promise<T>
) {
  return handler;
}