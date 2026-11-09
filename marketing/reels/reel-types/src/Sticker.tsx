import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BRAND } from "./brand";
import { FONT } from "./fonts";

// Instagram's own "text with background" sticker: the kind of label a person adds in the app.
// It pops in over 4 frames (from `at`, a frame inside the current Sequence) and leaves on a cut.
export const Sticker: React.FC<{
  text: string;
  at?: number;
  bg?: string;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({ text, at = 0, bg = BRAND.ink, color = "#ffffff", size = 66, style }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const scale = interpolate(frame - at, [0, 4], [0.86, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color,
        borderRadius: 14,
        padding: `${size * 0.18}px ${size * 0.4}px ${size * 0.08}px`,
        font: `700 ${size}px/1.3 '${FONT}', sans-serif`,
        letterSpacing: "-0.01em",
        transform: `scale(${scale})`,
        ...style,
      }}
    >
      {text}
    </span>
  );
};
