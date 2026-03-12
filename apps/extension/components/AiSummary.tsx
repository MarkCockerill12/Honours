"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "@/packages/ui/ThemeProvider";
import anime from "animejs";
import { chromeBridge } from "../Utils/chromeBridge";

interface AiSummaryProps {
  isActive: boolean;
}

export function AiSummary({ isActive }: Readonly<AiSummaryProps>) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const summaryRef = useRef<HTMLDivElement>(null);
  const { colors } = useTheme();

  // Summary entrance animation
  useEffect(() => {
    if (!summaryRef.current || !summary) return;
    anime({
      targets: summaryRef.current,
      translateY: [10, 0],
      opacity: [0, 1],
      duration: 500,
      easing: "easeOutExpo",
    });
  }, [summary]);

  const handleSummarize = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      // 1. Get page text from content script
      let text = "";
      if (chromeBridge.isAvailable()) {
        const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          const textResp = await chromeBridge.sendMessage(tabs[0].id, { action: "GET_PAGE_TEXT" });
          if (textResp?.success) {
            text = textResp.text;
          } else {
            setError("Could not extract page text. Refresh and try again.");
            setIsLoading(false);
            return;
          }
        }
      } else {
        setError("Chrome extension environment required.");
        setIsLoading(false);
        return;
      }

      if (!text || text.trim().length < 50) {
        setError("Not enough text content on this page to summarize.");
        setIsLoading(false);
        return;
      }

      // 2. Send to background for Gemini API call
      const resp = await chromeBridge.sendMessage(undefined as any, {
        action: "SUMMARIZE_TEXT",
        text,
      });

      if (resp?.success && resp.summary) {
        setSummary(resp.summary);
      } else {
        setError(resp?.error || "Summary generation failed.");
      }
    } catch (err: any) {
      setError(`Failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-400" />
        <span className={`text-sm font-black tracking-tight uppercase ${colors.text}`}>AI Summary</span>
      </div>

      <Button
        className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/20 flex items-center gap-2"
        onClick={handleSummarize}
        disabled={isLoading || !isActive}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isLoading ? "Generating Summary..." : "Summarize This Page"}
      </Button>

      {error && (
        <div className="p-2.5 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold uppercase tracking-wider">
          {error}
        </div>
      )}

      {summary && (
        <div ref={summaryRef} className={`${colors.bgSecondary} border ${colors.border} rounded-xl overflow-hidden`} style={{ opacity: 0 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-3 text-left hover:opacity-80 transition-opacity"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> AI Summary
            </span>
            {isExpanded ? (
              <ChevronUp className={`h-3 w-3 ${colors.textSecondary}`} />
            ) : (
              <ChevronDown className={`h-3 w-3 ${colors.textSecondary}`} />
            )}
          </button>
          {isExpanded && (
            <div className={`px-3 pb-3 text-xs ${colors.text} leading-relaxed whitespace-pre-wrap border-t ${colors.border} pt-2`}>
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
