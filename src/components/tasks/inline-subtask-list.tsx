'use client'

import { useState, useEffect, useCallback } from 'react'
import { SubtaskRow } from './subtask-row'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Subtask } from '@/types/database'

const EXPANDED_TASKS_KEY = 'pulse-expanded-tasks'

interface InlineSubtaskListProps {
  taskId: string
  subtasks: Subtask[]
  onSubtaskUpdate?: (subtask: Subtask) => void
}

export function InlineSubtaskList({ taskId, subtasks: initialSubtasks, onSubtaskUpdate }: InlineSubtaskListProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  // Maintain local state of subtasks to preserve updates across collapse/expand
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(initialSubtasks)

  // Sync with props when they change (e.g., after server refresh)
  useEffect(() => {
    setLocalSubtasks(initialSubtasks)
  }, [initialSubtasks])

  // Handle subtask update - update local state immediately
  const handleSubtaskUpdate = useCallback((updatedSubtask: Subtask) => {
    setLocalSubtasks(prev =>
      prev.map(s => s.id === updatedSubtask.id ? updatedSubtask : s)
    )
    // Also notify parent if callback provided
    if (onSubtaskUpdate) {
      onSubtaskUpdate(updatedSubtask)
    }
  }, [onSubtaskUpdate])

  // Load expanded state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(EXPANDED_TASKS_KEY)
    if (stored) {
      try {
        const collapsedTasks = JSON.parse(stored) as string[]
        // Default to expanded unless explicitly collapsed
        setIsExpanded(!collapsedTasks.includes(taskId))
      } catch {
        // Ignore invalid JSON
      }
    }
  }, [taskId])

  // Save expanded state to localStorage
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)

    try {
      const stored = localStorage.getItem(EXPANDED_TASKS_KEY)
      let collapsedTasks: string[] = stored ? JSON.parse(stored) : []

      if (newExpanded) {
        // Remove from collapsed list
        collapsedTasks = collapsedTasks.filter(id => id !== taskId)
      } else {
        // Add to collapsed list
        if (!collapsedTasks.includes(taskId)) {
          collapsedTasks.push(taskId)
        }
      }

      localStorage.setItem(EXPANDED_TASKS_KEY, JSON.stringify(collapsedTasks))
    } catch {
      // Ignore localStorage errors
    }
  }

  if (localSubtasks.length === 0) {
    return null
  }

  const completedCount = localSubtasks.filter(s => s.is_completed).length
  const totalCount = localSubtasks.length

  return (
    <div className="ml-6 mt-1 mb-2">
      {/* Expand/collapse toggle */}
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 py-0.5"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span>
          {completedCount}/{totalCount} subtasks
        </span>
      </button>

      {/* Subtask rows with visual connector - kept mounted, hidden with CSS */}
      <div className={cn('relative pl-1', !isExpanded && 'hidden')}>
        {/* Vertical connector line */}
        <div className="absolute left-[3px] top-0 bottom-2 w-px bg-border" />

        {/* Subtask items */}
        <div className="space-y-0">
          {localSubtasks.map((subtask, index) => (
            <div key={subtask.id} className="relative flex items-start">
              {/* Horizontal connector */}
              <div className="absolute left-[3px] top-[11px] w-3 h-px bg-border" />

              {/* Hide vertical line below last item */}
              {index === localSubtasks.length - 1 && (
                <div className="absolute left-[3px] top-[11px] bottom-0 w-px bg-background" />
              )}

              {/* Subtask row */}
              <div className="ml-5 flex-1">
                <SubtaskRow subtask={subtask} onUpdate={handleSubtaskUpdate} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
