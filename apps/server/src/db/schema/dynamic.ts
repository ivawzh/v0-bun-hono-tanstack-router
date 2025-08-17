/**
 * Dynamic schema selector based on feature flags
 * Allows runtime switching between V1 and V2 schemas
 */

import { useV2Schema } from '../../lib/feature-flags';

// Import V1 schema
import * as v1Schema from './index';

// Import V2 schema
import * as v2Schema from './v2';

/**
 * Get the current schema based on feature flags
 */
export function getCurrentSchema() {
  if (useV2Schema()) {
    return v2Schema;
  }
  return v1Schema;
}

/**
 * Re-export schema entities based on feature flags
 * This allows existing imports to work with either schema version
 */

// Users table (same in both versions)
export const users = getCurrentSchema().users;
export const usersRelations = getCurrentSchema().usersRelations;

// Projects table (enhanced in V2)
export const projects = getCurrentSchema().projects;
export const projectsRelations = getCurrentSchema().projectsRelations;

// Agent-related tables (V1: agentClients, V2: agents)
export const agentClients = useV2Schema() ? undefined : v1Schema.agentClients;
export const agentClientsRelations = useV2Schema() ? undefined : v1Schema.agentClientsRelations;
export const agents = useV2Schema() ? v2Schema.agents : undefined;
export const agentsRelations = useV2Schema() ? v2Schema.agentsRelations : undefined;

// Repository-related tables (V1: repoAgents, V2: repositories)
export const repoAgents = useV2Schema() ? undefined : v1Schema.repoAgents;
export const repoAgentsRelations = useV2Schema() ? undefined : v1Schema.repoAgentsRelations;
export const repositories = useV2Schema() ? v2Schema.repositories : undefined;
export const repositoriesRelations = useV2Schema() ? v2Schema.repositoriesRelations : undefined;

// V2-only tables
export const projectUsers = useV2Schema() ? v2Schema.projectUsers : undefined;
export const projectUsersRelations = useV2Schema() ? v2Schema.projectUsersRelations : undefined;
export const taskRepositories = useV2Schema() ? v2Schema.taskRepositories : undefined;
export const taskRepositoriesRelations = useV2Schema() ? v2Schema.taskRepositoriesRelations : undefined;
export const taskAgents = useV2Schema() ? v2Schema.taskAgents : undefined;
export const taskAgentsRelations = useV2Schema() ? v2Schema.taskAgentsRelations : undefined;

// Common tables (actors, tasks, taskDependencies)
export const actors = getCurrentSchema().actors;
export const actorsRelations = getCurrentSchema().actorsRelations;
export const tasks = getCurrentSchema().tasks;
export const tasksRelations = getCurrentSchema().tasksRelations;
export const taskDependencies = getCurrentSchema().taskDependencies;
export const taskDependenciesRelations = getCurrentSchema().taskDependenciesRelations;

// V1-only tables
export const sessions = useV2Schema() ? undefined : v1Schema.sessions;
export const sessionsRelations = useV2Schema() ? undefined : v1Schema.sessionsRelations;

// Enums (shared between versions)
export const agentClientTypeEnum = getCurrentSchema().agentClientTypeEnum;

/**
 * Get all table definitions for the current schema
 * Useful for migrations and introspection
 */
export function getAllTables() {
  const schema = getCurrentSchema();
  const tables: Record<string, any> = {};
  
  // Extract all table definitions from the schema
  Object.keys(schema).forEach(key => {
    const value = (schema as any)[key];
    if (value && typeof value === 'object' && value._.config && value._.config.name) {
      tables[key] = value;
    }
  });
  
  return tables;
}

/**
 * Get schema version for debugging
 */
export function getSchemaVersion(): 'v1' | 'v2' {
  return useV2Schema() ? 'v2' : 'v1';
}

/**
 * Check if a table exists in the current schema
 */
export function hasTable(tableName: string): boolean {
  const tables = getAllTables();
  return tableName in tables;
}

/**
 * Helper to safely access V2-only tables with runtime checks
 */
export function requireV2Table<T>(table: T | undefined, tableName: string): T {
  if (!useV2Schema()) {
    throw new Error(`Table ${tableName} is only available in V2 schema. Enable V2 schema with USE_V2_SCHEMA=true`);
  }
  if (!table) {
    throw new Error(`Table ${tableName} is not defined in V2 schema`);
  }
  return table;
}

/**
 * Helper to safely access V1-only tables with runtime checks
 */
export function requireV1Table<T>(table: T | undefined, tableName: string): T {
  if (useV2Schema()) {
    throw new Error(`Table ${tableName} is only available in V1 schema. Disable V2 schema with USE_V2_SCHEMA=false`);
  }
  if (!table) {
    throw new Error(`Table ${tableName} is not defined in V1 schema`);
  }
  return table;
}