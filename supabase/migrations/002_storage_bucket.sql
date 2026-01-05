-- Storage bucket for task attachments
-- Run this in your Supabase SQL Editor after enabling Storage

-- Create the bucket (if not exists - note: bucket creation is typically done via UI or API)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('task-attachments', 'task-attachments', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for task-attachments bucket
-- Users can only access their own folder (user_id/task_id/*)

-- Policy: Allow authenticated users to upload files to their own folder
DROP POLICY IF EXISTS "Users can upload own attachments" ON storage.objects;
CREATE POLICY "Users can upload own attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to view their own attachments
DROP POLICY IF EXISTS "Users can view own attachments" ON storage.objects;
CREATE POLICY "Users can view own attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to update their own attachments
DROP POLICY IF EXISTS "Users can update own attachments" ON storage.objects;
CREATE POLICY "Users can update own attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'task-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow users to delete their own attachments
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Note: You need to create the bucket manually in Supabase Dashboard:
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New Bucket"
-- 3. Name it "task-attachments"
-- 4. Keep it as a private bucket (not public)
