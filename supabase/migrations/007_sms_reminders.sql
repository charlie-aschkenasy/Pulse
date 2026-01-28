-- SMS Reminders Feature Migration

-- Add SMS-related columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS sms_reminders_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN profiles.phone_number IS 'User phone number for SMS reminders (E.164 format)';
COMMENT ON COLUMN profiles.sms_reminders_enabled IS 'Whether SMS reminders are enabled for this user';
COMMENT ON COLUMN profiles.phone_verified IS 'Whether the phone number has been verified via test SMS';

-- Create task_reminders table
CREATE TABLE task_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('specific_time', 'before_due')),
  remind_at TIMESTAMPTZ, -- For specific_time type
  before_due_interval TEXT CHECK (before_due_interval IN ('15_minutes', '30_minutes', '1_hour', '1_day')), -- For before_due type
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_task_reminders_task_id ON task_reminders(task_id);
CREATE INDEX idx_task_reminders_user_id ON task_reminders(user_id);
CREATE INDEX idx_task_reminders_pending ON task_reminders(is_sent, remind_at) WHERE is_sent = FALSE;
CREATE INDEX idx_task_reminders_before_due ON task_reminders(is_sent, before_due_interval) WHERE is_sent = FALSE AND reminder_type = 'before_due';

-- Enable Row Level Security
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_reminders
CREATE POLICY "Users can view their own reminders"
  ON task_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminders"
  ON task_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
  ON task_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
  ON task_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE task_reminders IS 'SMS reminders for tasks';
COMMENT ON COLUMN task_reminders.reminder_type IS 'Type: specific_time (exact datetime) or before_due (relative to due date)';
COMMENT ON COLUMN task_reminders.remind_at IS 'Exact datetime to send reminder (for specific_time type)';
COMMENT ON COLUMN task_reminders.before_due_interval IS 'How long before due date to send reminder (for before_due type)';
COMMENT ON COLUMN task_reminders.is_sent IS 'Whether the SMS has been sent';
COMMENT ON COLUMN task_reminders.sent_at IS 'When the SMS was sent';
