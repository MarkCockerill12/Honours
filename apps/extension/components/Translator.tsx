import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Languages, RefreshCw, CheckCircle2, X, Loader2 } from "lucide-react";
import anime from "animejs";
import { chromeBridge } from "../Utils/chromeBridge";

const SUPPORTED_LANGUAGES = [
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "zh-CN", name: "Chinese", flag: "🇨🇳" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
];

export function Translator() {
  const [targetLang, setTargetLang] = useState("es");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslationActive, setIsTranslationActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [translatedCount, setTranslatedCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const activeBannerRef = useRef<HTMLDivElement>(null);
  const translateBtnRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Entrance animation removed to avoid conflict with CollapsibleSection
  useEffect(() => {
    // Component is ready
  }, []);

  // Status message animation
  useEffect(() => {
    if (!statusRef.current || !status) return;
    anime({
      targets: statusRef.current,
      translateY: [-5, 0],
      opacity: [0, 1],
      duration: 400,
      easing: "easeOutExpo",
    });
  }, [status]);

  // Active banner slide animation
  useEffect(() => {
    if (!activeBannerRef.current) return;
    if (isTranslationActive) {
      anime({
        targets: activeBannerRef.current,
        height: [0, activeBannerRef.current.scrollHeight],
        opacity: [0, 1],
        duration: 400,
        easing: "easeOutExpo",
      });
    }
  }, [isTranslationActive]);

  // Progress bar animation during translation
  useEffect(() => {
    if (!progressRef.current) return;
    if (isTranslating) {
      progressRef.current.style.display = "block";
      anime({
        targets: progressRef.current,
        width: ["0%", "90%"],
        duration: 8000,
        easing: "easeOutQuad",
      });
    } else if (translatedCount > 0) {
      anime({
        targets: progressRef.current,
        width: "100%",
        duration: 300,
        easing: "easeOutQuad",
        complete: () => {
          setTimeout(() => {
            if (progressRef.current) {
              anime({
                targets: progressRef.current,
                opacity: 0,
                duration: 500,
                complete: () => {
                  if (progressRef.current) {
                    progressRef.current.style.display = "none";
                    progressRef.current.style.opacity = "1";
                    progressRef.current.style.width = "0%";
                  }
                },
              });
            }
          }, 600);
        },
      });
    }
  }, [isTranslating, translatedCount]);

  const handleTranslate = async () => {
    setIsTranslating(true);
    setStatus("Translating...");
    setTranslatedCount(0);

    // Button spin animation
    if (translateBtnRef.current) {
      anime({
        targets: translateBtnRef.current,
        rotate: 360,
        duration: 600,
        easing: "easeOutExpo",
      });
    }

    if (!chromeBridge.isAvailable()) {
      setIsTranslating(false);
      setStatus("Chrome APIs not available.");
      return;
    }

    try {
      const tabs = await chromeBridge.queryTabs({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]?.id) {
        setIsTranslating(false);
        setStatus("Error: No active tab.");
        return;
      }

      const response = await chromeBridge.sendMessage(tabs[0].id, {
        action: "TRANSLATE_PAGE",
        targetLang,
      });

      setIsTranslating(false);

      if (response?.success) {
        setIsTranslationActive(true);
        setTranslatedCount(response.count);
        setStatus(`✓ Translated ${response.count} elements.`);
      } else {
        setStatus("Translation failed.");
      }
    } catch (error: any) {
      setIsTranslating(false);
      setStatus(`Failed: ${error.message}`);
    }
  };

  const handleClearTranslation = async () => {
    setStatus("Clearing...");

    if (!chromeBridge.isAvailable()) {
      setStatus("Chrome APIs not available.");
      return;
    }

    try {
      const tabs = await chromeBridge.queryTabs({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]?.id) {
        setStatus("Error: No active tab.");
        return;
      }

      await chromeBridge.sendMessage(tabs[0].id, {
        action: "CLEAR_TRANSLATIONS",
      });

      // Animate banner out
      if (activeBannerRef.current) {
        anime({
          targets: activeBannerRef.current,
          height: 0,
          opacity: 0,
          duration: 300,
          easing: "easeInQuad",
          complete: () => {
            setIsTranslationActive(false);
            setTranslatedCount(0);
          },
        });
      } else {
        setIsTranslationActive(false);
        setTranslatedCount(0);
      }
      setStatus("Translations cleared.");
    } catch (error: any) {
      setStatus(`Failed: ${error.message}`);
    }
  };

  const selectedLang = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);

  return (
    <div ref={containerRef} className="w-full text-zinc-100 space-y-3">
      {/* Translation Active Banner */}
      {isTranslationActive && (
        <div
          ref={activeBannerRef}
          className="overflow-hidden"
          style={{ height: 0, opacity: 0 }}
        >
          <div className="flex items-center justify-between p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <Languages className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">
                {selectedLang?.flag} Translated to {selectedLang?.name} (
                {translatedCount} elements)
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-blue-500/20"
              onClick={handleClearTranslation}
            >
              <X className="h-3 w-3 text-blue-400" />
            </Button>
          </div>
        </div>
      )}

      {/* Language selector + translate button */}
      <div className="flex gap-2">
        <Select value={targetLang} onValueChange={setTargetLang}>
          <SelectTrigger className="w-full h-9 text-xs bg-zinc-900 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="Select Language" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          ref={translateBtnRef}
          className="bg-blue-600 hover:bg-blue-500 text-white shrink-0 w-9 h-9 p-0 transition-all duration-200"
          onClick={handleTranslate}
          disabled={isTranslating}
          title="Translate Page"
        >
          {isTranslating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Progress bar */}
      <div className="relative h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          ref={progressRef}
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
          style={{ width: "0%", display: "none" }}
        />
      </div>

      {/* Status message */}
      {status && (
        <div
          ref={statusRef}
          className={`text-[10px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5
            ${
              status.includes("Error") ||
              status.includes("Failed") ||
              status.includes("not available")
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}
          style={{ opacity: 0 }}
        >
          {!status.includes("Error") &&
            !status.includes("Failed") &&
            !status.includes("not available") && (
              <CheckCircle2 className="h-3 w-3" />
            )}
          {status}
        </div>
      )}
    </div>
  );
}
