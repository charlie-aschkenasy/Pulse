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
import { getTaskCounts, getTasksWithSubtasksByViewCategory, updateTask, deleteTask, archiveTask } from '@/app/actions/tasks'
import { getProjects } from '@/app/actions/projects'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Task, Project, ViewCategory, Subtask } from '@/types/database'
import { useWalkthrough } from '@/components/onboarding/walkthrough-context'

type TaskWithSubtasks = Task & { project?: Project | null; subtasks: Subtask[] }

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
  const [dailyTasks, setDailyTasks] = useState<TaskWithSubtasks[]>([])
  const [weeklyTasks, setWeeklyTasks] = useState<TaskWithSubtasks[]>([])
  const [monthlyTasks, setMonthlyTasks] = useState<TaskWithSubtasks[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [taskCounts, setTaskCounts] = useState({ total: 0, completed: 0, overdue: 0, dueToday: 0 })
  const [isLoading, setIsLoading] = useState(true)
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

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [projectsRes, countsRes, dailyRes, weeklyRes, monthlyRes] = await Promise.all([
        getProjects(),
        getTaskCounts(),
        getTasksWithSubtasksByViewCategory('daily'),
        getTasksWithSubtasksByViewCategory('weekly'),
        getTasksWithSubtasksByViewCategory('monthly'),
      ])

      if (projectsRes.data) setProjects(projectsRes.data)
      if (countsRes.data) setTaskCounts(countsRes.data)
      if (dailyRes.data) setDailyTasks(dailyRes.data as TaskWithSubtasks[])
      if (weeklyRes.data) setWeeklyTasks(weeklyRes.data as TaskWithSubtasks[])
      if (monthlyRes.data) setMonthlyTasks(monthlyRes.data as TaskWithSubtasks[])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Helper to get/set tasks for a category
  const getTasksState = (category: ViewCategory) => {
    switch (category) {
      case 'daily': return dailyTasks
      case 'weekly': return weeklyTasks
      case 'monthly': return monthlyTasks
    }
  }

  const setTasksState = (category: ViewCategory, tasks: TaskWithSubtasks[]) => {
    switch (category) {
      case 'daily': setDailyTasks(tasks); break
      case 'weekly': setWeeklyTasks(tasks); break
      case 'monthly': setMonthlyTasks(tasks); break
    }
  }

  // Find which category a task belongs to
  const findTaskCategory = (taskId: string): ViewCategory | null => {
    if (dailyTasks.find(t => t.id === taskId)) return 'daily'
    if (weeklyTasks.find(t => t.id === taskId)) return 'weekly'
    if (monthlyTasks.find(t => t.id === taskId)) return 'monthly'
    return null
  }

  // Update a task in its category array
  const updateTaskInState = (taskId: string, updates: Partial<Task>) => {
    const category = findTaskCategory(taskId)
    if (!category) return

    const tasks = getTasksState(category)
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    )
    setTasksState(category, updatedTasks)
  }

  // Remove a task from its category array
  const removeTaskFromState = (taskId: string) => {
    const category = findTaskCategory(taskId)
    if (!category) return null

    const tasks = getTasksState(category)
    const task = tasks.find(t => t.id === taskId)
    const updatedTasks = tasks.filter(t => t.id !== taskId)
    setTasksState(category, updatedTasks)
    return task
  }

  // Add a task to a category array
  const addTaskToState = (task: TaskWithSubtasks, category: ViewCategory) => {
    const tasks = getTasksState(category)
    setTasksState(category, [...tasks, task])
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingTask(null)
  }

  // Optimistic: handle task creation/edit from modal
  const handleSuccess = (task?: Task & { project?: Project | null }) => {
    if (task) {
      const existingCategory = findTaskCategory(task.id)
      // Add empty subtasks array for new tasks from modal
      const taskWithSubtasks: TaskWithSubtasks = { ...task, subtasks: [] }

      if (existingCategory) {
        // Task was edited
        if (existingCategory === task.view_category) {
          // Same category - just update in place
          updateTaskInState(task.id, task)
        } else {
          // Category changed - move to new category (preserve existing subtasks)
          const existingTask = removeTaskFromState(task.id)
          addTaskToState({ ...taskWithSubtasks, subtasks: existingTask?.subtasks || [] }, task.view_category)
        }
      } else {
        // New task - add to appropriate category
        addTaskToState(taskWithSubtasks, task.view_category)

        // Walkthrough: track tutorial task and advance
        if (walkthrough.isActive && walkthrough.currentStep === 'fill-task-form') {
          walkthrough.setTutorialTaskId(task.id)
          walkthrough.advanceStep('task-created')
        }
      }

      // Update counts optimistically
      if (!existingCategory) {
        setTaskCounts(prev => ({ ...prev, total: prev.total + 1 }))
      }
    } else {
      // Fallback: reload if no task data returned
      loadData()
    }
  }

  // Handle subtask updates (reload to get fresh data)
  const handleSubtaskUpdate = useCallback(() => {
    // Reload data to reflect subtask changes
    loadData()
  }, [loadData])

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
    const oldStatus = [...dailyTasks, ...weeklyTasks, ...monthlyTasks].find(t => t.id === taskId)?.status

    // Optimistic update
    updateTaskInState(taskId, { status: newStatus as Task['status'] })

    // Update counts optimistically
    if (newStatus === 'completed' && oldStatus !== 'completed') {
      setTaskCounts(prev => ({ ...prev, completed: prev.completed + 1 }))
    } else if (newStatus !== 'completed' && oldStatus === 'completed') {
      setTaskCounts(prev => ({ ...prev, completed: Math.max(0, prev.completed - 1) }))
    }

    // Fire server call in background
    updateTask(taskId, { status: newStatus as Task['status'] }).then(({ error }) => {
      if (error) {
        toast.error('Failed to update task')
        loadData() // Reload to restore correct state
      } else {
        toast.success(newStatus === 'completed' ? 'Task completed!' : 'Task reopened')
      }
    })
  }

  // Optimistic delete
  const handleDelete = (taskId: string) => {
    const removedTask = removeTaskFromState(taskId)

    if (removedTask) {
      // Update counts optimistically
      setTaskCounts(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        completed: removedTask.status === 'completed' ? Math.max(0, prev.completed - 1) : prev.completed,
      }))
    }

    // Fire server call in background
    deleteTask(taskId).then(({ error }) => {
      if (error) {
        toast.error('Failed to delete task')
        loadData() // Reload to restore correct state
      } else {
        toast.success('Task deleted')
      }
    })
  }

  // Optimistic archive
  const handleArchive = (taskId: string) => {
    const removedTask = removeTaskFromState(taskId)

    if (removedTask) {
      // Update counts optimistically (archived tasks are excluded from counts)
      setTaskCounts(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        completed: removedTask.status === 'completed' ? Math.max(0, prev.completed - 1) : prev.completed,
      }))
    }

    // Fire server call in background
    archiveTask(taskId).then(({ error }) => {
      if (error) {
        toast.error('Failed to archive task')
        loadData() // Reload to restore correct state
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

    const categoryLabel = categories.find(c => c.id === targetCategoryId)?.label

    // Optimistic update: move task between categories
    const sourceCategory = draggedTask.view_category
    const sourceTasks = getTasksState(sourceCategory)
    const targetTasks = getTasksState(targetCategoryId)

    // Remove from source
    setTasksState(sourceCategory, sourceTasks.filter(t => t.id !== draggedTask.id))

    // Add to target with updated category
    const updatedTask = { ...draggedTask, view_category: targetCategoryId }
    setTasksState(targetCategoryId, [...targetTasks, updatedTask])

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
        loadData() // Reload to restore correct state
      }
    })
  }

  const filteredDaily = filterTasks(dailyTasks)
  const filteredWeekly = filterTasks(weeklyTasks)
  const filteredMonthly = filterTasks(monthlyTasks)

  const getTasksForCategory = (categoryId: ViewCategory) => {
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
        <div id="tour-task-columns" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <DroppableSection
              key={category.id}
              category={category}
              tasks={getTasksForCategory(category.id)}
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
