'use client'

import { useState } from 'react'
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
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Plus, Zap, Calendar, Users, Trash2 } from 'lucide-react'
import { MatrixTaskCard } from '@/components/matrix/matrix-task-card'
import { TaskModal } from '@/components/tasks/task-modal'
import { updateTaskQuadrant, reorderTasks } from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { Task, Project } from '@/types/database'
import { useDroppable } from '@dnd-kit/core'
import { useMatrixTasks, TaskWithProject, invalidateMatrixTasks, invalidateAllTasks } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'

type Quadrant = {
  id: string
  title: string
  subtitle: string
  urgent: boolean
  important: boolean
  icon: React.ReactNode
  className: string
}

const quadrants: Quadrant[] = [
  {
    id: 'q1',
    title: 'DO FIRST',
    subtitle: 'Urgent & Important',
    urgent: true,
    important: true,
    icon: <Zap className="h-4 w-4" />,
    className: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900',
  },
  {
    id: 'q2',
    title: 'SCHEDULE',
    subtitle: 'Not Urgent & Important',
    urgent: false,
    important: true,
    icon: <Calendar className="h-4 w-4" />,
    className: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900',
  },
  {
    id: 'q3',
    title: 'DELEGATE',
    subtitle: 'Urgent & Not Important',
    urgent: true,
    important: false,
    icon: <Users className="h-4 w-4" />,
    className: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900',
  },
  {
    id: 'q4',
    title: 'ELIMINATE',
    subtitle: 'Not Urgent & Not Important',
    urgent: false,
    important: false,
    icon: <Trash2 className="h-4 w-4" />,
    className: 'bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-800',
  },
]

function QuadrantDropZone({
  quadrant,
  tasks,
  onAddTask,
  onEditTask,
}: {
  quadrant: Quadrant
  tasks: TaskWithProject[]
  onAddTask: (quadrant: Quadrant) => void
  onEditTask: (task: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: quadrant.id,
    data: { quadrant },
  })

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'flex flex-col h-full transition-all',
        quadrant.className,
        isOver && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {quadrant.icon}
            <div>
              <CardTitle className="text-sm font-bold">{quadrant.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{quadrant.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{tasks.length}</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onAddTask(quadrant)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-2 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 pb-2">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <MatrixTaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEditTask}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <p className="text-sm">No tasks</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => onAddTask(quadrant)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Task
                  </Button>
                </div>
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function MatrixContent() {
  const { tasks, isLoading, mutate: mutateTasks } = useMatrixTasks()
  const { projects } = useProjects()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultQuadrant, setDefaultQuadrant] = useState<{ urgent: boolean; important: boolean } | undefined>()
  const [activeTask, setActiveTask] = useState<TaskWithProject | null>(null)

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

  const getTasksForQuadrant = (urgent: boolean, important: boolean) => {
    return tasks
      .filter((t) => t.urgent === urgent && t.important === important)
      .sort((a, b) => a.covey_sort_index - b.covey_sort_index)
  }

  const handleAddTask = (quadrant: Quadrant) => {
    setEditingTask(null)
    setDefaultQuadrant({ urgent: quadrant.urgent, important: quadrant.important })
    setIsModalOpen(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setDefaultQuadrant(undefined)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingTask(null)
    setDefaultQuadrant(undefined)
  }

  const handleSuccess = () => {
    mutateTasks()
    invalidateAllTasks()
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = tasks.find((t) => t.id === active.id)
    if (task) {
      setActiveTask(task)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const draggedTask = tasks.find((t) => t.id === active.id)
    if (!draggedTask) return

    // Check if dropped on a quadrant
    const targetQuadrant = quadrants.find((q) => q.id === over.id)
    if (targetQuadrant) {
      // Move to different quadrant
      if (draggedTask.urgent !== targetQuadrant.urgent || draggedTask.important !== targetQuadrant.important) {
        // Optimistic update
        mutateTasks(
          tasks.map(t => t.id === draggedTask.id
            ? { ...t, urgent: targetQuadrant.urgent, important: targetQuadrant.important }
            : t
          ),
          { revalidate: false }
        )

        const { error } = await updateTaskQuadrant(
          draggedTask.id,
          targetQuadrant.urgent,
          targetQuadrant.important
        )
        if (error) {
          toast.error('Failed to move task')
          mutateTasks() // Revalidate to restore correct state
        } else {
          toast.success('Task moved!')
        }
      }
      return
    }

    // Check if reordering within same quadrant
    const overTask = tasks.find((t) => t.id === over.id)
    if (overTask && draggedTask.urgent === overTask.urgent && draggedTask.important === overTask.important) {
      const quadrantTasks = getTasksForQuadrant(draggedTask.urgent, draggedTask.important)
      const oldIndex = quadrantTasks.findIndex((t) => t.id === active.id)
      const newIndex = quadrantTasks.findIndex((t) => t.id === over.id)

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(quadrantTasks, oldIndex, newIndex)

        // Optimistic update
        const newTasks = tasks.map((t) => {
          const idx = newOrder.findIndex((nt) => nt.id === t.id)
          if (idx !== -1) {
            return { ...t, covey_sort_index: idx }
          }
          return t
        })
        mutateTasks(newTasks, { revalidate: false })

        const { error } = await reorderTasks(
          newOrder.map((t) => t.id),
          'covey_sort_index'
        )
        if (error) {
          toast.error('Failed to reorder tasks')
          mutateTasks() // Revalidate to restore correct state
        }
      }
    } else if (overTask) {
      // Move to different quadrant (dropped on a task in another quadrant)
      // Optimistic update
      mutateTasks(
        tasks.map(t => t.id === draggedTask.id
          ? { ...t, urgent: overTask.urgent, important: overTask.important }
          : t
        ),
        { revalidate: false }
      )

      const { error } = await updateTaskQuadrant(
        draggedTask.id,
        overTask.urgent,
        overTask.important
      )
      if (error) {
        toast.error('Failed to move task')
        mutateTasks() // Revalidate to restore correct state
      } else {
        toast.success('Task moved!')
      }
    }
  }

  if (isLoading) {
    return null
  }

  return (
    <div className="space-y-6 h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Covey Matrix</h1>
          <p className="text-muted-foreground">
            Prioritize your tasks by urgency and importance
          </p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100%-60px)]">
          {quadrants.map((quadrant) => (
            <QuadrantDropZone
              key={quadrant.id}
              quadrant={quadrant}
              tasks={getTasksForQuadrant(quadrant.urgent, quadrant.important)}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <MatrixTaskCard task={activeTask} onEdit={() => {}} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        task={editingTask}
        projects={projects}
        defaultQuadrant={defaultQuadrant}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
