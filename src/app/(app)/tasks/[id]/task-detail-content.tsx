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
} from 'lucide-react'
import { TipTapEditor } from '@/components/tasks/tiptap-editor'
import { updateTask, updateTaskEditorContent, deleteTask } from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { Task, Project } from '@/types/database'
import {
  taskPriorityOptions,
  taskStatusOptions,
  formatDuration,
  parseDuration,
} from '@/lib/validations'

interface TaskDetailContentProps {
  task: Task & { project?: Project | null }
  projects: Project[]
  userId: string
}

export function TaskDetailContent({ task: initialTask, projects, userId }: TaskDetailContentProps) {
  const router = useRouter()
  const [task, setTask] = useState(initialTask)
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

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveEditorContent(content)
      }, 1000)
    },
    [saveEditorContent]
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return

    setIsDeleting(true)
    const { error } = await deleteTask(task.id)
    if (error) {
      toast.error('Failed to delete task')
      setIsDeleting(false)
    } else {
      toast.success('Task deleted')
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

      <Separator />

      {/* Editor */}
      <div>
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
