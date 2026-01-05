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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          timezone: string
          created_at: string
        }
        Insert: {
          user_id: string
          timezone?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          timezone?: string
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      task_status: TaskStatus
      task_priority: TaskPriority
      view_category: ViewCategory
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskEvent = Database['public']['Tables']['task_events']['Row']

export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']

// Extended types with relations
export interface TaskWithProject extends Task {
  project: Project | null
}

export interface ProjectWithTasks extends Project {
  tasks: Task[]
}
