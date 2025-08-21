import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { TestFixtures, TestValidation } from './test-utils'
import { db } from '../db/index'
import { tasks, projects } from '../db/schema/index'
import { eq } from 'drizzle-orm'

/**
 * Test MCP tool functionality with new terminology
 */
describe('MCP Tools - New Terminology', () => {
  let testEnv: Awaited<ReturnType<typeof TestFixtures.createCompleteTestEnvironment>>

  beforeEach(async () => {
    await TestFixtures.cleanup()
    testEnv = await TestFixtures.createCompleteTestEnvironment()
  })

  afterEach(async () => {
    await TestFixtures.cleanup()
  })

  describe('task_update MCP Tool', () => {
    test('should update card column (list) via MCP', async () => {
      // Simulate MCP task_update call to move card to doing column
      const updateData = {
        taskId: testEnv.cards.todo.id,
        list: 'doing' as const,
        mode: 'clarify' as const,
        agentSessionStatus: 'ACTIVE' as const
      }

      // Apply the update
      await db.update(tasks)
        .set({
          list: updateData.list,
          mode: updateData.mode,
          agentSessionStatus: updateData.agentSessionStatus,
          lastAgentSessionStartedAt: new Date()
        })
        .where(eq(tasks.id, updateData.taskId))

      // Validate the update worked
      const card = await TestValidation.validateCardTransition(
        testEnv.cards.todo.id,
        'doing',
        'clarify'
      )
      
      expect(card.agentSessionStatus).toBe('ACTIVE')
      expect(card.lastAgentSessionStartedAt).toBeDefined()
    })

    test('should update card mode via MCP', async () => {
      // Move card through modes: clarify → plan → execute
      const transitions = [
        { mode: 'clarify' as const, refinedTitle: undefined },
        { mode: 'plan' as const, refinedTitle: 'Refined Title' },
        { mode: 'execute' as const, plan: { solution: 'Final solution' } }
      ]

      for (const transition of transitions) {
        await db.update(tasks)
          .set({
            mode: transition.mode,
            refinedTitle: transition.refinedTitle,
            plan: transition.plan
          })
          .where(eq(tasks.id, testEnv.cards.doingClarify.id))

        const card = await TestValidation.validateCardInMode(
          testEnv.cards.doingClarify.id,
          transition.mode
        )

        if (transition.refinedTitle) {
          expect(card.refinedTitle).toBe(transition.refinedTitle)
        }
        if (transition.plan) {
          expect(card.plan).toEqual(transition.plan)
        }
      }
    })

    test('should complete card and move to done column', async () => {
      // Simulate completion via MCP
      const completionData = {
        taskId: testEnv.cards.doingExecute.id,
        list: 'done' as const,
        mode: null,
        agentSessionStatus: 'INACTIVE' as const
      }

      await db.update(tasks)
        .set({
          list: completionData.list,
          mode: completionData.mode,
          agentSessionStatus: completionData.agentSessionStatus
        })
        .where(eq(tasks.id, completionData.taskId))

      const card = await TestValidation.validateCardTransition(
        testEnv.cards.doingExecute.id,
        'done',
        null
      )
      
      expect(card.agentSessionStatus).toBe('INACTIVE')
    })

    test('should handle loop card return to loop column', async () => {
      // Move loop card to doing first
      await db.update(tasks)
        .set({
          list: 'doing',
          agentSessionStatus: 'ACTIVE'
        })
        .where(eq(tasks.id, testEnv.cards.loop.id))

      // Then return to loop via MCP
      await db.update(tasks)
        .set({
          list: 'loop',
          agentSessionStatus: 'INACTIVE'
        })
        .where(eq(tasks.id, testEnv.cards.loop.id))

      const card = await TestValidation.validateCardTransition(
        testEnv.cards.loop.id,
        'loop',
        'loop'
      )
      
      expect(card.agentSessionStatus).toBe('INACTIVE')
    })
  })

  describe('task_create MCP Tool', () => {
    test('should create new card via MCP with correct terminology', async () => {
      const newCardData = {
        createdByTaskId: testEnv.cards.doingExecute.id,
        rawTitle: 'MCP Created Card',
        rawDescription: 'Card created by agent via MCP',
        refinedTitle: 'Refined MCP Card',
        refinedDescription: 'Agent refined this card',
        mode: 'plan' as const,
        priority: 4
      }

      // Create card via MCP simulation
      const [newCard] = await db.insert(tasks)
        .values({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          createdByTaskId: newCardData.createdByTaskId,
          rawTitle: newCardData.rawTitle,
          rawDescription: newCardData.rawDescription,
          refinedTitle: newCardData.refinedTitle,
          refinedDescription: newCardData.refinedDescription,
          list: 'todo', // Default column for new cards
          mode: newCardData.mode,
          priority: newCardData.priority,
          author: 'ai' // Mark as AI-created
        })
        .returning()

      expect(newCard.rawTitle).toBe(newCardData.rawTitle)
      expect(newCard.refinedTitle).toBe(newCardData.refinedTitle)
      expect(newCard.list).toBe('todo')
      expect(newCard.mode).toBe('plan')
      expect(newCard.author).toBe('ai')
      expect(newCard.createdByTaskId).toBe(newCardData.createdByTaskId)
    })

    test('should create loop card via MCP', async () => {
      const loopCardData = {
        createdByTaskId: testEnv.cards.doingExecute.id,
        rawTitle: 'New Loop Card',
        rawDescription: 'Repeatable maintenance card',
        list: 'loop' as const,
        mode: 'loop' as const
      }

      const [loopCard] = await db.insert(tasks)
        .values({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          createdByTaskId: loopCardData.createdByTaskId,
          rawTitle: loopCardData.rawTitle,
          rawDescription: loopCardData.rawDescription,
          list: loopCardData.list,
          mode: loopCardData.mode,
          author: 'ai'
        })
        .returning()

      expect(loopCard.list).toBe('loop')
      expect(loopCard.mode).toBe('loop')
      expect(loopCard.author).toBe('ai')
    })
  })

  describe('project_memory MCP Tools', () => {
    test('should update project memory via MCP', async () => {
      const memoryUpdate = {
        projectId: testEnv.project.id,
        memory: JSON.stringify({
          context: 'Updated project context',
          learnings: 'Key learnings from recent work',
          terminology: 'Using card/column/mode terminology'
        })
      }

      // Update project memory
      await db.update(projects)
        .set({
          memory: JSON.parse(memoryUpdate.memory),
          updatedAt: new Date()
        })
        .where(eq(projects.id, memoryUpdate.projectId))

      // Verify memory was updated
      const [updatedProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, testEnv.project.id))

      expect(updatedProject.memory).toEqual({
        context: 'Updated project context',
        learnings: 'Key learnings from recent work',
        terminology: 'Using card/column/mode terminology'
      })
    })

    test('should get project memory via MCP', async () => {
      // Set initial memory
      const initialMemory = {
        context: 'Project uses new terminology',
        patterns: 'card → column → mode workflow'
      }

      await db.update(projects)
        .set({ memory: initialMemory })
        .where(eq(projects.id, testEnv.project.id))

      // Get project memory
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, testEnv.project.id))

      expect(project.memory).toEqual(initialMemory)
    })
  })

  describe('MCP Tool Integration', () => {
    test('should handle full workflow via MCP tools', async () => {
      // 1. Create new card
      const [newCard] = await db.insert(tasks)
        .values({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          rawTitle: 'Full Workflow Card',
          list: 'todo',
          ready: true
        })
        .returning()

      // 2. Move to doing with clarify mode
      await db.update(tasks)
        .set({
          list: 'doing',
          mode: 'clarify',
          agentSessionStatus: 'ACTIVE'
        })
        .where(eq(tasks.id, newCard.id))

      let card = await TestValidation.validateCardTransition(newCard.id, 'doing', 'clarify')

      // 3. Progress to plan mode
      await db.update(tasks)
        .set({
          mode: 'plan',
          refinedTitle: 'Refined Workflow Card',
          refinedDescription: 'Detailed description of the workflow'
        })
        .where(eq(tasks.id, newCard.id))

      card = await TestValidation.validateCardTransition(newCard.id, 'doing', 'plan')
      expect(card.refinedTitle).toBe('Refined Workflow Card')

      // 4. Progress to execute mode
      await db.update(tasks)
        .set({
          mode: 'execute',
          plan: {
            solution: 'Implement full MCP workflow',
            spec: 'Use all MCP tools in sequence',
            steps: ['clarify', 'plan', 'execute']
          }
        })
        .where(eq(tasks.id, newCard.id))

      card = await TestValidation.validateCardTransition(newCard.id, 'doing', 'execute')
      expect(card.plan).toHaveProperty('solution')

      // 5. Complete card
      await db.update(tasks)
        .set({
          list: 'done',
          mode: null,
          agentSessionStatus: 'INACTIVE'
        })
        .where(eq(tasks.id, newCard.id))

      card = await TestValidation.validateCardTransition(newCard.id, 'done', null)
      expect(card.agentSessionStatus).toBe('INACTIVE')
    })
  })
})