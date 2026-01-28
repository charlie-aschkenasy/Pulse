'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import {
  Bell,
  Plus,
  Trash2,
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  Settings,
  Smartphone,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getReminders,
  createReminder,
  deleteReminder,
  checkUserNotificationSetup,
} from '@/app/actions/reminders'
import type { TaskReminder, ReminderType, BeforeDueInterval, NotificationType } from '@/types/database'

interface TaskRemindersProps {
  taskId: string
  taskDueDate: string | null
}

const beforeDueOptions = [
  { value: '15_minutes', label: '15 minutes before' },
  { value: '30_minutes', label: '30 minutes before' },
  { value: '1_hour', label: '1 hour before' },
  { value: '2_hours', label: '2 hours before' },
  { value: '1_day', label: '1 day before' },
] as const

export function TaskReminders({ taskId, taskDueDate }: TaskRemindersProps) {
  const [reminders, setReminders] = useState<TaskReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notificationSetup, setNotificationSetup] = useState<{
    hasPhoneNumber: boolean
    smsEnabled: boolean
    phoneVerified: boolean
    pushEnabled: boolean
    hasPushSubscription: boolean
  } | null>(null)

  // Form state for new reminder
  const [reminderType, setReminderType] = useState<ReminderType>('specific_time')
  const [notificationType, setNotificationType] = useState<NotificationType>('push')
  const [beforeDueInterval, setBeforeDueInterval] = useState<BeforeDueInterval>('1_hour')
  const [specificDate, setSpecificDate] = useState<Date | undefined>()
  const [specificTime, setSpecificTime] = useState('09:00')

  // Load reminders and notification setup
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const [remindersResult, setupResult] = await Promise.all([
        getReminders(taskId),
        checkUserNotificationSetup(),
      ])

      if (remindersResult.data) {
        setReminders(remindersResult.data)
      }
      if (setupResult.data) {
        setNotificationSetup(setupResult.data)
        // Default to push if available, otherwise sms
        if (setupResult.data.hasPushSubscription) {
          setNotificationType('push')
        } else if (setupResult.data.smsEnabled) {
          setNotificationType('sms')
        }
      }
      setIsLoading(false)
    }
    load()
  }, [taskId])

  const handleAddReminder = async () => {
    setIsAdding(true)

    let remindAt: string | null = null
    if (reminderType === 'specific_time' && specificDate) {
      const [hours, minutes] = specificTime.split(':')
      const dateTime = new Date(specificDate)
      dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      remindAt = dateTime.toISOString()
    }

    const { data, error } = await createReminder({
      task_id: taskId,
      reminder_type: reminderType,
      remind_at: remindAt,
      before_due_interval: reminderType === 'before_due' ? beforeDueInterval : null,
      notification_type: notificationType,
    })

    if (error) {
      toast.error(error)
    } else if (data) {
      setReminders((prev) => [...prev, data])
      toast.success('Reminder added')
      // Reset form
      setSpecificDate(undefined)
      setSpecificTime('09:00')
    }
    setIsAdding(false)
  }

  const handleDeleteReminder = async (id: string) => {
    setDeletingId(id)
    const { error } = await deleteReminder(id)
    if (error) {
      toast.error('Failed to delete reminder')
    } else {
      setReminders((prev) => prev.filter((r) => r.id !== id))
      toast.success('Reminder removed')
    }
    setDeletingId(null)
  }

  const formatReminderDisplay = (reminder: TaskReminder) => {
    if (reminder.reminder_type === 'specific_time' && reminder.remind_at) {
      return format(new Date(reminder.remind_at), "MMM d 'at' h:mm a")
    }
    if (reminder.reminder_type === 'before_due' && reminder.before_due_interval) {
      const option = beforeDueOptions.find((o) => o.value === reminder.before_due_interval)
      return option?.label || reminder.before_due_interval
    }
    return 'Unknown'
  }

  const canUsePush = notificationSetup?.hasPushSubscription
  const canUseSms = notificationSetup?.smsEnabled && notificationSetup?.hasPhoneNumber
  const hasAnyNotificationMethod = canUsePush || canUseSms

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show setup message if no notification method configured
  if (!hasAnyNotificationMethod) {
    return (
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
        <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Notifications not set up</p>
          <p className="text-xs text-muted-foreground">
            Enable push notifications or configure SMS in settings to use reminders.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Existing reminders */}
      {reminders.length > 0 && (
        <div className="space-y-2">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className={cn(
                'flex items-center justify-between p-2 rounded-md border',
                reminder.is_sent && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-2">
                {reminder.notification_type === 'sms' ? (
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Bell className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {formatReminderDisplay(reminder)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({reminder.notification_type === 'sms' ? 'SMS' : 'Push'})
                </span>
                {reminder.is_sent && (
                  <span className="text-xs text-muted-foreground">(Sent)</span>
                )}
              </div>
              {!reminder.is_sent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDeleteReminder(reminder.id)}
                  disabled={deletingId === reminder.id}
                >
                  {deletingId === reminder.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new reminder form */}
      <div className="space-y-4 pt-3 border-t">
        {/* Notification type selector */}
        {canUsePush && canUseSms && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">Notify via:</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={notificationType === 'push' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setNotificationType('push')}
              >
                <Bell className="mr-1 h-3 w-3" />
                Push
              </Button>
              <Button
                type="button"
                variant={notificationType === 'sms' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setNotificationType('sms')}
              >
                <MessageSquare className="mr-1 h-3 w-3" />
                SMS
              </Button>
            </div>
          </div>
        )}

        {/* Show which method will be used if only one is available */}
        {!canUsePush && canUseSms && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>Reminders will be sent via SMS</span>
          </div>
        )}
        {canUsePush && !canUseSms && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bell className="h-3 w-3" />
            <span>Reminders will be sent via push notification</span>
          </div>
        )}

        {/* Reminder type radio buttons */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="reminderType"
              value="specific_time"
              checked={reminderType === 'specific_time'}
              onChange={() => setReminderType('specific_time')}
              className="h-4 w-4 text-primary"
            />
            <span className="text-sm">At specific time</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="reminderType"
              value="before_due"
              checked={reminderType === 'before_due'}
              onChange={() => setReminderType('before_due')}
              className="h-4 w-4 text-primary"
              disabled={!taskDueDate}
            />
            <span className={cn("text-sm", !taskDueDate && "text-muted-foreground")}>
              Before due date
            </span>
          </label>
        </div>

        {/* Reminder options based on type */}
        <div className="space-y-3">
          {reminderType === 'specific_time' ? (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {specificDate ? format(specificDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={specificDate}
                    onSelect={setSpecificDate}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="time"
                  value={specificTime}
                  onChange={(e) => setSpecificTime(e.target.value)}
                  className="h-8 w-28"
                />
              </div>
            </div>
          ) : (
            <Select
              value={beforeDueInterval}
              onValueChange={(v) => setBeforeDueInterval(v as BeforeDueInterval)}
              disabled={!taskDueDate}
            >
              <SelectTrigger className="w-full h-8">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                {beforeDueOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {reminderType === 'before_due' && !taskDueDate && (
            <p className="text-xs text-muted-foreground">
              Set a due date for this task to add before-due reminders.
            </p>
          )}
        </div>

        {/* Save button */}
        <Button
          size="sm"
          className="w-full h-8"
          onClick={handleAddReminder}
          disabled={
            isAdding ||
            (reminderType === 'before_due' && !taskDueDate) ||
            (reminderType === 'specific_time' && !specificDate)
          }
        >
          {isAdding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Set Reminder
        </Button>
      </div>
    </div>
  )
}
