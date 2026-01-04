'use client';

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  trend?: { value: number; isUp: boolean };
  sparklineData?: number[];
}

// Simple SVG sparkline component
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;

  const width = 80;
  const height = 24;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={pathD}
        fill="none"
        stroke="#635BFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Animated number component using framer-motion useSpring
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  );
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = display.on('change', (latest) => {
      setDisplayValue(latest);
    });
    return unsubscribe;
  }, [display]);

  return <span>{displayValue}</span>;
}

export function StatsCard({
  title,
  value,
  icon,
  iconBgColor,
  iconColor,
  trend,
  sparklineData,
}: StatsCardProps) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg',
              iconBgColor,
              iconColor
            )}
          >
            {icon}
          </div>

          {/* Title and Value */}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            <span className="text-2xl font-bold text-foreground">
              <AnimatedNumber value={value} />
            </span>
          </div>
        </div>

        {/* Right side: Trend and/or Sparkline */}
        <div className="flex items-center gap-3">
          {/* Sparkline */}
          {sparklineData && sparklineData.length > 0 && (
            <Sparkline data={sparklineData} />
          )}

          {/* Trend Indicator */}
          {trend && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                trend.isUp
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              )}
            >
              {trend.isUp ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              <span>{trend.value}%</span>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
