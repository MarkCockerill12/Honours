import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldAlert, Zap, EyeOff } from 'lucide-react';

// IMPORT SHARED LOGIC
import { parseAdblockRules } from '@/packages/core/src/adblock';

export function SmartFilters() {
  const [adblockEnabled, setAdblockEnabled] = useState(false);
  const [trackerBlocking, setTrackerBlocking] = useState(false);
  const [stats, setStats] = useState({ adsBlocked: 0, trackersBlocked: 0 });

  // 1. On Mount: Check storage for saved settings
  useEffect(() => {
    // Mock loading from chrome.storage.local
    const saved = localStorage.getItem('adblock_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setAdblockEnabled(parsed.adblock);
      setTrackerBlocking(parsed.trackers);
    }
  }, []);

  // 2. Effect: Update Rules when toggle changes
  useEffect(() => {
    // TODO: Implement chrome.declarativeNetRequest to apply these rules at the browser level
    // This is where we would call the Chrome DNR API
    // chrome.declarativeNetRequest.updateDynamicRules(...)
    
    // For now, we use our Core logic to generate the rules
    const rules = parseAdblockRules(adblockEnabled);
    console.log("Active Rules Generated:", rules.length);
    
    // Save state
    localStorage.setItem('adblock_settings', JSON.stringify({
      adblock: adblockEnabled,
      trackers: trackerBlocking
    }));

  }, [adblockEnabled, trackerBlocking]);

  return (
    <Card className="w-full border-zinc-800 bg-zinc-950 text-zinc-100">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Smart Filters</CardTitle>
          <Shield className={`h-4 w-4 ${adblockEnabled ? 'text-emerald-500' : 'text-zinc-600'}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Adblock Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${adblockEnabled ? 'bg-emerald-500/10' : 'bg-zinc-900'}`}>
              <Zap className={`h-4 w-4 ${adblockEnabled ? 'text-emerald-500' : 'text-zinc-500'}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Ad Blocker</span>
              <span className="text-xs text-zinc-500">Block intrusive ads</span>
            </div>
          </div>
          <Switch checked={adblockEnabled} onCheckedChange={setAdblockEnabled} />
        </div>

        {/* Tracker Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${trackerBlocking ? 'bg-blue-500/10' : 'bg-zinc-900'}`}>
              <EyeOff className={`h-4 w-4 ${trackerBlocking ? 'text-blue-500' : 'text-zinc-500'}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Tracker Blocker</span>
              <span className="text-xs text-zinc-500">Stop data harvesting</span>
            </div>
          </div>
          <Switch checked={trackerBlocking} onCheckedChange={setTrackerBlocking} />
        </div>

        {/* Stats Section */}
        {(adblockEnabled || trackerBlocking) && (
          <div className="mt-4 rounded-md bg-zinc-900/50 p-3">
            <div className="flex justify-between items-center text-xs text-zinc-400 mb-2">
              <span>Session Stats</span>
              <Badge variant="outline" className="border-zinc-700 text-zinc-400">Live</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-900 rounded p-2 text-center">
                <span className="block text-lg font-bold text-emerald-500">{stats.adsBlocked}</span>
                <span className="text-[10px] text-zinc-500">Ads</span>
              </div>
              <div className="bg-zinc-900 rounded p-2 text-center">
                <span className="block text-lg font-bold text-blue-500">{stats.trackersBlocked}</span>
                <span className="text-[10px] text-zinc-500">Trackers</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}