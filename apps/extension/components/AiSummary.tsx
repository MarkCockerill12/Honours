"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, Brain, Globe, AlertCircle } from "lucide-react";
import { useTheme } from "@privacy-shield/core";
import anime from "animejs";
import { chromeBridge } from "../utils/chromeBridge";

export function AiSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterWarnings, setFilterWarnings] = useState<string[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const { colors, theme } = useTheme();

  // Check for active filter matches on the current page immediately on mount
  useEffect(() => {
    if (!chromeBridge.isAvailable()) return;
    (async () => {
      try {
        const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
        if (!tabs[0]?.id) return;
        const textResp = await chromeBridge.sendMessage(tabs[0].id, { action: "GET_PAGE_TEXT" });
        if (!textResp?.success || !textResp.text) return;
        const lowerText = textResp.text.toLowerCase();
        const res = await (chrome as any).storage.local.get(["filters"]);
        const filters = (res.filters || []).filter((f: any) => f.enabled && f.blockTerm?.trim());
        const matches = filters
          .filter((f: any) => lowerText.includes(f.blockTerm.toLowerCase()))
          .map((f: any) => f.blockTerm);
        setFilterWarnings(matches);
      } catch { /* ignore */ }
    })();
  }, []);

  // Summary entrance animation
  useEffect(() => {
    if (!summaryRef.current || !summary) return;
    anime({
      targets: summaryRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      easing: "easeOutQuart",
    });
  }, [summary]);

  const getPageText = async (tabs: any[]) => {
    if (!tabs[0]?.id) return { success: false, error: "No active tab found" };
    const url = tabs[0].url || "";
    if (url.toLowerCase().endsWith(".pdf") || url.includes("application/pdf")) {
      return { success: true, url, text: "" };
    }
    const textResp = await chromeBridge.sendMessage(tabs[0].id, { action: "GET_PAGE_TEXT" });
    if (textResp?.success) {
      return { success: true, url, text: textResp.text };
    }
    return { success: false, error: "Could not extract text from this page." };
  };

  const handleSummarize = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      if (!chromeBridge.isAvailable()) {
        setError("Extension context unavailable.");
        setIsLoading(false);
        return;
      }

      const tabs = await chromeBridge.queryTabs({ active: true, currentWindow: true });
      const pageData = await getPageText(tabs);

      if (!pageData.success) {
        setError(pageData.error!);
        setIsLoading(false);
        return;
      }

      const resp = await chromeBridge.sendMessage(undefined as any, {
        action: "SUMMARIZE_TEXT",
        text: pageData.text,
        url: pageData.url,
      });

      if (resp?.success && resp.summary) {
        setSummary(resp.summary);
      } else {
        setError(resp?.error || "Summary generation failed.");
      }
    } catch (err: any) {
      setError(`Summarization failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onAccentColor = theme === 'dark' ? '#005762' : '#ffffff';

  return (
    <div className="w-full space-y-4">
      {/* Filter trigger warning — shown immediately without needing to summarize */}
      {filterWarnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="text-amber-500 text-sm shrink-0">⚑</span>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Filter Triggers Detected</span>
            <span className="text-[10px] text-amber-400 font-medium">{filterWarnings.join(", ")}</span>
          </div>
        </div>
      )}
      {/* Primary Action */}
      <button
        onClick={handleSummarize}
        disabled={isLoading}
        className={`group relative w-full h-14 rounded-2xl flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-95 transition-all overflow-hidden ${theme === 'dark' ? 'bg-gradient-to-br from-[#81ecff] to-[#00d4ec]' : colors.accent}`}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: onAccentColor }} />
        ) : (
          <Brain className="w-5 h-5 group-hover:scale-110 transition-transform" style={{ fill: onAccentColor, color: onAccentColor }} />
        )}
        <span className="font-headline font-black text-sm tracking-tight" style={{ color: onAccentColor }}>
          {isLoading ? "ANALYZING CONTENT..." : "SUMMARIZE PAGE"}
        </span>
      </button>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="text-red-500 w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Processing Error</span>
            <span className="text-xs text-red-400 font-medium">{error}</span>
          </div>
        </div>
      )}

      {summary && (
        <div ref={summaryRef} className={`${colors.bgSecondary} border ${colors.border} rounded-2xl overflow-hidden shadow-sm`} style={{ opacity: 0 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-500/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${colors.success}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${colors.success}`}>AI Insight Report</span>
            </div>
            {isExpanded ? (
              <ChevronUp className={`h-4 w-4 ${colors.textSecondary} opacity-50`} />
            ) : (
              <ChevronDown className={`h-4 w-4 ${colors.textSecondary} opacity-50`} />
            )}
          </button>
          {isExpanded && (
            <div className={`px-5 pb-5 text-xs ${colors.text} leading-relaxed border-t ${colors.border} pt-4 max-h-[300px] overflow-y-auto custom-scrollbar`}>
              {renderSafeSummary(summary, colors.success)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderSafeSummary(text: string, accentColorClass: string) {
  if (!text) return null;

  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = (listIndex: number) => {
    if (currentList.length > 0) {
      result.push(
        <ul key={`ul-${listIndex}`} className="list-disc pl-5 my-3 space-y-1.5">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const isTriggerWarning = trimmed.toUpperCase().startsWith("TRIGGER WARNING:");
    const lineHash = `line-${i}-${trimmed.substring(0, 10).replaceAll(/\s/g, "-")}`;

    const isFilterMatch = trimmed.toUpperCase().startsWith("FILTER MATCHES:");

    if (isFilterMatch) {
      result.push(
        <div key={`fm-${i}`} className="mb-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] tracking-widest font-bold flex items-center gap-2">
          <span>⚑ {trimmed}</span>
        </div>
      );
    } else if (isTriggerWarning) {
      const content = trimmed.replace(/^TRIGGER WARNING:\s*/i, '').trim();
      const isNone = content.toLowerCase() === 'none' || content.toLowerCase() === 'none detected';
      if (!isNone) {
        result.push(
          <div key={`tw-${i}`} className="mb-2 p-2.5 rounded-lg text-[10px] tracking-widest font-bold flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500">
            <AlertCircle size={14} />
            <span>⚠ {content}</span>
          </div>
        );
      }
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const content = trimmed.substring(2).trim();
      if (content.toLowerCase() === 'none' || content.toLowerCase() === 'none detected') return;
      currentList.push(<li key={`li-${i}-${lineHash}`} className="marker:text-primary">{parseInline(content)}</li>);
    } else {
      flushList(i);
      if (trimmed === "") {
        if (result.length > 0 && i < lines.length - 1) {
          result.push(<div key={`br-${i}`} className="h-2" />);
        }
      } else {
        result.push(
          <p key={`p-${i}-${lineHash}`} className="my-2 font-medium">
            {parseInline(line)}
          </p>
        );
      }
    }
  });

  flushList(lines.length);
  return result;
}

function parseInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    const key = `inline-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key} className="font-black text-primary">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key} className="italic opacity-90">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
