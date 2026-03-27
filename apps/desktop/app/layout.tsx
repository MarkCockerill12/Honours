import React from "react";
import type { Metadata } from "next";
import "./globals.css";

import { StatsProvider } from "@privacy-shield/core";



export const metadata: Metadata = {
  title: "Blocker - Honours Project",
  description: "An Ad Blocker/Vpn etc",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <StatsProvider>
          {children}
        </StatsProvider>
      </body>
    </html>
  );
}

