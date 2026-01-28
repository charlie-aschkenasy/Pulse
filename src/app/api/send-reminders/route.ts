import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sendTaskReminderSms } from '@/lib/twilio'
import { sendTaskReminderPush } from '@/lib/web-push'
import { subMinutes, subHours, subDays, format } from 'date-fns'

// Lazy-initialize admin client to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return supabaseAdmin
}

interface ReminderResult {
  success: boolean
  error?: string
}

async function sendReminder(
  reminder: {
    id: string
    notification_type: string
    user_id: string
  },
  task: {
    id: string
    title: string
    due_date: string | null
  },
  profile: {
    phone_number: string | null
    sms_reminders_enabled: boolean
  },
  dueInfo: string
): Promise<ReminderResult> {
  if (reminder.notification_type === 'sms') {
    // SMS notification
    if (!profile?.sms_reminders_enabled || !profile?.phone_number) {
      return { success: false, error: 'SMS not enabled' }
    }
    return sendTaskReminderSms(profile.phone_number, task.title, dueInfo)
  } else {
    // Push notification
    const { data: subscriptions } = await getSupabaseAdmin()
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', reminder.user_id)

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, error: 'No push subscriptions' }
    }

    // Send to all user's devices
    let successCount = 0
    let lastError = ''

    for (const sub of subscriptions) {
      const result = await sendTaskReminderPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        task.title,
        task.id,
        dueInfo
      )
      if (result.success) {
        successCount++
      } else {
        lastError = result.error || 'Unknown error'
        // If subscription is invalid, remove it
        if (result.error?.includes('expired') || result.error?.includes('unsubscribed')) {
          await getSupabaseAdmin()
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }
      }
    }

    return successCount > 0
      ? { success: true }
      : { success: false, error: lastError }
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = {
    processed: 0,
    sent: 0,
    errors: 0,
    details: [] as string[],
  }

  try {
    // 1. Process specific_time reminders that are due
    const { data: specificTimeReminders, error: specificError } = await getSupabaseAdmin()
      .from('task_reminders')
      .select(`
        *,
        tasks!inner(id, title, due_date, user_id),
        profiles!inner(phone_number, sms_reminders_enabled, timezone)
      `)
      .eq('reminder_type', 'specific_time')
      .eq('is_sent', false)
      .lte('remind_at', now.toISOString())

    if (specificError) {
      console.error('Error fetching specific_time reminders:', specificError)
    }

    for (const reminder of specificTimeReminders || []) {
      results.processed++

      const profile = reminder.profiles
      const task = reminder.tasks
      const dueInfo = task.due_date
        ? `Due: ${format(new Date(task.due_date), 'MMM d')}`
        : ''

      const result = await sendReminder(
        { id: reminder.id, notification_type: reminder.notification_type || 'push', user_id: reminder.user_id },
        task,
        profile,
        dueInfo
      )

      if (result.success) {
        await getSupabaseAdmin()
          .from('task_reminders')
          .update({ is_sent: true, sent_at: now.toISOString() })
          .eq('id', reminder.id)
        results.sent++
        results.details.push(`Sent ${reminder.id} via ${reminder.notification_type || 'push'}`)
      } else {
        results.errors++
        results.details.push(`Failed ${reminder.id}: ${result.error}`)
      }
    }

    // 2. Process before_due reminders
    const { data: beforeDueReminders, error: beforeDueError } = await getSupabaseAdmin()
      .from('task_reminders')
      .select(`
        *,
        tasks!inner(id, title, due_date, user_id),
        profiles!inner(phone_number, sms_reminders_enabled, timezone)
      `)
      .eq('reminder_type', 'before_due')
      .eq('is_sent', false)

    if (beforeDueError) {
      console.error('Error fetching before_due reminders:', beforeDueError)
    }

    for (const reminder of beforeDueReminders || []) {
      const task = reminder.tasks
      if (!task?.due_date) continue

      results.processed++

      const profile = reminder.profiles

      // Calculate when this reminder should fire based on interval
      // due_date is stored as YYYY-MM-DD, assume start of day in UTC
      const dueDate = new Date(task.due_date + 'T09:00:00') // Default to 9 AM on due date
      let reminderTime: Date

      switch (reminder.before_due_interval) {
        case '15_minutes':
          reminderTime = subMinutes(dueDate, 15)
          break
        case '30_minutes':
          reminderTime = subMinutes(dueDate, 30)
          break
        case '1_hour':
          reminderTime = subHours(dueDate, 1)
          break
        case '2_hours':
          reminderTime = subHours(dueDate, 2)
          break
        case '1_day':
          reminderTime = subDays(dueDate, 1)
          break
        default:
          continue
      }

      // Check if it's time to send
      if (now < reminderTime) {
        continue // Not yet time
      }

      const intervalLabel = {
        '15_minutes': 'in 15 minutes',
        '30_minutes': 'in 30 minutes',
        '1_hour': 'in 1 hour',
        '2_hours': 'in 2 hours',
        '1_day': 'tomorrow',
      }[reminder.before_due_interval as string] || 'soon'

      const result = await sendReminder(
        { id: reminder.id, notification_type: reminder.notification_type || 'push', user_id: reminder.user_id },
        task,
        profile,
        `Due ${intervalLabel}`
      )

      if (result.success) {
        await getSupabaseAdmin()
          .from('task_reminders')
          .update({ is_sent: true, sent_at: now.toISOString() })
          .eq('id', reminder.id)
        results.sent++
        results.details.push(`Sent ${reminder.id} via ${reminder.notification_type || 'push'}`)
      } else {
        results.errors++
        results.details.push(`Failed ${reminder.id}: ${result.error}`)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
