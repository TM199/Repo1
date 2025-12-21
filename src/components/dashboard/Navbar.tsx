'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import Logo from '@/components/ui/Logo';
import { LogOut, Bell, Search, HelpCircle } from 'lucide-react';

export function Navbar() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-[#E3E8EE]">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard">
            <Logo size="sm" />
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-[#6B7C93] hover:text-[#0A2540] hover:bg-[#F6F9FC] transition-colors"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-[#6B7C93] hover:text-[#0A2540] hover:bg-[#F6F9FC] transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-[#6B7C93] hover:text-[#0A2540] hover:bg-[#F6F9FC] transition-colors relative"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#635BFF] rounded-full" />
          </Button>
          <div className="w-px h-6 bg-[#E3E8EE] mx-2" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-9 px-3 text-[#6B7C93] hover:text-[#CD3D64] hover:bg-[#FEE2E2]/50 transition-colors text-sm font-medium"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
