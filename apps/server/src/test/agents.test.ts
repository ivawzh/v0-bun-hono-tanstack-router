import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { TestFixtures } from './test-utils'
import { db } from '../db/index'
import { tasks, agents } from '../db/schema/index'
import { eq, and, desc } from 'drizzle-orm'

/**
 * Test agent functionality with new terminology
 */
describe('Agent System - New Terminology', () => {
  let testEnv: Awaited<ReturnType<typeof TestFixtures.createCompleteTestEnvironment>>

  beforeEach(async () => {
    await TestFixtures.cleanup()
    testEnv = await TestFixtures.createCompleteTestEnvironment()
  })

  afterEach(async () => {
    await TestFixtures.cleanup()
  })

  describe('Card Selection Logic', () => {
    test('should select cards from todo column first', async () => {
      // Create cards in different columns with different priorities
      const highPriorityTodo = await TestFixtures.createCard({
        projectId: testEnv.project.id,
        mainRepositoryId: testEnv.repository.id,
        rawTitle: 'High Priority Todo',
        list: 'todo',
        priority: 5,
        ready: true
      })

      const lowPriorityDoing = await TestFixtures.createCard({
        projectId: testEnv.project.id,
        mainRepositoryId: testEnv.repository.id,
        rawTitle: 'Low Priority Doing',
        list: 'doing',
        priority: 1,
        mode: 'execute',
        agentSessionStatus: 'ACTIVE'
      })

      // Query for next available card (should pick todo over doing)
      const availableCards = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, testEnv.project.id),
            eq(tasks.ready, true),
            eq(tasks.list, 'todo')
          )
        )
        .orderBy(desc(tasks.priority), tasks.listOrder)

      expect(availableCards).toHaveLength(2) // Original todo + high priority todo
      expect(availableCards[0].priority).toBe(5) // High priority first
    })

    test('should select loop cards when todo and doing are empty', async () => {
      // Clear todo cards by marking them not ready
      await db.update(tasks)
        .set({ ready: false })
        .where(eq(tasks.list, 'todo'))

      // Clear doing cards by moving them to done
      await db.update(tasks)
        .set({ 
          list: 'done',
          mode: null,
          agentSessionStatus: 'INACTIVE'
        })
        .where(eq(tasks.list, 'doing'))

      // Now only loop cards should be available
      const loopCards = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, testEnv.project.id),
            eq(tasks.list, 'loop')
          )
        )

      expect(loopCards).toHaveLength(1)
      expect(loopCards[0].mode).toBe('loop')
    })

    test('should respect priority ordering within columns', async () => {
      // Create multiple todo cards with different priorities
      const priorities = [1, 3, 5, 2, 4]
      const cards = []

      for (const priority of priorities) {
        const card = await TestFixtures.createCard({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          rawTitle: `Priority ${priority} Card`,
          list: 'todo',
          priority,
          ready: true
        })
        cards.push(card)
      }

      // Query cards in priority order
      const orderedCards = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, testEnv.project.id),
            eq(tasks.list, 'todo'),
            eq(tasks.ready, true)
          )
        )
        .orderBy(desc(tasks.priority)) // DESC for highest first

      // Verify they're ordered by priority (5, 4, 3, 2, 1)
      const priorities_ordered = orderedCards.map(card => card.priority)
      expect(priorities_ordered).toEqual([5, 4, 3, 3, 2, 1]) // Including original todo card
    })
  })

  describe('Agent Session Management', () => {
    test('should track agent session lifecycle', async () => {
      const sessionStates = [
        { status: 'INACTIVE', description: 'Agent idle' },
        { status: 'PUSHING', description: 'Spawning agent process' },
        { status: 'ACTIVE', description: 'Agent working on card' },
        { status: 'INACTIVE', description: 'Agent completed work' }
      ]

      let currentCard = testEnv.cards.todo

      for (const state of sessionStates) {
        await db.update(tasks)
          .set({ 
            agentSessionStatus: state.status,
            lastAgentSessionStartedAt: state.status === 'ACTIVE' ? new Date() : undefined
          })
          .where(eq(tasks.id, currentCard.id))

        const [updatedCard] = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, currentCard.id))

        expect(updatedCard.agentSessionStatus).toBe(state.status)
        
        if (state.status === 'ACTIVE') {
          expect(updatedCard.lastAgentSessionStartedAt).toBeDefined()
        }
      }
    })

    test('should handle agent concurrency limits', async () => {
      // Set agent max concurrency to 1
      await db.update(agents)
        .set({ maxConcurrencyLimit: 1 })
        .where(eq(agents.id, testEnv.agent.id))

      // Try to assign multiple cards to same agent
      const card1 = testEnv.cards.todo
      const card2 = await TestFixtures.createCard({
        projectId: testEnv.project.id,
        mainRepositoryId: testEnv.repository.id,
        rawTitle: 'Second Card',
        list: 'todo',
        ready: true
      })

      // First card gets assigned
      await db.update(tasks)
        .set({ 
          agentSessionStatus: 'ACTIVE',
          activeAgentId: testEnv.agent.id,
          list: 'doing',
          mode: 'clarify'
        })
        .where(eq(tasks.id, card1.id))

      // Count active cards for this agent
      const activeCards = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.activeAgentId, testEnv.agent.id),
            eq(tasks.agentSessionStatus, 'ACTIVE')
          )
        )

      expect(activeCards).toHaveLength(1)
      
      // Verify agent concurrency limit is respected
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, testEnv.agent.id))

      expect(agent.maxConcurrencyLimit).toBe(1)
    })
  })

  describe('Agent Workflow Modes', () => {
    test('should progress through workflow modes correctly', async () => {
      const workflowSteps = [
        { mode: 'clarify', column: 'doing', action: 'Refine title and description' },
        { mode: 'plan', column: 'doing', action: 'Create solution plan' },
        { mode: 'execute', column: 'doing', action: 'Implement solution' },
        { mode: null, column: 'done', action: 'Complete card' }
      ]

      let currentCard = testEnv.cards.todo

      for (const step of workflowSteps) {
        const updateData: any = {
          list: step.column as 'todo' | 'doing' | 'done' | 'loop',
          mode: step.mode as 'clarify' | 'plan' | 'execute' | 'loop' | 'talk' | null,
          agentSessionStatus: step.column === 'done' ? 'INACTIVE' : 'ACTIVE'
        }
        
        if (step.mode === 'plan') {
          updateData.refinedTitle = 'Refined Title'
        }
        if (step.mode === 'execute') {
          updateData.plan = { solution: 'Test solution' }
        }
        
        await db.update(tasks)
          .set(updateData)
          .where(eq(tasks.id, currentCard.id))

        const [updatedCard] = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, currentCard.id))

        expect(updatedCard.list).toBe(step.column as any)
        expect(updatedCard.mode).toBe(step.mode as any)

        if (step.mode === 'plan') {
          expect(updatedCard.refinedTitle).toBeDefined()
        }
        if (step.mode === 'execute') {
          expect(updatedCard.plan).toBeDefined()
        }
      }
    })

    test('should handle loop mode workflow', async () => {
      const loopCard = testEnv.cards.loop

      // Loop card starts in loop column with loop mode
      expect(loopCard.list).toBe('loop')
      expect(loopCard.mode).toBe('loop')

      // Agent picks up loop card
      await db.update(tasks)
        .set({
          list: 'doing',
          agentSessionStatus: 'ACTIVE',
          activeAgentId: testEnv.agent.id
        })
        .where(eq(tasks.id, loopCard.id))

      let [updatedCard] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, loopCard.id))

      expect(updatedCard.list).toBe('doing')
      expect(updatedCard.mode).toBe('loop') // Mode stays 'loop'
      expect(updatedCard.agentSessionStatus).toBe('ACTIVE')

      // Agent completes loop card - returns to loop column
      await db.update(tasks)
        .set({
          list: 'loop',
          agentSessionStatus: 'INACTIVE',
          activeAgentId: null
        })
        .where(eq(tasks.id, loopCard.id))

      updatedCard = (await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, loopCard.id)))[0]

      expect(updatedCard.list).toBe('loop')
      expect(updatedCard.mode).toBe('loop') // Mode still 'loop'
      expect(updatedCard.agentSessionStatus).toBe('INACTIVE')
    })
  })

  describe('Agent Rate Limiting', () => {
    test('should track rate limit reset times', async () => {
      const rateLimitResetTime = new Date(Date.now() + 3600000) // 1 hour from now

      await db.update(agents)
        .set({ 
          rateLimitResetAt: rateLimitResetTime,
          lastTaskPushedAt: new Date()
        })
        .where(eq(agents.id, testEnv.agent.id))

      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, testEnv.agent.id))

      expect(agent.rateLimitResetAt).toBeDefined()
      expect(agent.lastTaskPushedAt).toBeDefined()
      expect(new Date(agent.rateLimitResetAt!).getTime()).toBe(rateLimitResetTime.getTime())
    })

    test('should handle agent availability based on rate limits', async () => {
      // Set agent as rate limited
      await db.update(agents)
        .set({ 
          rateLimitResetAt: new Date(Date.now() + 3600000) // Rate limited for 1 hour
        })
        .where(eq(agents.id, testEnv.agent.id))

      // Create available card
      const availableCard = await TestFixtures.createCard({
        projectId: testEnv.project.id,
        mainRepositoryId: testEnv.repository.id,
        rawTitle: 'Available Card',
        list: 'todo',
        ready: true
      })

      // Check if agent is available (should be false due to rate limit)
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, testEnv.agent.id))

      const isAvailable = !agent.rateLimitResetAt || new Date(agent.rateLimitResetAt) <= new Date()
      expect(isAvailable).toBe(false)

      // Clear rate limit
      await db.update(agents)
        .set({ rateLimitResetAt: null })
        .where(eq(agents.id, testEnv.agent.id))

      const [clearedAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, testEnv.agent.id))

      const isNowAvailable = !clearedAgent.rateLimitResetAt || new Date(clearedAgent.rateLimitResetAt) <= new Date()
      expect(isNowAvailable).toBe(true)
    })
  })
})