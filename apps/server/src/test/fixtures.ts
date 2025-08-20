/**
 * Test data fixtures and factory functions
 * Provides utilities to create test data for users, projects, repos, agents, etc.
 */
import { getTestDb } from "./setup";
import * as schema from "../db/schema";

export interface TestUser {
  id: string;
  email: string;
  displayName: string;
}

export interface TestProject {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
}

export interface TestRepository {
  id: string;
  projectId: string;
  name: string;
  repoPath: string;
  isDefault: boolean;
}

export interface TestAgent {
  id: string;
  projectId: string;
  name: string;
  agentType: "CLAUDE_CODE" | "CURSOR_CLI" | "OPENCODE";
  agentSettings: any;
}

export interface TestActor {
  id: string;
  projectId: string;
  name: string;
  description: string;
  isDefault: boolean;
}

/**
 * Create a test user
 */
export async function createTestUser(
  overrides: Partial<Omit<TestUser, "id">> = {}
): Promise<TestUser> {
  const db = getTestDb();
  
  const userData = {
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    displayName: "Test User",
    ...overrides,
  };
  
  const [user] = await db
    .insert(schema.users)
    .values(userData)
    .returning();
    
  return user;
}

/**
 * Create a test project with owner
 */
export async function createTestProject(
  ownerId: string,
  overrides: Partial<Omit<TestProject, "id" | "ownerId">> = {}
): Promise<TestProject> {
  const db = getTestDb();
  
  const projectData = {
    name: `Test Project ${Date.now()}`,
    description: "A test project",
    ownerId,
    memory: {},
    settings: {},
    ...overrides,
  };
  
  const [project] = await db
    .insert(schema.projects)
    .values(projectData)
    .returning();
    
  // Create project membership
  await db
    .insert(schema.projectUsers)
    .values({
      userId: ownerId,
      projectId: project.id,
      role: "admin",
    });
    
  return project;
}

/**
 * Create a test repository
 */
export async function createTestRepository(
  projectId: string,
  overrides: Partial<Omit<TestRepository, "id" | "projectId">> = {}
): Promise<TestRepository> {
  const db = getTestDb();
  
  const repoData = {
    name: `Test Repo ${Date.now()}`,
    repoPath: `/tmp/test-repo-${Date.now()}`,
    isDefault: true,
    maxConcurrencyLimit: 1,
    projectId,
    ...overrides,
  };
  
  const [repository] = await db
    .insert(schema.repositories)
    .values(repoData)
    .returning();
    
  return repository;
}

/**
 * Create a test agent
 */
export async function createTestAgent(
  projectId: string,
  overrides: Partial<Omit<TestAgent, "id" | "projectId">> = {}
): Promise<TestAgent> {
  const db = getTestDb();
  
  const agentData = {
    name: `Test Agent ${Date.now()}`,
    agentType: "CLAUDE_CODE" as const,
    agentSettings: {},
    maxConcurrencyLimit: 0,
    projectId,
    state: {},
    ...overrides,
  };
  
  const [agent] = await db
    .insert(schema.agents)
    .values(agentData)
    .returning();
    
  return agent;
}

/**
 * Create a test actor
 */
export async function createTestActor(
  projectId: string,
  overrides: Partial<Omit<TestActor, "id" | "projectId">> = {}
): Promise<TestActor> {
  const db = getTestDb();
  
  const actorData = {
    name: `Test Actor ${Date.now()}`,
    description: "A test actor for testing purposes",
    isDefault: true,
    projectId,
    ...overrides,
  };
  
  const [actor] = await db
    .insert(schema.actors)
    .values(actorData)
    .returning();
    
  return actor;
}

/**
 * Create a test task
 */
export async function createTestTask(
  projectId: string,
  mainRepositoryId: string,
  overrides: Partial<Omit<schema.Task, "id" | "projectId" | "mainRepositoryId" | "createdAt" | "updatedAt">> = {}
): Promise<schema.Task> {
  const db = getTestDb();
  
  const taskData = {
    rawTitle: `Test Task ${Date.now()}`,
    rawDescription: "A test task description",
    status: "todo" as const,
    priority: 3,
    columnOrder: "1000",
    ready: false,
    agentSessionStatus: "NON_ACTIVE",
    author: "human",
    attachments: [],
    projectId,
    mainRepositoryId,
    ...overrides,
  };
  
  const [task] = await db
    .insert(schema.tasks)
    .values(taskData)
    .returning();
    
  return task;
}

/**
 * Create a complete test project setup with user, project, repo, agent, and actor
 */
export async function createCompleteTestSetup(overrides: {
  user?: Partial<Omit<TestUser, "id">>;
  project?: Partial<Omit<TestProject, "id" | "ownerId">>;
  repository?: Partial<Omit<TestRepository, "id" | "projectId">>;
  agent?: Partial<Omit<TestAgent, "id" | "projectId">>;
  actor?: Partial<Omit<TestActor, "id" | "projectId">>;
} = {}) {
  const user = await createTestUser(overrides.user);
  const project = await createTestProject(user.id, overrides.project);
  const repository = await createTestRepository(project.id, overrides.repository);
  const agent = await createTestAgent(project.id, overrides.agent);
  const actor = await createTestActor(project.id, overrides.actor);
  
  return {
    user,
    project,
    repository,
    agent,
    actor,
  };
}