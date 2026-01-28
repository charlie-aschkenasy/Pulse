'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  Check,
  Loader2,
  Repeat,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Bell,
} from 'lucide-react'
import { TipTapEditor } from '@/components/tasks/tiptap-editor'
import { SubtaskList } from '@/components/tasks/subtask-list'
import { TaskReminders } from '@/components/tasks/task-reminders'
import { updateTask, updateTaskEditorContent, deleteTask } from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { Task, Project, RecurrenceDay } from '@/types/database'
import {
  taskPriorityOptions,
  taskStatusOptions,
  formatDuration,
  parseDuration,
  recurrenceTypeOptions,
  recurrenceDayOptions,
  formatRecurrence,
} from '@/lib/validations'
import { useWalkthrough } from '@/components/onboarding/walkthrough-context'

interface TaskDetailContentProps {
  task: Task & { project?: Project | null }
  projects: Project[]
  userId: string
}

export function TaskDetailContent({ task: initialTask, projects, userId }: TaskDetailContentProps) {
  const router = useRouter()
  const walkthrough = useWalkthrough()
  const [task, setTask] = useState(initialTask)
  const [hasTypedInEditor, setHasTypedInEditor] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [durationInput, setDurationInput] = useState(
    task.duration_minutes ? formatDuration(task.duration_minutes) : ''
  )
  const [date, setDate] = useState<Date | undefined>(
    task.due_date ? new Date(task.due_date + 'T00:00:00') : undefined
  )
  const [editorContent, setEditorContent] = useState<Record<string, unknown>>(
    (task.editor_json as Record<string, unknown>) || {}
  )
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(
    task.recurrence_end_date ? new Date(task.recurrence_end_date + 'T00:00:00') : undefined
  )
  const [subtaskCounts, setSubtaskCounts] = useState({ completed: 0, total: 0 })
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(true)
  const [isRemindersExpanded, setIsRemindersExpanded] = useState(true)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced save for editor content
  const saveEditorContent = useCallback(
    async (content: Record<string, unknown>) => {
      setIsSaving(true)
      const { error } = await updateTaskEditorContent(task.id, content)
      if (error) {
        toast.error('Failed to save notes')
      } else {
        setLastSaved(new Date())
      }
      setIsSaving(false)
    },
    [task.id]
  )

  const handleEditorChange = useCallback(
    (content: Record<string, unknown>) => {
      setEditorContent(content)

      // Walkthrough: detect typing in editor
      if (
        walkthrough.isActive &&
        walkthrough.currentStep === 'type-in-editor' &&
        !hasTypedInEditor
      ) {
        setHasTypedInEditor(true)
        walkthrough.advanceStep('editor-typed')
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveEditorContent(content)
      }, 1000)
    },
    [saveEditorContent, walkthrough, hasTypedInEditor]
  )

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleTitleChange = async (newTitle: string) => {
    if (newTitle === task.title) return

    setIsSaving(true)
    const { data, error } = await updateTask(task.id, { title: newTitle })
    if (error) {
      toast.error('Failed to update title')
      setTitle(task.title)
    } else if (data) {
      setTask(data)
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const handleDurationChange = async () => {
    const minutes = parseDuration(durationInput)
    if (minutes === task.duration_minutes) return

    setIsSaving(true)
    const { data, error } = await updateTask(task.id, { duration_minutes: minutes })
    if (error) {
      toast.error('Failed to update duration')
    } else if (data) {
      setTask(data)
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const handleDateChange = async (newDate: Date | undefined) => {
    if (!newDate) return

    setDate(newDate)
    setIsSaving(true)
    const { data, error } = await updateTask(task.id, {
      due_date: format(newDate, 'yyyy-MM-dd'),
    })
    if (error) {
      toast.error('Failed to update due date')
    } else if (data) {
      setTask(data)
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const handleFieldChange = async (field: string, value: unknown) => {
    setIsSaving(true)
    const { data, error } = await updateTask(task.id, { [field]: value })
    if (error) {
      toast.error(`Failed to update ${field}`)
    } else if (data) {
      setTask(data)
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const handleRecurrenceToggle = async (checked: boolean) => {
    setIsSaving(true)
    const updates: Record<string, unknown> = {
      is_recurring: checked,
    }
    // Set default recurrence type when enabling
    if (checked && !task.recurrence_type) {
      updates.recurrence_type = 'daily'
    }
    // Clear recurrence settings when disabling
    if (!checked) {
      updates.recurrence_type = null
      updates.recurrence_interval = 1
      updates.recurrence_days = []
      updates.recurrence_end_date = null
      setRecurrenceEndDate(undefined)
    }
    const { data, error } = await updateTask(task.id, updates)
    if (error) {
      toast.error('Failed to update recurrence')
    } else if (data) {
      setTask(data)
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const handleRecurrenceEndDateChange = async (newDate: Date | undefined) => {
    setRecurrenceEndDate(newDate)
    setIsSaving(true)
    const { data, error } = await updateTask(task.id, {
      recurrence_end_date: newDate ? format(newDate, 'yyyy-MM-dd') : null,
    })
    if (error) {
      toast.error('Failed to update recurrence end date')
    } else if (data) {
      setTask(data)
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const handleRecurrenceDayToggle = async (day: RecurrenceDay) => {
    const currentDays = task.recurrence_days || []
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day]

    setIsSaving(true)
    const { data, error } = await updateTask(task.id, { recurrence_days: newDays })
    if (error) {
      toast.error('Failed to update recurrence days')
    } else if (data) {
      setTask(data)
      setLastSaved(new Date())
    }
    setIsSaving(false)
  }

  const handleSubtaskCountChange = useCallback((completed: number, total: number) => {
    setSubtaskCounts({ completed, total })
  }, [])

  const handleDelete = async () => {
    // Skip confirmation during walkthrough
    const isTutorialTask = walkthrough.isActive && walkthrough.tutorialTaskId === task.id
    if (!isTutorialTask && !confirm('Are you sure you want to delete this task?')) return

    setIsDeleting(true)
    const { error } = await deleteTask(task.id)
    if (error) {
      toast.error('Failed to delete task')
      setIsDeleting(false)
    } else {
      toast.success('Task deleted')

      // Walkthrough: complete when tutorial task is deleted
      if (isTutorialTask) {
        walkthrough.setTutorialTaskId(null)
        walkthrough.advanceStep('complete')
      }

      router.push('/dashboard')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {isSaving ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          ) : lastSaved ? (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500" />
              Saved {format(lastSaved, 'h:mm a')}
            </div>
          ) : null}

          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            data-walkthrough="delete-button"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => handleTitleChange(title)}
        onKeyDown={(e) => e.key === 'Enter' && handleTitleChange(title)}
        className="text-2xl font-bold border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
        placeholder="Task title"
      />

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Due Date */}
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                {date ? format(date, 'MMM d, yyyy') : 'Set date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Input
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            onBlur={handleDurationChange}
            onKeyDown={(e) => e.key === 'Enter' && handleDurationChange()}
            placeholder="Duration"
            className="w-24 h-8"
          />
        </div>

        {/* Priority */}
        <Select
          value={task.priority}
          onValueChange={(value) => handleFieldChange('priority', value)}
        >
          <SelectTrigger className="w-28 h-8">
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

        {/* Status */}
        <Select
          value={task.status}
          onValueChange={(value) => handleFieldChange('status', value)}
        >
          <SelectTrigger className="w-32 h-8">
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

        {/* Project */}
        <Select
          value={task.project_id || 'none'}
          onValueChange={(value) =>
            handleFieldChange('project_id', value === 'none' ? null : value)
          }
        >
          <SelectTrigger className="w-36 h-8">
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
      </div>

      {/* Quadrant toggles */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="urgent"
            checked={task.urgent}
            onCheckedChange={(checked) => handleFieldChange('urgent', checked)}
          />
          <Label htmlFor="urgent" className="text-sm">
            Urgent
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="important"
            checked={task.important}
            onCheckedChange={(checked) => handleFieldChange('important', checked)}
          />
          <Label htmlFor="important" className="text-sm">
            Important
          </Label>
        </div>

        {task.project && (
          <Badge variant="secondary" className="ml-auto">
            <div
              className="w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: task.project.color || '#6B7280' }}
            />
            {task.project.name}
          </Badge>
        )}
      </div>

      {/* Subtasks Section */}
      <div className="space-y-3 p-4 border rounded-lg">
        <button
          onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Subtasks</span>
            {subtaskCounts.total > 0 && (
              <span className="text-xs text-muted-foreground">
                ({subtaskCounts.completed}/{subtaskCounts.total})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {subtaskCounts.total > 0 && (
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${(subtaskCounts.completed / subtaskCounts.total) * 100}%`,
                  }}
                />
              </div>
            )}
            {isSubtasksExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {isSubtasksExpanded && (
          <div className="pt-2">
            <SubtaskList
              taskId={task.id}
              onCountChange={handleSubtaskCountChange}
            />

            {/* Auto-complete toggle */}
            <div className="flex items-center gap-2 pt-4 mt-4 border-t">
              <Switch
                id="auto_complete_subtasks"
                checked={task.auto_complete_subtasks}
                onCheckedChange={(checked) => handleFieldChange('auto_complete_subtasks', checked)}
              />
              <Label htmlFor="auto_complete_subtasks" className="text-xs text-muted-foreground">
                Auto-complete task when all subtasks are done
              </Label>
            </div>
          </div>
        )}
      </div>

      {/* SMS Reminders Section */}
      <div className="space-y-3 p-4 border rounded-lg">
        <button
          onClick={() => setIsRemindersExpanded(!isRemindersExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">SMS Reminders</span>
          </div>
          <div className="flex items-center gap-2">
            {isRemindersExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {isRemindersExpanded && (
          <div className="pt-2">
            <TaskReminders
              taskId={task.id}
              taskDueDate={task.due_date}
            />
          </div>
        )}
      </div>

      {/* Recurrence Section */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="is_recurring" className="text-sm font-medium">
              Repeat
            </Label>
            {task.is_recurring && task.recurrence_type && (
              <span className="text-xs text-muted-foreground">
                ({formatRecurrence(task.recurrence_type, task.recurrence_interval, task.recurrence_days || [])})
              </span>
            )}
          </div>
          <Switch
            id="is_recurring"
            checked={task.is_recurring}
            onCheckedChange={handleRecurrenceToggle}
          />
        </div>

        {task.is_recurring && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Frequency</Label>
                <Select
                  value={task.recurrence_type || 'daily'}
                  onValueChange={(value) => handleFieldChange('recurrence_type', value)}
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

              {(task.recurrence_type === 'custom' || task.recurrence_type === 'weekly' || task.recurrence_type === 'monthly' || task.recurrence_type === 'yearly') && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Every</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      className="h-9 w-16"
                      value={task.recurrence_interval || 1}
                      onChange={(e) => handleFieldChange('recurrence_interval', parseInt(e.target.value) || 1)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {task.recurrence_type === 'weekly' ? 'week(s)' :
                       task.recurrence_type === 'monthly' ? 'month(s)' :
                       task.recurrence_type === 'yearly' ? 'year(s)' : 'day(s)'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {task.recurrence_type === 'weekly' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">On days</Label>
                <div className="flex flex-wrap gap-1">
                  {recurrenceDayOptions.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={(task.recurrence_days || []).includes(day.value as RecurrenceDay) ? 'default' : 'outline'}
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
                      onClick={() => handleRecurrenceEndDateChange(undefined)}
                    >
                      Clear end date
                    </Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={recurrenceEndDate}
                    onSelect={handleRecurrenceEndDateChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Editor */}
      <div data-walkthrough="notes-editor">
        <h2 className="text-lg font-semibold mb-4">Notes</h2>
        <TipTapEditor
          content={editorContent}
          onChange={handleEditorChange}
          taskId={task.id}
          userId={userId}
          placeholder="Add notes, images, and more..."
        />
      </div>
    </div>
  )
}
