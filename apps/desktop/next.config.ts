import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@privacy-shield/core", "@privacy-shield/core"],
};

export default nextConfig;
