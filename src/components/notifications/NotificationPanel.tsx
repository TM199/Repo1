'use client';

import { motion } from 'framer-motion';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationItem } from './NotificationItem';
import { scaleIn } from '@/lib/animations';
import type { Notification } from '@/lib/notifications';

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export function NotificationPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationPanelProps) {
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-[#E3E8EE] overflow-hidden z-50"
      style={{ transformOrigin: 'top right' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E8EE]">
        <h3 className="text-sm font-semibold text-[#0A2540]">Notifications</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="h-7 px-2 text-xs text-[#635BFF] hover:text-[#635BFF] hover:bg-[#635BFF]/10"
          >
            <Check className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-8 w-8 text-[#E3E8EE] mb-2" />
            <p className="text-sm text-[#6B7C93]">No notifications yet</p>
            <p className="text-xs text-[#6B7C93]/70 mt-1">
              We&apos;ll notify you when something happens
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E3E8EE]">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
