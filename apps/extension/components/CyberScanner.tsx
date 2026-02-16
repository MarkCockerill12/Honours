import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck, Scan } from 'lucide-react';

// IMPORT FROM YOUR NEW CORE PACKAGE
import { scanUrl } from '../Utils/security'; 

export function CyberScanner() {
  const [autoScan, setAutoScan] = useState(false);
  const [status, setStatus] = useState<'safe' | 'danger' | 'idle'>('idle');
  const [currentUrl, setCurrentUrl] = useState('');

  // Simulating getting the current tab URL
  useEffect(() => {
    // TODO: Integrate with chrome.tabs API to detect current active URL real-time
    // In a real Chrome Extension, this would be:
    // chrome.tabs.query({active: true, currentWindow: true}, (tabs) => ...)
    setCurrentUrl(window.location.href); 
  }, []);

  const handleManualScan = () => {
    setStatus('idle');
    
    // USE THE CORE LOGIC HERE
    const result = scanUrl(currentUrl);
    
    setTimeout(() => { // Fake a slight delay for "scanning" effect
      if (result.isSafe) {
        setStatus('safe');
      } else {
        setStatus('danger');
      }
    }, 800);
  };

  return (
    <Card className="w-full border-zinc-800 bg-zinc-950 text-zinc-100">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Cyber Guard</CardTitle>
        <ShieldCheck className={`h-4 w-4 ${status === 'danger' ? 'text-red-500' : 'text-emerald-500'}`} />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* Status Display */}
          <div className={`flex items-center gap-2 rounded-md p-3 text-sm font-medium ${
            status === 'danger' ? 'bg-red-500/10 text-red-500' : 
            status === 'safe' ? 'bg-emerald-500/10 text-emerald-500' : 
            'bg-zinc-900 text-zinc-400'
          }`}>
            {status === 'danger' && <ShieldAlert className="h-4 w-4" />}
            {status === 'safe' && <ShieldCheck className="h-4 w-4" />}
            {status === 'idle' && <Scan className="h-4 w-4" />}
            
            {status === 'idle' ? 'System Ready' : 
             status === 'safe' ? 'No Threats Detected' : 
             'PHISHING DETECTED'}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Auto-Scan on Load</span>
            <Switch checked={autoScan} onCheckedChange={setAutoScan} />
          </div>

          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleManualScan}
          >
            Scan Current Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}