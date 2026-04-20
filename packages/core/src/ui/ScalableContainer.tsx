"use client";

import React from "react";
import { useTheme } from "./ThemeProvider";

interface ScalableContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
  aspectRatio?: string;
}

export function ScalableContainer({
  children,
  className = "",
  maxWidth = "100%",
  aspectRatio,
}: ScalableContainerProps) {
  const { colors, theme } = useTheme();

  const getBackgroundStyle = () => {
    if (theme === "vaporwave") {
      return {
        background:
          "linear-gradient(180deg, #1a0a2e 0%, #16213e 50%, #0f0f23 100%)",
        backgroundImage: `
          linear-gradient(180deg, #1a0a2e 0%, #16213e 50%, #0f0f23 100%),
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 40px,
            rgba(244, 114, 182, 0.03) 40px,
            rgba(244, 114, 182, 0.03) 41px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 40px,
            rgba(34, 211, 238, 0.03) 40px,
            rgba(34, 211, 238, 0.03) 41px
          )
        `,
      };
    }
    if (theme === "frutiger-aero") {
      return {
        background:
          "linear-gradient(135deg, #e0f2fe 0%, #d1fae5 50%, #cffafe 100%)",
      };
    }
    return {};
  };

  return (
    <div
      className={`
        w-full min-h-fit ${colors.bg} ${colors.text}
        transition-all duration-300 ease-out
        overflow-auto
        ${className}
      `}
      style={{
        maxWidth,
        aspectRatio,
        ...getBackgroundStyle(),
      }}
    >
      <div className="w-full h-full">{children}</div>
    </div>
  );
}
