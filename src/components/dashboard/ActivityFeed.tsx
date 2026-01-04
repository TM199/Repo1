'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Briefcase, Users, FileText, Building2, LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { slideDown } from '@/lib/animations';

interface Activity {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  created_at: string;
  icp_profile_id: string | null;
}

interface ActivityTypeConfig {
  icon: LucideIcon;
  colorClass: string;
}

const activityTypeConfig: Record<string, ActivityTypeConfig> = {
  signals_detected: { icon: Bell, colorClass: 'text-purple-500' },
  jobs_synced: { icon: Briefcase, colorClass: 'text-orange-500' },
  classification_complete: { icon: Users, colorClass: 'text-green-500' },
  contracts_synced: { icon: FileText, colorClass: 'text-blue-500' },
  ch_signals: { icon: Building2, colorClass: 'text-indigo-500' },
};

const defaultConfig: ActivityTypeConfig = { icon: Bell, colorClass: 'text-gray-500' };

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userIcpIds, setUserIcpIds] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();

    // Fetch user's ICP profile IDs first
    const fetchUserIcps = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return [];
      }

      const { data: icps } = await supabase
        .from('icp_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      return (icps || []).map(p => p.id);
    };

    // Fetch initial activities filtered by user's ICPs
    const fetchActivities = async (icpIds: string[]) => {
      // Show activities that either:
      // 1. Belong to user's ICPs
      // 2. Are global (null icp_profile_id) - legacy/system-wide activities
      let query = supabase
        .from('system_activity')
        .select('id, type, title, detail, created_at, icp_profile_id')
        .order('created_at', { ascending: false })
        .limit(15);

      if (icpIds.length > 0) {
        // Filter: activities for user's ICPs OR global activities
        query = query.or(`icp_profile_id.in.(${icpIds.join(',')}),icp_profile_id.is.null`);
      } else {
        // No ICPs - only show global activities
        query = query.is('icp_profile_id', null);
      }

      const { data, error } = await query;

      if (!error && data) {
        setActivities(data);
      }
      setIsLoading(false);
    };

    // Initialize
    fetchUserIcps().then((icpIds) => {
      setUserIcpIds(icpIds);
      fetchActivities(icpIds);
    });

    // Subscribe to realtime updates
    const channel = supabase
      .channel('system_activity_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_activity',
        },
        (payload) => {
          const newActivity = payload.new as Activity;
          // Only add if it belongs to user's ICPs or is global
          if (
            newActivity.icp_profile_id === null ||
            userIcpIds.includes(newActivity.icp_profile_id)
          ) {
            setActivities((prev) => [newActivity, ...prev].slice(0, 15));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold" style={{ color: '#0A2540' }}>
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm" style={{ color: '#6B7C93' }}>
            No recent activity
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {activities.map((activity) => {
                const config = activityTypeConfig[activity.type] || defaultConfig;
                const Icon = config.icon;

                return (
                  <motion.div
                    key={activity.id}
                    variants={slideDown}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    layout
                    className="flex items-start gap-3"
                  >
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#F6F9FC' }}
                    >
                      <Icon className={`w-4 h-4 ${config.colorClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: '#0A2540' }}
                      >
                        {activity.title}
                      </p>
                      {activity.detail && (
                        <p
                          className="text-xs truncate"
                          style={{ color: '#6B7C93' }}
                        >
                          {activity.detail}
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: '#6B7C93' }}>
                        {getTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
