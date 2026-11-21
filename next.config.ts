import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fully client-side app (engine + Firebase client SDK run in the browser),
  // so ship it as a static export for Firebase Hosting.
  output: "export",
};

export default nextConfig;
