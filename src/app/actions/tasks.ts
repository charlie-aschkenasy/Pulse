'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TaskInsert, TaskUpdate, Task, ViewCategory, RecurrenceType, RecurrenceDay } from '@/types/database'
import { addDays, addWeeks, addMonths, addYears, getDay, nextDay } from 'date-fns'
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

export async function getTasksWithSubtasksByViewCategory(viewCategory: ViewCategory) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Get tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .eq('view_category', viewCategory)
    .neq('status', 'archived')
    .order('list_sort_index', { ascending: true })

  if (tasksError) {
    return { error: tasksError.message, data: null }
  }

  if (!tasks || tasks.length === 0) {
    return { data: [], error: null }
  }

  // Get subtasks for all tasks
  const taskIds = tasks.map(t => t.id)
  const { data: subtasks, error: subtasksError } = await supabase
    .from('subtasks')
    .select('*')
    .eq('user_id', user.id)
    .in('task_id', taskIds)
    .order('sort_index', { ascending: true })

  if (subtasksError) {
    return { error: subtasksError.message, data: null }
  }

  // Group subtasks by task_id
  const subtasksByTaskId: Record<string, typeof subtasks> = {}
  for (const subtask of subtasks || []) {
    if (!subtasksByTaskId[subtask.task_id]) {
      subtasksByTaskId[subtask.task_id] = []
    }
    subtasksByTaskId[subtask.task_id].push(subtask)
  }

  // Merge subtasks into tasks
  const tasksWithSubtasks = tasks.map(task => ({
    ...task,
    subtasks: subtasksByTaskId[task.id] || [],
  }))

  return { data: tasksWithSubtasks, error: null }
}

export async function getTasksWithSubtasksByProject(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Get tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .neq('status', 'archived')
    .neq('status', 'completed')
    .order('list_sort_index', { ascending: true })

  if (tasksError) {
    return { error: tasksError.message, data: null }
  }

  if (!tasks || tasks.length === 0) {
    return { data: [], error: null }
  }

  // Get subtasks for all tasks
  const taskIds = tasks.map(t => t.id)
  const { data: subtasks, error: subtasksError } = await supabase
    .from('subtasks')
    .select('*')
    .eq('user_id', user.id)
    .in('task_id', taskIds)
    .order('sort_index', { ascending: true })

  if (subtasksError) {
    return { error: subtasksError.message, data: null }
  }

  // Group subtasks by task_id
  const subtasksByTaskId: Record<string, typeof subtasks> = {}
  for (const subtask of subtasks || []) {
    if (!subtasksByTaskId[subtask.task_id]) {
      subtasksByTaskId[subtask.task_id] = []
    }
    subtasksByTaskId[subtask.task_id].push(subtask)
  }

  // Merge subtasks into tasks
  const tasksWithSubtasks = tasks.map(task => ({
    ...task,
    subtasks: subtasksByTaskId[task.id] || [],
  }))

  return { data: tasksWithSubtasks, error: null }
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

export async function searchTasks(
  query: string,
  filters?: {
    status?: 'all' | 'open' | 'completed'
    projectId?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  if (!query || query.trim().length === 0) {
    return { data: [], error: null }
  }

  const searchQuery = query.trim()

  let dbQuery = supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .ilike('title', `%${searchQuery}%`)
    .order('updated_at', { ascending: false })
    .limit(20)

  // Apply status filter
  if (filters?.status === 'open') {
    dbQuery = dbQuery.in('status', ['open', 'in_progress', 'blocked'])
  } else if (filters?.status === 'completed') {
    dbQuery = dbQuery.eq('status', 'completed')
  }

  // Apply project filter
  if (filters?.projectId) {
    dbQuery = dbQuery.eq('project_id', filters.projectId)
  }

  const { data, error } = await dbQuery

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
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
  is_recurring?: boolean
  recurrence_type?: RecurrenceType | null
  recurrence_interval?: number
  recurrence_days?: RecurrenceDay[]
  recurrence_end_date?: string | null
  parent_task_id?: string | null
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
    is_recurring: data.is_recurring || false,
    recurrence_type: data.recurrence_type || null,
    recurrence_interval: data.recurrence_interval || 1,
    recurrence_days: data.recurrence_days || [],
    recurrence_end_date: data.recurrence_end_date || null,
    parent_task_id: data.parent_task_id || null,
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

// Helper: Map day name to date-fns day number (0 = Sunday, 1 = Monday, etc.)
const dayNameToNumber: Record<RecurrenceDay, Day> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

// Calculate the next due date based on recurrence rules
function calculateNextDueDate(
  currentDueDate: string,
  recurrenceType: RecurrenceType,
  recurrenceInterval: number,
  recurrenceDays: RecurrenceDay[]
): string {
  const current = new Date(currentDueDate + 'T00:00:00')
  let nextDate: Date

  switch (recurrenceType) {
    case 'daily':
      nextDate = addDays(current, recurrenceInterval)
      break

    case 'weekly':
      if (recurrenceDays && recurrenceDays.length > 0) {
        // Find the next day in the recurrence pattern
        const currentDayOfWeek = getDay(current) as Day
        const sortedDays = recurrenceDays
          .map(d => dayNameToNumber[d])
          .sort((a, b) => a - b)

        // Find next day after current day in this week
        let nextDayNum = sortedDays.find(d => d > currentDayOfWeek)

        if (nextDayNum !== undefined) {
          // Next day is later this week
          nextDate = nextDay(current, nextDayNum as Day)
        } else {
          // Next occurrence is next week on the first day of the pattern
          const daysUntilNextWeek = 7 - currentDayOfWeek + sortedDays[0]
          nextDate = addDays(current, daysUntilNextWeek + (recurrenceInterval - 1) * 7)
        }
      } else {
        nextDate = addWeeks(current, recurrenceInterval)
      }
      break

    case 'monthly':
      nextDate = addMonths(current, recurrenceInterval)
      break

    case 'yearly':
      nextDate = addYears(current, recurrenceInterval)
      break

    case 'custom':
      nextDate = addDays(current, recurrenceInterval)
      break

    default:
      nextDate = addDays(current, 1)
  }

  // Format as YYYY-MM-DD
  return nextDate.toISOString().split('T')[0]
}

// Complete a recurring task and create the next occurrence
export async function completeRecurringTask(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Get the task
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !task) {
    return { error: fetchError?.message || 'Task not found', data: null }
  }

  // Mark the current task as completed
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ status: 'completed' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message, data: null }
  }

  // If it's a recurring task, create the next occurrence
  if (task.is_recurring && task.recurrence_type && task.due_date) {
    const nextDueDate = calculateNextDueDate(
      task.due_date,
      task.recurrence_type as RecurrenceType,
      task.recurrence_interval || 1,
      (task.recurrence_days || []) as RecurrenceDay[]
    )

    // Check if we've passed the end date
    if (task.recurrence_end_date && nextDueDate > task.recurrence_end_date) {
      revalidatePath('/dashboard')
      revalidatePath('/projects')
      revalidatePath('/matrix')
      return { data: task, error: null, seriesEnded: true }
    }

    // Create the next occurrence
    const { data: newTask, error: createError } = await createTask({
      title: task.title,
      due_date: nextDueDate,
      priority: task.priority,
      project_id: task.project_id,
      status: 'open',
      urgent: task.urgent,
      important: task.important,
      view_category: task.view_category,
      is_recurring: true,
      recurrence_type: task.recurrence_type as RecurrenceType,
      recurrence_interval: task.recurrence_interval || 1,
      recurrence_days: (task.recurrence_days || []) as RecurrenceDay[],
      recurrence_end_date: task.recurrence_end_date,
      parent_task_id: task.parent_task_id || task.id, // Link to original or keep the chain
    })

    if (createError) {
      return { error: createError, data: null }
    }

    revalidatePath('/dashboard')
    revalidatePath('/projects')
    revalidatePath('/matrix')
    return { data: newTask, error: null, nextOccurrenceCreated: true }
  }

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  revalidatePath('/matrix')
  return { data: task, error: null }
}

// Skip a single occurrence of a recurring task
export async function skipTaskOccurrence(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Get the task
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !task) {
    return { error: fetchError?.message || 'Task not found', data: null }
  }

  // Mark the current task as skipped
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ is_skipped: true, status: 'archived' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message, data: null }
  }

  // If it's a recurring task, create the next occurrence
  if (task.is_recurring && task.recurrence_type && task.due_date) {
    const nextDueDate = calculateNextDueDate(
      task.due_date,
      task.recurrence_type as RecurrenceType,
      task.recurrence_interval || 1,
      (task.recurrence_days || []) as RecurrenceDay[]
    )

    // Check if we've passed the end date
    if (task.recurrence_end_date && nextDueDate > task.recurrence_end_date) {
      revalidatePath('/dashboard')
      revalidatePath('/projects')
      revalidatePath('/matrix')
      return { data: task, error: null, seriesEnded: true }
    }

    // Create the next occurrence
    const { data: newTask, error: createError } = await createTask({
      title: task.title,
      due_date: nextDueDate,
      priority: task.priority,
      project_id: task.project_id,
      status: 'open',
      urgent: task.urgent,
      important: task.important,
      view_category: task.view_category,
      is_recurring: true,
      recurrence_type: task.recurrence_type as RecurrenceType,
      recurrence_interval: task.recurrence_interval || 1,
      recurrence_days: (task.recurrence_days || []) as RecurrenceDay[],
      recurrence_end_date: task.recurrence_end_date,
      parent_task_id: task.parent_task_id || task.id,
    })

    if (createError) {
      return { error: createError, data: null }
    }

    revalidatePath('/dashboard')
    revalidatePath('/projects')
    revalidatePath('/matrix')
    return { data: newTask, error: null, skipped: true, nextOccurrenceCreated: true }
  }

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  revalidatePath('/matrix')
  return { data: task, error: null, skipped: true }
}
