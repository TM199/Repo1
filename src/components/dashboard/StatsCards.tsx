import { Card, CardContent } from '@/components/ui/card';
import { Zap, Radio, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatsCardsProps {
  totalSignals: number;
  newSignals: number;
  totalSources: number;
}

export function StatsCards({ totalSignals, newSignals, totalSources }: StatsCardsProps) {
  const stats = [
    {
      label: 'Total Signals',
      value: totalSignals.toLocaleString(),
      change: '+12.5%',
      trend: 'up',
      icon: Zap,
      color: '#635BFF',
      bgColor: '#EEF2FF',
    },
    {
      label: 'New This Week',
      value: newSignals.toLocaleString(),
      change: '+8.3%',
      trend: 'up',
      icon: TrendingUp,
      color: '#0BBF7D',
      bgColor: '#D1FAE5',
    },
    {
      label: 'Active Sources',
      value: totalSources.toLocaleString(),
      change: '100%',
      trend: 'neutral',
      icon: Radio,
      color: '#00D4FF',
      bgColor: '#E0F7FF',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const TrendIcon = stat.trend === 'up' ? ArrowUpRight : stat.trend === 'down' ? ArrowDownRight : null;

        return (
          <Card key={i} className="bg-white border-[#E3E8EE] shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-[#6B7C93] mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-[#0A2540] tracking-tight">{stat.value}</p>
                  {TrendIcon && (
                    <div className="flex items-center gap-1 mt-1">
                      <TrendIcon
                        className="h-3 w-3"
                        style={{ color: stat.trend === 'up' ? '#0BBF7D' : '#CD3D64' }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color: stat.trend === 'up' ? '#0BBF7D' : '#CD3D64' }}
                      >
                        {stat.change}
                      </span>
                      <span className="text-xs text-[#6B7C93]">vs last week</span>
                    </div>
                  )}
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.bgColor }}
                >
                  <Icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
