"use client";

import React, { useState, useRef } from "react";
import { Shield, ShieldOff } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import type { ProtectionState } from "../shared";

interface ActivationButtonProps {
  readonly protection: ProtectionState;
  readonly onToggle: () => void;
  readonly size?: "sm" | "md" | "lg" | "xl";
}

export function ActivationButton({
  protection,
  onToggle,
  size = "md",
}: ActivationButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const { theme } = useTheme();
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);

  const dimensions = {
    sm: 64,
    md: 96,
    lg: 128,
    xl: 160,
  };

  const iconSizes = {
    sm: 24,
    md: 36,
    lg: 48,
    xl: 64,
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    onToggle();
  };

  const px = dimensions[size];

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer Ring from Reference */}
      <div className={`absolute rounded-full border-2 transition-all duration-1000 ${
        protection.isActive 
          ? 'border-[#81ecff]/20 animate-pulse' 
          : 'border-white/5'
      }`} style={{ width: px + 32, height: px + 32 }} />

      {/* Main button */}
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`
          relative rounded-full
          flex items-center justify-center
          transition-all duration-300 ease-out
          z-30
          ${isPressed ? "scale-90" : ""}
          ${theme === "dark" ? "power-glow" : ""}
        `}
        style={{
          width: px,
          height: px,
          background: theme === "dark" 
            ? (protection.isActive ? "linear-gradient(135deg, #81ecff 0%, #00d4ec 100%)" : "#3f3f46")
            : protection.isActive ? "#10b981" : "#d4d4d8",
          color: protection.isActive ? (theme === "dark" ? "#005762" : "#ffffff") : "#a1a1aa",
          border: "none",
          boxShadow: theme === "dark" 
            ? (protection.isActive ? "0 0 25px rgba(129, 236, 255, 0.35)" : "none")
            : protection.isActive
              ? "0 0 40px rgba(16, 185, 129, 0.25)"
              : "0 4px 12px rgba(0, 0, 0, 0.1)",
          cursor: "pointer",
        }}
      >
        <span ref={contentRef} className="pointer-events-none flex items-center justify-center">
          {protection.isActive ? (
            <Shield className="drop-shadow-md" size={iconSizes[size]} style={{ fill: theme === 'dark' ? 'currentColor' : 'none' }} />
          ) : (
            <ShieldOff className="drop-shadow-md opacity-90" size={iconSizes[size]} />
          )}
        </span>
      </button>
    </div>
  );
}
