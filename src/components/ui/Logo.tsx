"use client";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "light";
  appName?: string;
}

export default function Logo({
  className = "",
  showText = true,
  size = "md",
  variant = "default",
  appName = "Signal Tracker"
}: LogoProps) {
  const sizes = {
    sm: { icon: 28, text: "text-sm" },
    md: { icon: 36, text: "text-base" },
    lg: { icon: 48, text: "text-xl" },
  };

  const { icon, text } = sizes[size];
  const isLight = variant === "light";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Logo Icon - Flowing M */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id={`mentisGradient-${variant}`} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="35%" stopColor="#3730a3" />
            <stop offset="65%" stopColor="#0891b2" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>

        {/* Left curved stroke of M */}
        <path
          d="M15 80
             L15 35
             Q15 20 30 20
             Q45 20 50 40
             Q50 50 45 55
             Q40 60 35 55
             Q30 50 35 40
             Q40 30 50 35"
          stroke={`url(#mentisGradient-${variant})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Right curved stroke of M */}
        <path
          d="M50 35
             Q60 30 65 40
             Q70 50 65 55
             Q60 60 55 55
             Q50 50 50 40
             Q55 20 70 20
             Q85 20 85 35
             L85 80"
          stroke={`url(#mentisGradient-${variant})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* Text */}
      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-bold tracking-tight leading-tight ${text} ${isLight ? "text-white" : "text-[#0A1628]"}`}
          >
            {appName}
          </span>
          <span className={`text-[8px] uppercase tracking-[0.12em] font-medium -mt-0.5 ${isLight ? "text-white/60" : "text-[#64748B]"}`}>
            by Mentis Digital
          </span>
        </div>
      )}
    </div>
  );
}
