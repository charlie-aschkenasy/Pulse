'use client'

import useSWR, { mutate } from 'swr'
import { getTaskCounts } from '@/app/actions/tasks'

export type TaskCounts = {
  total: number
  completed: number
  overdue: number
  dueToday: number
}

// Cache key
export const TASK_COUNTS_KEY = 'task-counts'

// Hook for task counts
export function useTaskCounts() {
  const { data, error, isLoading, mutate: boundMutate } = useSWR(
    TASK_COUNTS_KEY,
    async () => {
      const result = await getTaskCounts()
      if (result.error) throw new Error(result.error)
      return result.data as TaskCounts
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    counts: data ?? { total: 0, completed: 0, overdue: 0, dueToday: 0 },
    error,
    isLoading,
    mutate: boundMutate,
  }
}

// Utility to invalidate task counts
export function invalidateTaskCounts() {
  mutate(TASK_COUNTS_KEY)
}
