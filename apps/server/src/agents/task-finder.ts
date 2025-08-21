/**
 * Optimized task selection engine with single SQL query
 */

import { db } from '../db';
import { eq, and, or, ne, desc, asc, sql, notExists } from 'drizzle-orm';
import * as schema from '../db/schema/index';

export interface TaskWithContext {
  task: schema.Task;
  mainRepository: schema.Repository;
  actor?: schema.Actor | null;
  project: schema.Project;
  assignedAgents: schema.Agent[];
  additionalRepositories: schema.Repository[];
}

/**
 * Find the next assignable task using a single optimized query
 * This query includes all necessary joins and conditions to avoid N+1 queries
 */
export async function findNextAssignableTask(): Promise<TaskWithContext | null> {
  // Single query with embedded subqueries to get the highest priority ready task
  const readyTasks = await db
    .select({
      task: schema.tasks,
      mainRepository: schema.repositories,
      actor: schema.actors,
      project: schema.projects
    })
    .from(schema.tasks)
    .innerJoin(schema.repositories, eq(schema.repositories.id, schema.tasks.mainRepositoryId))
    .leftJoin(schema.actors, eq(schema.actors.id, schema.tasks.actorId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
    .where(
      and(
        eq(schema.tasks.ready, true),
        eq(schema.tasks.agentSessionStatus, 'INACTIVE'),
        ne(schema.tasks.column, 'done'),
        // Only tasks with no incomplete dependencies
        notExists(
          db.select()
            .from(schema.taskDependencies)
            .innerJoin(schema.tasks as any, eq(schema.taskDependencies.dependsOnTaskId, (schema.tasks as any).id))
            .where(
              and(
                eq(schema.taskDependencies.taskId, schema.tasks.id),
                ne((schema.tasks as any).column, 'done')
              )
            )
        ),
        // Repository not at capacity (embedded subquery)
        // 0 = limitless, >0 = actual limit
        sql`(
          COALESCE(${schema.repositories.maxConcurrencyLimit}, 1) = 0
          OR (
            SELECT COUNT(*)
            FROM tasks AS repo_tasks
            WHERE repo_tasks.main_repository_id = ${schema.tasks.mainRepositoryId}
              AND repo_tasks.agent_session_status IN ('PUSHING', 'ACTIVE')
              AND repo_tasks.column != 'done'
          ) < ${schema.repositories.maxConcurrencyLimit}
        )`,
        // Has at least one available agent (embedded subquery)
        // 0 = limitless, >0 = actual limit
        sql`EXISTS (
          SELECT 1
          FROM task_agents ta
          INNER JOIN agents a ON a.id = ta.agent_id
          WHERE ta.task_id = ${schema.tasks.id}
            AND (a.rate_limit_reset_at IS NULL OR a.rate_limit_reset_at <= CURRENT_TIMESTAMP)
            AND (
              COALESCE(a.max_concurrency_limit, 0) = 0
              OR (
                SELECT COUNT(*)
                FROM tasks agent_tasks
                WHERE agent_tasks.active_agent_id = a.id
                  AND agent_tasks.agent_session_status IN ('PUSHING', 'ACTIVE')
                  AND agent_tasks.column != 'done'
              ) < a.max_concurrency_limit
            )
        )`
      )
    )
    .orderBy(
      desc(schema.tasks.priority), // Higher numbers = higher priority (5 > 4 > 3 > 2 > 1)
      sql`CASE
        WHEN ${schema.tasks.column} = 'doing' THEN 3
        WHEN ${schema.tasks.column} = 'todo' THEN 2
        WHEN ${schema.tasks.column} = 'loop' THEN 1
        ELSE 0
      END DESC`, // Column weight: doing > todo > loop
      asc(sql`CAST(${schema.tasks.columnOrder} AS DECIMAL)`),
      asc(schema.tasks.createdAt)
    )
    .limit(1);

  if (readyTasks.length === 0) {
    return null;
  }

  const result = readyTasks[0];

  // Get assigned agents for this task
  const assignedAgents = await db
    .select({
      agent: schema.agents
    })
    .from(schema.taskAgents)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.taskAgents.agentId))
    .where(eq(schema.taskAgents.taskId, result.task.id));

  // Get additional repositories for this task
  const additionalRepositories = await db
    .select({
      repository: schema.repositories
    })
    .from(schema.taskAdditionalRepositories)
    .innerJoin(schema.repositories, eq(schema.repositories.id, schema.taskAdditionalRepositories.repositoryId))
    .where(eq(schema.taskAdditionalRepositories.taskId, result.task.id));

  return {
    task: result.task,
    mainRepository: result.mainRepository,
    actor: result.actor,
    project: result.project,
    assignedAgents: assignedAgents.map(a => a.agent),
    additionalRepositories: additionalRepositories.map(ar => ar.repository)
  };
}

/**
 * Find best available agent for a task from assigned agents
 */
export function selectBestAvailableAgent(assignedAgents: any[]): any | null {
  if (assignedAgents.length === 0) {
    return null;
  }

  const now = new Date();

  // Sort by:
  // 1. Not rate limited (rate_limit_reset_at is null or in the past)
  // 2. Last task pushed time (oldest first for fair distribution)
  const eligibleAgents = assignedAgents
    .filter(agent => {
      // Check if agent is not rate limited
      if (agent.rateLimitResetAt) {
        const resetTime = new Date(agent.rateLimitResetAt);
        const isAvailable = resetTime <= now;
        if (!isAvailable) {
          console.log(`🚫 Agent ${agent.id} rate limited until ${resetTime.toISOString()}, current time: ${now.toISOString()}`);
        }
        return isAvailable;
      }
      return true;
    })
    .sort((a, b) => {
      // Prefer agents that haven't been used recently
      const aTime = a.lastTaskPushedAt?.getTime() || 0;
      const bTime = b.lastTaskPushedAt?.getTime() || 0;
      return aTime - bTime;
    });

  if (eligibleAgents.length === 0) {
    console.log(`🚫 No eligible agents found out of ${assignedAgents.length} assigned agents`);
    assignedAgents.forEach(agent => {
      if (agent.rateLimitResetAt) {
        console.log(`  - Agent ${agent.id}: rate limited until ${new Date(agent.rateLimitResetAt).toISOString()}`);
      } else {
        console.log(`  - Agent ${agent.id}: no rate limit (this should be available)`);
      }
    });
  }

  return eligibleAgents[0] || null;
}
