"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronDown, ChevronUp, Settings as SettingsIcon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import anime from "animejs";
import { chromeBridge } from "../Utils/chromeBridge";

export function AiSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [groqApiKey, setGroqApiKey] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const { colors } = useTheme();

  // Load API key from storage
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["groqApiKey"], (result: { [key: string]: any }) => {
        if (typeof result.groqApiKey === "string") {
          setGroqApiKey(result.groqApiKey);
        }
      });
    }
  }, []);

  const saveApiKey = () => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ groqApiKey }, () => {
        setShowApiKeyInput(false);
      });
    }
  };

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
    return { success: false, error: "Could not extract page text. Refresh and try again." };
  };

  const handleSummarize = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      if (!chromeBridge.isAvailable()) {
        setError("Chrome extension environment required.");
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

      if (!pageData.text && !pageData.url?.toLowerCase().endsWith(".pdf")) {
        setError("Not enough text content on this page to summarize.");
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
      setError(`Failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className={`text-sm font-black tracking-tight uppercase ${colors.text}`}>AI Summary</span>
        </div>
        <button 
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className={`p-1 rounded-md hover:bg-white/10 transition-colors ${showApiKeyInput ? 'text-purple-400' : colors.textSecondary}`}
        >
          <SettingsIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {showApiKeyInput && (
        <div className={`p-3 rounded-xl border ${colors.border} ${colors.bgSecondary} space-y-2 animate-in fade-in slide-in-from-top-1`}>
          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Groq API Key</div>
          <div className="flex gap-2">
            <input 
              type="password"
              placeholder="gsk_..."
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-purple-500/50"
            />
            <Button size="sm" className="h-7 px-3 bg-purple-600 hover:bg-purple-500 text-[10px] font-bold" onClick={saveApiKey}>
              SAVE
            </Button>
          </div>
          <p className="text-[8px] text-zinc-500 leading-tight">
            Key is stored locally in your browser. Get one at groq.com.
          </p>
        </div>
      )}

      <Button
        className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/20 flex items-center gap-2"
        onClick={handleSummarize}
        disabled={isLoading}
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
            <div className={`px-4 pb-4 text-xs ${colors.text} leading-relaxed border-t ${colors.border} pt-3 prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5`}>
              {renderSafeSummary(summary, colors.textSecondary)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderSafeSummary(text: string, secondaryColor: string) {
  if (!text) return null;

  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = (listIndex: number) => {
    if (currentList.length > 0) {
      result.push(
        <ul key={`ul-${listIndex}`} className="list-disc pl-5 my-2 space-y-1">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const lineHash = `line-${i}-${trimmed.substring(0, 10).replaceAll(/\s/g, "-")}`;

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const content = trimmed.substring(2);
      currentList.push(<li key={`li-${i}-${lineHash}`}>{parseInline(content)}</li>);
    } else {
      flushList(i);
      if (trimmed === "") {
        if (result.length > 0 && i < lines.length - 1) {
          result.push(<div key={`br-${i}`} className="h-2" />);
        }
      } else {
        result.push(
          <p key={`p-${i}-${lineHash}`} className="my-1">
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
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

