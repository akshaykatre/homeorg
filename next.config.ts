import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Every route here is auth-gated and per-user (cookies/session), so static
  // prerendering buys nothing and Cache Components would force a Suspense
  // boundary around every data access. Keep rendering plain dynamic/SSR.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
