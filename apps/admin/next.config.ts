import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@heft/shared"],
  reactStrictMode: true,
};

export default nextConfig;
