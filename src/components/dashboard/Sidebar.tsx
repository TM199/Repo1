'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Download, Settings, Plus, Flame, Users, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/icp', label: 'ICP Profiles', icon: Users },
  { href: '/pain', label: 'Companies in Pain', icon: Flame },
  { href: '/export', label: 'Export', icon: Download },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/labs', label: 'Labs', icon: FlaskConical },
];

export function Sidebar() {
  const pathname = usePathname();

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
