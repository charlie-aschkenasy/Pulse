import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskDetailContent } from './task-detail-content'
import { getProjects } from '@/app/actions/projects'

interface TaskDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    notFound()
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !task) {
    notFound()
  }

  const { data: projects } = await getProjects()

  return (
    <TaskDetailContent
      task={task}
      projects={projects || []}
      userId={user.id}
    />
  )
}
