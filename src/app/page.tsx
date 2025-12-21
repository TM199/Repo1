import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Logo from '@/components/ui/Logo';
import {
  Zap,
  Radio,
  Download,
  ArrowRight,
  Target,
  TrendingUp,
  Building2,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Globe2,
  Shield
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[#E3E8EE]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-[#425466] hover:text-[#0A2540] transition-colors">
              Features
            </Link>
            <Link href="#signals" className="text-sm text-[#425466] hover:text-[#0A2540] transition-colors">
              Signal Types
            </Link>
            <Link href="#pricing" className="text-sm text-[#425466] hover:text-[#0A2540] transition-colors">
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

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden gradient-mesh">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#635BFF]/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00D4FF]/10 rounded-full blur-3xl animate-float delay-300" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E3E8EE] rounded-full text-xs font-medium text-[#425466] mb-8 shadow-sm animate-fade-in-down">
              <Sparkles className="h-3.5 w-3.5 text-[#635BFF]" />
              AI-Powered Signal Intelligence
            </div>

            {/* Headline */}
            <h1 className="text-[3.5rem] md:text-[4.5rem] font-bold leading-[1.1] tracking-tight text-[#0A2540] mb-6 animate-fade-in-up opacity-0" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
              Track growth signals.
              <br />
              <span className="text-gradient">Close more deals.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-[#425466] max-w-xl mx-auto mb-10 leading-relaxed animate-fade-in-up opacity-0" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
              Monitor hiring, planning, contracts and more. Export enriched data to Clay or Prospeo in one click.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in-up opacity-0" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
              <Link href="/signup">
                <Button size="lg" className="bg-[#635BFF] hover:bg-[#5851ea] text-white px-8 h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                  Get started free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-[#E3E8EE] text-[#0A2540] hover:bg-white hover:border-[#C4CAD4] px-8 h-12 text-base font-medium">
                  View demo
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-[#6B7C93] animate-fade-in opacity-0" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0BBF7D]" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0BBF7D]" />
                14-day free trial
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#0BBF7D]" />
                Cancel anytime
              </div>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-20 relative animate-fade-in-up opacity-0" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
            <div className="relative bg-white rounded-2xl shadow-2xl border border-[#E3E8EE] overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#F6F9FC] border-b border-[#E3E8EE]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-white rounded-md text-xs text-[#6B7C93] border border-[#E3E8EE]">
                    signal-tracker.app/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard content preview */}
              <div className="p-8 bg-gradient-to-b from-[#F6F9FC] to-white">
                <div className="grid grid-cols-3 gap-6 mb-8">
                  {[
                    { label: 'Total Signals', value: '2,847', change: '+12.5%', color: '#635BFF' },
                    { label: 'New Today', value: '142', change: '+8.3%', color: '#0BBF7D' },
                    { label: 'Sources Active', value: '24', change: '100%', color: '#00D4FF' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-xl p-5 border border-[#E3E8EE] shadow-sm">
                      <p className="text-xs font-medium text-[#6B7C93] mb-1">{stat.label}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-[#0A2540]">{stat.value}</span>
                        <span className="text-xs font-medium" style={{ color: stat.color }}>{stat.change}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-5 border border-[#E3E8EE] shadow-sm">
                    <p className="text-sm font-medium text-[#0A2540] mb-4">Recent Signals</p>
                    <div className="space-y-3">
                      {[
                        { company: 'Acme Corp', signal: 'Hiring 5 engineers', type: 'new_job' },
                        { company: 'TechStart Ltd', signal: 'Series A - £2M', type: 'funding' },
                        { company: 'BuildCo', signal: 'Planning approved', type: 'planning' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-[#F0F3F7] last:border-0">
                          <div>
                            <p className="text-sm font-medium text-[#0A2540]">{item.company}</p>
                            <p className="text-xs text-[#6B7C93]">{item.signal}</p>
                          </div>
                          <div className="w-2 h-2 rounded-full bg-[#635BFF]" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-5 border border-[#E3E8EE] shadow-sm">
                    <p className="text-sm font-medium text-[#0A2540] mb-4">Signal Volume</p>
                    <div className="flex items-end gap-1 h-24">
                      {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t"
                          style={{
                            height: `${h}%`,
                            background: i === 11 ? '#635BFF' : '#E3E8EE'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[#635BFF]/20 via-[#00D4FF]/20 to-[#635BFF]/20 blur-3xl -z-10 opacity-50" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-[#635BFF] mb-3">FEATURES</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">
              Everything you need to find leads
            </h2>
            <p className="text-lg text-[#425466] max-w-xl mx-auto">
              Powerful tools to track, analyze, and act on growth signals across your target market.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Radio,
                title: 'Smart Monitoring',
                description: 'Add any URL and our AI extracts structured data automatically. Works with job boards, planning portals, news sites, and more.',
                color: '#635BFF'
              },
              {
                icon: Zap,
                title: 'AI Extraction',
                description: 'Firecrawl-powered AI identifies company names, titles, values, and context. No manual parsing required.',
                color: '#00D4FF'
              },
              {
                icon: Download,
                title: 'One-Click Export',
                description: 'Export enriched data to CSV instantly. Perfect for Clay, Prospeo, or your custom enrichment workflows.',
                color: '#0BBF7D'
              },
              {
                icon: BarChart3,
                title: 'Analytics Dashboard',
                description: 'Track signal trends over time. See which sources produce the best leads for your business.',
                color: '#F5A623'
              },
              {
                icon: Globe2,
                title: 'Multi-Industry',
                description: 'Works across construction, healthcare, tech, finance, and more. Configure for your specific market.',
                color: '#CD3D64'
              },
              {
                icon: Shield,
                title: 'Automated Schedules',
                description: 'Set daily or weekly scrapes. Never miss a signal with automated monitoring and alerts.',
                color: '#635BFF'
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-6 bg-white rounded-xl border border-[#E3E8EE] hover:border-[#635BFF]/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${feature.color}15` }}
                >
                  <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
                </div>
                <h3 className="text-lg font-semibold text-[#0A2540] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#425466] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Signal Types Section */}
      <section id="signals" className="py-24 bg-[#F6F9FC]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-[#635BFF] mb-3">SIGNAL TYPES</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">
              8 powerful signal types
            </h2>
            <p className="text-lg text-[#425466] max-w-xl mx-auto">
              Track the growth indicators that matter most to your sales motion.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'New Hiring', icon: Target, color: '#4338CA', bg: '#EEF2FF' },
              { label: 'Planning Submitted', icon: Building2, color: '#B45309', bg: '#FEF3C7' },
              { label: 'Planning Approved', icon: Building2, color: '#047857', bg: '#D1FAE5' },
              { label: 'Contract Awards', icon: TrendingUp, color: '#7C3AED', bg: '#F3E8FF' },
              { label: 'Funding Rounds', icon: TrendingUp, color: '#BE185D', bg: '#FCE7F3' },
              { label: 'Leadership Changes', icon: Target, color: '#C2410C', bg: '#FFEDD5' },
              { label: 'CQC Ratings', icon: Building2, color: '#B91C1C', bg: '#FEE2E2' },
              { label: 'Company Expansion', icon: TrendingUp, color: '#0F766E', bg: '#CCFBF1' },
            ].map((signal, i) => (
              <div
                key={i}
                className="group p-5 bg-white rounded-xl border border-[#E3E8EE] hover:border-transparent hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: signal.bg }}
                >
                  <signal.icon className="h-5 w-5" style={{ color: signal.color }} />
                </div>
                <p className="font-medium text-[#0A2540]">{signal.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 gradient-mesh-dark text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to find your next customers?
          </h2>
          <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto">
            Start tracking growth signals today. Set up in minutes, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-[#0A2540] hover:bg-white/90 px-8 h-12 text-base font-medium shadow-lg">
                Start free trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 h-12 text-base font-medium">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

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
