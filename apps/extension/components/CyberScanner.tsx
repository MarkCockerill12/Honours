"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@privacy-shield/core";
import { Switch } from "@privacy-shield/core";
import { ShieldAlert, ShieldCheck, Scan, FileText, Globe } from "lucide-react";
import anime from "animejs";
import { scanUrl, ScanResult } from "../utils/security";
import { chromeBridge } from "../utils/chromeBridge";

export function CyberScanner() {
  const [currentUrl, setCurrentUrl] = useState("");
  const [urlStatus, setUrlStatus] = useState<ScanResult | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanReport, setScanReport] = useState<{
    total: number;
    bad: number;
    type: "WEB" | "PDF" | null;
    maliciousLinks: ScanResult[];
    safeLinks: ScanResult[];
  } | null>(null);

  const [showDetails, setShowDetails] = useState<"safe" | "threats" | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanningRef = useRef<boolean>(false);
  const radarRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Status computation
  const isSafe = useMemo(() => urlStatus?.isSafe ?? true, [urlStatus]);
  const statusText = useMemo(() => {
    if (!urlStatus) return "INITIALIZING...";
    return isSafe ? "SAFE CONNECTION" : "THREAT DETECTED";
  }, [urlStatus, isSafe]);

  // Radar sweep animation during scan
  useEffect(() => {
    if (!radarRef.current) return;
    if (isScanning) {
      radarRef.current.style.display = "block";
      anime({
        targets: radarRef.current,
        rotate: [0, 360],
        duration: 1500,
        easing: "linear",
        loop: true,
      });
    } else {
      anime.remove(radarRef.current);
      anime({
        targets: radarRef.current,
        opacity: [1, 0],
        duration: 300,
        easing: "easeOutQuad",
        complete: () => {
          if (radarRef.current) radarRef.current.style.display = "none";
        },
      });
    }
  }, [isScanning]);

  // Status bar animation
  useEffect(() => {
    if (!statusRef.current || !urlStatus) return;
    anime({
      targets: statusRef.current,
      scale: [0.95, 1],
      opacity: [0, 1],
      duration: 500,
      easing: "easeOutBack",
    });
  }, [urlStatus]);

  // Report entrance animation
  useEffect(() => {
    if (!reportRef.current || !scanReport) return;
    anime({
      targets: reportRef.current,
      translateY: [10, 0],
      opacity: [0, 1],
      duration: 500,
      easing: "easeOutExpo",
    });
    const statEls = reportRef.current.querySelectorAll(".stat-number");
    anime({
      targets: statEls,
      scale: [0, 1],
      delay: anime.stagger(100, { start: 200 }),
      duration: 600,
      easing: "easeOutBack",
    });
  }, [scanReport]);

  // Error shake animation
  useEffect(() => {
    if (!errorRef.current || !errorMessage) return;
    anime({
      targets: errorRef.current,
      translateX: [-8, 8, -6, 6, -3, 0],
      duration: 500,
      easing: "easeOutQuad",
    });
  }, [errorMessage]);

  const loadUrl = async () => {
    const savedAuto = localStorage.getItem("autoscan_enabled") === "true";
    setAutoScan(savedAuto);

    if (!chromeBridge.isAvailable()) {
      const devUrl = "http://localhost:3000";
      setCurrentUrl(devUrl);
      setUrlStatus(scanUrl(devUrl));
      return;
    }

    try {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        setCurrentUrl(tabs[0].url);
        setUrlStatus(scanUrl(tabs[0].url));
        if (savedAuto && tabs[0].id) triggerPageScan(tabs[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadUrl();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const triggerPageScan = async (tabId?: number) => {
    if (scanningRef.current) return;
    setErrorMessage(null);
    setIsScanning(true);
    scanningRef.current = true;
    setScanReport(null);

    const cleanup = () => {
      setIsScanning(false);
      scanningRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    timeoutRef.current = setTimeout(() => {
      if (scanningRef.current) {
        setErrorMessage("Scan timed out. Reload and try again.");
        cleanup();
      }
    }, 10000);

    if (!chromeBridge.isAvailable()) {
      cleanup();
      setErrorMessage("Chrome extension environment required.");
      return;
    }

    let targetId = tabId;
    if (!targetId) {
      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      targetId = tabs[0]?.id;
    }

    if (!targetId) {
      cleanup();
      setErrorMessage("No active tab found.");
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
        setErrorMessage(response?.error || response?.message || "No response from page or unsupported URL.");
      }
    } catch (err: any) {
      cleanup();
      setErrorMessage(`Scan failed: ${err.message}`);
    }
  };

  return (
    <div className="w-full space-y-4">
      <StatusBanner
        statusRef={statusRef}
        radarRef={radarRef}
        isSafe={isSafe}
        statusText={statusText}
        currentUrl={currentUrl}
        urlStatus={urlStatus}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">Auto-Scan Pages</span>
        <Switch
          checked={autoScan}
          onCheckedChange={(enabled) => {
            setAutoScan(enabled);
            localStorage.setItem("autoscan_enabled", String(enabled));
          }}
        />
      </div>

      <Button
        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-2"
        onClick={() => triggerPageScan()}
        disabled={isScanning}
      >
        <Scan className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
        {isScanning ? "Scanning Page..." : "Scan Page Content"}
      </Button>

      {errorMessage && (
        <div ref={errorRef} className="p-3 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl space-y-2">
          <div className="font-bold">⚠️ {errorMessage}</div>
        </div>
      )}

      {scanReport && (
        <ScanReport
          reportRef={reportRef}
          scanReport={scanReport}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
        />
      )}
    </div>
  );
}

function StatusBanner({ statusRef, radarRef, isSafe, statusText, currentUrl, urlStatus }: Readonly<any>) {
  return (
    <div
      ref={statusRef}
      className={`relative flex flex-col gap-1 rounded-xl p-3 border overflow-hidden ${
        isSafe ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
      }`}
    >
      <div
        ref={radarRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          display: "none",
          background: `conic-gradient(from 0deg, transparent 0deg, ${isSafe ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)"} 60deg, transparent 120deg)`,
          borderRadius: "inherit",
        }}
      />
      <div className="flex items-center gap-2 text-sm font-bold relative z-10">
        {!isSafe && urlStatus?.isMalicious ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {!isSafe ? (urlStatus?.isMalicious ? "THREAT DETECTED" : "TRACKER DETECTED") : statusText}
      </div>
      <div className="text-xs opacity-80 break-all line-clamp-1 relative z-10">{currentUrl || "Scanning..."}</div>
      {!isSafe && urlStatus?.details && (
        <div className="mt-1 text-xs font-bold bg-red-500 text-white px-2 py-1 rounded w-fit relative z-10">
          {urlStatus.details}
        </div>
      )}
    </div>
  );
}

function ScanReport({ reportRef, scanReport, showDetails, setShowDetails }: Readonly<any>) {
  return (
    <div ref={reportRef} className="text-xs bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 backdrop-blur-sm" style={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 flex items-center gap-1">
          {scanReport.type === "PDF" ? <FileText className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
          Target Source:
        </span>
        <span className="font-mono text-zinc-200">{scanReport.type}</span>
      </div>

      {scanReport.type === "PDF" ? (
        <p className="text-zinc-500 italic mt-1 font-medium">PDF content verified. Individual links unscannable.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <StatButton label="Links Found" value={scanReport.total} active={showDetails === "safe"} onClick={() => setShowDetails(showDetails === "safe" ? null : "safe")} />
          <StatButton label="Threats" value={scanReport.bad} active={showDetails === "threats"} onClick={() => setShowDetails(showDetails === "threats" ? null : "threats")} critical={scanReport.bad > 0} />
          
          <ReportDetails type={showDetails} report={scanReport} />
        </div>
      )}
    </div>
  );
}

function StatButton({ label, value, active, onClick, critical }: Readonly<any>) {
  return (
    <button
      type="button"
      className={`w-full bg-zinc-950 p-3 rounded-xl text-center border transition-all duration-200 hover:bg-zinc-800 ${active ? (critical ? "border-red-500" : "border-emerald-500") : (critical ? "border-red-900" : "border-transparent")}`}
      onClick={onClick}
    >
      <div className={`text-[10px] uppercase tracking-wider font-black ${critical ? "text-red-400" : "text-zinc-500"}`}>{label}</div>
      <div className={`stat-number text-lg font-black ${critical ? "text-red-500" : "text-emerald-500"}`}>{value}</div>
    </button>
  );
}

function ReportDetails({ type, report }: Readonly<any>) {
  if (!type) return null;
  const isThreats = type === "threats";
  const items = isThreats ? report.maliciousLinks : report.safeLinks;
  
  return (
    <div className={`col-span-2 mt-2 max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl text-[10px] border ${isThreats ? "bg-red-950/20 border-red-900/50" : "bg-black/40 border-zinc-800"}`}>
      <div className={`font-black uppercase tracking-widest mb-2 ${isThreats ? "text-yellow-400" : "text-zinc-500"}`}>
        {isThreats ? `Security & Trackers (${items.length})` : `Validated Links (${items.length})`}
      </div>
      {items.map((link: ScanResult, i: number) => (
        <div key={`${link.url}-${i}`} className="flex flex-col mb-2 last:mb-0 pb-2 border-b border-white/5 last:border-0">
          <span className="truncate text-zinc-300 font-mono" title={String(link.url)}>{String(link.url)}</span>
          {isThreats && (
            <span className={`${link.isMalicious ? 'text-red-500' : 'text-yellow-500'} font-black uppercase text-[8px] mt-0.5`}>
              {link.isMalicious ? '🔥 MALICIOUS' : '🛑 TRACKER'} - {link.details}
            </span>
          )}
        </div>
      ))}
      {items.length === 0 && <div className="text-zinc-600 italic py-2">No items discovered.</div>}
    </div>
  );
}
