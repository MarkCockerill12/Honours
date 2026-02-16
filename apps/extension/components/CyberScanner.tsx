import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck, Scan, FileText, Globe } from 'lucide-react';
import { scanUrl, ScanResult } from '../Utils/security';

export function CyberScanner() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [urlStatus, setUrlStatus] = useState<ScanResult | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  
  // Page Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanReport, setScanReport] = useState<{
    total: number;
    bad: number;
    type: 'WEB' | 'PDF' | null;
  } | null>(null);

  // Helper: Safely get the tab URL (Works in Dev Iframe & Prod Extension)
  const getTabUrl = (callback: (url: string, tabId?: number) => void) => {
    // 1. Production Mode (Real Extension)
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) callback(tabs[0].url, tabs[0].id);
      });
    } 
    // 2. Dev Mode (Iframe fallback)
    else {
      // We are in dev mode, likely localhost
      setCurrentUrl("http://localhost (Dev Mode)"); 
    }
  };

  // 1. On Load & Auto-Scan Logic
  useEffect(() => {
    const savedAuto = localStorage.getItem('autoscan_enabled') === 'true';
    setAutoScan(savedAuto);

    getTabUrl((url, id) => {
      setCurrentUrl(url);
      const result = scanUrl(url);
      setUrlStatus(result);

      if (savedAuto && id) {
        triggerPageScan(id);
      }
    });
  }, []);

  const toggleAutoScan = (enabled: boolean) => {
    setAutoScan(enabled);
    localStorage.setItem('autoscan_enabled', String(enabled));
  };

  // 3. The Scanning Logic
  const triggerPageScan = (tabId?: number) => {
    setErrorMessage(null);
    setIsScanning(true);
    setScanReport(null);

    // ============================================================
    // 🛠️ DEV MODE BRIDGE (Fixes "Not working in Dev Mode")
    // ============================================================
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      console.log("Environment: Dev Mode (Using Bridge)");
      window.parent.postMessage({ action: 'EXECUTE_SCAN' }, '*');
      
      const handleBridgeResult = (event: MessageEvent) => {
        if (event.data.action === 'SCAN_RESULT') {
          setIsScanning(false); // ✅ Stop loading
          window.removeEventListener('message', handleBridgeResult);

          if (event.data.error) {
             console.warn("Bridge Error:", event.data.error);
             setErrorMessage("Connection failed. Refresh the web page.");
             return;
          }
          if (event.data.data) {
             setScanReport({
              total: event.data.data.linkCount,
              bad: event.data.data.maliciousCount,
              type: event.data.data.type
            });
          }
        }
      };
      window.addEventListener('message', handleBridgeResult);
      return; 
    }

    // ============================================================
    // PRODUCTION MODE (Real Extension)
    // ============================================================
    if (!tabId) {
       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
         if (tabs[0]?.id) triggerPageScan(tabs[0].id);
         else {
            setIsScanning(false);
            setErrorMessage("No active tab found.");
         }
       });
       return;
    }

    chrome.tabs.sendMessage(
      tabId, 
      { action: "SCAN_PAGE_LINKS" }, 
      (response) => {
        setIsScanning(false); // ✅ FIX: Stop loading even if error occurs
        
        if (chrome.runtime.lastError) {
          console.warn("Scan failed:", chrome.runtime.lastError.message);
          setErrorMessage("Connection failed. Try refreshing the web page.");
          return;
        }

        if (response) {
          setScanReport({
            total: response.linkCount,
            bad: response.maliciousCount,
            type: response.type
          });
        }
      }
    );
  };

  return (
    <Card className="w-full border-zinc-800 bg-zinc-950 text-zinc-100">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Cyber Guard</CardTitle>
        {urlStatus?.isSafe ? (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-red-500" />
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Box */}
        <div className={`flex flex-col gap-1 rounded-md p-3 border ${
          urlStatus?.isSafe 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
            : 'bg-red-500/10 border-red-500/20 text-red-500'
        }`}>
          <div className="flex items-center gap-2 text-sm font-bold">
            {urlStatus?.isSafe ? "SAFE CONNECTION" : "THREAT DETECTED"}
          </div>
          <div className="text-xs opacity-80 break-all line-clamp-1">
            {currentUrl || "Scanning..."}
          </div>
          {!urlStatus?.isSafe && (
             <div className="mt-1 text-xs font-bold bg-red-500 text-white px-2 py-1 rounded w-fit">
               {urlStatus?.details}
             </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Auto-Scan Pages</span>
          <Switch checked={autoScan} onCheckedChange={toggleAutoScan} />
        </div>

        <div className="space-y-2">
          <Button 
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-2"
            onClick={() => triggerPageScan()}
            disabled={isScanning}
          >
            {isScanning ? <Scan className="animate-spin h-4 w-4" /> : <Scan className="h-4 w-4" />}
            {isScanning ? "Scanning Page..." : "Scan Page Content"}
          </Button>

           {errorMessage && (
            <div className="p-2 text-xs bg-red-500/10 text-red-500 border border-red-500/20 rounded">
              ⚠️ {errorMessage}
            </div>
          )}

          {scanReport && (
            <div className="text-xs bg-zinc-900 p-2 rounded border border-zinc-800 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-400 flex items-center gap-1">
                  {scanReport.type === 'PDF' ? <FileText className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                  Target:
                </span>
                <span className="font-mono text-zinc-200">{scanReport.type}</span>
              </div>
              
              {scanReport.type === 'PDF' ? (
                 <p className="text-zinc-500 italic mt-1">
                   PDF Source Verified. Internal links cannot be scanned via API.
                 </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-zinc-950 p-2 rounded text-center">
                    <div className="text-zinc-400">Links Found</div>
                    <div className="text-lg font-bold">{scanReport.total}</div>
                  </div>
                  <div className={`bg-zinc-950 p-2 rounded text-center border ${scanReport.bad > 0 ? 'border-red-900' : ''}`}>
                    <div className={scanReport.bad > 0 ? "text-red-400" : "text-zinc-400"}>Threats</div>
                    <div className={`text-lg font-bold ${scanReport.bad > 0 ? "text-red-500" : "text-emerald-500"}`}>
                      {scanReport.bad}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}