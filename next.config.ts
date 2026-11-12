import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  // lib/publik.ts reads the public publik app token from the repo root at run time; ship it with the server routes.
  outputFileTracingIncludes: { "/api/**": ["./publik-app-token.txt"] },
};

export default nextConfig;
