import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // turbopack: {} silences the "webpack config without turbopack config" warning.
  // @boards imports work in webpack mode but Turbopack won't load files outside
  // the project root; use @/lib copies of board configs when importing in client code.
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@boards": path.resolve(__dirname, "../boards"),
    }
    return config
  },
};

export default nextConfig;
