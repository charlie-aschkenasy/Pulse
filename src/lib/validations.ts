import { z } from 'zod'

// Duration parsing: accepts formats like "15m", "1h", "2h30m", "90"
export function parseDuration(input: string): number | null {
  if (!input || input.trim() === '') return null

  const trimmed = input.trim().toLowerCase()

  // Pure number (assumed to be minutes)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10)
  }

  // Match patterns like "1h", "30m", "1h30m", "2h 15m"
  let totalMinutes = 0
  const hoursMatch = trimmed.match(/(\d+)\s*h/)
  const minutesMatch = trimmed.match(/(\d+)\s*m/)

  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60
  }

  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10)
  }

  return totalMinutes > 0 ? totalMinutes : null
}

// Format duration for display
export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === 0) return ''

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export const taskStatusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const

export const taskPriorityOptions = [
  { value: 'high', label: 'High', color: 'bg-red-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-green-500' },
] as const

export const viewCategoryOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

export const recurrenceTypeOptions = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
] as const

export const recurrenceDayOptions = [
  { value: 'mon', label: 'Mon', fullLabel: 'Monday' },
  { value: 'tue', label: 'Tue', fullLabel: 'Tuesday' },
  { value: 'wed', label: 'Wed', fullLabel: 'Wednesday' },
  { value: 'thu', label: 'Thu', fullLabel: 'Thursday' },
  { value: 'fri', label: 'Fri', fullLabel: 'Friday' },
  { value: 'sat', label: 'Sat', fullLabel: 'Saturday' },
  { value: 'sun', label: 'Sun', fullLabel: 'Sunday' },
] as const

export const projectColors = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Yellow' },
  { value: '#EF4444', label: 'Red' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#F97316', label: 'Orange' },
  { value: '#6B7280', label: 'Gray' },
] as const

// Zod schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name is too long'),
  color: z.string().nullable().optional(),
})

export const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(500, 'Task title is too long'),
  due_date: z.string().nullable().optional(),
  duration: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  project_id: z.string().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'blocked', 'completed', 'archived']),
  urgent: z.boolean(),
  important: z.boolean(),
  view_category: z.enum(['daily', 'weekly', 'monthly']),
  is_recurring: z.boolean().optional(),
  recurrence_type: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']).nullable().optional(),
  recurrence_interval: z.number().min(1).optional(),
  recurrence_days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
  recurrence_end_date: z.string().nullable().optional(),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type ProjectFormData = z.infer<typeof projectSchema>
export type TaskFormData = z.infer<typeof taskSchema>

// Format recurrence for display
export function formatRecurrence(
  recurrenceType: string | null,
  recurrenceInterval: number,
  recurrenceDays: string[]
): string {
  if (!recurrenceType) return ''

  const interval = recurrenceInterval || 1
  const plural = interval > 1

  switch (recurrenceType) {
    case 'daily':
      return interval === 1 ? 'Daily' : `Every ${interval} days`
    case 'weekly':
      if (recurrenceDays && recurrenceDays.length > 0) {
        const dayLabels = recurrenceDays
          .map(d => recurrenceDayOptions.find(o => o.value === d)?.label || d)
          .join(', ')
        return interval === 1
          ? `Weekly on ${dayLabels}`
          : `Every ${interval} weeks on ${dayLabels}`
      }
      return interval === 1 ? 'Weekly' : `Every ${interval} weeks`
    case 'monthly':
      return interval === 1 ? 'Monthly' : `Every ${interval} months`
    case 'yearly':
      return interval === 1 ? 'Yearly' : `Every ${interval} years`
    case 'custom':
      return `Every ${interval} day${plural ? 's' : ''}`
    default:
      return ''
  }
}
