-- Sprint 4: In-App Notifications Migration
-- Run this in Supabase SQL Editor

-- 1. Create user_notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_signals', 'classification_complete', 'enrichment_complete', 'job_sync'
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB, -- { signalCount: 5, companyName: "Acme" }
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for efficient unread queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON user_notifications(user_id, is_read)
WHERE is_read = FALSE;

-- 3. Create index for user's notifications ordered by date
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON user_notifications(user_id, created_at DESC);

-- 4. Enable RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications" ON user_notifications
  FOR INSERT WITH CHECK (true);

-- 6. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;

-- 7. Add notification_sound_enabled to user_settings (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'notification_sound_enabled'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN notification_sound_enabled BOOLEAN DEFAULT TRUE;
  END IF;
END $$;
