-- Add 2_hours option to before_due_interval check constraint

-- Drop the existing constraint
ALTER TABLE task_reminders DROP CONSTRAINT IF EXISTS task_reminders_before_due_interval_check;

-- Add the new constraint with 2_hours option
ALTER TABLE task_reminders ADD CONSTRAINT task_reminders_before_due_interval_check
  CHECK (before_due_interval IN ('15_minutes', '30_minutes', '1_hour', '2_hours', '1_day'));
