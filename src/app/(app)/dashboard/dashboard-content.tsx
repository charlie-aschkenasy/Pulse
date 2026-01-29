'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react'
import { TaskList } from '@/components/tasks/task-list'
import { TaskCard } from '@/components/tasks/task-card'
import { TaskModal } from '@/components/tasks/task-modal'
import { updateTask, deleteTask, archiveTask } from '@/app/actions/tasks'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Task, Project, ViewCategory, Subtask } from '@/types/database'
import { useWalkthrough } from '@/components/onboarding/walkthrough-context'
import { useTasksByViewCategory, TaskWithSubtasks, invalidateAllTasks, TASKS_KEYS } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'
import { useTaskCounts, invalidateTaskCounts, TASK_COUNTS_KEY } from '@/hooks/use-task-counts'
import { mutate } from 'swr'

interface CategorySection {
  id: ViewCategory
  title: string
  label: string
}

const categories: CategorySection[] = [
  { id: 'daily', title: 'Daily', label: 'Daily' },
  { id: 'weekly', title: 'Weekly', label: 'Weekly' },
  { id: 'monthly', title: 'Monthly', label: 'Monthly' },
]

function DroppableSection({
  category,
  tasks,
  onEdit,
  onAddTask,
  onStatusChange,
  onDelete,
  onArchive,
  onSubtaskUpdate,
}: {
  category: CategorySection
  tasks: TaskWithSubtasks[]
  onEdit: (task: Task) => void
  onAddTask: (category: ViewCategory) => void
  onStatusChange: (taskId: string, newStatus: string) => void
  onDelete: (taskId: string) => void
  onArchive: (taskId: string) => void
  onSubtaskUpdate?: (subtask: Subtask) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: category.id,
    data: { category },
  })

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'flex flex-col transition-all',
        isOver && 'ring-2 ring-primary ring-offset-2 bg-primary/5'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{category.title}</CardTitle>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onAddTask(category.id)}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto min-h-[200px]">
        <TaskList
          tasks={tasks}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          onArchive={onArchive}
          emptyMessage={`No ${category.id} tasks`}
          compact
          useExternalDnd
          showSubtasks
          onSubtaskUpdate={onSubtaskUpdate}
        />
      </CardContent>
    </Card>
  )
}

export function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const walkthrough = useWalkthrough()

  // SWR hooks for data fetching
  const { tasks: dailyTasks, mutate: mutateDaily } = useTasksByViewCategory('daily')
  const { tasks: weeklyTasks, mutate: mutateWeekly } = useTasksByViewCategory('weekly')
  const { tasks: monthlyTasks, mutate: mutateMonthly } = useTasksByViewCategory('monthly')
  const { projects } = useProjects()
  const { counts: taskCounts, mutate: mutateCounts } = useTaskCounts()

  // Local state for filtering and UI
  const [showCompleted, setShowCompleted] = useState(false)
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultViewCategory, setDefaultViewCategory] = useState<ViewCategory>('daily')
  const [activeTask, setActiveTask] = useState<TaskWithSubtasks | null>(null)

  // Check if walkthrough should be started via URL param
  const forceTour = searchParams.get('tour') === 'true'

  // Start walkthrough if forced or if user hasn't completed it
  useEffect(() => {
    if (forceTour && !walkthrough.isActive) {
      walkthrough.startWalkthrough()
      router.replace('/dashboard', { scroll: false })
    } else if (!walkthrough.isWalkthroughComplete() && !walkthrough.isActive) {
      // Auto-start for new users
      const timer = setTimeout(() => {
        walkthrough.startWalkthrough()
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [forceTour, router, walkthrough])

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

  const filterTasks = useCallback((tasks: TaskWithSubtasks[]) => {
    let filtered = tasks
    if (!showCompleted) {
      filtered = filtered.filter(t => t.status !== 'completed')
    }
    if (projectFilter !== 'all') {
      filtered = filtered.filter(t => t.project_id === projectFilter)
    }
    return filtered
  }, [showCompleted, projectFilter])

  // Helper to get mutate function for a category
  const getMutateForCategory = (category: ViewCategory) => {
    switch (category) {
      case 'daily': return mutateDaily
      case 'weekly': return mutateWeekly
      case 'monthly': return mutateMonthly
    }
  }

  // Helper to get tasks for a category
  const getTasksForCategory = (category: ViewCategory) => {
    switch (category) {
      case 'daily': return dailyTasks
      case 'weekly': return weeklyTasks
      case 'monthly': return monthlyTasks
    }
  }

  // Find which category a task belongs to
  const findTaskCategory = (taskId: string): ViewCategory | null => {
    if (dailyTasks.find(t => t.id === taskId)) return 'daily'
    if (weeklyTasks.find(t => t.id === taskId)) return 'weekly'
    if (monthlyTasks.find(t => t.id === taskId)) return 'monthly'
    return null
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingTask(null)
  }

  // Handle task creation/edit from modal
  const handleSuccess = (task?: Task & { project?: Project | null }) => {
    if (task) {
      const existingCategory = findTaskCategory(task.id)
      const taskWithSubtasks: TaskWithSubtasks = { ...task, subtasks: [] }

      if (existingCategory) {
        // Task was edited
        if (existingCategory === task.view_category) {
          // Same category - optimistic update in place
          getMutateForCategory(existingCategory)(
            (current) => current?.map(t => t.id === task.id ? { ...t, ...task } : t),
            { revalidate: false }
          )
        } else {
          // Category changed - remove from old, add to new
          getMutateForCategory(existingCategory)(
            (current) => current?.filter(t => t.id !== task.id),
            { revalidate: false }
          )
          const existingTasks = getTasksForCategory(existingCategory)
          const existingTask = existingTasks.find(t => t.id === task.id)
          getMutateForCategory(task.view_category)(
            (current) => [...(current || []), { ...taskWithSubtasks, subtasks: existingTask?.subtasks || [] }],
            { revalidate: false }
          )
        }
      } else {
        // New task - add to appropriate category
        getMutateForCategory(task.view_category)(
          (current) => [...(current || []), taskWithSubtasks],
          { revalidate: false }
        )

        // Walkthrough: track tutorial task and advance
        if (walkthrough.isActive && walkthrough.currentStep === 'fill-task-form') {
          walkthrough.setTutorialTaskId(task.id)
          walkthrough.advanceStep('task-created')
        }

        // Update counts optimistically
        mutateCounts(
          (current) => current ? { ...current, total: current.total + 1 } : current,
          { revalidate: false }
        )
      }
    } else {
      // Fallback: revalidate all if no task data returned
      invalidateAllTasks()
      invalidateTaskCounts()
    }
  }

  // Handle subtask updates
  const handleSubtaskUpdate = useCallback(() => {
    // Revalidate tasks to reflect subtask changes
    mutateDaily()
    mutateWeekly()
    mutateMonthly()
  }, [mutateDaily, mutateWeekly, mutateMonthly])

  const handleNewTask = (category: ViewCategory) => {
    setDefaultViewCategory(category)
    setEditingTask(null)
    setIsModalOpen(true)

    // Walkthrough: advance when modal opens
    if (walkthrough.isActive && walkthrough.currentStep === 'click-new-task') {
      walkthrough.advanceStep('fill-task-form')
    }
  }

  // Optimistic status change
  const handleStatusChange = (taskId: string, newStatus: string) => {
    const category = findTaskCategory(taskId)
    if (!category) return

    const tasks = getTasksForCategory(category)
    const task = tasks.find(t => t.id === taskId)
    const oldStatus = task?.status

    // Optimistic update
    getMutateForCategory(category)(
      (current) => current?.map(t => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t),
      { revalidate: false }
    )

    // Update counts optimistically
    if (newStatus === 'completed' && oldStatus !== 'completed') {
      mutateCounts(
        (current) => current ? { ...current, completed: current.completed + 1 } : current,
        { revalidate: false }
      )
    } else if (newStatus !== 'completed' && oldStatus === 'completed') {
      mutateCounts(
        (current) => current ? { ...current, completed: Math.max(0, current.completed - 1) } : current,
        { revalidate: false }
      )
    }

    // Fire server call in background
    updateTask(taskId, { status: newStatus as Task['status'] }).then(({ error }) => {
      if (error) {
        toast.error('Failed to update task')
        getMutateForCategory(category)() // Revalidate to restore correct state
        mutateCounts()
      } else {
        toast.success(newStatus === 'completed' ? 'Task completed!' : 'Task reopened')
      }
    })
  }

  // Optimistic delete
  const handleDelete = (taskId: string) => {
    const category = findTaskCategory(taskId)
    if (!category) return

    const tasks = getTasksForCategory(category)
    const task = tasks.find(t => t.id === taskId)

    // Optimistic update
    getMutateForCategory(category)(
      (current) => current?.filter(t => t.id !== taskId),
      { revalidate: false }
    )

    // Update counts optimistically
    if (task) {
      mutateCounts(
        (current) => current ? {
          ...current,
          total: Math.max(0, current.total - 1),
          completed: task.status === 'completed' ? Math.max(0, current.completed - 1) : current.completed,
        } : current,
        { revalidate: false }
      )
    }

    // Fire server call in background
    deleteTask(taskId).then(({ error }) => {
      if (error) {
        toast.error('Failed to delete task')
        getMutateForCategory(category)() // Revalidate to restore correct state
        mutateCounts()
      } else {
        toast.success('Task deleted')
      }
    })
  }

  // Optimistic archive
  const handleArchive = (taskId: string) => {
    const category = findTaskCategory(taskId)
    if (!category) return

    const tasks = getTasksForCategory(category)
    const task = tasks.find(t => t.id === taskId)

    // Optimistic update
    getMutateForCategory(category)(
      (current) => current?.filter(t => t.id !== taskId),
      { revalidate: false }
    )

    // Update counts optimistically
    if (task) {
      mutateCounts(
        (current) => current ? {
          ...current,
          total: Math.max(0, current.total - 1),
          completed: task.status === 'completed' ? Math.max(0, current.completed - 1) : current.completed,
        } : current,
        { revalidate: false }
      )
    }

    // Fire server call in background
    archiveTask(taskId).then(({ error }) => {
      if (error) {
        toast.error('Failed to archive task')
        getMutateForCategory(category)() // Revalidate to restore correct state
        mutateCounts()
      } else {
        toast.success('Task archived')
      }
    })
  }

  // Get all tasks for drag operations
  const allTasks = [...dailyTasks, ...weeklyTasks, ...monthlyTasks]

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = allTasks.find((t) => t.id === active.id)
    if (task) {
      setActiveTask(task)
    }
  }

  // Optimistic drag and drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const draggedTask = allTasks.find((t) => t.id === active.id)
    if (!draggedTask) return

    // Determine target category
    let targetCategoryId: ViewCategory | null = null

    // Check if dropped on a category section
    const targetCategory = categories.find((c) => c.id === over.id)
    if (targetCategory) {
      targetCategoryId = targetCategory.id
    } else {
      // Check if dropped on a task - use that task's category
      const overTask = allTasks.find((t) => t.id === over.id)
      if (overTask) {
        targetCategoryId = overTask.view_category
      }
    }

    if (!targetCategoryId || draggedTask.view_category === targetCategoryId) {
      return // Same category or invalid drop
    }

    const sourceCategory = draggedTask.view_category
    const categoryLabel = categories.find(c => c.id === targetCategoryId)?.label

    // Optimistic update: move task between categories
    getMutateForCategory(sourceCategory)(
      (current) => current?.filter(t => t.id !== draggedTask.id),
      { revalidate: false }
    )

    const updatedTask = { ...draggedTask, view_category: targetCategoryId }
    getMutateForCategory(targetCategoryId)(
      (current) => [...(current || []), updatedTask],
      { revalidate: false }
    )

    toast.success(`Task moved to ${categoryLabel}`)

    // Walkthrough: detect tutorial task moved to weekly
    if (
      walkthrough.isActive &&
      walkthrough.currentStep === 'drag-to-weekly' &&
      draggedTask.id === walkthrough.tutorialTaskId &&
      targetCategoryId === 'weekly'
    ) {
      walkthrough.advanceStep('task-moved')
    }

    // Fire server call in background (don't await)
    updateTask(draggedTask.id, { view_category: targetCategoryId }).then(({ error }) => {
      if (error) {
        toast.error('Failed to save move - reverting')
        // Revalidate both categories to restore correct state
        getMutateForCategory(sourceCategory)()
        getMutateForCategory(targetCategoryId!)()
      }
    })
  }

  const filteredDaily = filterTasks(dailyTasks)
  const filteredWeekly = filterTasks(weeklyTasks)
  const filteredMonthly = filterTasks(monthlyTasks)

  const getFilteredTasksForCategory = (categoryId: ViewCategory) => {
    switch (categoryId) {
      case 'daily':
        return filteredDaily
      case 'weekly':
        return filteredWeekly
      case 'monthly':
        return filteredMonthly
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Organize your tasks by timeframe</p>
        </div>
        <Button id="tour-new-task-button" onClick={() => handleNewTask('daily')}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskCounts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskCounts.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskCounts.dueToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{taskCounts.overdue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="showCompleted"
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
          />
          <Label htmlFor="showCompleted" className="text-sm">
            Show completed
          </Label>
        </div>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
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

      {/* Task Sections with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div id="tour-task-columns" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <DroppableSection
              key={category.id}
              category={category}
              tasks={getFilteredTasksForCategory(category.id)}
              onEdit={handleEdit}
              onAddTask={handleNewTask}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onSubtaskUpdate={handleSubtaskUpdate}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 shadow-lg">
              <TaskCard task={activeTask} compact isDraggable={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Modal */}
      <TaskModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        task={editingTask}
        projects={projects}
        onSuccess={handleSuccess}
        defaultViewCategory={defaultViewCategory}
        isWalkthroughActive={walkthrough.isActive && walkthrough.currentStep === 'fill-task-form'}
      />
    </div>
  )
}
