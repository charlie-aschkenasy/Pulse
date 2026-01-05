'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { GripVertical, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import { deleteProject } from '@/app/actions/projects'
import { toast } from 'sonner'
import { TaskCard } from '@/components/tasks/task-card'
import type { Project, Task } from '@/types/database'

interface ProjectCardProps {
  project: Project & { total_tasks: number; completed_tasks: number }
  tasks: Task[]
  onEdit: (project: Project) => void
  onAddTask: (projectId: string) => void
  onEditTask: (task: Task) => void
  isDraggable?: boolean
}

export function ProjectCard({
  project,
  tasks,
  onEdit,
  onAddTask,
  onEditTask,
  isDraggable = true,
}: ProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    disabled: !isDraggable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const progress = project.total_tasks > 0
    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
    : 0

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? Tasks will be kept but unassigned.')) {
      return
    }

    setIsDeleting(true)
    const { error } = await deleteProject(project.id)
    if (error) {
      toast.error('Failed to delete project')
    } else {
      toast.success('Project deleted')
    }
    setIsDeleting(false)
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {isDraggable && (
            <button
              {...attributes}
              {...listeners}
              className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: project.color || '#6B7280' }}
          />

          <CardTitle className="flex-1 text-base truncate">
            {project.name}
          </CardTitle>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(project)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddTask(project.id)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {project.completed_tasks}/{project.total_tasks}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {tasks.length > 0 ? (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={onEditTask}
                  showProject={false}
                  compact
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">No tasks yet</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddTask(project.id)}
            >
              <Plus className="mr-2 h-3 w-3" />
              Add Task
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
