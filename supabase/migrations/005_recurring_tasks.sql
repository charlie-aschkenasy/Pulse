-- Add recurring task support to tasks table

-- Add recurrence columns to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_days TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN DEFAULT FALSE;

-- Create index for recurring tasks
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(user_id, is_recurring) WHERE is_recurring = TRUE;

-- Create index for parent task lookups
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tasks.is_recurring IS 'Whether this task repeats on a schedule';
COMMENT ON COLUMN tasks.recurrence_type IS 'Type of recurrence: daily, weekly, monthly, yearly, or custom';
COMMENT ON COLUMN tasks.recurrence_interval IS 'Interval for recurrence (e.g., every 2 weeks)';
COMMENT ON COLUMN tasks.recurrence_days IS 'For weekly recurrence: array of days like {mon, wed, fri}';
COMMENT ON COLUMN tasks.recurrence_end_date IS 'Optional end date for the recurrence series';
COMMENT ON COLUMN tasks.parent_task_id IS 'Reference to the original recurring task (for generated instances)';
COMMENT ON COLUMN tasks.is_skipped IS 'Whether this occurrence was skipped';
