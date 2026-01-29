'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format, isPast, isToday } from 'date-fns'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Calendar,
  Clock,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  FolderOpen,
  Repeat,
  SkipForward,
  ListChecks,
} from 'lucide-react'
import { completeTask, deleteTask, archiveTask, updateTask, completeRecurringTask, skipTaskOccurrence } from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { Task, Project } from '@/types/database'
import { formatDuration, formatRecurrence } from '@/lib/validations'

interface TaskCardProps {
  task: Task & { project?: Project | null }
  onEdit?: (task: Task) => void
  onStatusChange?: (taskId: string, newStatus: string) => void
  onDelete?: (taskId: string) => void
  onArchive?: (taskId: string) => void
  onSkip?: (taskId: string) => void
  showProject?: boolean
  compact?: boolean
  isDraggable?: boolean
  subtaskCount?: { completed: number; total: number }
}

const priorityBorderColors = {
  high: 'border-l-red-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  blocked: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
  archived: 'Archived',
}

export function TaskCard({
  task,
  onEdit,
  onStatusChange,
  onDelete,
  onArchive,
  onSkip,
  showProject = true,
  compact = false,
  isDraggable = true,
  subtaskCount,
}: TaskCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !isDraggable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dueDate = task.due_date ? new Date(task.due_date + 'T00:00:00') : null
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && task.status !== 'completed'
  const isDueToday = dueDate && isToday(dueDate)

  const handleComplete = async () => {
    const newStatus = task.status === 'completed' ? 'open' : 'completed'

    // If callback provided, let parent handle optimistically
    if (onStatusChange) {
      onStatusChange(task.id, newStatus)
      return
    }

    // Fallback to direct update
    setIsLoading(true)

    // Use completeRecurringTask for recurring tasks to create next occurrence
    if (task.is_recurring && newStatus === 'completed') {
      const { error } = await completeRecurringTask(task.id)
      if (error) {
        toast.error('Failed to complete task')
      } else {
        toast.success('Task completed! Next occurrence created.')
      }
    } else {
      const { error } = await updateTask(task.id, { status: newStatus })
      if (error) {
        toast.error('Failed to update task')
      } else {
        toast.success(newStatus === 'completed' ? 'Task completed!' : 'Task reopened')
      }
    }
    setIsLoading(false)
  }

  const handleSkip = async () => {
    if (onSkip) {
      onSkip(task.id)
      return
    }

    setIsLoading(true)
    const { error } = await skipTaskOccurrence(task.id)
    if (error) {
      toast.error('Failed to skip occurrence')
    } else {
      toast.success('Occurrence skipped')
    }
    setIsLoading(false)
  }

  const handleDelete = async () => {
    // If callback provided, let parent handle optimistically
    if (onDelete) {
      onDelete(task.id)
      return
    }

    // Fallback to direct delete
    setIsLoading(true)
    const { error } = await deleteTask(task.id)
    if (error) {
      toast.error('Failed to delete task')
    } else {
      toast.success('Task deleted')
    }
    setIsLoading(false)
  }

  const handleArchive = async () => {
    // If callback provided, let parent handle optimistically
    if (onArchive) {
      onArchive(task.id)
      return
    }

    // Fallback to direct archive
    setIsLoading(true)
    const { error } = await archiveTask(task.id)
    if (error) {
      toast.error('Failed to archive task')
    } else {
      toast.success('Task archived')
    }
    setIsLoading(false)
  }

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-2 p-2 rounded-lg bg-card border border-l-4 hover:shadow-sm transition-all',
          priorityBorderColors[task.priority],
          isDragging && 'opacity-50 shadow-lg',
          task.status === 'completed' && 'opacity-60'
        )}
      >
        {isDraggable && (
          <button
            {...attributes}
            {...listeners}
            className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <Checkbox
          checked={task.status === 'completed'}
          onCheckedChange={handleComplete}
          disabled={isLoading}
          className="shrink-0"
        />

        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className={cn(
              'text-sm break-words hover:underline',
              task.status === 'completed' && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </Link>
          {task.is_recurring && (
            <Repeat className="h-3 w-3 text-primary shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {showProject && task.project && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full truncate max-w-[100px]"
              style={{
                backgroundColor: (task.project.color || '#6B7280') + '20',
                color: task.project.color || '#6B7280',
              }}
            >
              {task.project.name}
            </span>
          )}
          {dueDate && (
            <span className={cn(
              'text-xs',
              isOverdue && 'text-destructive font-medium',
              isDueToday && 'text-primary font-medium'
            )}>
              {format(dueDate, 'MMM d')}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-3 p-4 rounded-lg bg-card border border-l-4 hover:shadow-md transition-all',
        priorityBorderColors[task.priority],
        isDragging && 'opacity-50 shadow-lg',
        task.status === 'completed' && 'opacity-60'
      )}
    >
      {isDraggable && (
        <button
          {...attributes}
          {...listeners}
          className="mt-1 touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <Checkbox
        checked={task.status === 'completed'}
        onCheckedChange={handleComplete}
        disabled={isLoading}
        className="mt-1 shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/tasks/${task.id}`}
              className={cn(
                'font-medium hover:underline',
                task.status === 'completed' && 'line-through text-muted-foreground'
              )}
            >
              {task.title}
            </Link>
            {task.is_recurring && (
              <Repeat className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/tasks/${task.id}`}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Open
                </Link>
              </DropdownMenuItem>
              {task.is_recurring && (
                <DropdownMenuItem onClick={handleSkip}>
                  <SkipForward className="mr-2 h-4 w-4" />
                  Skip this occurrence
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
          {dueDate && (
            <div className={cn(
              'flex items-center gap-1',
              isOverdue && 'text-destructive',
              isDueToday && 'text-primary'
            )}>
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {isOverdue ? 'Overdue: ' : isDueToday ? 'Due today' : ''}
                {format(dueDate, 'MMM d, yyyy')}
              </span>
            </div>
          )}

          {task.duration_minutes && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDuration(task.duration_minutes)}</span>
            </div>
          )}

          {task.is_recurring && task.recurrence_type && (
            <div className="flex items-center gap-1 text-primary">
              <Repeat className="h-3.5 w-3.5" />
              <span className="text-xs">
                {formatRecurrence(task.recurrence_type, task.recurrence_interval, task.recurrence_days || [])}
              </span>
            </div>
          )}

          {subtaskCount && subtaskCount.total > 0 && (
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              <span className="text-xs">{subtaskCount.completed}/{subtaskCount.total}</span>
              <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${(subtaskCount.completed / subtaskCount.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {showProject && task.project && (
            <span
              className="text-xs px-2 py-0.5 rounded-full truncate max-w-[120px]"
              style={{
                backgroundColor: (task.project.color || '#6B7280') + '20',
                color: task.project.color || '#6B7280',
              }}
            >
              {task.project.name}
            </span>
          )}

          <Badge variant="secondary" className={cn('text-xs', statusColors[task.status])}>
            {statusLabels[task.status]}
          </Badge>
        </div>
      </div>
    </div>
  )
}
