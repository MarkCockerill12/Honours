"use client";

import React, { useState, useRef, useEffect } from "react";
import { Shield, ShieldOff } from "lucide-react";
import anime from "animejs";
import { useTheme } from "./ThemeProvider";
import type { ProtectionState } from "./types";

interface ActivationButtonProps {
  protection: ProtectionState;
  onToggle: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
}

export function ActivationButton({
  protection,
  onToggle,
  size = "md",
  loading = false,
}: ActivationButtonProps) {
  const { theme, colors } = useTheme();
  const [isPressed, setIsPressed] = useState(false);
  const [lightningBolts, setLightningBolts] = useState<
    Array<{ id: number; angle: number; delay: number }>
  >([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-32 h-32",
    lg: "w-40 h-40",
    xl: "w-56 h-56",
  };

  const iconSizes = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 80,
  };

  const triggerLightning = () => {
    const bolts = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      angle: i * 30,
      delay: i * 30,
    }));
    setLightningBolts(bolts);
    setTimeout(() => setLightningBolts([]), 600);
  };

  const handleClick = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);

    if (!protection.isActive) triggerLightning();
    onToggle();
  };

  // Magnetic 3D Cursor Hover Effect
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    
    // Calculate distance from center (-1 to 1)
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    
    // Max tilt is 15 degrees
    anime({
      targets: buttonRef.current,
      rotateX: -y * 15, // tilt up/down depending on mouse Y
      rotateY: x * 15,  // tilt left/right depending on mouse X
      scale: 1.15,      // slight pop on hover
      duration: 300,
      easing: "easeOutExpo"
    });
  };

  const handleMouseLeave = () => {
    if (!buttonRef.current) return;
    // Snap back to 0
    anime({
      targets: buttonRef.current,
      rotateX: 0,
      rotateY: 0,
      scale: protection.isActive ? 1.05 : 1, // Stay slightly popped if active
      duration: 600,
      easing: "easeOutElastic(1, .5)"
    });
  };

  const getButtonGradient = () => {
    if (!protection.isActive) {
      return theme === "vaporwave"
        ? "bg-gradient-to-br from-zinc-700 to-zinc-800"
        : theme === "frutiger-aero"
          ? "bg-gradient-to-br from-slate-300 to-slate-400"
          : "bg-gradient-to-br from-zinc-700 to-zinc-800";
    }

    switch (theme) {
      case "vaporwave":
        return "bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500";
      case "frutiger-aero":
        return "bg-gradient-to-br from-sky-400 via-emerald-400 to-teal-400";
      case "cyberpunk":
        return "bg-gradient-to-br from-cyan-400 via-yellow-400 to-red-500";
      case "light":
        return "bg-gradient-to-br from-blue-400 to-blue-600";
      default:
        return "bg-gradient-to-br from-emerald-400 to-emerald-600";
    }
  };

  const buttonRadius =
    size === "xl" ? 112 : size === "lg" ? 80 : size === "md" ? 64 : 40; // Half of button size

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer spinning ring for loading state */}
      {loading && (
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 border-r-emerald-400/30 animate-spin z-10"
          style={{ width: "110%", height: "110%", left: "-5%", top: "-5%" }}
        />
      )}

      {/* Lightning bolts - shoot from button edge */}
      {lightningBolts.map((bolt) => {
        // Calculate position on button circumference
        const angleRad = (bolt.angle * Math.PI) / 180;
        const startX = Math.cos(angleRad) * buttonRadius;
        const startY = Math.sin(angleRad) * buttonRadius;

        return (
          <div
            key={bolt.id}
            className="absolute pointer-events-none z-50"
            style={{
              left: `calc(50% + ${startX}px)`,
              top: `calc(50% + ${startY}px)`,
              transform: `rotate(${bolt.angle}deg) translateX(0)`,
              transformOrigin: "left center",
            }}
          >
            <svg
              className="lightning-bolt"
              width="80"
              height="20"
              viewBox="0 0 80 20"
              style={{
                animation: `lightning-shoot 0.4s ease-out ${bolt.delay}ms forwards`,
                opacity: 0,
              }}
            >
              <path
                d="M0,10 L15,8 L12,10 L30,7 L25,10 L45,5 L38,10 L60,3 L50,10 L80,0"
                fill="none"
                stroke={
                  theme === "vaporwave"
                    ? "#f472b6"
                    : theme === "frutiger-aero"
                      ? "#38bdf8"
                      : theme === "cyberpunk"
                        ? "#fef08a"
                        : "#34d399"
                }
                strokeWidth="3"
                strokeLinecap="round"
                filter="url(#glow)"
              />
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>
          </div>
        );
      })}

      {/* Glow ring */}
      {protection.isActive && (
        <div
          className={`absolute ${sizeClasses[size]} rounded-full animate-ping opacity-30`}
          style={{
            background:
              theme === "vaporwave"
                ? "radial-gradient(circle, #f472b6 0%, transparent 70%)"
                : theme === "frutiger-aero"
                  ? "radial-gradient(circle, #38bdf8 0%, transparent 70%)"
                  : theme === "cyberpunk"
                    ? "radial-gradient(circle, #22d3ee 0%, transparent 70%)"
                    : "radial-gradient(circle, #34d399 0%, transparent 70%)",
          }}
        />
      )}

      {/* Main button */}
      <div style={{ perspective: "1000px" }} className={`relative w-full h-full flex items-center justify-center`}>
        <button
          ref={buttonRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`
            relative ${sizeClasses[size]} rounded-full
            ${getButtonGradient()}
            flex items-center justify-center
            transition-colors duration-200 ease-out
            ${isPressed ? "scale-95" : protection.isActive ? "scale-[1.05]" : "scale-100"}
            ${protection.isActive ? "shadow-2xl" : "shadow-lg"}
            ${theme === "frutiger-aero" ? "backdrop-blur-sm border-2 border-white/50" : ""}
          `}
          style={{
            transformStyle: "preserve-3d",
            boxShadow: protection.isActive
              ? theme === "vaporwave"
                ? "0 0 40px rgba(244, 114, 182, 0.5), 0 0 80px rgba(34, 211, 238, 0.3)"
                : theme === "frutiger-aero"
                  ? "0 0 40px rgba(56, 189, 248, 0.4), 0 0 80px rgba(52, 211, 153, 0.2)"
                  : "0 0 40px rgba(52, 211, 153, 0.5)"
              : "0 4px 20px rgba(0, 0, 0, 0.3)",
          }}
        >
          {protection.isActive ? (
            <Shield
              className="text-white drop-shadow-lg"
              size={iconSizes[size]}
              style={{ transform: "translateZ(30px)" }}
            />
          ) : (
            <ShieldOff className="text-zinc-400" size={iconSizes[size]} style={{ transform: "translateZ(30px)" }} />
          )}
        </button>
      </div>

      {/* Status indicator */}
      <div
        className={`
          absolute -bottom-2 px-3 py-1 rounded-full text-xs font-bold
          transition-all duration-300
          ${protection.isActive ? colors.accent : "bg-zinc-600"}
          text-white
        `}
      >
        {protection.isActive ? "ACTIVE" : "OFF"}
      </div>
    </div>
  );
}
