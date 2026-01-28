'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ReminderType, BeforeDueInterval, NotificationType, TaskReminderInsert } from '@/types/database'

export async function getReminders(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('task_reminders')
    .select('*')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function createReminder(data: {
  task_id: string
  reminder_type: ReminderType
  remind_at?: string | null
  before_due_interval?: BeforeDueInterval | null
  notification_type?: NotificationType
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const notificationType = data.notification_type || 'push'

  // Validate based on notification type
  const { data: profile } = await supabase
    .from('profiles')
    .select('sms_reminders_enabled, phone_number, push_enabled')
    .eq('user_id', user.id)
    .single()

  if (notificationType === 'sms') {
    if (!profile?.sms_reminders_enabled || !profile?.phone_number) {
      return { error: 'SMS reminders not set up. Please configure in Settings.', data: null }
    }
  } else if (notificationType === 'push') {
    // Check if user has push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    if (!subscriptions || subscriptions.length === 0) {
      return { error: 'Push notifications not set up. Please enable in Settings.', data: null }
    }
  }

  const insertData: TaskReminderInsert = {
    task_id: data.task_id,
    user_id: user.id,
    reminder_type: data.reminder_type,
    remind_at: data.remind_at || null,
    before_due_interval: data.before_due_interval || null,
    notification_type: notificationType,
  }

  const { data: reminder, error } = await supabase
    .from('task_reminders')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath(`/tasks/${data.task_id}`)
  return { data: reminder, error: null }
}

export async function deleteReminder(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get task_id before deleting for revalidation
  const { data: reminder } = await supabase
    .from('task_reminders')
    .select('task_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('task_reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  if (reminder) {
    revalidatePath(`/tasks/${reminder.task_id}`)
  }
  return { error: null }
}

export async function checkUserSmsSetup() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('phone_number, sms_reminders_enabled, phone_verified')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return {
    data: {
      hasPhoneNumber: !!profile?.phone_number,
      smsEnabled: !!profile?.sms_reminders_enabled,
      phoneVerified: !!profile?.phone_verified,
    },
    error: null,
  }
}

export async function checkUserNotificationSetup() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_number, sms_reminders_enabled, phone_verified, push_enabled')
    .eq('user_id', user.id)
    .single()

  const { data: pushSubscriptions } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)

  return {
    data: {
      // SMS setup
      hasPhoneNumber: !!profile?.phone_number,
      smsEnabled: !!profile?.sms_reminders_enabled,
      phoneVerified: !!profile?.phone_verified,
      // Push setup
      pushEnabled: !!profile?.push_enabled,
      hasPushSubscription: (pushSubscriptions?.length ?? 0) > 0,
    },
    error: null,
  }
}
