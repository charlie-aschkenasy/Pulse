'use client'

import { useState, useEffect, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { updateSubtask } from '@/app/actions/subtasks'
import { cn } from '@/lib/utils'
import type { Subtask } from '@/types/database'

interface SubtaskRowProps {
  subtask: Subtask
  onUpdate?: (subtask: Subtask) => void
}

export function SubtaskRow({ subtask, onUpdate }: SubtaskRowProps) {
  const [isCompleted, setIsCompleted] = useState(subtask.is_completed)
  const [isUpdating, setIsUpdating] = useState(false)
  // Track if we have a pending local update to avoid overwriting with stale props
  const pendingUpdateRef = useRef(false)

  // Sync local state with props, but only if we don't have a pending update
  useEffect(() => {
    if (!pendingUpdateRef.current) {
      setIsCompleted(subtask.is_completed)
    }
  }, [subtask.is_completed])

  const handleToggle = async () => {
    const newCompleted = !isCompleted

    // Mark that we have a pending update
    pendingUpdateRef.current = true

    // Optimistic update
    setIsCompleted(newCompleted)
    setIsUpdating(true)

    const { data, error } = await updateSubtask(subtask.id, {
      is_completed: newCompleted,
    })

    if (error) {
      // Revert on error
      setIsCompleted(!newCompleted)
    } else if (data && onUpdate) {
      onUpdate(data)
    }

    // Clear pending flag after a short delay to allow parent state to update
    setTimeout(() => {
      pendingUpdateRef.current = false
    }, 100)

    setIsUpdating(false)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors',
        'hover:bg-muted/50',
        isUpdating && 'opacity-50'
      )}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
        className="h-3.5 w-3.5"
      />
      <span
        className={cn(
          'text-sm transition-all',
          isCompleted && 'line-through text-muted-foreground'
        )}
      >
        {subtask.title}
      </span>
    </div>
  )
}
