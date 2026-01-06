'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SubtaskInsert, SubtaskUpdate } from '@/types/database'

export async function getSubtasks(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .order('sort_index', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getSubtaskCounts(taskIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  if (taskIds.length === 0) {
    return { data: {}, error: null }
  }

  const { data, error } = await supabase
    .from('subtasks')
    .select('task_id, is_completed')
    .eq('user_id', user.id)
    .in('task_id', taskIds)

  if (error) {
    return { error: error.message, data: null }
  }

  // Group by task_id and count completed/total
  const counts: Record<string, { completed: number; total: number }> = {}
  for (const subtask of data || []) {
    if (!counts[subtask.task_id]) {
      counts[subtask.task_id] = { completed: 0, total: 0 }
    }
    counts[subtask.task_id].total++
    if (subtask.is_completed) {
      counts[subtask.task_id].completed++
    }
  }

  return { data: counts, error: null }
}

export async function createSubtask(taskId: string, title: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Get max sort_index for this task
  const { data: maxSubtask } = await supabase
    .from('subtasks')
    .select('sort_index')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .order('sort_index', { ascending: false })
    .limit(1)
    .single()

  const sortIndex = (maxSubtask?.sort_index ?? -1) + 1

  const insertData: SubtaskInsert = {
    task_id: taskId,
    user_id: user.id,
    title,
    sort_index: sortIndex,
  }

  const { data, error } = await supabase
    .from('subtasks')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath(`/tasks/${taskId}`)
  return { data, error: null }
}

export async function updateSubtask(
  id: string,
  updates: Partial<Pick<SubtaskUpdate, 'title' | 'is_completed' | 'sort_index'>>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('subtasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  // Check if we need to auto-complete the parent task
  if (updates.is_completed !== undefined && data) {
    await checkAutoCompleteTask(data.task_id)
  }

  return { data, error: null }
}

export async function deleteSubtask(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get task_id before deleting for revalidation
  const { data: subtask } = await supabase
    .from('subtasks')
    .select('task_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  if (subtask) {
    revalidatePath(`/tasks/${subtask.task_id}`)
  }
  return { error: null }
}

export async function reorderSubtasks(taskId: string, subtaskIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const updates = subtaskIds.map((id, index) =>
    supabase
      .from('subtasks')
      .update({ sort_index: index })
      .eq('id', id)
      .eq('user_id', user.id)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)

  if (errors.length > 0) {
    return { error: 'Failed to reorder some subtasks' }
  }

  revalidatePath(`/tasks/${taskId}`)
  return { error: null }
}

// Helper: Check if all subtasks are completed and auto-complete task if enabled
async function checkAutoCompleteTask(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  // Get the task to check if auto_complete_subtasks is enabled
  const { data: task } = await supabase
    .from('tasks')
    .select('auto_complete_subtasks, status')
    .eq('id', taskId)
    .eq('user_id', user.id)
    .single()

  if (!task?.auto_complete_subtasks || task.status === 'completed') return

  // Get all subtasks for this task
  const { data: subtasks } = await supabase
    .from('subtasks')
    .select('is_completed')
    .eq('task_id', taskId)
    .eq('user_id', user.id)

  if (!subtasks || subtasks.length === 0) return

  // Check if all are completed
  const allCompleted = subtasks.every((s) => s.is_completed)

  if (allCompleted) {
    await supabase
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', taskId)
      .eq('user_id', user.id)

    revalidatePath('/dashboard')
    revalidatePath('/projects')
    revalidatePath('/matrix')
  }
}
