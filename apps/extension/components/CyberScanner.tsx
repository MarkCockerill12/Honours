"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Switch, useTheme } from "@privacy-shield/core";
import { ShieldCheck, Radar, FileText, Globe, AlertTriangle } from "lucide-react";
import anime from "animejs";
import { scanUrl, ScanResult } from "../utils/security";
import { chromeBridge } from "../utils/chromeBridge";

export function CyberScanner() {
  const [autoScan, setAutoScan] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanReport, setScanReport] = useState<{
    total: number;
    bad: number;
    type: "WEB" | "PDF" | null;
    maliciousLinks: ScanResult[];
    safeLinks: ScanResult[];
  } | null>(null);

  const [showDetails, setShowDetails] = useState<"safe" | "threats" | null>(null);

  const timeoutRef = useRef<number | null>(null);
  const scanningRef = useRef<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { colors, theme } = useTheme();

  // Report entrance animation
  useEffect(() => {
    if (!reportRef.current || !scanReport) return;
    anime({
      targets: reportRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      easing: "easeOutQuart",
    });
  }, [scanReport]);

  useEffect(() => {
    const loadSettings = async () => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const data = await chrome.storage.local.get(["autoscan_enabled"]);
        setAutoScan(data.autoscan_enabled === "true");
      }
    };
    loadSettings();
  }, []);

  const triggerPageScan = async (tabId?: number) => {
    if (scanningRef.current) return;
    setError(null);
    setIsScanning(true);
    scanningRef.current = true;
    setScanReport(null);

    const cleanup = () => {
      setIsScanning(false);
      scanningRef.current = false;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };

    timeoutRef.current = window.setTimeout(() => {
      if (scanningRef.current) {
        setError("Scan timed out. Content script might be blocked.");
        cleanup();
      }
    }, 10000) as unknown as number;

    if (!chromeBridge.isAvailable()) {
      setError("Extension context unavailable.");
      cleanup();
      return;
    }

    let targetId = tabId;
    if (!targetId) {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      targetId = tabs[0]?.id;
    }

    if (!targetId) {
      setError("No active tab found.");
      cleanup();
      return;
    }

    try {
      const response = await chromeBridge.sendMessage(targetId, { action: "SCAN_PAGE_LINKS" });
      cleanup();
      if (response && response.type) {
        setScanReport({
          total: response.linkCount,
          bad: response.maliciousCount,
          type: response.type,
          maliciousLinks: response.maliciousLinks || [],
          safeLinks: response.safeLinks || [],
        });
      } else {
        setError(response?.error || "Could not retrieve page content.");
      }
    } catch (err: any) {
      setError(`Scan failed: ${err.message}`);
      cleanup();
    }
  };

  const onAccentColor = theme === 'dark' ? '#005762' : '#ffffff';

  return (
    <div className="flex-1 flex flex-col items-center justify-start space-y-5">
      {/* Radar Button Section */}
      <div className="relative flex items-center justify-center w-40 h-40 mt-2">
        {/* Pulsing Radar Backgrounds */}
        <div className={`absolute w-full h-full border-2 ${colors.success.replace('text-', 'border-')} rounded-full opacity-0 animate-pulse`} style={{ animation: 'pulse 3s cubic-bezier(0.215, 0.61, 0.355, 1) infinite' }}></div>
        <div className={`absolute w-full h-full border-2 ${colors.success.replace('text-', 'border-')} rounded-full opacity-0 animate-pulse`} style={{ animation: 'pulse 3s 1s cubic-bezier(0.215, 0.61, 0.355, 1) infinite' }}></div>
        
        {/* Central Power Button */}
        <button 
          onClick={() => triggerPageScan()}
          disabled={isScanning}
          className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all group ${theme === 'dark' ? 'bg-gradient-to-br from-[#81ecff] to-[#00d4ec]' : colors.accent}`}
        >
          <Radar className={`w-10 h-10 mb-1.5 ${isScanning ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} style={{ color: onAccentColor }} />
          <span className="font-headline font-black text-[10px] tracking-widest" style={{ color: onAccentColor }}>
            {isScanning ? 'SCANNING' : 'SCAN NOW'}
          </span>
        </button>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 0; }
          50% { opacity: 0.2; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>

      {/* Status Indicators */}
      <div className="w-full space-y-3">
        {/* Auto-Scan Toggle */}
        <div 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const newState = !autoScan;
            setAutoScan(newState);
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
              chrome.storage.local.set({ autoscan_enabled: String(newState) });
            }
          }}
          className={`${colors.bgSecondary} rounded-2xl p-4 flex items-center justify-between border ${colors.border} cursor-pointer hover:bg-zinc-500/5 transition-colors w-full text-left`}
        >
          <div className="flex items-center gap-3.5 pointer-events-none">
            <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center shadow-inner`}>
              <Globe className={`text-amber-400 w-5 h-5`} />
            </div>
            <div className="flex flex-col">
              <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${colors.textSecondary} leading-none mb-1`}>Auto-Scan Pages</span>
              <span className={`text-sm font-bold ${autoScan ? colors.success : colors.textSecondary} leading-none`}>{autoScan ? 'Active' : 'Disabled'}</span>
            </div>
          </div>
          <Switch
            checked={autoScan}
            onCheckedChange={() => {}} // parent div handles the click
            className="pointer-events-none"
          />
        </div>
      </div>

      {error && (
        <div className="w-full p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="text-red-500 w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Scan Error</span>
            <span className="text-xs text-red-400 font-medium">{error}</span>
          </div>
        </div>
      )}

      {scanReport && (
        <ScanReport
          reportRef={reportRef}
          scanReport={scanReport}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
          colors={colors}
        />
      )}
    </div>
  );
}

function ScanReport({ reportRef, scanReport, showDetails, setShowDetails, colors }: Readonly<any>) {
  return (
    <div ref={reportRef} className={`text-xs ${colors.bgSecondary} p-4 rounded-2xl border ${colors.border} w-full space-y-4`} style={{ opacity: 0 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {scanReport.type === "PDF" ? <FileText className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-primary" />}
          <span className={`${colors.textSecondary} text-[10px] font-black uppercase tracking-widest`}>Scan Results</span>
        </div>
        <span className={`font-mono ${colors.text} text-[10px] bg-zinc-500/10 px-2 py-0.5 rounded`}>{scanReport.type}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatButton label="Total Links" value={scanReport.total} active={showDetails === "safe"} onClick={() => setShowDetails(showDetails === "safe" ? null : "safe")} colors={colors} />
        <StatButton label="Threats" value={scanReport.bad} active={showDetails === "threats"} onClick={() => setShowDetails(showDetails === "threats" ? null : "threats")} critical={scanReport.bad > 0} colors={colors} />
        
        <ReportDetails type={showDetails} report={scanReport} colors={colors} />
      </div>
    </div>
  );
}

function StatButton({ label, value, active, onClick, critical, colors }: Readonly<any>) {
  return (
    <button
      type="button"
      className={`w-full ${colors.bg} p-3 rounded-2xl text-center border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${active ? (critical ? "border-red-500 bg-red-500/5" : "border-primary bg-primary/5") : "border-transparent"}`}
      onClick={onClick}
    >
      <div className={`text-[9px] uppercase tracking-widest font-black ${critical ? "text-red-400" : colors.textSecondary} mb-1`}>{label}</div>
      <div className={`stat-number text-lg font-black ${critical ? "text-red-500" : colors.success.replace('text-', 'text-')}`}>{value}</div>
    </button>
  );
}

function ReportDetails({ type, report, colors }: Readonly<any>) {
  if (!type) return null;
  const isThreats = type === "threats";
  const items = isThreats ? report.maliciousLinks : report.safeLinks;
  
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (items.length > 0 && listRef.current) {
      const els = listRef.current.querySelectorAll(".report-item");
      anime({
        targets: els,
        translateX: [-10, 0],
        opacity: [0, 1],
        delay: anime.stagger(20),
        duration: 400,
        easing: "easeOutQuad"
      });
    }
  }, [type, items.length]);

  return (
    <div ref={listRef} className={`col-span-2 mt-2 max-h-60 overflow-y-auto space-y-3 p-4 rounded-xl border-2 ${isThreats ? "bg-red-950/10 border-red-900/40" : "bg-black/40 border-zinc-800"} custom-scrollbar animate-in fade-in slide-in-from-top-2`}>
      <div className={`font-black uppercase tracking-widest text-[10px] mb-3 flex items-center justify-between pb-2 border-b border-white/5`}>
        <span className={isThreats ? "text-red-400" : colors.success}>{isThreats ? "Malicious Detected" : "Safe Connections"}</span>
        <span className="opacity-50 bg-white/5 px-2 py-0.5 rounded">{items.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((link: ScanResult, i: number) => (
          <div key={`${link.url}-${i}`} className={`report-item flex flex-col gap-1.5 p-3 rounded-lg ${isThreats ? 'bg-red-500/10' : 'bg-white/5'} border border-white/5 shadow-sm`}>
            <span className={`text-[11px] font-medium break-all ${colors.text} leading-snug`} title={String(link.url)}>
              {String(link.url)}
            </span>
            {isThreats && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${link.isMalicious ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'}`}>
                  {link.isMalicious ? 'DANGEROUS' : 'TRACKER'}
                </span>
                <span className={`text-[9px] font-bold ${colors.textSecondary} truncate`}>{link.details}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <div className={`text-center py-10 ${colors.textSecondary} italic text-sm opacity-50`}>
          No items identified.
        </div>
      )}
    </div>
  );
}
