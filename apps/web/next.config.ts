import type { NextConfig } from "next";

/**
 * Litma is exported as a static site and served from https://www.jayageetham.com/litma
 * (cPanel). Server work runs in Supabase Edge Functions (see supabase/functions).
 * The desktop app builds the same site with an empty base path (npm run build:desktop).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/litma";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // workspace packages ship TypeScript source
  transpilePackages: ["@litma/shared", "@litma/i18n", "@litma/keyboards"],
};

export default nextConfig;
