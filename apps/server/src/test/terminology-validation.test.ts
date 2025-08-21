import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { TestFixtures } from './test-utils'
import { db } from '../db/index'
import { tasks } from '../db/schema/index'
import { eq } from 'drizzle-orm'

/**
 * Test suite to validate the terminology refactor is complete
 * This ensures all terminology changes from task→card, status→column, stage→mode work correctly
 */
describe('Terminology Validation', () => {
  let testEnv: Awaited<ReturnType<typeof TestFixtures.createCompleteTestEnvironment>>

  beforeEach(async () => {
    await TestFixtures.cleanup()
    testEnv = await TestFixtures.createCompleteTestEnvironment()
  })

  afterEach(async () => {
    await TestFixtures.cleanup()
  })

  describe('Database Schema Uses New Terminology', () => {
    test('should use "list" column instead of "status"', async () => {
      const [card] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, testEnv.cards.todo.id))

      // Verify the field exists and uses correct values
      expect(card.list).toBeDefined()
      expect(['todo', 'doing', 'done', 'loop']).toContain(card.list)
    })

    test('should use "mode" column instead of "stage"', async () => {
      const [card] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, testEnv.cards.doingClarify.id))

      // Verify the field exists and uses correct values
      expect(card.mode).toBeDefined()
      expect(['clarify', 'plan', 'execute', 'loop', 'talk']).toContain(card.mode)
    })

    test('should use "tasks" table (cards)', async () => {
      // Verify we can query the tasks table successfully
      const allCards = await db.select().from(tasks)
      expect(allCards.length).toBeGreaterThan(0)
    })
  })

  describe('Column Values Validation', () => {
    test('should support all valid column values', async () => {
      const validColumns: Array<'todo' | 'doing' | 'done' | 'loop'> = ['todo', 'doing', 'done', 'loop']
      
      for (const column of validColumns) {
        const card = await TestFixtures.createCard({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          rawTitle: `Test ${column} card`,
          list: column
        })
        
        expect(card.list).toBe(column)
      }
    })

    test('should support all valid mode values', async () => {
      const validModes: Array<'clarify' | 'plan' | 'execute' | 'loop' | 'talk'> = ['clarify', 'plan', 'execute', 'loop', 'talk']
      
      for (const mode of validModes) {
        const card = await TestFixtures.createCard({
          projectId: testEnv.project.id,
          mainRepositoryId: testEnv.repository.id,
          rawTitle: `Test ${mode} mode card`,
          list: 'doing',
          mode: mode
        })
        
        expect(card.mode).toBe(mode)
      }
    })
  })

  describe('Workflow Validation', () => {
    test('should support card workflow: todo → doing → done', async () => {
      let card = testEnv.cards.todo
      expect(card.list).toBe('todo')

      // Move to doing
      await db.update(tasks)
        .set({ list: 'doing', mode: 'clarify' })
        .where(eq(tasks.id, card.id))

      const [updatedCard1] = await db.select().from(tasks).where(eq(tasks.id, card.id))
      card = updatedCard1
      expect(card.list).toBe('doing')
      expect(card.mode).toBe('clarify')

      // Move to done
      await db.update(tasks)
        .set({ list: 'done', mode: null })
        .where(eq(tasks.id, card.id))

      const [updatedCard2] = await db.select().from(tasks).where(eq(tasks.id, card.id))
      card = updatedCard2
      expect(card.list).toBe('done')
      expect(card.mode).toBeNull()
    })

    test('should support mode workflow: clarify → plan → execute', async () => {
      const card = testEnv.cards.doingClarify
      expect(card.mode).toBe('clarify')

      // Progress to plan mode
      await db.update(tasks)
        .set({ mode: 'plan' })
        .where(eq(tasks.id, card.id))

      const [planCard] = await db.select().from(tasks).where(eq(tasks.id, card.id))
      expect(planCard.mode).toBe('plan')

      // Progress to execute mode
      await db.update(tasks)
        .set({ mode: 'execute' })
        .where(eq(tasks.id, card.id))

      const [executeCard] = await db.select().from(tasks).where(eq(tasks.id, card.id))
      expect(executeCard.mode).toBe('execute')
    })

    test('should support loop card cycling: loop → doing → loop', async () => {
      let card = testEnv.cards.loop
      expect(card.list).toBe('loop')
      expect(card.mode).toBe('loop')

      // Move to doing
      await db.update(tasks)
        .set({ list: 'doing' })
        .where(eq(tasks.id, card.id))

      const [doingCard] = await db.select().from(tasks).where(eq(tasks.id, card.id))
      card = doingCard
      expect(card.list).toBe('doing')
      expect(card.mode).toBe('loop') // Mode stays loop

      // Return to loop
      await db.update(tasks)
        .set({ list: 'loop' })
        .where(eq(tasks.id, card.id))

      const [loopCard] = await db.select().from(tasks).where(eq(tasks.id, card.id))
      card = loopCard
      expect(card.list).toBe('loop')
      expect(card.mode).toBe('loop') // Mode stays loop
    })
  })

  describe('Agent Session Integration', () => {
    test('should work with agentSessionStatus', async () => {
      const card = testEnv.cards.todo
      
      // Set to active
      await db.update(tasks)
        .set({ 
          agentSessionStatus: 'ACTIVE',
          list: 'doing',
          mode: 'clarify'
        })
        .where(eq(tasks.id, card.id))

      const [activeCard] = await db.select().from(tasks).where(eq(tasks.id, card.id))
      expect(activeCard.agentSessionStatus).toBe('ACTIVE')
      expect(activeCard.list).toBe('doing')
      expect(activeCard.mode).toBe('clarify')
    })
  })

  describe('Terminology Consistency', () => {
    test('should not use old terminology in schema', async () => {
      // Verify that old field names don't exist by checking the schema
      const [sampleCard] = await db.select().from(tasks).limit(1)
      
      // These old field names should not exist
      expect(sampleCard).not.toHaveProperty('status')
      expect(sampleCard).not.toHaveProperty('stage')
      expect(sampleCard).not.toHaveProperty('column_order')
      
      // These new field names should exist
      expect(sampleCard).toHaveProperty('list')
      expect(sampleCard).toHaveProperty('mode')
    })

    test('should validate complete test environment uses new terminology', async () => {
      // Verify all cards in test environment use new terminology
      const allCards = Object.values(testEnv.cards)
      
      for (const card of allCards) {
        expect(['todo', 'doing', 'done', 'loop']).toContain(card.list)
        if (card.mode) {
          expect(['clarify', 'plan', 'execute', 'loop', 'talk']).toContain(card.mode)
        }
      }
    })
  })
})