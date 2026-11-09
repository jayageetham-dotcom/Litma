import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Anek Malayalam: Litma's own display face (variable weight 100-800), Malayalam and Latin files.
export const FONT = "Anek Malayalam";

loadFont({
  family: FONT,
  url: staticFile("fonts/anek-malayalam-malayalam-standard-normal.woff2"),
  weight: "100 800",
  unicodeRange:
    "U+0307, U+0323, U+0951-0952, U+0964-0965, U+0D00-0D7F, U+1CDA, U+1CF2, U+200C-200D, U+20B9, U+25CC, U+A830-A832",
});
loadFont({
  family: FONT,
  url: staticFile("fonts/anek-malayalam-latin-standard-normal.woff2"),
  weight: "100 800",
  unicodeRange: "U+0000-00FF, U+2000-206F, U+2122, U+2212",
});
