'use client'

import { useCallback, useState } from 'react'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { TaskCard } from './task-card'
import { reorderTasks } from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { Task, Project } from '@/types/database'

interface TaskListProps {
  tasks: (Task & { project?: Project | null })[]
  onEdit?: (task: Task) => void
  onStatusChange?: (taskId: string, newStatus: string) => void
  onDelete?: (taskId: string) => void
  onArchive?: (taskId: string) => void
  showProject?: boolean
  compact?: boolean
  isDraggable?: boolean
  emptyMessage?: string
  /** When true, uses external DndContext (for cross-list drag-and-drop) */
  useExternalDnd?: boolean
}

export function TaskList({
  tasks: initialTasks,
  onEdit,
  onStatusChange,
  onDelete,
  onArchive,
  showProject = true,
  compact = false,
  isDraggable = true,
  emptyMessage = 'No tasks found',
  useExternalDnd = false,
}: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)

  // Update tasks when props change (check IDs and status for optimistic updates)
  const initialTasksKey = initialTasks.map(t => `${t.id}:${t.status}`).join(',')
  const tasksKey = tasks.map(t => `${t.id}:${t.status}`).join(',')
  if (initialTasksKey !== tasksKey) {
    setTasks(initialTasks)
  }

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

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = tasks.findIndex((t) => t.id === active.id)
        const newIndex = tasks.findIndex((t) => t.id === over.id)

        const newTasks = arrayMove(tasks, oldIndex, newIndex)
        setTasks(newTasks)

        const { error } = await reorderTasks(newTasks.map((t) => t.id))
        if (error) {
          toast.error('Failed to reorder tasks')
          setTasks(tasks) // Revert on error
        }
      }
    },
    [tasks]
  )

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center min-h-[100px]">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  // Inner content that renders the sortable tasks
  const taskListContent = (
    <SortableContext
      items={tasks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onArchive={onArchive}
            showProject={showProject}
            compact={compact}
            isDraggable={isDraggable}
          />
        ))}
      </div>
    </SortableContext>
  )

  // If using external DndContext (for cross-list drag), just render the content
  if (useExternalDnd) {
    return taskListContent
  }

  // Otherwise, wrap with internal DndContext for standalone use
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {taskListContent}
    </DndContext>
  )
}
