import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { TestFixtures, TestValidation } from './test-utils'
import { db } from '../db/index'
import { tasks } from '../db/schema/index'
import { eq } from 'drizzle-orm'

describe('Tasks Router - New Terminology', () => {
  let testEnv: Awaited<ReturnType<typeof TestFixtures.createCompleteTestEnvironment>>

  beforeEach(async () => {
    await TestFixtures.cleanup()
    testEnv = await TestFixtures.createCompleteTestEnvironment()
  })

  afterEach(async () => {
    await TestFixtures.cleanup()
  })

  describe('Card Creation', () => {
    test('should create card with correct default column', async () => {
      const card = await TestFixtures.createCard({
        projectId: testEnv.project.id,
        mainRepositoryId: testEnv.repository.id,
        rawTitle: 'New Card'
      })

      expect(card.list).toBe('todo')
      expect(card.mode).toBeNull()
      expect(card.agentSessionStatus).toBe('INACTIVE')
    })

    test('should create card in loop column', async () => {
      const card = await TestFixtures.createCard({
        projectId: testEnv.project.id,
        mainRepositoryId: testEnv.repository.id,
        rawTitle: 'Loop Card',
        list: 'loop',
        mode: 'loop'
      })

      expect(card.list).toBe('loop')
      expect(card.mode).toBe('loop')
    })
  })

  describe('Card State Transitions', () => {
    test('should validate todo → doing → done transitions', async () => {
      // Start in todo
      let card = await TestValidation.validateCardInColumn(testEnv.cards.todo.id, 'todo')
      expect(card.mode).toBeNull()

      // Move to doing with clarify mode
      await db.update(tasks)
        .set({ 
          list: 'doing', 
          mode: 'clarify',
          agentSessionStatus: 'ACTIVE'
        })
        .where(eq(tasks.id, testEnv.cards.todo.id))

      card = await TestValidation.validateCardTransition(testEnv.cards.todo.id, 'doing', 'clarify')
      expect(card.agentSessionStatus).toBe('ACTIVE')

      // Progress through plan mode
      await db.update(tasks)
        .set({ 
          mode: 'plan',
          refinedTitle: 'Refined Title',
          refinedDescription: 'Refined Description'
        })
        .where(eq(tasks.id, testEnv.cards.todo.id))

      card = await TestValidation.validateCardTransition(testEnv.cards.todo.id, 'doing', 'plan')
      expect(card.refinedTitle).toBe('Refined Title')

      // Progress to execute mode
      await db.update(tasks)
        .set({ 
          mode: 'execute',
          plan: { solution: 'Final solution', spec: 'Implementation spec' }
        })
        .where(eq(tasks.id, testEnv.cards.todo.id))

      card = await TestValidation.validateCardTransition(testEnv.cards.todo.id, 'doing', 'execute')
      expect(card.plan).toEqual({ solution: 'Final solution', spec: 'Implementation spec' })

      // Complete to done
      await db.update(tasks)
        .set({ 
          list: 'done',
          mode: null,
          agentSessionStatus: 'INACTIVE'
        })
        .where(eq(tasks.id, testEnv.cards.todo.id))

      card = await TestValidation.validateCardTransition(testEnv.cards.todo.id, 'done', null)
      expect(card.agentSessionStatus).toBe('INACTIVE')
    })

    test('should validate loop card cycling', async () => {
      // Start in loop
      let card = await TestValidation.validateCardTransition(testEnv.cards.loop.id, 'loop', 'loop')

      // Move to doing (agent picks up)
      await db.update(tasks)
        .set({ 
          list: 'doing',
          agentSessionStatus: 'ACTIVE'
        })
        .where(eq(tasks.id, testEnv.cards.loop.id))

      card = await TestValidation.validateCardTransition(testEnv.cards.loop.id, 'doing', 'loop')
      expect(card.agentSessionStatus).toBe('ACTIVE')

      // Return to loop (infinite cycle)
      await db.update(tasks)
        .set({ 
          list: 'loop',
          agentSessionStatus: 'INACTIVE'
        })
        .where(eq(tasks.id, testEnv.cards.loop.id))

      card = await TestValidation.validateCardTransition(testEnv.cards.loop.id, 'loop', 'loop')
      expect(card.agentSessionStatus).toBe('INACTIVE')
    })
  })

  describe('Card Workflow Modes', () => {
    test('should support clarify mode functionality', async () => {
      const card = await TestValidation.validateCardTransition(
        testEnv.cards.doingClarify.id, 
        'doing', 
        'clarify'
      )
      
      expect(card.rawTitle).toBeDefined()
      expect(card.refinedTitle).toBeNull() // Not refined yet
    })

    test('should support plan mode functionality', async () => {
      const card = await TestValidation.validateCardTransition(
        testEnv.cards.doingPlan.id, 
        'doing', 
        'plan'
      )
      
      expect(card.refinedTitle).toBeDefined()
      expect(card.plan).toEqual({}) // Plan not created yet
    })

    test('should support execute mode functionality', async () => {
      const card = await TestValidation.validateCardTransition(
        testEnv.cards.doingExecute.id, 
        'doing', 
        'execute'
      )
      
      expect(card.refinedTitle).toBeDefined()
      expect(card.plan).toEqual({ solution: 'Test solution', spec: 'Test spec' })
    })
  })

  describe('Column Validation', () => {
    test('should validate all column values', async () => {
      const validColumns: Array<'todo' | 'doing' | 'done' | 'loop'> = ['todo', 'doing', 'done', 'loop']
      
      for (const column of validColumns) {
        const card = await TestFixtures.createCard({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          rawTitle: `${column} Card`,
          list: column
        })
        
        expect(card.list).toBe(column)
      }
    })

    test('should validate all mode values', async () => {
      const validModes: Array<'clarify' | 'plan' | 'execute' | 'loop' | 'talk'> = ['clarify', 'plan', 'execute', 'loop', 'talk']
      
      for (const mode of validModes) {
        const card = await TestFixtures.createCard({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          rawTitle: `${mode} Mode Card`,
          list: 'doing',
          mode: mode
        })
        
        expect(card.mode).toBe(mode)
      }
    })
  })

  describe('Agent Session Status', () => {
    test('should track agent session status correctly', async () => {
      const validStatuses = ['INACTIVE', 'PUSHING', 'ACTIVE']
      
      for (const status of validStatuses) {
        await db.update(tasks)
          .set({ agentSessionStatus: status })
          .where(eq(tasks.id, testEnv.cards.todo.id))
        
        const [card] = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, testEnv.cards.todo.id))
        
        expect(card.agentSessionStatus).toBe(status)
      }
    })
  })

  describe('Priority and Ready State', () => {
    test('should handle priority values correctly', async () => {
      const priorities = [1, 2, 3, 4, 5]
      
      for (const priority of priorities) {
        const card = await TestFixtures.createCard({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          rawTitle: `Priority ${priority} Card`,
          priority
        })
        
        expect(card.priority).toBe(priority)
      }
    })

    test('should handle ready state correctly', async () => {
      const readyCard = await TestFixtures.createCard({
        projectId: testEnv.project.id,
        mainRepositoryId: testEnv.repository.id,
        rawTitle: 'Ready Card',
        ready: true
      })
      
      const notReadyCard = await TestFixtures.createCard({
        projectId: testEnv.project.id,
        mainRepositoryId: testEnv.repository.id,
        rawTitle: 'Not Ready Card',
        ready: false
      })
      
      expect(readyCard.ready).toBe(true)
      expect(notReadyCard.ready).toBe(false)
    })
  })
})