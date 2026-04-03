"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { TrendingUp, Clock, PoundSterling } from "lucide-react";
import anime from "animejs";
import { useTheme } from "./ThemeProvider";
import type { TrackerStats, Theme } from "@privacy-shield/core";

interface TrackerCardProps {
  stats: TrackerStats;
  compact?: boolean;
}

interface AnimatedValueProps {
  value: number;
  format: (n: number) => string;
  suffix?: string;
}

// Animated number component
function AnimatedValue({
  value,
  format,
  suffix = "",
}: Readonly<AnimatedValueProps>) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const startVal = prevValue.current;

    anime({
      targets: { val: startVal },
      val: value,
      duration: 1200,
      easing: "easeOutExpo",
      update: (anim) => {
        const current = (anim.animations[0] as unknown as { currentValue: number }).currentValue;
        el.textContent = format(Number(current)) + suffix;
      },
    });

    // Scale pop on change
    if (startVal !== value) {
      anime({
        targets: el,
        scale: [1, 1.15, 1],
        duration: 600,
        easing: "easeOutElastic(1, .5)",
      });
    }

    prevValue.current = value;
  }, [value, format, suffix]);

  return (
    <span ref={ref}>
      {format(value)}
      {suffix}
    </span>
  );
}

export function TrackerCard({
  stats,
  compact = false,
}: Readonly<TrackerCardProps>) {
  const { theme, colors } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);

  const glassCardClass = useMemo(() => {
    switch (theme) {
      case "dark":
        return "glass-card";
      case "vaporwave":
        return "glass-card-vaporwave";
      case "frutiger-aero":
        return "glass-card-frutiger";
      case "cyberpunk":
        return "glass-card-cyberpunk";
      default:
        return "glass-card-light";
    }
  }, [theme]);

  const formatBandwidth = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    const kb = bytes / 1024;
    if (mb < 1) return `${kb.toFixed(1)}KB`;
    return `${mb.toFixed(1)}MB`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}m`;
  };

  // Entrance animation
  useEffect(() => {
    if (!cardRef.current) return;

    anime({
      targets: cardRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 800,
      easing: "easeOutExpo",
    });

    // Stagger animate the stat items
    const items = cardRef.current.querySelectorAll(".stat-item");
    anime({
      targets: items,
      translateY: [15, 0],
      opacity: [0, 1],
      delay: anime.stagger(120, { start: 300 }),
      duration: 600,
      easing: "easeOutExpo",
    });
  }, []);

  const statsConfig = useMemo(
    () => [
      {
        icon: TrendingUp,
        value: stats.bandwidthSaved,
        format: formatBandwidth,
        label: "Bandwidth",
        colorClass: colors.success,
      },
      {
        icon: Clock,
        value: stats.timeSaved,
        format: formatTime,
        label: "Time",
        colorClass: colors.warning,
      },
      {
        icon: PoundSterling,
        value: stats.moneySaved ?? 0,
        format: (n: number) => `£${n.toFixed(2)}`,
        label: "Value",
        colorClass: theme === "vaporwave" ? "text-pink-400" : colors.success,
      },
    ],
    [stats, colors, theme],
  );

  const getHoverGlow = () => {
    switch (theme) {
      case "vaporwave":
        return "hover:shadow-[0_0_20px_rgba(244,114,182,0.15)]";
      case "frutiger-aero":
        return "hover:shadow-[0_0_20px_rgba(56,189,248,0.15)]";
      case "cyberpunk":
        return "hover:shadow-[0_0_25px_rgba(254,240,138,0.25)]";
      case "light":
        return "hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]";
      default:
        return "hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]";
    }
  };

  if (compact) {
    return (
      <div
        ref={cardRef}
        className={`flex items-center justify-around p-3 rounded-2xl hover-lift transition-all duration-300 ${getHoverGlow()} ${glassCardClass}`}
      >
        <div className="stat-item flex items-center gap-2 transition-transform duration-200 hover:scale-110">
          <TrendingUp className={colors.success} size={16} />
          <span className={`text-sm font-bold ${colors.text}`}>
            <AnimatedValue
              value={stats.bandwidthSaved}
              format={formatBandwidth}
            />
          </span>
        </div>
        <div className={`w-px h-4 ${colors.border} border-r`} />
        <div className="stat-item flex items-center gap-2 transition-transform duration-200 hover:scale-110">
          <Clock className={colors.warning} size={16} />
          <span className={`text-sm font-bold ${colors.text}`}>
            <AnimatedValue value={stats.timeSaved} format={formatTime} />
          </span>
        </div>
        <div className={`w-px h-4 ${colors.border} border-r`} />
        <div className="stat-item flex items-center gap-2 transition-transform duration-200 hover:scale-110">
          <PoundSterling
            className={theme === "vaporwave" ? "text-pink-400" : colors.success}
            size={16}
          />
          <span className={`text-sm font-bold ${colors.text}`}>
            <AnimatedValue
              value={stats.moneySaved ?? 0}
              format={(n) => `£${n.toFixed(2)}`}
            />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`p-5 rounded-4xl hover-lift transition-all duration-300 ${getHoverGlow()} ${glassCardClass}`}
      style={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className={`text-xs font-bold uppercase tracking-[0.2em] ${colors.textSecondary}`}
        >
          You Are The Product Tracker
        </h3>
        <div className="flex gap-1 animate-pulse">
          <div className={`w-1 h-1 rounded-full ${colors.accent}`} />
          <div className={`w-1 h-1 rounded-full ${colors.accent} opacity-50`} />
          <div className={`w-1 h-1 rounded-full ${colors.accent} opacity-20`} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {statsConfig.map((stat) => (
          <div
            key={stat.label}
            className={`stat-item flex flex-col items-center p-4 rounded-2xl bg-black/10 transition-all duration-300 hover:bg-black/20 hover:-translate-y-1 shadow-inner`}
          >
            <div
              className={`p-2 rounded-full mb-3 shadow-lg ${StatIconBgColor(theme)}`}
            >
              <stat.icon className={stat.colorClass} size={18} />
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${colors.textSecondary}`}
            >
              {stat.label}
            </span>
            <span
              className={`text-lg font-black tracking-tight ${colors.text} drop-shadow-sm`}
            >
              <AnimatedValue value={stat.value} format={stat.format} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatIconBgColor(theme: Theme) {
  if (theme === "light" || theme === "frutiger-aero") {
    return "bg-white/50 backdrop-blur-md border border-white/20";
  } else {
    return "bg-zinc-900/50 backdrop-blur-md border border-zinc-800/50";
  }
}
