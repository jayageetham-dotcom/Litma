import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Litma is exported as a static site and served from https://getlitma.in
 * (cPanel, at the domain root). Server work runs in Supabase Edge Functions (see supabase/functions).
 * The desktop app builds the same site with an empty base path (npm run build:desktop).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** one version for every app: the root package.json (the Release workflow bumps it) */
const version = process.env.LITMA_VERSION || (JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8")).version as string);
/** identifies this build (version + commit), so open tabs can tell when a newer one is live; scripts/write-version.mjs uses the same rule */
const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
})();
const buildId = process.env.LITMA_BUILD_ID || `${version}+${commit}`;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_APP_VERSION: version, NEXT_PUBLIC_BUILD_ID: buildId },
  // workspace packages ship TypeScript source
  transpilePackages: ["@litma/shared", "@litma/i18n", "@litma/keyboards"],
};

export default nextConfig;
