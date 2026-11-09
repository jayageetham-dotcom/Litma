// Litma's own colours (apps/web/src/styles/theme.css). Change them there first.
export const BRAND = {
  desk: "#eceaf4", // a touch darker than --canvas so white pages read on it
  ink: "#111113",
  violet: "#5b3ef0", // --accent, AA on white
  mark: "#6b4eff", // --brand-mark, the logo dot
  lime: "#d5f567",
  coral: "#ff5e7e",
  sky: "#8ad1ff",
  tangerine: "#ff9f43",
  onPop: "#15123a", // text on lime, sky, coral, tangerine
  muted: "#4a4760",
};

// The home page gives each writing type a colour in this order (TypesShowcase.tsx COLOURS).
export const TYPE_COLOURS = [BRAND.mark, BRAND.coral, BRAND.sky, BRAND.lime, BRAND.tangerine];
