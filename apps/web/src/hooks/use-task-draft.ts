import { useState, useEffect, useCallback, useRef } from 'react'
import type { Priority } from '@/utils/priority'

export interface AttachmentFile {
  id: string
  file: File
  preview?: string
}

interface TaskDraft {
  rawTitle: string
  rawDescription: string
  priority: Priority
  mainRepositoryId: string
  additionalRepositoryIds: string[]
  assignedAgentIds: string[]
  actorId: string
  attachments: AttachmentFile[]
  mode: string | null
}

const STORAGE_KEY = 'solo-unicorn-task-draft'
const DEBOUNCE_DELAY = 500

// Helper function to get default mode based on column
function getDefaultMode(column?: string): string | null {
  if (column === 'loop') {
    return 'loop'
  }
  return 'clarify' // Default for all other columns (todo, doing, done)
}

export function useTaskDraft(defaultColumn?: string) {
  const [draft, setDraft] = useState<TaskDraft>({
    rawTitle: '',
    rawDescription: '',
    priority: 3,
    mainRepositoryId: '',
    additionalRepositoryIds: [],
    assignedAgentIds: [],
    actorId: '__default__',
    attachments: [],
    mode: getDefaultMode(defaultColumn)
  })
  const [hasDraft, setHasDraft] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedDraft = JSON.parse(stored)
        // Ensure mode is set if missing from stored draft
        if (!parsedDraft.mode) {
          parsedDraft.mode = getDefaultMode(defaultColumn)
        }
        setDraft(parsedDraft)
        setHasDraft(true)
      }
    } catch (error) {
      // Silent fallback - localStorage might be disabled or full
      console.warn('Failed to load task draft from localStorage:', error)
    }
  }, [defaultColumn])

  // Debounced save to localStorage
  const saveDraft = useCallback((newDraft: TaskDraft) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      try {
        // Only save if there's actual content
        if (newDraft.rawTitle.trim() || newDraft.rawDescription.trim() || newDraft.attachments.length > 0) {
          // Don't save File objects to localStorage - they can't be serialized
          const draftToSave = {
            ...newDraft,
            attachments: [] // Reset attachments in localStorage
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(draftToSave))
          setHasDraft(true)
        } else {
          // Clear storage if no content
          localStorage.removeItem(STORAGE_KEY)
          setHasDraft(false)
        }
      } catch (error) {
        // Silent fallback for localStorage errors
        console.warn('Failed to save task draft to localStorage:', error)
      }
    }, DEBOUNCE_DELAY)
  }, [])

  // Update draft and trigger auto-save
  const updateDraft = useCallback((updates: Partial<TaskDraft>) => {
    setDraft(currentDraft => {
      const newDraft = { ...currentDraft, ...updates }
      saveDraft(newDraft)
      return newDraft
    })
  }, [saveDraft])

  // Update mode when defaultColumn changes
  useEffect(() => {
    setDraft(currentDraft => {
      const newMode = getDefaultMode(defaultColumn)
      if (currentDraft.mode !== newMode) {
        const newDraft = { ...currentDraft, mode: newMode }
        saveDraft(newDraft)
        return newDraft
      }
      return currentDraft
    })
  }, [defaultColumn, saveDraft])

  // Clear draft from both state and localStorage
  const clearDraft = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear task draft from localStorage:', error)
    }

    setDraft({
      rawTitle: '',
      rawDescription: '',
      priority: 3,
      mainRepositoryId: '',
      additionalRepositoryIds: [],
      assignedAgentIds: [],
      actorId: '__default__',
      attachments: [],
      mode: getDefaultMode(defaultColumn)
    })
    setHasDraft(false)
  }, [defaultColumn])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  return {
    draft,
    updateDraft,
    clearDraft,
    hasDraft
  }
}
