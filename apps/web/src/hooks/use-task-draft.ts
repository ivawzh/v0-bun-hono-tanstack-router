import { useState, useEffect, useCallback, useRef } from 'react'

interface TaskDraft {
  rawTitle: string
  rawDescription: string
  priority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
  repoAgentId: string
  actorId: string
}

const STORAGE_KEY = 'solo-unicorn-task-draft'
const DEBOUNCE_DELAY = 500

export function useTaskDraft() {
  const [draft, setDraft] = useState<TaskDraft>({
    rawTitle: '',
    rawDescription: '',
    priority: 'P3',
    repoAgentId: '',
    actorId: '__default__'
  })
  const [hasDraft, setHasDraft] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedDraft = JSON.parse(stored)
        setDraft(parsedDraft)
        setHasDraft(true)
      }
    } catch (error) {
      // Silent fallback - localStorage might be disabled or full
      console.warn('Failed to load task draft from localStorage:', error)
    }
  }, [])

  // Debounced save to localStorage
  const saveDraft = useCallback((newDraft: TaskDraft) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      try {
        // Only save if there's actual content
        if (newDraft.rawTitle.trim() || newDraft.rawDescription.trim()) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newDraft))
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
      priority: 'P3',
      repoAgentId: '',
      actorId: '__default__'
    })
    setHasDraft(false)
  }, [])

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