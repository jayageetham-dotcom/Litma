import type { NextConfig } from "next";

/**
 * Litma is exported as a static site and served from https://www.jayageetham.com/litma
 * (cPanel). Server work runs in Supabase Edge Functions (see supabase/functions).
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
};

export default nextConfig;
