import React from "react";
import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { BRAND, TYPE_COLOURS } from "./brand";
import { FONT } from "./fonts";
import { Sticker } from "./Sticker";

// 30 fps. Cuts sit on a 0.45 s grid so a 133 BPM track (or any track at half/double) lines up.
export const PICKER = 90; // the real "What are you writing?" sheet, 3 s
export const BEAT = 27; // one page per 0.9 s
export const TYPES = [
  "നോവൽ",
  "ചെറുകഥ",
  "കവിത",
  "തിരക്കഥ",
  "ഫീച്ചർ",
  "ലേഖനം",
  "നാടകം",
  "ഗാനം",
  "ഡയറി",
];
export const PILE_END = PICKER + TYPES.length * BEAT + 72; // last page, then the pile line
export const END = 96; // end card, 3.2 s
export const TOTAL = PILE_END + END;

// Where each page lands on the desk: a little off each time, like pages put down by hand.
const LANDINGS: [number, number, number][] = [
  [-10, 0, -2.2],
  [26, -14, 1.6],
  [-30, 12, -0.9],
  [18, 22, 2.6],
  [-22, -18, -1.9],
  [30, 6, 1.1],
  [-8, 26, -2.8],
  [12, -20, 0.7],
  [0, 8, -1.3],
];

const PAGE_W = 990;
const PAGE_H = (PAGE_W * 1928) / 1360;

const Page: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame(); // local to this page's Sequence
  const [dx, dy, rot] = LANDINGS[i];
  // put down: a few frames from slightly above the desk, then it stays put
  const lift = interpolate(frame, [0, 4], [1.07, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const shadow = interpolate(frame, [0, 4], [44, 18], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - PAGE_W) / 2 + dx,
        top: 205 + dy, // the top of the page is what reads; its foot runs under the caption bar
        width: PAGE_W,
        height: PAGE_H,
        transform: `rotate(${rot}deg) scale(${lift})`,
        borderRadius: 30,
        overflow: "hidden",
        background: "#fff",
        boxShadow: `0 ${shadow * 0.5}px ${shadow}px rgba(21, 18, 58, 0.18), 0 1px 2px rgba(21, 18, 58, 0.12)`,
      }}
    >
      {/* the real first page of this writing type, rendered by Litma's TemplatePreview */}
      <Img
        src={staticFile(`pages/${i}.png`)}
        style={{ position: "absolute", left: -8, top: -8, width: PAGE_W + 16, height: PAGE_H + 16 }}
      />
    </div>
  );
};

const Label: React.FC<{ i: number }> = ({ i }) => {
  const bg = TYPE_COLOURS[i % TYPE_COLOURS.length];
  const color = bg === BRAND.mark ? "#ffffff" : BRAND.onPop;
  return (
    <AbsoluteFill style={{ alignItems: "center", top: 1170 }}>
      <Sticker text={TYPES[i]} bg={bg} color={color} size={84} />
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const stamp = (at: number) =>
    frame < at
      ? 0
      : interpolate(frame - at, [0, 3], [1.14, 1], { extrapolateRight: "clamp" });
  const marker = interpolate(frame, [12, 21], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const show = (at: number) => (frame >= at ? 1 : 0);
  return (
    <AbsoluteFill style={{ background: "#f4f2fb", fontFamily: `'${FONT}', sans-serif`, color: BRAND.ink }}>
      <div style={{ position: "absolute", left: 90, top: 470, fontWeight: 800, fontSize: 160, lineHeight: 1, letterSpacing: "-0.02em", opacity: show(0), transform: `scale(${stamp(0)})`, transformOrigin: "left bottom" }}>
        എഴുതൂ,
      </div>
      <div style={{ position: "absolute", left: 90, top: 690, fontWeight: 800, fontSize: 118, lineHeight: 1, color: BRAND.violet, opacity: show(6), transform: `scale(${stamp(6) || 1})`, transformOrigin: "left bottom" }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          <span style={{ position: "absolute", left: -12, right: -12, bottom: 4, height: 46, borderRadius: 14, background: BRAND.lime, transform: `scaleX(${marker})`, transformOrigin: "left center" }} />
          <span style={{ position: "relative" }}>മലയാളത്തിൽ</span>
          <span style={{ position: "absolute", right: -50, bottom: 22, width: 34, height: 34, borderRadius: "50%", background: BRAND.coral, transform: `scale(${frame < 22 ? 0 : interpolate(frame - 22, [0, 5], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(3)) })})` }} />
        </span>
      </div>
      <div style={{ position: "absolute", left: 90, top: 1000, display: "flex", alignItems: "center", gap: 30, opacity: show(26) }}>
        <Img src={staticFile("icon.png")} style={{ width: 132, height: 132, borderRadius: 30 }} />
        <div style={{ fontWeight: 800, fontSize: 84, lineHeight: 1, clipPath: `inset(0 ${interpolate(frame, [28, 37], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}% 0 0)` }}>
          ലിറ്റ്മ<span style={{ color: BRAND.mark }}>.</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 90, top: 1180, display: "flex", gap: 20, alignItems: "center", opacity: show(32) }}>
        <Sticker text="getlitma.in" at={32} size={50} style={{ borderRadius: 999, fontWeight: 600 }} />
        <span style={{ fontWeight: 600, fontSize: 44, color: BRAND.muted }}>Free to use</span>
      </div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BRAND.desk }}>
      {/* 1. the real picker, recorded on a phone-sized screen */}
      <Sequence name="Picker (screen recording)" durationInFrames={PICKER}>
        <Video src={staticFile("picker.mp4")} trimBefore={30} muted style={{ width: 1080, height: 1920 }} />
        <AbsoluteFill style={{ alignItems: "center", top: 1150 }}>
          <Sticker text="എന്താണ് എഴുതുന്നത്?" size={72} />
        </AbsoluteFill>
      </Sequence>

      {/* 2. nine first pages land on the desk, one per beat, and stay */}
      {TYPES.map((t, i) => (
        <Sequence key={t} name={`Page: ${t}`} from={PICKER + i * BEAT} durationInFrames={PILE_END - PICKER - i * BEAT}>
          <Page i={i} />
        </Sequence>
      ))}
      {TYPES.map((t, i) => (
        <Sequence
          key={`l-${t}`}
          name={`Label: ${t}`}
          from={PICKER + i * BEAT + 2}
          durationInFrames={i === TYPES.length - 1 ? BEAT + 4 : BEAT}
        >
          <Label i={i} />
        </Sequence>
      ))}

      {/* 3. the pile, named */}
      <Sequence name="Pile line" from={PICKER + TYPES.length * BEAT + 6} durationInFrames={PILE_END - (PICKER + TYPES.length * BEAT + 6)}>
        <AbsoluteFill style={{ alignItems: "center", top: 1110, gap: 12, flexDirection: "column", justifyContent: "flex-start" }}>
          <Sticker text="ഒൻപത് സാഹിത്യരൂപങ്ങൾ" size={70} />
          <Sticker text="ഒരു എഴുത്തുമേശ" at={14} size={70} bg={BRAND.violet} />
        </AbsoluteFill>
      </Sequence>

      {/* 4. end card */}
      <Sequence name="End card" from={PILE_END} durationInFrames={END}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
