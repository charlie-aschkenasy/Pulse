export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'archived'
export type TaskPriority = 'high' | 'medium' | 'low'
export type ViewCategory = 'daily' | 'weekly' | 'monthly'
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export type RecurrenceDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type ReminderType = 'specific_time' | 'before_due'
export type BeforeDueInterval = '15_minutes' | '30_minutes' | '1_hour' | '2_hours' | '1_day'
export type NotificationType = 'sms' | 'push'

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          timezone: string
          phone_number: string | null
          sms_reminders_enabled: boolean
          phone_verified: boolean
          push_enabled: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          timezone?: string
          phone_number?: string | null
          sms_reminders_enabled?: boolean
          phone_verified?: boolean
          push_enabled?: boolean
          created_at?: string
        }
        Update: {
          user_id?: string
          timezone?: string
          phone_number?: string | null
          sms_reminders_enabled?: boolean
          phone_verified?: boolean
          push_enabled?: boolean
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          sort_index: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          sort_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          sort_index?: number
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          title: string
          due_date: string | null
          duration_minutes: number | null
          priority: TaskPriority
          status: TaskStatus
          urgent: boolean
          important: boolean
          covey_sort_index: number
          list_sort_index: number
          editor_json: Json
          view_category: ViewCategory
          created_at: string
          updated_at: string
          is_recurring: boolean
          recurrence_type: RecurrenceType | null
          recurrence_interval: number
          recurrence_days: RecurrenceDay[]
          recurrence_end_date: string | null
          parent_task_id: string | null
          is_skipped: boolean
          auto_complete_subtasks: boolean
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          title: string
          due_date?: string | null
          duration_minutes?: number | null
          priority?: TaskPriority
          status?: TaskStatus
          urgent?: boolean
          important?: boolean
          covey_sort_index?: number
          list_sort_index?: number
          editor_json?: Json
          view_category?: ViewCategory
          created_at?: string
          updated_at?: string
          is_recurring?: boolean
          recurrence_type?: RecurrenceType | null
          recurrence_interval?: number
          recurrence_days?: RecurrenceDay[]
          recurrence_end_date?: string | null
          parent_task_id?: string | null
          is_skipped?: boolean
          auto_complete_subtasks?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          title?: string
          due_date?: string | null
          duration_minutes?: number | null
          priority?: TaskPriority
          status?: TaskStatus
          urgent?: boolean
          important?: boolean
          covey_sort_index?: number
          list_sort_index?: number
          editor_json?: Json
          view_category?: ViewCategory
          created_at?: string
          updated_at?: string
          is_recurring?: boolean
          recurrence_type?: RecurrenceType | null
          recurrence_interval?: number
          recurrence_days?: RecurrenceDay[]
          recurrence_end_date?: string | null
          parent_task_id?: string | null
          is_skipped?: boolean
          auto_complete_subtasks?: boolean
        }
      }
      subtasks: {
        Row: {
          id: string
          task_id: string
          user_id: string
          title: string
          is_completed: boolean
          sort_index: number
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          title: string
          is_completed?: boolean
          sort_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          title?: string
          is_completed?: boolean
          sort_index?: number
          created_at?: string
        }
      }
      task_events: {
        Row: {
          id: string
          user_id: string
          task_id: string
          provider: string
          external_id: string
          last_synced_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_id: string
          provider: string
          external_id: string
          last_synced_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string
          provider?: string
          external_id?: string
          last_synced_at?: string
        }
      }
      task_reminders: {
        Row: {
          id: string
          task_id: string
          user_id: string
          reminder_type: ReminderType
          remind_at: string | null
          before_due_interval: BeforeDueInterval | null
          notification_type: NotificationType
          is_sent: boolean
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          reminder_type: ReminderType
          remind_at?: string | null
          before_due_interval?: BeforeDueInterval | null
          notification_type?: NotificationType
          is_sent?: boolean
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          reminder_type?: ReminderType
          remind_at?: string | null
          before_due_interval?: BeforeDueInterval | null
          notification_type?: NotificationType
          is_sent?: boolean
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: {
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
        }
        Update: {
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      task_status: TaskStatus
      task_priority: TaskPriority
      view_category: ViewCategory
      recurrence_type: RecurrenceType
      recurrence_day: RecurrenceDay
      reminder_type: ReminderType
      before_due_interval: BeforeDueInterval
      notification_type: NotificationType
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskEvent = Database['public']['Tables']['task_events']['Row']
export type Subtask = Database['public']['Tables']['subtasks']['Row']

export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']
export type SubtaskInsert = Database['public']['Tables']['subtasks']['Insert']
export type SubtaskUpdate = Database['public']['Tables']['subtasks']['Update']
export type TaskReminder = Database['public']['Tables']['task_reminders']['Row']
export type TaskReminderInsert = Database['public']['Tables']['task_reminders']['Insert']
export type TaskReminderUpdate = Database['public']['Tables']['task_reminders']['Update']
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row']
export type PushSubscriptionInsert = Database['public']['Tables']['push_subscriptions']['Insert']

// Extended types with relations
export interface TaskWithProject extends Task {
  project: Project | null
}

export interface TaskWithSubtasks extends Task {
  project: Project | null
  subtasks: Subtask[]
}

export interface ProjectWithTasks extends Project {
  tasks: Task[]
}
