-- Add view_category column to tasks table
-- This allows users to manually categorize tasks into Daily, Weekly, or Monthly sections

-- Add the view_category column with default value 'daily'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS view_category TEXT NOT NULL DEFAULT 'daily';

-- Add check constraint to ensure valid values
ALTER TABLE tasks ADD CONSTRAINT tasks_view_category_check
  CHECK (view_category IN ('daily', 'weekly', 'monthly'));

-- Make due_date optional (nullable) since categorization is now manual
ALTER TABLE tasks ALTER COLUMN due_date DROP NOT NULL;

-- Create index for filtering by view_category
CREATE INDEX IF NOT EXISTS idx_tasks_view_category ON tasks(user_id, view_category);
