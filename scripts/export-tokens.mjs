// Exports the design tokens in apps/web/src/styles/theme.css (the single source of truth)
// to packages/tokens/tokens.json, so the Flutter app and any other client use the same colours,
// radii and fonts.  Run: npm run tokens   (CI fails if tokens.json is out of date)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "apps/web/src/styles/theme.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function block(selector) {
  const m = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\}`));
  const out = {};
  if (!m) return out;
  for (const [, name, value] of m[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) out[name] = value.trim();
  return out;
}

const light = block(":root");
const dark = block(".dark");
const pick = (o, re) => Object.fromEntries(Object.entries(o).filter(([k]) => re.test(k)));
const isColor = (v) => /^(#|rgba?\()/.test(v);

const tokens = {
  $comment: "Generated from apps/web/src/styles/theme.css by scripts/export-tokens.mjs. Edit theme.css, then run npm run tokens.",
  color: {
    light: Object.fromEntries(Object.entries(light).filter(([, v]) => isColor(v))),
    dark: Object.fromEntries(Object.entries(dark).filter(([, v]) => isColor(v))),
  },
  radius: Object.fromEntries(Object.entries(pick(light, /^radius/)).map(([k, v]) => [k, parseFloat(v)])),
  shadow: { light: pick(light, /shadow$/), dark: pick(dark, /shadow$/) },
  font: Object.fromEntries(Object.entries(pick(light, /^font-/)).map(([k, v]) => [k.replace(/^font-/, ""), v.split(",").map((s) => s.trim().replace(/^"|"$/g, ""))])),
};
const file = join(root, "packages/tokens/tokens.json");
writeFileSync(file, JSON.stringify(tokens, null, 2) + "\n");
console.log(`Wrote ${Object.keys(tokens.color.light).length} light and ${Object.keys(tokens.color.dark).length} dark colours to packages/tokens/tokens.json`);
