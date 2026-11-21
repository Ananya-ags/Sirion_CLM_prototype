import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Case data is read at runtime by API routes (drafts, PDFs): ship it in the serverless bundle.
  outputFileTracingIncludes: {
    "/api/**": ["./docket_data/data/**/*"],
  },
  outputFileTracingExcludes: {
    "*": ["./docket_data_v1_backup/**/*", "./docket_data/data/docs_src/**/*", "./docket_data/scripts/**/*"],
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
