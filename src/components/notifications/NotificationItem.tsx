'use client';

import { Bell, Users, Briefcase, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/lib/notifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

function getIcon(type: NotificationType) {
  switch (type) {
    case 'new_signals':
      return <Bell className="h-4 w-4 text-[#635BFF]" />;
    case 'classification_complete':
      return <Users className="h-4 w-4 text-green-500" />;
    case 'enrichment_complete':
      return <Briefcase className="h-4 w-4 text-blue-500" />;
    case 'job_sync':
      return <RefreshCw className="h-4 w-4 text-amber-500" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-gray-50',
        !notification.is_read && 'bg-[#635BFF]/5'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm text-[#0A2540] truncate',
            !notification.is_read && 'font-medium'
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="flex-shrink-0 w-2 h-2 bg-[#635BFF] rounded-full mt-1.5" />
          )}
        </div>
        {notification.message && (
          <p className="text-xs text-[#6B7C93] mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
        <p className="text-xs text-[#6B7C93]/70 mt-1">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>
    </button>
  );
}
