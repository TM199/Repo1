import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Logo from '@/components/ui/Logo';
import { ArrowRight } from 'lucide-react';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[#E3E8EE]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-sm text-[#425466] hover:text-[#0A2540] transition-colors">
              Features
            </Link>
            <Link href="/#signals" className="text-sm text-[#425466] hover:text-[#0A2540] transition-colors">
              Signal Types
            </Link>
            <Link href="/pricing" className="text-sm text-[#425466] hover:text-[#0A2540] transition-colors">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-[#425466] hover:text-[#0A2540] hover:bg-transparent text-sm font-medium">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-[#635BFF] hover:bg-[#5851ea] text-white text-sm font-medium h-9 px-4 shadow-sm hover:shadow-md transition-all">
                Start free
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-[#E3E8EE]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Logo size="sm" />
            <p className="text-sm text-[#6B7C93]">
              © 2025 Mentis Digital. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
