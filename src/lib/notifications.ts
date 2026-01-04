import { createClient } from '@/lib/supabase/client';

export type NotificationType =
  | 'new_signals'
  | 'classification_complete'
  | 'enrichment_complete'
  | 'job_sync';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Create a new notification for a user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message?: string,
  metadata?: Record<string, unknown>
): Promise<Notification | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message: message || null,
      metadata: metadata || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data;
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }

  return true;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }

  return true;
}

/**
 * Get count of unread notifications for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get recent notifications for a user
 */
export async function getNotifications(
  userId: string,
  limit: number = 10
): Promise<Notification[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
}
