import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Case data is read at runtime by API routes (drafts, PDFs): ship it in the serverless bundle.
  // Only what the app reads at runtime: root data files, the AI cache, the PDFs and dev_gold (seed fallback).
  outputFileTracingIncludes: {
    "/**": ["./docket_data/data/*.{json,csv}", "./docket_data/data/cache/**/*", "./docket_data/data/docs/**/*", "./docket_data/data/gold/dev_gold.json"],
  },
  // Eval-only sources, held-out gold, scripts and old data packs never ship ("/**" matches every route).
  outputFileTracingExcludes: {
    "/**": [
      "./docket_data_v1_backup/**/*",
      "./docket_data_v2_backup/**/*",
      "./docket_data/data/docs_src/**/*",
      "./docket_data/data/gold/heldout/**/*",
      "./docket_data/data/gold/heldout_gold.json",
      "./docket_data/scripts/**/*",
      "./scripts/**/*",
    ],
  },
  async redirects() {
    return [{ source: "/", destination: "/inbox", permanent: false }];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
