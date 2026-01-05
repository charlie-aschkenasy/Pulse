'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { CalendarIcon, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createTask, updateTask } from '@/app/actions/tasks'
import { createProject } from '@/app/actions/projects'
import { taskSchema, type TaskFormData, formatDuration, taskPriorityOptions, taskStatusOptions, viewCategoryOptions } from '@/lib/validations'
import type { Task, Project, ViewCategory } from '@/types/database'

interface TaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  projects: Project[]
  defaultQuadrant?: { urgent: boolean; important: boolean }
  defaultViewCategory?: ViewCategory
  onSuccess?: (task?: Task & { project?: Project | null }) => void
  isWalkthroughActive?: boolean
}

export function TaskModal({
  open,
  onOpenChange,
  task,
  projects,
  defaultQuadrant,
  defaultViewCategory = 'daily',
  onSuccess,
  isWalkthroughActive = false,
}: TaskModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [date, setDate] = useState<Date | undefined>(
    task?.due_date ? new Date(task.due_date + 'T00:00:00') : undefined
  )

  const isEditing = !!task

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || '',
      due_date: task?.due_date || null,
      duration: task?.duration_minutes ? formatDuration(task.duration_minutes) : '',
      priority: task?.priority || 'medium',
      project_id: task?.project_id || null,
      status: task?.status || 'open',
      urgent: task?.urgent ?? defaultQuadrant?.urgent ?? false,
      important: task?.important ?? defaultQuadrant?.important ?? false,
      view_category: task?.view_category || defaultViewCategory,
    },
  })

  const watchProjectId = watch('project_id')
  const watchUrgent = watch('urgent')
  const watchImportant = watch('important')

  useEffect(() => {
    if (open) {
      reset({
        title: task?.title || '',
        due_date: task?.due_date || null,
        duration: task?.duration_minutes ? formatDuration(task.duration_minutes) : '',
        priority: task?.priority || 'medium',
        project_id: task?.project_id || null,
        status: task?.status || 'open',
        urgent: task?.urgent ?? defaultQuadrant?.urgent ?? false,
        important: task?.important ?? defaultQuadrant?.important ?? false,
        view_category: task?.view_category || defaultViewCategory,
      })
      setDate(task?.due_date ? new Date(task.due_date + 'T00:00:00') : undefined)
    }
  }, [open, task, defaultQuadrant, defaultViewCategory, reset])

  const onSubmit = async (data: TaskFormData) => {
    setIsLoading(true)
    try {
      if (isEditing) {
        const { data: updatedTask, error } = await updateTask(task.id, {
          title: data.title,
          due_date: data.due_date || null,
          duration: data.duration,
          priority: data.priority,
          project_id: data.project_id || null,
          status: data.status,
          urgent: data.urgent,
          important: data.important,
          view_category: data.view_category,
        })

        if (error) {
          toast.error(error)
          return
        }
        toast.success('Task updated!')
        onOpenChange(false)
        onSuccess?.(updatedTask as Task & { project?: Project | null })
      } else {
        const { data: newTask, error } = await createTask({
          title: data.title,
          due_date: data.due_date || null,
          duration: data.duration,
          priority: data.priority,
          project_id: data.project_id || null,
          status: data.status,
          urgent: data.urgent,
          important: data.important,
          view_category: data.view_category,
        })

        if (error) {
          toast.error(error)
          return
        }
        toast.success('Task created!')
        onOpenChange(false)
        onSuccess?.(newTask as Task & { project?: Project | null })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setIsLoading(true)
    const { data, error } = await createProject({ name: newProjectName.trim() })
    setIsLoading(false)

    if (error) {
      toast.error(error)
      return
    }

    if (data) {
      setValue('project_id', data.id)
      setNewProjectName('')
      setShowNewProject(false)
      toast.success('Project created!')
    }
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate)
      setValue('due_date', format(selectedDate, 'yyyy-MM-dd'))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        onKeyDown={handleKeyDown}
        data-walkthrough={isWalkthroughActive ? 'task-modal' : undefined}
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="What needs to be done?"
              {...register('title')}
              autoFocus
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <Select
              value={watch('view_category')}
              onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                setValue('view_category', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {viewCategoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'MMM d, yyyy') : 'No due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2 border-b">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setDate(undefined)
                        setValue('due_date', null)
                      }}
                    >
                      Clear date
                    </Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                placeholder="e.g., 1h30m, 45m"
                {...register('duration')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={watch('priority')}
                onValueChange={(value: 'high' | 'medium' | 'low') =>
                  setValue('priority', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskPriorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', option.color)} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(value: TaskFormData['status']) =>
                  setValue('status', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Project</Label>
            {showNewProject ? (
              <div className="flex gap-2">
                <Input
                  placeholder="New project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateProject}
                  disabled={isLoading || !newProjectName.trim()}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewProject(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={watchProjectId || 'none'}
                  onValueChange={(value) =>
                    setValue('project_id', value === 'none' ? null : value)
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: project.color || '#6B7280' }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowNewProject(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="urgent"
                checked={watchUrgent}
                onCheckedChange={(checked) => setValue('urgent', checked)}
              />
              <Label htmlFor="urgent" className="text-sm">
                Urgent
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="important"
                checked={watchImportant}
                onCheckedChange={(checked) => setValue('important', checked)}
              />
              <Label htmlFor="important" className="text-sm">
                Important
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Update Task'
              ) : (
                'Create Task'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
