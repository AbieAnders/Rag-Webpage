import type { NextConfig } from "next";
/** @type {import('next').NextConfig} */

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false }; // Prevents server-side modules from breaking
    return config;
  },
};

export default nextConfig;
