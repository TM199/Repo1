'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Zap, Download, Settings, Plus, Flame, Users, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/icp', label: 'ICP Profiles', icon: Users },
  { href: '/pain', label: 'Companies in Pain', icon: Flame },
  { href: '/signals', label: 'Signals', icon: Zap, showBadge: true },
  { href: '/export', label: 'Export', icon: Download },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/labs', label: 'Labs', icon: FlaskConical },
];

export function Sidebar() {
  const pathname = usePathname();
  const [newSignalCount, setNewSignalCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    async function fetchNewSignalCount() {
      try {
        const response = await fetch('/api/signals/count');
        if (response.ok) {
          const data = await response.json();
          const newCount = data.count || 0;

          // Show toast if count increased
          if (newCount > prevCountRef.current && prevCountRef.current > 0) {
            const diff = newCount - prevCountRef.current;
            toast.success(`${diff} new signal${diff > 1 ? 's' : ''} found!`, {
              action: {
                label: 'View',
                onClick: () => window.location.href = '/signals',
              },
            });
          }

          prevCountRef.current = newCount;
          setNewSignalCount(newCount);
        }
      } catch (error) {
        console.error('[Sidebar] Error fetching signal count:', error);
      }
    }

    fetchNewSignalCount();

    // Poll every 10 seconds for faster updates
    const interval = setInterval(fetchNewSignalCount, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-60 border-r border-[#E3E8EE] bg-white min-h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="p-4">
        <Link href="/icp/new">
          <Button className="w-full bg-[#635BFF] hover:bg-[#5851ea] text-white h-9 text-sm font-medium shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            New ICP Profile
          </Button>
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const showBadge = item.showBadge && newSignalCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-[#F6F9FC] text-[#635BFF]'
                  : 'text-[#425466] hover:bg-[#F6F9FC] hover:text-[#0A2540]'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn('h-4 w-4', isActive ? 'text-[#635BFF]' : 'text-[#6B7C93]')} />
                {item.label}
              </div>
              {showBadge && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold text-white bg-[#CD3D64] rounded-full animate-pulse">
                  {newSignalCount > 99 ? '99+' : newSignalCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#E3E8EE]">
        <div className="px-3 py-3 rounded-lg bg-[#F6F9FC]">
          <p className="text-xs font-medium text-[#0A2540] mb-0.5">Signal Tracker</p>
          <p className="text-[10px] text-[#6B7C93]">by Mentis Digital</p>
        </div>
      </div>
    </aside>
  );
}
