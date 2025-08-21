/**
 * Test data fixtures and factory functions
 * Provides utilities to create test data for users, projects, repos, agents, etc.
 */
import { getTestDb } from "./setup";
import * as schema from "../db/schema";

// Use actual schema types
export type TestUser = schema.User;
export type TestProject = schema.Project;
export type TestRepository = schema.Repository;
export type TestAgent = schema.Agent;
export type TestActor = schema.Actor;

/**
 * Create a test user
 */
export async function createTestUser(
  overrides: Partial<Omit<TestUser, "id" | "createdAt" | "updatedAt">> = {}
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
  overrides: Partial<Omit<TestProject, "id" | "ownerId" | "createdAt" | "updatedAt">> = {}
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
  overrides: Partial<Omit<TestRepository, "id" | "projectId" | "createdAt" | "updatedAt">> = {}
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
  overrides: Partial<Omit<TestAgent, "id" | "projectId" | "createdAt" | "updatedAt">> = {}
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
  overrides: Partial<Omit<TestActor, "id" | "projectId" | "createdAt" | "updatedAt">> = {}
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
    column: "todo" as const,
    priority: 3,
    columnOrder: "1000",
    ready: false,
    agentSessionStatus: "INACTIVE",
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
  user?: Partial<Omit<TestUser, "id" | "createdAt" | "updatedAt">>;
  project?: Partial<Omit<TestProject, "id" | "ownerId" | "createdAt" | "updatedAt">>;
  repository?: Partial<Omit<TestRepository, "id" | "projectId" | "createdAt" | "updatedAt">>;
  agent?: Partial<Omit<TestAgent, "id" | "projectId" | "createdAt" | "updatedAt">>;
  actor?: Partial<Omit<TestActor, "id" | "projectId" | "createdAt" | "updatedAt">>;
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

/**
 * Create multiple test users for testing multi-user scenarios
 */
export async function createTestUsers(count: number, overrides: Partial<Omit<TestUser, "id" | "createdAt" | "updatedAt">>[] = []): Promise<TestUser[]> {
  const users = [];
  for (let i = 0; i < count; i++) {
    const userOverrides = overrides[i] || {};
    const user = await createTestUser(userOverrides);
    users.push(user);
  }
  return users;
}

/**
 * Create a project with multiple members
 */
export async function createProjectWithMembers(
  owner: TestUser,
  members: TestUser[],
  overrides: Partial<Omit<TestProject, "id" | "ownerId" | "createdAt" | "updatedAt">> = {}
): Promise<TestProject> {
  const db = getTestDb();
  const project = await createTestProject(owner.id, overrides);
  
  // Add members to project
  for (const member of members) {
    await db
      .insert(schema.projectUsers)
      .values({
        userId: member.id,
        projectId: project.id,
        role: "member",
      });
  }
  
  return project;
}

/**
 * Create a test scenario with multiple projects, users, and tasks
 */
export async function createComplexTestScenario() {
  const [owner, member1, member2, outsider] = await createTestUsers(4, [
    { displayName: "Project Owner" },
    { displayName: "Project Member 1" },
    { displayName: "Project Member 2" },
    { displayName: "Outsider User" }
  ]);
  
  const project = await createProjectWithMembers(owner, [member1, member2]);
  const repository = await createTestRepository(project.id, { isDefault: true });
  const agent = await createTestAgent(project.id);
  const actor = await createTestActor(project.id);
  
  // Create some tasks
  const todoTask = await createTestTask(project.id, repository.id, {
    rawTitle: "Todo Task",
    column: "todo",
    ready: true,
    priority: 2,
  });
  
  const doingTask = await createTestTask(project.id, repository.id, {
    rawTitle: "Doing Task",
    column: "doing",
    mode: "plan",
    priority: 1,
  });
  
  const doneTask = await createTestTask(project.id, repository.id, {
    rawTitle: "Done Task",
    column: "done",
    priority: 3,
  });
  
  return {
    users: { owner, member1, member2, outsider },
    project,
    repository,
    agent,
    actor,
    tasks: { todoTask, doingTask, doneTask },
  };
}

/**
 * Seed database with realistic test data
 */
export async function seedTestDatabase(options: {
  userCount?: number;
  projectsPerUser?: number;
  tasksPerProject?: number;
} = {}) {
  const { userCount = 3, projectsPerUser = 2, tasksPerProject = 5 } = options;
  
  const users = await createTestUsers(userCount);
  const projects = [];
  const allTasks = [];
  
  for (const user of users) {
    for (let p = 0; p < projectsPerUser; p++) {
      const project = await createTestProject(user.id, {
        name: `${user.displayName}'s Project ${p + 1}`,
      });
      const repository = await createTestRepository(project.id);
      const agent = await createTestAgent(project.id);
      const actor = await createTestActor(project.id);
      
      projects.push({ project, repository, agent, actor, owner: user });
      
      // Create tasks for this project
      for (let t = 0; t < tasksPerProject; t++) {
        const columns = ["todo", "doing", "done"] as const;
        const column = columns[t % 3];
        const task = await createTestTask(project.id, repository.id, {
          rawTitle: `Task ${t + 1} for ${project.name}`,
          column,
          priority: Math.floor(Math.random() * 5) + 1,
          ready: column === "todo" && Math.random() > 0.5,
        });
        allTasks.push(task);
      }
    }
  }
  
  return {
    users,
    projects,
    tasks: allTasks,
  };
}