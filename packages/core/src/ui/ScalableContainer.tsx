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
          "linear-gradient(180deg, #0a0015 0%, #1a0030 100%)",
        backgroundImage: `
          linear-gradient(180deg, transparent 0%, #0a0015 100%),
          repeating-linear-gradient(
            90deg,
            rgba(185, 103, 255, 0.13) 0px,
            transparent 1px,
            transparent 60px
          ),
          repeating-linear-gradient(
            0deg,
            rgba(185, 103, 255, 0.13) 0px,
            transparent 1px,
            transparent 60px
          )
        `,
        backgroundSize: "100% 100%, 60px 60px, 60px 60px",
      };
    }
    if (theme === "frutiger-aero") {
      return {
        background:
          "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 40%, #bae6fd 100%)",
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
