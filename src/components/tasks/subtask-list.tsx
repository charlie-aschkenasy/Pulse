'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GripVertical, Plus, Trash2, Loader2 } from 'lucide-react'
import {
  getSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  reorderSubtasks,
} from '@/app/actions/subtasks'
import { toast } from 'sonner'
import type { Subtask } from '@/types/database'

interface SubtaskListProps {
  taskId: string
  onCountChange?: (completed: number, total: number) => void
}

interface SortableSubtaskProps {
  subtask: Subtask
  onToggle: (id: string, completed: boolean) => void
  onUpdate: (id: string, title: string) => void
  onDelete: (id: string) => void
  isUpdating: boolean
}

function SortableSubtask({
  subtask,
  onToggle,
  onUpdate,
  onDelete,
  isUpdating,
}: SortableSubtaskProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(subtask.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleBlur = () => {
    setIsEditing(false)
    if (editTitle.trim() && editTitle !== subtask.title) {
      onUpdate(subtask.id, editTitle.trim())
    } else {
      setEditTitle(subtask.title)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setEditTitle(subtask.title)
      setIsEditing(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors',
        isDragging && 'opacity-50 bg-muted'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Checkbox
        checked={subtask.is_completed}
        onCheckedChange={(checked) => onToggle(subtask.id, !!checked)}
        disabled={isUpdating}
        className="shrink-0"
      />

      {isEditing ? (
        <Input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm flex-1"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={cn(
            'flex-1 text-sm cursor-text',
            subtask.is_completed && 'line-through text-muted-foreground'
          )}
        >
          {subtask.title}
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(subtask.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function SubtaskList({ taskId, onCountChange }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load subtasks
  useEffect(() => {
    async function loadSubtasks() {
      setIsLoading(true)
      const { data, error } = await getSubtasks(taskId)
      if (error) {
        toast.error('Failed to load subtasks')
      } else {
        setSubtasks(data || [])
      }
      setIsLoading(false)
    }
    loadSubtasks()
  }, [taskId])

  // Notify parent of count changes
  useEffect(() => {
    if (onCountChange) {
      const completed = subtasks.filter((s) => s.is_completed).length
      onCountChange(completed, subtasks.length)
    }
  }, [subtasks, onCountChange])

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return

    setIsAdding(true)
    const { data, error } = await createSubtask(taskId, newSubtaskTitle.trim())
    if (error) {
      toast.error('Failed to add subtask')
    } else if (data) {
      setSubtasks((prev) => [...prev, data])
      setNewSubtaskTitle('')
    }
    setIsAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddSubtask()
    }
  }

  const handleToggle = async (id: string, completed: boolean) => {
    // Optimistic update
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_completed: completed } : s))
    )

    setIsUpdating(true)
    const { error } = await updateSubtask(id, { is_completed: completed })
    if (error) {
      // Revert on error
      setSubtasks((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_completed: !completed } : s))
      )
      toast.error('Failed to update subtask')
    }
    setIsUpdating(false)
  }

  const handleUpdate = async (id: string, title: string) => {
    // Optimistic update
    const oldTitle = subtasks.find((s) => s.id === id)?.title || ''
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s))
    )

    setIsUpdating(true)
    const { error } = await updateSubtask(id, { title })
    if (error) {
      // Revert on error
      setSubtasks((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: oldTitle } : s))
      )
      toast.error('Failed to update subtask')
    }
    setIsUpdating(false)
  }

  const handleDelete = async (id: string) => {
    // Optimistic update
    const deletedSubtask = subtasks.find((s) => s.id === id)
    setSubtasks((prev) => prev.filter((s) => s.id !== id))

    const { error } = await deleteSubtask(id)
    if (error) {
      // Revert on error
      if (deletedSubtask) {
        setSubtasks((prev) => [...prev, deletedSubtask].sort((a, b) => a.sort_index - b.sort_index))
      }
      toast.error('Failed to delete subtask')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = subtasks.findIndex((s) => s.id === active.id)
      const newIndex = subtasks.findIndex((s) => s.id === over.id)

      const newOrder = arrayMove(subtasks, oldIndex, newIndex)
      setSubtasks(newOrder)

      const { error } = await reorderSubtasks(
        taskId,
        newOrder.map((s) => s.id)
      )
      if (error) {
        // Revert on error
        setSubtasks(subtasks)
        toast.error('Failed to reorder subtasks')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {subtasks.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subtasks.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {subtasks.map((subtask) => (
                <SortableSubtask
                  key={subtask.id}
                  subtask={subtask}
                  onToggle={handleToggle}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  isUpdating={isUpdating}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Plus className="h-4 w-4 text-muted-foreground shrink-0 ml-6" />
        <Input
          placeholder="Add a subtask..."
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAdding}
          className="h-8 text-sm flex-1"
        />
        {isAdding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  )
}
