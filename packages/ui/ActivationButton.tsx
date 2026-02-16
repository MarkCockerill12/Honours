"use client"

import React, { useState, useRef, useEffect } from "react"
import { Shield, ShieldOff } from "lucide-react"
import { useTheme } from "./ThemeProvider"
import type { ProtectionState } from "./types"

interface ActivationButtonProps {
  protection: ProtectionState
  onToggle: () => void
  size?: "sm" | "md" | "lg"
}

export function ActivationButton({ protection, onToggle, size = "md" }: ActivationButtonProps) {
  const { theme, colors } = useTheme()
  const [isPressed, setIsPressed] = useState(false)
  const [lightningBolts, setLightningBolts] = useState<Array<{ id: number; angle: number; delay: number }>>([])
  const buttonRef = useRef<HTMLButtonElement>(null)

  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  }

  const iconSizes = {
    sm: 32,
    md: 48,
    lg: 64,
  }

  const triggerLightning = () => {
    const bolts = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      angle: i * 30,
      delay: i * 30,
    }))
    setLightningBolts(bolts)
    setTimeout(() => setLightningBolts([]), 600)
  }

  const handleClick = () => {
    setIsPressed(true)
    setTimeout(() => setIsPressed(false), 150)
    
    // Only trigger lightning when turning ON
    if (!protection.isActive) {
      triggerLightning()
    }
    // TODO: Implement haptic feedback for mobile touch devices
    onToggle()
  }

  const getButtonGradient = () => {
    if (!protection.isActive) {
      return theme === "vaporwave"
        ? "bg-gradient-to-br from-zinc-700 to-zinc-800"
        : theme === "frutiger-aero"
        ? "bg-gradient-to-br from-slate-300 to-slate-400"
        : "bg-gradient-to-br from-zinc-700 to-zinc-800"
    }
    
    switch (theme) {
      case "vaporwave":
        return "bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500"
      case "frutiger-aero":
        return "bg-gradient-to-br from-sky-400 via-emerald-400 to-teal-400"
      case "light":
        return "bg-gradient-to-br from-blue-400 to-blue-600"
      default:
        return "bg-gradient-to-br from-emerald-400 to-emerald-600"
    }
  }

  return (
    <div className="relative flex items-center justify-center">
      {/* Lightning bolts */}
      {lightningBolts.map((bolt) => (
        <div
          key={bolt.id}
          className="absolute pointer-events-none"
          style={{
            transform: `rotate(${bolt.angle}deg)`,
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
              stroke={theme === "vaporwave" ? "#f472b6" : theme === "frutiger-aero" ? "#38bdf8" : "#34d399"}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      ))}

      {/* Glow ring */}
      {protection.isActive && (
        <div
          className={`absolute ${sizeClasses[size]} rounded-full animate-ping opacity-30`}
          style={{
            background: theme === "vaporwave"
              ? "radial-gradient(circle, #f472b6 0%, transparent 70%)"
              : theme === "frutiger-aero"
              ? "radial-gradient(circle, #38bdf8 0%, transparent 70%)"
              : "radial-gradient(circle, #34d399 0%, transparent 70%)",
          }}
        />
      )}

      {/* Main button */}
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`
          relative ${sizeClasses[size]} rounded-full
          ${getButtonGradient()}
          flex items-center justify-center
          transition-all duration-200 ease-out
          hover:scale-110 active:scale-95
          ${isPressed ? "scale-95" : ""}
          ${protection.isActive ? "shadow-2xl" : "shadow-lg"}
          ${theme === "frutiger-aero" ? "backdrop-blur-sm border-2 border-white/50" : ""}
        `}
        style={{
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
          <Shield className="text-white drop-shadow-lg" size={iconSizes[size]} />
        ) : (
          <ShieldOff className="text-zinc-400" size={iconSizes[size]} />
        )}
      </button>

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
  )
}
