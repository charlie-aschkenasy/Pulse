'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TaskInsert, TaskUpdate, Task, ViewCategory } from '@/types/database'
import { parseDuration } from '@/lib/validations'

export async function getTasks(filters?: {
  status?: string[]
  projectId?: string
  showArchived?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  let query = supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true })
    .order('list_sort_index', { ascending: true })

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }

  if (!filters?.showArchived) {
    query = query.neq('status', 'archived')
  }

  if (filters?.projectId) {
    query = query.eq('project_id', filters.projectId)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getTasksByDateRange(startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .neq('status', 'archived')
    .order('due_date', { ascending: true })
    .order('list_sort_index', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getTasksByViewCategory(viewCategory: ViewCategory) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .eq('view_category', viewCategory)
    .neq('status', 'archived')
    .order('list_sort_index', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getOverdueTasks() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .lt('due_date', today)
    .neq('status', 'completed')
    .neq('status', 'archived')
    .order('due_date', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getTaskById(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getTasksForCoveyMatrix() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .neq('status', 'completed')
    .order('covey_sort_index', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getTasksByProject(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .neq('status', 'archived')
    .order('list_sort_index', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getTaskCounts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const today = new Date().toISOString().split('T')[0]

  const [
    { count: total },
    { count: completed },
    { count: overdue },
    { count: dueToday }
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'archived'),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed'),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lt('due_date', today)
      .neq('status', 'completed')
      .neq('status', 'archived'),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('due_date', today)
      .neq('status', 'completed')
      .neq('status', 'archived')
  ])

  return {
    data: {
      total: total || 0,
      completed: completed || 0,
      overdue: overdue || 0,
      dueToday: dueToday || 0,
    },
    error: null,
  }
}

export async function createTask(data: {
  title: string
  due_date?: string | null
  duration?: string
  priority: 'high' | 'medium' | 'low'
  project_id?: string | null
  status?: 'open' | 'in_progress' | 'blocked' | 'completed' | 'archived'
  urgent?: boolean
  important?: boolean
  view_category?: ViewCategory
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Get max list_sort_index
  const { data: maxTask } = await supabase
    .from('tasks')
    .select('list_sort_index')
    .eq('user_id', user.id)
    .order('list_sort_index', { ascending: false })
    .limit(1)
    .single()

  const listSortIndex = (maxTask?.list_sort_index ?? -1) + 1

  // Get max covey_sort_index for the quadrant
  const urgent = data.urgent ?? false
  const important = data.important ?? false

  const { data: maxCoveyTask } = await supabase
    .from('tasks')
    .select('covey_sort_index')
    .eq('user_id', user.id)
    .eq('urgent', urgent)
    .eq('important', important)
    .order('covey_sort_index', { ascending: false })
    .limit(1)
    .single()

  const coveySortIndex = (maxCoveyTask?.covey_sort_index ?? -1) + 1

  const insertData: TaskInsert = {
    user_id: user.id,
    title: data.title,
    due_date: data.due_date || null,
    duration_minutes: data.duration ? parseDuration(data.duration) : null,
    priority: data.priority,
    project_id: data.project_id || null,
    status: data.status || 'open',
    urgent,
    important,
    list_sort_index: listSortIndex,
    covey_sort_index: coveySortIndex,
    editor_json: {},
    view_category: data.view_category || 'daily',
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert(insertData)
    .select('*, project:projects(*)')
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  revalidatePath('/matrix')
  return { data: task, error: null }
}

export async function updateTask(id: string, data: Partial<TaskUpdate> & { duration?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const updateData: TaskUpdate = { ...data }

  // Handle duration string conversion
  if ('duration' in data) {
    updateData.duration_minutes = data.duration ? parseDuration(data.duration) : null
    delete (updateData as Record<string, unknown>).duration
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, project:projects(*)')
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  revalidatePath('/matrix')
  revalidatePath(`/tasks/${id}`)
  return { data: task, error: null }
}

export async function updateTaskEditorContent(id: string, editorJson: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .update({ editor_json: editorJson })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data: task, error: null }
}

export async function deleteTask(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  revalidatePath('/matrix')
  return { error: null }
}

export async function completeTask(id: string) {
  return updateTask(id, { status: 'completed' })
}

export async function archiveTask(id: string) {
  return updateTask(id, { status: 'archived' })
}

export async function reorderTasks(taskIds: string[], field: 'list_sort_index' | 'covey_sort_index' = 'list_sort_index') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const updates = taskIds.map((id, index) =>
    supabase
      .from('tasks')
      .update({ [field]: index })
      .eq('id', id)
      .eq('user_id', user.id)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)

  if (errors.length > 0) {
    return { error: 'Failed to reorder some tasks' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  revalidatePath('/matrix')
  return { error: null }
}

export async function moveTaskToProject(taskId: string, projectId: string | null) {
  return updateTask(taskId, { project_id: projectId })
}

export async function updateTaskQuadrant(taskId: string, urgent: boolean, important: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Get max covey_sort_index for the new quadrant
  const { data: maxCoveyTask } = await supabase
    .from('tasks')
    .select('covey_sort_index')
    .eq('user_id', user.id)
    .eq('urgent', urgent)
    .eq('important', important)
    .order('covey_sort_index', { ascending: false })
    .limit(1)
    .single()

  const coveySortIndex = (maxCoveyTask?.covey_sort_index ?? -1) + 1

  return updateTask(taskId, { urgent, important, covey_sort_index: coveySortIndex })
}
