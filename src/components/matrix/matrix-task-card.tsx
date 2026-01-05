'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
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
} from 'lucide-react'
import { completeTask, deleteTask, archiveTask, updateTask } from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { Task, Project } from '@/types/database'
import { formatDuration } from '@/lib/validations'

interface MatrixTaskCardProps {
  task: Task & { project?: Project | null }
  onEdit: (task: Task) => void
  isDragging?: boolean
}

const priorityBorderColors = {
  high: 'border-l-red-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export function MatrixTaskCard({ task, onEdit, isDragging = false }: MatrixTaskCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dueDate = task.due_date ? new Date(task.due_date + 'T00:00:00') : null

  const handleComplete = async () => {
    setIsLoading(true)
    const newStatus = task.status === 'completed' ? 'open' : 'completed'
    const { error } = await updateTask(task.id, { status: newStatus })
    if (error) {
      toast.error('Failed to update task')
    }
    setIsLoading(false)
  }

  const handleDelete = async () => {
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
    setIsLoading(true)
    const { error } = await archiveTask(task.id)
    if (error) {
      toast.error('Failed to archive task')
    } else {
      toast.success('Task archived')
    }
    setIsLoading(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 p-3 rounded-lg bg-card border border-l-4 shadow-sm hover:shadow-md transition-all',
        priorityBorderColors[task.priority],
        (isDragging || isSortableDragging) && 'opacity-50 shadow-lg rotate-2'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Checkbox
        checked={task.status === 'completed'}
        onCheckedChange={handleComplete}
        disabled={isLoading}
        className="mt-0.5 shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <Link
            href={`/tasks/${task.id}`}
            className={cn(
              'text-sm font-medium hover:underline line-clamp-2',
              task.status === 'completed' && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
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

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
          {dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{format(dueDate, 'MMM d')}</span>
            </div>
          )}

          {task.duration_minutes && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(task.duration_minutes)}</span>
            </div>
          )}

          {task.project && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-[80px]"
              style={{
                backgroundColor: (task.project.color || '#6B7280') + '20',
                color: task.project.color || '#6B7280',
              }}
            >
              {task.project.name}
            </span>
          )}

          {task.status !== 'open' && task.status !== 'completed' && (
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', statusColors[task.status])}>
              {task.status.replace('_', ' ')}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
