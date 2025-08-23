import { db } from '../db/index'
import { tasks, projects, agents, repositories, actors, users, projectUsers } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'

export interface TestTask {
  id: string
  projectId: string
  rawTitle: string
  rawDescription?: string | null
  refinedTitle?: string | null
  refinedDescription?: string | null
  list: 'todo' | 'doing' | 'done' | 'loop' | 'check'
  mode?: 'clarify' | 'plan' | 'execute' | 'iterate' | 'loop' | 'talk' | 'check' | null
  priority: number
  ready: boolean | null
  agentSessionStatus: string
  plan?: any
}

export interface TestProject {
  id: string
  name: string
  description?: string | null
  ownerId: string
}

export interface TestAgent {
  id: string
  projectId: string
  name: string
  agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE'
}

export interface TestRepository {
  id: string
  projectId: string
  name: string
  repoPath: string
  isDefault: boolean | null
}

export interface TestActor {
  id: string
  projectId: string
  name: string
  description: string
  isDefault: boolean | null
}

export interface TestUser {
  id: string
  email: string
  displayName: string
}

/**
 * Create test fixtures using new terminology
 */
export class TestFixtures {
  static async createUser(userData?: Partial<TestUser>): Promise<TestUser> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData?.email || 'test@example.com',
        displayName: userData?.displayName || 'Test User',
        ...userData
      })
      .returning()
    
    return user
  }

  static async createProject(projectData: Partial<TestProject> & { ownerId: string }): Promise<TestProject> {
    const [project] = await db
      .insert(projects)
      .values({
        name: projectData.name || 'Test Project',
        description: projectData.description || 'Test project description',
        ownerId: projectData.ownerId
      })
      .returning()
    
    return project
  }

  static async createRepository(repoData: Partial<TestRepository> & { projectId: string }): Promise<TestRepository> {
    const [repository] = await db
      .insert(repositories)
      .values({
        projectId: repoData.projectId,
        name: repoData.name || 'Test Repo',
        repoPath: repoData.repoPath || '/tmp/test-repo',
        isDefault: repoData.isDefault ?? true
      })
      .returning()
    
    return repository
  }

  static async createAgent(agentData: Partial<TestAgent> & { projectId: string }): Promise<TestAgent> {
    const [agent] = await db
      .insert(agents)
      .values({
        projectId: agentData.projectId,
        name: agentData.name || 'Test Agent',
        agentType: agentData.agentType || 'CLAUDE_CODE'
      })
      .returning()
    
    return agent
  }

  static async createActor(actorData: Partial<TestActor> & { projectId: string }): Promise<TestActor> {
    const [actor] = await db
      .insert(actors)
      .values({
        projectId: actorData.projectId,
        name: actorData.name || 'Test Actor',
        description: actorData.description || 'Test actor description',
        isDefault: actorData.isDefault ?? true
      })
      .returning()
    
    return actor
  }

  static async createCard(cardData: Partial<TestTask> & { 
    projectId: string
    mainRepositoryId: string 
  }): Promise<TestTask> {
    const [card] = await db
      .insert(tasks)
      .values({
        projectId: cardData.projectId,
        mainRepositoryId: cardData.mainRepositoryId,
        rawTitle: cardData.rawTitle || 'Test Card',
        rawDescription: cardData.rawDescription,
        refinedTitle: cardData.refinedTitle,
        refinedDescription: cardData.refinedDescription,
        list: cardData.list || 'todo',
        mode: cardData.mode,
        priority: cardData.priority || 3,
        ready: cardData.ready ?? false,
        agentSessionStatus: cardData.agentSessionStatus || 'INACTIVE',
        plan: cardData.plan
      })
      .returning()
    
    return card
  }

  /**
   * Create a complete test environment with all entities using new terminology
   */
  static async createCompleteTestEnvironment() {
    const user = await this.createUser()
    const project = await this.createProject({ ownerId: user.id })
    
    // Add user to project
    await db.insert(projectUsers).values({
      userId: user.id,
      projectId: project.id,
      role: 'owner'
    })
    
    const repository = await this.createRepository({ projectId: project.id })
    const agent = await this.createAgent({ projectId: project.id })
    const actor = await this.createActor({ projectId: project.id })
    
    // Create cards in different columns with different modes
    const todoCard = await this.createCard({
      projectId: project.id,
      mainRepositoryId: repository.id,
      rawTitle: 'Todo Card',
      list: 'todo',
      mode: undefined,
      ready: true
    })
    
    const doingClarifyCard = await this.createCard({
      projectId: project.id,
      mainRepositoryId: repository.id,
      rawTitle: 'Doing Clarify Card',
      list: 'doing',
      mode: 'clarify',
      agentSessionStatus: 'ACTIVE'
    })
    
    const doingPlanCard = await this.createCard({
      projectId: project.id,
      mainRepositoryId: repository.id,
      rawTitle: 'Doing Plan Card',
      list: 'doing',
      mode: 'plan',
      refinedTitle: 'Refined Planning Card',
      agentSessionStatus: 'ACTIVE'
    })
    
    const doingExecuteCard = await this.createCard({
      projectId: project.id,
      mainRepositoryId: repository.id,
      rawTitle: 'Doing Execute Card',
      list: 'doing',
      mode: 'execute',
      refinedTitle: 'Refined Execution Card',
      plan: { solution: 'Test solution', spec: 'Test spec' },
      agentSessionStatus: 'ACTIVE'
    })
    
    const doneCard = await this.createCard({
      projectId: project.id,
      mainRepositoryId: repository.id,
      rawTitle: 'Done Card',
      list: 'done',
      mode: undefined,
      refinedTitle: 'Completed Card'
    })
    
    const loopCard = await this.createCard({
      projectId: project.id,
      mainRepositoryId: repository.id,
      rawTitle: 'Loop Card',
      list: 'loop',
      mode: 'loop',
      ready: true
    })
    
    return {
      user,
      project,
      repository,
      agent,
      actor,
      cards: {
        todo: todoCard,
        doingClarify: doingClarifyCard,
        doingPlan: doingPlanCard,
        doingExecute: doingExecuteCard,
        done: doneCard,
        loop: loopCard
      }
    }
  }

  /**
   * Clean up all test data
   */
  static async cleanup() {
    // Delete in reverse dependency order
    await db.delete(tasks)
    await db.delete(actors)
    await db.delete(repositories)
    await db.delete(agents)
    await db.delete(projectUsers)
    await db.delete(projects)
    await db.delete(users)
  }
}

/**
 * Test utilities for validating card states using new terminology
 */
export class TestValidation {
  static async validateCardInColumn(cardId: string, expectedColumn: 'todo' | 'doing' | 'done' | 'loop') {
    const [card] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, cardId))
    
    if (!card) {
      throw new Error(`Card ${cardId} not found`)
    }
    
    if (card.list !== expectedColumn) {
      throw new Error(`Expected card to be in ${expectedColumn} column, but found in ${card.list}`)
    }
    
    return card
  }
  
  static async validateCardInMode(cardId: string, expectedMode: 'clarify' | 'plan' | 'execute' | 'loop' | 'talk' | null) {
    const [card] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, cardId))
    
    if (!card) {
      throw new Error(`Card ${cardId} not found`)
    }
    
    if (card.mode !== expectedMode) {
      throw new Error(`Expected card to be in ${expectedMode} mode, but found in ${card.mode}`)
    }
    
    return card
  }
  
  static async validateCardTransition(cardId: string, expectedColumn: string, expectedMode: string | null) {
    const card = await this.validateCardInColumn(cardId, expectedColumn as any)
    await this.validateCardInMode(cardId, expectedMode as any)
    return card
  }
}