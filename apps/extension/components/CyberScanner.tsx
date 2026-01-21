"use client"

import React, { useState, useEffect } from "react"
import { Radar, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/packages/ui/ThemeProvider"

type ScanStatus = "idle" | "scanning" | "clean" | "warning" | "threat"

interface CyberScannerProps {
  compact?: boolean
}

export function CyberScanner({ compact = false }: CyberScannerProps) {
  const { colors, theme } = useTheme()
  const [status, setStatus] = useState<ScanStatus>("idle")
  const [scanProgress, setScanProgress] = useState(0)
  const [pulseRings, setPulseRings] = useState<number[]>([])

  const triggerScan = () => {
    setStatus("scanning")
    setScanProgress(0)
    
    // Trigger pulse rings
    const rings = [0, 1, 2, 3, 4]
    setPulseRings(rings)
    
    // Progress simulation
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          // Random result
          const results: ScanStatus[] = ["clean", "clean", "clean", "warning", "threat"]
          setStatus(results[Math.floor(Math.random() * results.length)])
          setTimeout(() => setPulseRings([]), 500)
          return 100
        }
        return prev + 5
      })
    }, 100)
  }

  const getStatusIcon = () => {
    switch (status) {
      case "scanning":
        return <Radar className="animate-spin" size={compact ? 20 : 32} />
      case "clean":
        return <CheckCircle className={colors.success} size={compact ? 20 : 32} />
      case "warning":
        return <AlertTriangle className={colors.warning} size={compact ? 20 : 32} />
      case "threat":
        return <XCircle className={colors.danger} size={compact ? 20 : 32} />
      default:
        return <Radar size={compact ? 20 : 32} />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "scanning":
        return `Scanning... ${scanProgress}%`
      case "clean":
        return "All Clear"
      case "warning":
        return "Trackers Found"
      case "threat":
        return "Threats Blocked"
      default:
        return "Ready to Scan"
    }
  }

  const getAccentColor = () => {
    if (theme === "vaporwave") return "#f472b6"
    if (theme === "frutiger-aero") return "#38bdf8"
    return "#34d399"
  }

  if (compact) {
    return (
      <Button
        onClick={triggerScan}
        disabled={status === "scanning"}
        variant="outline"
        className={`
          relative flex items-center gap-2 px-4 h-10
          transition-all duration-200 hover:scale-105 active:scale-95
          ${colors.border}
        `}
      >
        {getStatusIcon()}
        <span className={`text-sm ${colors.text}`}>{getStatusText()}</span>
      </Button>
    )
  }

  return (
    <div className={`rounded-2xl ${colors.bgSecondary} ${colors.border} border p-4`}>
      <h3 className={`text-sm font-semibold mb-4 ${colors.text}`}>Cyber Scanner</h3>
      
      <div className="relative flex items-center justify-center h-32">
        {/* Pulse rings */}
        {pulseRings.map((ring, index) => (
          <div
            key={ring}
            className="absolute rounded-full"
            style={{
              width: "20px",
              height: "20px",
              border: `2px solid ${getAccentColor()}`,
              opacity: 0,
              animation: `scanner-pulse 1.5s ease-out ${index * 200}ms infinite`,
            }}
          />
        ))}
        
        {/* Scanner button */}
        <button
          onClick={triggerScan}
          disabled={status === "scanning"}
          className={`
            relative z-10 w-20 h-20 rounded-full
            ${colors.bgSecondary} ${colors.border} border-2
            flex items-center justify-center
            transition-all duration-200 hover:scale-110 active:scale-95
            disabled:cursor-not-allowed
          `}
          style={{
            boxShadow: status !== "idle" 
              ? `0 0 20px ${getAccentColor()}40`
              : "none",
          }}
        >
          {getStatusIcon()}
        </button>
      </div>

      {/* Status text */}
      <div className="text-center mt-4">
        <p className={`text-sm font-medium ${colors.text}`}>{getStatusText()}</p>
        {status === "scanning" && (
          <div className="mt-2 h-1 bg-black/20 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-200"
              style={{ 
                width: `${scanProgress}%`,
                background: getAccentColor(),
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
