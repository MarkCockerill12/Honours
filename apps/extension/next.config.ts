import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@privacy-shield/shared", "@privacy-shield/ui"],
};

export default nextConfig;
