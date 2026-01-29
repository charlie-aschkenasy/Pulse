'use client'

import useSWR, { mutate } from 'swr'
import { getProjects, getProjectsWithTaskCounts } from '@/app/actions/projects'
import type { Project } from '@/types/database'

export type ProjectWithCounts = Project & { total_tasks: number; completed_tasks: number }

// Cache keys
export const PROJECTS_KEYS = {
  all: 'projects',
  withCounts: 'projects-with-counts',
}

// Hook for basic projects list
export function useProjects() {
  const { data, error, isLoading, mutate: boundMutate } = useSWR(
    PROJECTS_KEYS.all,
    async () => {
      const result = await getProjects()
      if (result.error) throw new Error(result.error)
      return result.data as Project[]
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    projects: data ?? [],
    error,
    isLoading,
    mutate: boundMutate,
  }
}

// Hook for projects with task counts (for projects page)
export function useProjectsWithCounts() {
  const { data, error, isLoading, mutate: boundMutate } = useSWR(
    PROJECTS_KEYS.withCounts,
    async () => {
      const result = await getProjectsWithTaskCounts()
      if (result.error) throw new Error(result.error)
      return result.data as ProjectWithCounts[]
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    projects: data ?? [],
    error,
    isLoading,
    mutate: boundMutate,
  }
}

// Utility to invalidate all project caches
export function invalidateProjects() {
  mutate(PROJECTS_KEYS.all)
  mutate(PROJECTS_KEYS.withCounts)
}
