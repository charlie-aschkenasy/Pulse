-- Add subtasks table for task checklists

CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  sort_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient task_id lookups
CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);

-- Create index for user_id lookups
CREATE INDEX idx_subtasks_user_id ON subtasks(user_id);

-- Enable Row Level Security
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own subtasks
CREATE POLICY "Users can view their own subtasks"
  ON subtasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subtasks"
  ON subtasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subtasks"
  ON subtasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subtasks"
  ON subtasks FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE subtasks IS 'Subtasks/checklist items for tasks';
COMMENT ON COLUMN subtasks.task_id IS 'Reference to the parent task';
COMMENT ON COLUMN subtasks.title IS 'The subtask text/title';
COMMENT ON COLUMN subtasks.is_completed IS 'Whether the subtask is checked off';
COMMENT ON COLUMN subtasks.sort_index IS 'Order of subtasks within a task';

-- Add auto_complete_subtasks column to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS auto_complete_subtasks BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tasks.auto_complete_subtasks IS 'When true, completing all subtasks auto-completes the parent task';
