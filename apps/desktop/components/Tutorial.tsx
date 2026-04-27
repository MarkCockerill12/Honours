"use client";

import React, { useState } from "react";
import { Shield, Globe, Palette, ChevronLeft, ChevronRight, X, Zap, Lock } from "lucide-react";
import { useTheme } from "@privacy-shield/core";

const STEPS = [
  {
    icon: Shield,
    title: "WELCOME",
    body: "Welcome to Privacy Sentinel, your personal digital fortress. This quick guide will show you everything you need to stay protected online.",
  },
  {
    icon: Zap,
    title: "VPN PROTECTION",
    body: "The large shield button in the centre controls your VPN. Click it to encrypt all your internet traffic through a secure WireGuard tunnel to one of 5 global servers.",
  },
  {
    icon: Globe,
    title: "SERVER SELECTION",
    body: "Click the 'Location' button to open the world map. Select a glowing node to route your connection through that region — pick the closest for speed, or another country to browse from there.",
  },
  {
    icon: Lock,
    title: "AD BLOCKING",
    body: "Toggle 'Adblock Protocol' to block ads and trackers system-wide using AdGuard DNS. This works across all apps and browsers on your computer, not just this one.",
  },
  {
    icon: Palette,
    title: "THEMES",
    body: "Click the palette icon in the top-right to personalise your experience. Choose from Dark, Light, Vaporwave, or Frutiger Aero visual themes.",
  },
];

interface TutorialProps {
  onClose: () => void;
}

export default function Tutorial({ onClose }: TutorialProps) {
  const [step, setStep] = useState(0);
  const { colors } = useTheme();
  const current = STEPS[step];
  const Icon = current.icon;

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ps_tutorial_seen', 'true');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`w-full max-w-md ${colors.bgSecondary} border border-white/10 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-2xl mx-6 relative`}>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className={`w-4 h-4 ${colors.textSecondary}`} />
        </button>

        <div className={`p-4 rounded-2xl ${step === 0 ? 'bg-emerald-500/10' : 'bg-cyan-500/10'}`}>
          <Icon className={`w-10 h-10 ${step === 0 ? 'text-emerald-400' : colors.success}`} />
        </div>

        <h2 className={`text-xl font-black ${colors.text} tracking-wider`}>
          {current.title}
        </h2>

        <p className={`${colors.textSecondary} text-sm text-center leading-relaxed`}>
          {current.body}
        </p>

        {/* Progress Dots */}
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${i === step ? `${colors.success} scale-125` : 'bg-zinc-600'}`}
              style={i === step ? { backgroundColor: 'currentColor' } : undefined}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex w-full gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className={`flex items-center gap-2 px-5 py-3.5 border ${colors.border} rounded-2xl ${colors.textSecondary} font-black text-xs tracking-widest hover:bg-white/5 transition-all`}
            >
              <ChevronLeft className="w-4 h-4" /> BACK
            </button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              NEXT <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              GET STARTED
            </button>
          )}
        </div>

        <button onClick={handleClose} className={`text-[10px] font-black ${colors.textSecondary} tracking-widest opacity-40 hover:opacity-100 transition-opacity`}>
          SKIP
        </button>
      </div>
    </div>
  );
}
