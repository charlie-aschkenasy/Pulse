'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Plus, FolderOpen } from 'lucide-react'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectModal } from '@/components/projects/project-modal'
import { TaskModal } from '@/components/tasks/task-modal'
import { getProjectsWithTaskCounts, reorderProjects } from '@/app/actions/projects'
import { getTasksByProject, moveTaskToProject } from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { Project, Task } from '@/types/database'

type ProjectWithCounts = Project & { total_tasks: number; completed_tasks: number }

export function ProjectsContent() {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([])
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [preselectedProjectId, setPreselectedProjectId] = useState<string | null>(null)

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

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data } = await getProjectsWithTaskCounts()
      if (data) {
        const projectsData = data as ProjectWithCounts[]
        setProjects(projectsData)

        // Load tasks for each project
        const tasksMap: Record<string, Task[]> = {}
        await Promise.all(
          projectsData.map(async (project: ProjectWithCounts) => {
            const { data: tasks } = await getTasksByProject(project.id)
            tasksMap[project.id] = (tasks || []) as Task[]
          })
        )
        setTasksByProject(tasksMap)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleProjectEdit = (project: Project) => {
    setEditingProject(project)
    setIsProjectModalOpen(true)
  }

  const handleProjectModalClose = () => {
    setIsProjectModalOpen(false)
    setEditingProject(null)
  }

  const handleAddTask = (projectId: string) => {
    setPreselectedProjectId(projectId)
    setEditingTask(null)
    setIsTaskModalOpen(true)
  }

  const handleTaskEdit = (task: Task) => {
    setEditingTask(task)
    setPreselectedProjectId(task.project_id)
    setIsTaskModalOpen(true)
  }

  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false)
    setEditingTask(null)
    setPreselectedProjectId(null)
  }

  const handleSuccess = () => {
    loadData()
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = projects.findIndex((p) => p.id === active.id)
      const newIndex = projects.findIndex((p) => p.id === over.id)

      const newProjects = arrayMove(projects, oldIndex, newIndex)
      setProjects(newProjects)

      const { error } = await reorderProjects(newProjects.map((p) => p.id))
      if (error) {
        toast.error('Failed to reorder projects')
        loadData()
      }
    }
  }

  if (isLoading) {
    return null // Loading state handled by Suspense
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Button onClick={() => setIsProjectModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <FolderOpen className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Create your first project to organize your tasks and boost productivity.
          </p>
          <Button onClick={() => setIsProjectModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </div>

        <ProjectModal
          open={isProjectModalOpen}
          onOpenChange={handleProjectModalClose}
          project={editingProject}
          onSuccess={handleSuccess}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setIsProjectModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={projects.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={tasksByProject[project.id] || []}
                onEdit={handleProjectEdit}
                onAddTask={handleAddTask}
                onEditTask={handleTaskEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ProjectModal
        open={isProjectModalOpen}
        onOpenChange={handleProjectModalClose}
        project={editingProject}
        onSuccess={handleSuccess}
      />

      <TaskModal
        open={isTaskModalOpen}
        onOpenChange={handleTaskModalClose}
        task={editingTask}
        projects={projects}
        onSuccess={handleSuccess}
        defaultQuadrant={preselectedProjectId ? undefined : undefined}
      />
    </div>
  )
}
