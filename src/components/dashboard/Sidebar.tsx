'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Download, Settings, Plus, Flame, Users, FlaskConical, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/providers/SidebarContext';

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
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="border-r border-border bg-card min-h-[calc(100vh-3.5rem)] flex flex-col"
    >
      {/* Collapse toggle */}
      <div className="absolute top-2 -right-3 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="h-6 w-6 rounded-full bg-card border-border shadow-sm hover:bg-muted icon-btn-interactive"
          title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        >
          {isCollapsed ? (
            <PanelLeft className="h-3 w-3 text-muted-foreground" />
          ) : (
            <PanelLeftClose className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </div>

      <div className="p-4">
        <Link href="/icp/new">
          <Button
            className={cn(
              "w-full bg-primary hover:bg-primary/90 text-primary-foreground h-9 text-sm font-medium shadow-sm btn-interactive",
              isCollapsed && "px-0"
            )}
          >
            <Plus className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
            {!isCollapsed && "New ICP Profile"}
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
                'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-150',
                isCollapsed ? 'justify-center' : 'justify-between',
                isActive
                  ? 'bg-secondary text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <div className={cn("flex items-center", !isCollapsed && "gap-3")}>
                <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                {!isCollapsed && item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("p-4 border-t border-border", isCollapsed && "px-2")}>
        <div className={cn("px-3 py-3 rounded-lg bg-secondary", isCollapsed && "px-2")}>
          {isCollapsed ? (
            <div className="flex justify-center">
              <span className="text-xs font-bold text-primary">SM</span>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-foreground mb-0.5">Signal Tracker</p>
              <p className="text-[10px] text-muted-foreground">by Mentis Digital</p>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
