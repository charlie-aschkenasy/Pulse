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
import { CalendarIcon, Loader2, Plus, Repeat } from 'lucide-react'
import { toast } from 'sonner'
import { createTask, updateTask } from '@/app/actions/tasks'
import { createProject } from '@/app/actions/projects'
import { taskSchema, type TaskFormData, formatDuration, taskPriorityOptions, taskStatusOptions, viewCategoryOptions, recurrenceTypeOptions, recurrenceDayOptions } from '@/lib/validations'
import type { Task, Project, ViewCategory, RecurrenceDay } from '@/types/database'
import { Checkbox } from '@/components/ui/checkbox'

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
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(
    task?.recurrence_end_date ? new Date(task.recurrence_end_date + 'T00:00:00') : undefined
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
      is_recurring: task?.is_recurring || false,
      recurrence_type: task?.recurrence_type || null,
      recurrence_interval: task?.recurrence_interval || 1,
      recurrence_days: task?.recurrence_days || [],
      recurrence_end_date: task?.recurrence_end_date || null,
    },
  })

  const watchProjectId = watch('project_id')
  const watchUrgent = watch('urgent')
  const watchImportant = watch('important')
  const watchIsRecurring = watch('is_recurring')
  const watchRecurrenceType = watch('recurrence_type')
  const watchRecurrenceDays = watch('recurrence_days') || []

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
        is_recurring: task?.is_recurring || false,
        recurrence_type: task?.recurrence_type || null,
        recurrence_interval: task?.recurrence_interval || 1,
        recurrence_days: task?.recurrence_days || [],
        recurrence_end_date: task?.recurrence_end_date || null,
      })
      setDate(task?.due_date ? new Date(task.due_date + 'T00:00:00') : undefined)
      setRecurrenceEndDate(task?.recurrence_end_date ? new Date(task.recurrence_end_date + 'T00:00:00') : undefined)
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
          is_recurring: data.is_recurring || false,
          recurrence_type: data.is_recurring ? data.recurrence_type : null,
          recurrence_interval: data.recurrence_interval || 1,
          recurrence_days: data.recurrence_days || [],
          recurrence_end_date: data.recurrence_end_date || null,
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
          is_recurring: data.is_recurring || false,
          recurrence_type: data.is_recurring ? data.recurrence_type : null,
          recurrence_interval: data.recurrence_interval || 1,
          recurrence_days: data.recurrence_days || [],
          recurrence_end_date: data.recurrence_end_date || null,
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

  const handleRecurrenceEndDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setRecurrenceEndDate(selectedDate)
      setValue('recurrence_end_date', format(selectedDate, 'yyyy-MM-dd'))
    }
  }

  const handleRecurrenceDayToggle = (day: RecurrenceDay) => {
    const currentDays = watchRecurrenceDays || []
    if (currentDays.includes(day)) {
      setValue('recurrence_days', currentDays.filter((d: RecurrenceDay) => d !== day))
    } else {
      setValue('recurrence_days', [...currentDays, day])
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

          {/* Recurrence Section */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="is_recurring" className="text-sm font-medium">
                  Repeat
                </Label>
              </div>
              <Switch
                id="is_recurring"
                checked={watchIsRecurring}
                onCheckedChange={(checked) => {
                  setValue('is_recurring', checked)
                  if (checked && !watchRecurrenceType) {
                    setValue('recurrence_type', 'daily')
                  }
                }}
              />
            </div>

            {watchIsRecurring && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Frequency</Label>
                    <Select
                      value={watchRecurrenceType || 'daily'}
                      onValueChange={(value) =>
                        setValue('recurrence_type', value as TaskFormData['recurrence_type'])
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {recurrenceTypeOptions.filter(o => o.value !== 'none').map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(watchRecurrenceType === 'custom' || watchRecurrenceType === 'weekly' || watchRecurrenceType === 'monthly' || watchRecurrenceType === 'yearly') && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Every
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          className="h-9 w-16"
                          value={watch('recurrence_interval') || 1}
                          onChange={(e) => setValue('recurrence_interval', parseInt(e.target.value) || 1)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {watchRecurrenceType === 'weekly' ? 'week(s)' :
                           watchRecurrenceType === 'monthly' ? 'month(s)' :
                           watchRecurrenceType === 'yearly' ? 'year(s)' : 'day(s)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {watchRecurrenceType === 'weekly' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">On days</Label>
                    <div className="flex flex-wrap gap-1">
                      {recurrenceDayOptions.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={watchRecurrenceDays.includes(day.value as RecurrenceDay) ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-10 p-0 text-xs"
                          onClick={() => handleRecurrenceDayToggle(day.value as RecurrenceDay)}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">End date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'w-full justify-start text-left font-normal h-9',
                          !recurrenceEndDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {recurrenceEndDate ? format(recurrenceEndDate, 'MMM d, yyyy') : 'No end date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-2 border-b">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setRecurrenceEndDate(undefined)
                            setValue('recurrence_end_date', null)
                          }}
                        >
                          Clear end date
                        </Button>
                      </div>
                      <Calendar
                        mode="single"
                        selected={recurrenceEndDate}
                        onSelect={handleRecurrenceEndDateSelect}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
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
