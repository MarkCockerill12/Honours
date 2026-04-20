import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out", 
  images: { unoptimized: true },
  transpilePackages: ["@privacy-shield/core"],
  
  // Fix the workspace root inference error
  outputFileTracingRoot: path.resolve(__dirname, "../../"),

  typescript: {
    ignoreBuildErrors: true,
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@privacy-shield/core/shared": path.resolve(__dirname, "../../packages/core/src/shared/index.ts"),
      "@privacy-shield/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
