import Logo from '@/components/ui/Logo';
import Link from 'next/link';
import { Zap, Radio, TrendingUp } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A2540] relative overflow-hidden">
        {/* Gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,91,255,0.3),transparent)]" />
          <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(0,212,255,0.2),transparent)]" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link href="/" className="inline-block">
            <Logo variant="light" size="lg" />
          </Link>

          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
                Monitor Growth Signals.<br />
                <span className="text-[#00D4FF]">Win More Business.</span>
              </h1>
              <p className="text-white/60 text-lg max-w-md">
                Track hiring signals, planning applications, contract awards, and more — all in one place.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-4">
              {[
                { icon: Zap, text: 'Real-time signal detection' },
                { icon: Radio, text: 'Automated source monitoring' },
                { icon: TrendingUp, text: 'Market intelligence insights' },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-white/70">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <feature.icon className="h-4 w-4 text-[#635BFF]" />
                  </div>
                  <span className="text-sm font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-sm">
            © 2025 Mentis Digital. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center bg-[#F6F9FC] p-8">
        <div className="w-full max-w-md animate-fadeIn">
          <div className="lg:hidden mb-8">
            <Link href="/">
              <Logo size="md" />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
