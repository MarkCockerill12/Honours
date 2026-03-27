"use client";

import React, { useState, useRef } from "react";
import { Shield, ShieldOff, Lock } from "lucide-react";
import anime from "animejs";
import { useTheme } from "./ThemeProvider";
import type { ProtectionState } from "@privacy-shield/core";

interface ActivationButtonProps {
  protection: ProtectionState;
  onToggle: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  isAdmin?: boolean;
}

export function ActivationButton({
  protection,
  onToggle,
  size = "md",
  loading = false,
  isAdmin = true,
}: ActivationButtonProps) {
  const { theme } = useTheme();
  const [isPressed, setIsPressed] = useState(false);
  const [lightningBolts, setLightningBolts] = useState<
    Array<{ id: number; angle: number; delay: number }>
  >([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const dimensions = {
    sm: 80,
    md: 128,
    lg: 160,
    xl: 224,
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
    if (!isAdmin && !protection.isActive) {
      if (buttonRef.current) {
        anime({
          targets: buttonRef.current,
          translateX: [0, -10, 10, -10, 10, 0],
          duration: 400,
          easing: "easeInOutSine"
        });
      }
      return;
    }
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);

    if (!protection.isActive) triggerLightning();
    onToggle();
  };

  const buttonRadius = dimensions[size] / 2;
  const px = `${dimensions[size]}px`;

  const getLightningColor = () => {
    switch (theme) {
      case "vaporwave": return "#f472b6";
      case "frutiger-aero": return "#38bdf8";
      case "cyberpunk": return "#fef08a";
      default: return "#34d399";
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer spinning ring for loading state */}
      {loading && (
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 border-r-emerald-400/30 animate-spin z-10 pointer-events-none"
          style={{ width: "110%", height: "110%", left: "-5%", top: "-5%" }}
        />
      )}

      {/* Lightning bolts */}
      {lightningBolts.map((bolt) => {
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
                stroke={getLightningColor()}
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
          className="absolute rounded-full animate-ping opacity-30 pointer-events-none"
          style={{
            width: px,
            height: px,
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

      {/* Main button — single element, no wrapper div stealing clicks */}
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`
          relative rounded-full
          flex items-center justify-center
          transition-all duration-300 ease-out
          z-30
          ${isPressed ? "scale-90" : "hover:scale-110 active:scale-95"}
        `}
        style={{
          width: px,
          height: px,
          backgroundColor: protection.isActive ? "#10b981" : "#3f3f46",
          color: "#ffffff",
          border: `4px solid ${protection.isActive ? "rgba(16, 185, 129, 0.3)" : "rgba(63, 63, 70, 0.5)"}`,
          boxShadow: protection.isActive
            ? "0 0 40px rgba(16, 185, 129, 0.25), 0 0 80px rgba(16, 185, 129, 0.1)"
            : "0 8px 32px rgba(0, 0, 0, 0.4)",
          cursor: "pointer",
        }}
      >
        <span className="pointer-events-none flex items-center justify-center">
          {protection.isActive ? (
            <Shield className="drop-shadow-md" size={iconSizes[size]} />
          ) : (
            <ShieldOff className="drop-shadow-md opacity-90" size={iconSizes[size]} />
          )}
        </span>

        {/* Admin Lock Overlay */}
        {!isAdmin && !protection.isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-full z-20 pointer-events-none">
            <div className="bg-red-500/90 p-2 rounded-full border border-white/20 shadow-xl">
              <Lock size={iconSizes[size] / 2.5} className="text-white drop-shadow-md" />
            </div>
          </div>
        )}
      </button>


    </div>
  );
}
