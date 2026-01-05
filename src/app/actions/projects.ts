'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ProjectInsert, ProjectUpdate, Project } from '@/types/database'

export async function getProjects() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_index', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function getProjectsWithTaskCounts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_index', { ascending: true })

  if (projectsError) {
    return { error: projectsError.message, data: null }
  }

  // Get task counts for each project
  const projectList = (projects || []) as Project[]
  const projectsWithCounts = await Promise.all(
    projectList.map(async (project: Project) => {
      const { count: totalCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .neq('status', 'archived')

      const { count: completedCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('status', 'completed')

      return {
        ...project,
        total_tasks: totalCount || 0,
        completed_tasks: completedCount || 0,
      }
    })
  )

  return { data: projectsWithCounts, error: null }
}

export async function createProject(data: { name: string; color?: string | null }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Get max sort_index
  const { data: maxProjectData } = await supabase
    .from('projects')
    .select('sort_index')
    .eq('user_id', user.id)
    .order('sort_index', { ascending: false })
    .limit(1)
    .single()

  const maxProject = maxProjectData as { sort_index: number } | null
  const sortIndex = (maxProject?.sort_index ?? -1) + 1

  const insertData: ProjectInsert = {
    user_id: user.id,
    name: data.name,
    color: data.color || null,
    sort_index: sortIndex,
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { data: project, error: null }
}

export async function updateProject(id: string, data: ProjectUpdate) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data: project, error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { data: project, error: null }
}

export async function deleteProject(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { error: null }
}

export async function reorderProjects(projectIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Update each project's sort_index
  const updates = projectIds.map((id, index) =>
    supabase
      .from('projects')
      .update({ sort_index: index })
      .eq('id', id)
      .eq('user_id', user.id)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)

  if (errors.length > 0) {
    return { error: 'Failed to reorder some projects' }
  }

  revalidatePath('/projects')
  return { error: null }
}
