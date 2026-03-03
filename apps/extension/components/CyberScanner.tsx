import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, ShieldCheck, Scan, FileText, Globe } from "lucide-react";
import anime from "animejs";
import { scanUrl, ScanResult } from "../Utils/security";
import { chromeBridge } from "../Utils/chromeBridge";

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

  const [showDetails, setShowDetails] = useState<"safe" | "threats" | null>(
    null,
  );

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanningRef = useRef<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const scanBtnRef = useRef<HTMLButtonElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Entrance animation removed to avoid conflict with CollapsibleSection
  useEffect(() => {
    // Component is ready
  }, []);

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

  // Status bar animation on URL status change
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
    // Animate the stat numbers
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

  const getTabUrl = async (callback: (url: string, tabId?: number) => void) => {
    if (!chromeBridge.isAvailable()) {
      const devUrl = "http://localhost:3000";
      setCurrentUrl(devUrl);
      callback(devUrl, undefined);
      return;
    }

    try {
      const tabs = await chromeBridge.queryTabs({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]?.url) {
        callback(tabs[0].url, tabs[0].id);
      }
    } catch (error) {
      console.error("[CyberScanner] Error querying tabs:", error);
      const devUrl = "http://localhost:3000";
      setCurrentUrl(devUrl);
      callback(devUrl, undefined);
    }
  };

  useEffect(() => {
    const savedAuto = localStorage.getItem("autoscan_enabled") === "true";
    setAutoScan(savedAuto);

    getTabUrl((url, id) => {
      setCurrentUrl(url);
      const result = scanUrl(url);
      setUrlStatus(result);

      if (savedAuto && id) {
        triggerPageScan(id);
      }
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const toggleAutoScan = (enabled: boolean) => {
    setAutoScan(enabled);
    localStorage.setItem("autoscan_enabled", String(enabled));
  };

  const stopScanning = () => {
    setIsScanning(false);
    scanningRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const triggerPageScan = async (tabId?: number) => {
    if (scanningRef.current) return;

    // Button press animation
    if (scanBtnRef.current) {
      anime({
        targets: scanBtnRef.current,
        scale: [1, 0.95, 1],
        duration: 200,
        easing: "easeOutQuad",
      });
    }

    setErrorMessage(null);
    setIsScanning(true);
    scanningRef.current = true;
    setScanReport(null);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (scanningRef.current) {
        setErrorMessage(
          "Scan timed out. Page may not be responsive or content script not loaded.",
        );
        stopScanning();
      }
    }, 10000);

    if (!chromeBridge.isAvailable()) {
      stopScanning();
      setErrorMessage(
        "Chrome APIs not available. Make sure you are running this as a Chrome extension.",
      );
      return;
    }

    if (!tabId) {
      try {
        const tabs = await chromeBridge.queryTabs({
          active: true,
          currentWindow: true,
        });
        if (tabs[0]?.id) {
          triggerPageScan(tabs[0].id);
        } else {
          stopScanning();
          setErrorMessage("No active tab found.");
        }
      } catch (error) {
        stopScanning();
        setErrorMessage("Failed to query tabs.");
      }
      return;
    }

    try {
      const response = await chromeBridge.sendMessage(tabId, {
        action: "SCAN_PAGE_LINKS",
      });
      stopScanning();

      if (response) {
        setScanReport({
          total: response.linkCount,
          bad: response.maliciousCount,
          type: response.type,
          maliciousLinks: response.maliciousLinks || [],
          safeLinks: response.safeLinks || [],
        });
      } else {
        setErrorMessage("No response from page. Reload and try again.");
      }
    } catch (error: any) {
      stopScanning();
      setErrorMessage(
        `Connection failed: ${error.message}. Try refreshing the web page.`,
      );
    }
  };

  const isSafe = urlStatus ? urlStatus.isSafe : true;
  const isLoading = urlStatus === null;

  let statusText = "INITIALIZING...";
  if (!isLoading) {
    statusText = isSafe ? "SAFE CONNECTION" : "THREAT DETECTED";
  }

  return (
    <div
      ref={cardRef}
      className="w-full text-zinc-100 space-y-4"
    >
      {/* Status Banner */}
      <div
        ref={statusRef}
        className={`relative flex flex-col gap-1 rounded-xl p-3 border overflow-hidden ${
          isSafe
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
            : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}
      >
        {/* Radar sweep overlay (visible during scan) */}
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
          {isSafe ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          {statusText}
        </div>
        <div className="text-xs opacity-80 break-all line-clamp-1 relative z-10">
          {currentUrl || "Scanning..."}
        </div>
        {!isSafe && !isLoading && (
          <div className="mt-1 text-xs font-bold bg-red-500 text-white px-2 py-1 rounded w-fit relative z-10">
            {urlStatus?.details}
          </div>
        )}
      </div>

      {/* Auto-scan toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">Auto-Scan Pages</span>
        <Switch checked={autoScan} onCheckedChange={toggleAutoScan} />
      </div>

      {/* Scan Button */}
      <Button
        ref={scanBtnRef}
        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-2 transition-all duration-200"
        onClick={() => triggerPageScan()}
        disabled={isScanning}
      >
        <Scan className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
        {isScanning ? "Scanning Page..." : "Scan Page Content"}
      </Button>

      {/* Error */}
      {errorMessage && (
        <div
          ref={errorRef}
          className="p-3 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl space-y-2"
        >
          <div className="font-bold">⚠️ {errorMessage}</div>
          {errorMessage.includes("Chrome APIs") && (
            <div className="text-[10px] text-red-300 space-y-1 mt-2">
              <p className="font-semibold">Steps to fix:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>
                  Make sure{" "}
                  <code className="bg-black/30 px-1 rounded">
                    npm run dev:extension
                  </code>{" "}
                  is running
                </li>
                <li>Reload the extension in Chrome (chrome://extensions/)</li>
                <li>Close and reopen the extension popup</li>
                <li>If still not working, try visiting a real website first</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Scan Report */}
      {scanReport && (
        <div
          ref={reportRef}
          className="text-xs bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 backdrop-blur-sm"
          style={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-400 flex items-center gap-1">
              {scanReport.type === "PDF" ? (
                <FileText className="h-3 w-3" />
              ) : (
                <Globe className="h-3 w-3" />
              )}
              Target:
            </span>
            <span className="font-mono text-zinc-200">{scanReport.type}</span>
          </div>

          {scanReport.type === "PDF" ? (
            <p className="text-zinc-500 italic mt-1">
              PDF Source Verified. Links inside PDF cannot be scanned.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                className="w-full bg-zinc-950 p-3 rounded-xl text-center cursor-pointer hover:bg-zinc-800 transition-all duration-200"
                onClick={() =>
                  setShowDetails(showDetails === "safe" ? null : "safe")
                }
              >
                <div className="text-zinc-400 text-[10px] uppercase tracking-wider">
                  Links Found
                </div>
                <div className="stat-number text-lg font-bold text-zinc-100">
                  {scanReport.total}
                </div>
              </button>
              <button
                type="button"
                className={`w-full bg-zinc-950 p-3 rounded-xl text-center border cursor-pointer hover:bg-zinc-800 transition-all duration-200 ${scanReport.bad > 0 ? "border-red-900" : "border-transparent"}`}
                onClick={() =>
                  setShowDetails(showDetails === "threats" ? null : "threats")
                }
              >
                <div
                  className={`text-[10px] uppercase tracking-wider ${scanReport.bad > 0 ? "text-red-400" : "text-zinc-400"}`}
                >
                  Threats
                </div>
                <div
                  className={`stat-number text-lg font-bold ${scanReport.bad > 0 ? "text-red-500" : "text-emerald-500"}`}
                >
                  {scanReport.bad}
                </div>
              </button>

              {/* Detail Lists */}
              {showDetails === "safe" && scanReport.safeLinks && (
                <div className="col-span-2 mt-2 max-h-40 overflow-y-auto space-y-1 bg-zinc-950 p-2 rounded-xl text-xs border border-zinc-800">
                  <div className="font-bold text-zinc-400 mb-1">
                    Safe Links ({scanReport.safeLinks.length})
                  </div>
                  {scanReport.safeLinks.map((link, i) => (
                    <div
                      key={`${link.url}-${i}`}
                      className="truncate text-zinc-500 hover:text-zinc-300 transition-colors"
                      title={typeof link.url === "string" ? link.url : ""}
                    >
                      {typeof link.url === "string" ? link.url : "Unknown Link"}
                    </div>
                  ))}
                  {scanReport.safeLinks.length === 0 && (
                    <div className="text-zinc-600 italic">
                      No safe links found.
                    </div>
                  )}
                </div>
              )}

              {showDetails === "threats" && scanReport.maliciousLinks && (
                <div className="col-span-2 mt-2 max-h-40 overflow-y-auto space-y-1 bg-red-950/20 p-2 rounded-xl text-xs border border-red-900/50">
                  <div className="font-bold text-red-400 mb-1">
                    Threats Detected ({scanReport.maliciousLinks.length})
                  </div>
                  {scanReport.maliciousLinks.map((link, i) => (
                    <div
                      key={`${link.url}-${i}`}
                      className="flex flex-col mb-2 border-b border-red-500/10 pb-1 last:border-0"
                    >
                      <span
                        className="truncate text-red-300 font-mono"
                        title={typeof link.url === "string" ? link.url : ""}
                      >
                        {typeof link.url === "string"
                          ? link.url
                          : "Unknown Link"}
                      </span>
                      <span className="text-red-500 font-bold uppercase text-[10px]">
                        {link.threatType} - {link.details}
                      </span>
                    </div>
                  ))}
                  {scanReport.maliciousLinks.length === 0 && (
                    <div className="text-zinc-600 italic">
                      No threats found.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
