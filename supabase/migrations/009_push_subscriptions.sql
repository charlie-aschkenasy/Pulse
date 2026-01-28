-- Push notification subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Add notification_type to task_reminders if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_reminders' AND column_name = 'notification_type'
  ) THEN
    ALTER TABLE task_reminders ADD COLUMN notification_type TEXT DEFAULT 'push';
    ALTER TABLE task_reminders ADD CONSTRAINT task_reminders_notification_type_check
      CHECK (notification_type IN ('sms', 'push'));
  END IF;
END $$;

-- Add push_enabled to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'push_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN push_enabled BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE push_subscriptions IS 'Web push notification subscription data';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Push service endpoint URL';
COMMENT ON COLUMN push_subscriptions.p256dh IS 'Client public key for encryption';
COMMENT ON COLUMN push_subscriptions.auth IS 'Authentication secret';
