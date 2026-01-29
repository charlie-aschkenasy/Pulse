'use client'

import useSWR, { mutate } from 'swr'
import { getTasksWithSubtasksByViewCategory, getTasksForCoveyMatrix, getTasksWithSubtasksByProject } from '@/app/actions/tasks'
import type { ViewCategory, Task, Project, Subtask } from '@/types/database'

export type TaskWithSubtasks = Task & { project?: Project | null; subtasks: Subtask[] }
export type TaskWithProject = Task & { project?: Project | null }

// Cache keys
export const TASKS_KEYS = {
  byViewCategory: (category: ViewCategory) => `tasks-${category}`,
  forMatrix: 'tasks-matrix',
  byProject: (projectId: string) => `tasks-project-${projectId}`,
}

// Hook for tasks by view category (dashboard)
export function useTasksByViewCategory(category: ViewCategory) {
  const { data, error, isLoading, mutate: boundMutate } = useSWR(
    TASKS_KEYS.byViewCategory(category),
    async () => {
      const result = await getTasksWithSubtasksByViewCategory(category)
      if (result.error) throw new Error(result.error)
      return result.data as TaskWithSubtasks[]
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    tasks: data ?? [],
    error,
    isLoading,
    mutate: boundMutate,
  }
}

// Hook for Covey matrix tasks
export function useMatrixTasks() {
  const { data, error, isLoading, mutate: boundMutate } = useSWR(
    TASKS_KEYS.forMatrix,
    async () => {
      const result = await getTasksForCoveyMatrix()
      if (result.error) throw new Error(result.error)
      return result.data as TaskWithProject[]
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    tasks: data ?? [],
    error,
    isLoading,
    mutate: boundMutate,
  }
}

// Hook for tasks by project
export function useTasksByProject(projectId: string) {
  const { data, error, isLoading, mutate: boundMutate } = useSWR(
    projectId ? TASKS_KEYS.byProject(projectId) : null,
    async () => {
      const result = await getTasksWithSubtasksByProject(projectId)
      if (result.error) throw new Error(result.error)
      return result.data as TaskWithSubtasks[]
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    tasks: data ?? [],
    error,
    isLoading,
    mutate: boundMutate,
  }
}

// Utility to invalidate all task-related caches
export function invalidateAllTasks() {
  mutate((key) => typeof key === 'string' && key.startsWith('tasks-'), undefined, { revalidate: true })
}

// Utility to invalidate specific view category
export function invalidateTasksByCategory(category: ViewCategory) {
  mutate(TASKS_KEYS.byViewCategory(category))
}

// Utility to invalidate matrix tasks
export function invalidateMatrixTasks() {
  mutate(TASKS_KEYS.forMatrix)
}
