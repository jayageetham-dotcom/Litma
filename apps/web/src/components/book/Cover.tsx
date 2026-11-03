"use client";
import { createContext, useContext, useRef, useState } from "react";
import type { Book, BookCover, CoverOffset } from "@/lib/types";
import { AvatarArt } from "@/components/art/Avatars";
import { CoverArtSvg } from "@/components/art/CoverArt";
import { Barcode, isbn13 } from "./Barcode";

export const COVER_TEMPLATES: { id: NonNullable<BookCover["template"]>; label: string; defaults: Partial<BookCover> }[] = [
  { id: "kasavu", label: "Frame", defaults: { bg: "#f7f3e8", fg: "#1a2220", accent: "#a17a28" } },
  { id: "art", label: "Artwork", defaults: { bg: "#0b2f3a", fg: "#fdf6e3", accent: "#e9c46a", art: "fantasy" } },
  { id: "solid", label: "Solid colour", defaults: { bg: "#1d5a52", fg: "#ffffff", accent: "#d2ad5c" } },
  // Needs an uploaded picture; hidden from the picker while PHOTO_UPLOADS is off (older books still render).
  { id: "photo", label: "Photograph", defaults: { bg: "#111916", fg: "#ffffff", accent: "#d2ad5c", imageOpacity: 0.9 } },
  { id: "type", label: "Big type", defaults: { bg: "#e9e1cf", fg: "#3b1f1a", accent: "#a3372b" } },
  { id: "minimal", label: "Minimal", defaults: { bg: "#ffffff", fg: "#1a2220", accent: "#1d5a52" } },
];

/**
 * Title fonts. Google Fonts ones load in app/layout.tsx; Karumbi, Dyuthi, Uroob, Meera and Rachana are
 * SMC fonts bundled in public/fonts/smc (SIL OFL) so covers print the same everywhere.
 */
export const COVER_FONTS: { name: string; kind: "sans" | "calligraphy" | "display" | "serif" }[] = [
  { name: "Anek Malayalam", kind: "sans" },
  { name: "Noto Sans Malayalam", kind: "sans" },
  { name: "Manjari", kind: "sans" },
  { name: "Gayathri", kind: "sans" },
  { name: "Meera", kind: "sans" },
  { name: "Baloo Chettan 2", kind: "sans" },
  { name: "Karumbi", kind: "calligraphy" },
  { name: "Chilanka", kind: "calligraphy" },
  { name: "Dyuthi", kind: "calligraphy" },
  { name: "Uroob", kind: "display" },
  { name: "Noto Serif Malayalam", kind: "serif" },
  { name: "Rachana", kind: "serif" },
];

/** Publisher shown on the back-cover imprint strip (and the front mark) until the writer names their own. */
export const DEFAULT_PUBLISHER = "Litma Publishing House";

/** Parts of a cover the writer can drag. Offsets are stored in millimetres so print matches the screen. */
export const COVER_PARTS = { front: ["title", "author", "badge", "mark"], back: ["back-head", "back-text", "back-imprint"] } as const;

function resolve(book: Pick<Book, "cover">) {
  const c = book.cover ?? {};
  const t = COVER_TEMPLATES.find((x) => x.id === c.template) ?? COVER_TEMPLATES[0];
  return { ...t.defaults, ...c, template: t.id } as BookCover & { template: NonNullable<BookCover["template"]> };
}

type MoveCtx = { offsets: Record<string, CoverOffset>; wmm: number; hmm: number; onMove?: (id: string, o: CoverOffset) => void; label?: (id: string) => string };
const Move = createContext<MoveCtx>({ offsets: {}, wmm: 210, hmm: 297 });

/** A block of the cover that keeps its design position plus the writer's offset; draggable in the designer. */
function Movable({ id, className = "", style, children }: { id: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const ctx = useContext(Move);
  const base = ctx.offsets[id] ?? { x: 0, y: 0 };
  const [live, setLive] = useState<CoverOffset | null>(null);
  const drag = useRef<{ sx: number; sy: number; ppm: number; start: CoverOffset } | null>(null);
  const o = live ?? base;
  const st: React.CSSProperties = { ...style, translate: o.x || o.y ? `${o.x}mm ${o.y}mm` : undefined };
  if (!ctx.onMove)
    return (
      <div className={className} style={st}>
        {children}
      </div>
    );
  const clamp = (v: CoverOffset): CoverOffset => ({
    x: Math.round(Math.max(-ctx.wmm, Math.min(ctx.wmm, v.x)) * 2) / 2,
    y: Math.round(Math.max(-ctx.hmm, Math.min(ctx.hmm, v.y)) * 2) / 2,
  });
  return (
    <div
      className={`${className} cursor-move touch-none select-none outline-offset-[1.5mm] hover:outline-2 hover:outline-dashed focus-visible:outline-2 focus-visible:outline-dashed`}
      style={{ ...st, outlineColor: "currentColor" }}
      role="button"
      tabIndex={0}
      aria-label={ctx.label?.(id)}
      title={ctx.label?.(id)}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const root = e.currentTarget.closest("[data-cover]") as HTMLElement | null;
        const ppm = root ? root.getBoundingClientRect().width / ctx.wmm : 3.78;
        drag.current = { sx: e.clientX, sy: e.clientY, ppm, start: base };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus();
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setLive(clamp({ x: d.start.x + (e.clientX - d.sx) / d.ppm, y: d.start.y + (e.clientY - d.sy) / d.ppm }));
      }}
      onPointerUp={() => {
        if (drag.current && live) ctx.onMove!(id, live);
        drag.current = null;
        setLive(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setLive(null);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 5 : 1;
        const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!k) return;
        e.preventDefault();
        ctx.onMove!(id, clamp({ x: base.x + k[0], y: base.y + k[1] }));
      }}
    >
      {children}
    </div>
  );
}

type CoverProps = {
  book: Pick<Book, "title" | "subtitle" | "author" | "cover" | "settings">;
  w: number;
  h: number;
  className?: string;
  /** Designer only: makes the title and author blocks draggable. */
  onMove?: (id: string, o: CoverOffset) => void;
  moveLabel?: (id: string) => string;
};

/** Front cover, drawn at w×h millimetres (full bleed). */
export function CoverFront({ book, w, h, className = "", onMove, moveLabel }: CoverProps) {
  const c = resolve(book);
  const scale = c.titleScale ?? 1;
  const font = `'${c.font ?? "Anek Malayalam"}', Inter, sans-serif`;
  const base = { width: `${w}mm`, height: `${h}mm`, background: c.bg, color: c.fg, fontFamily: font } as React.CSSProperties;
  const title = book.title || "പുസ്തകം";
  const publisher = book.settings?.publisher;
  /** The cover background artwork: always full bleed, under the design's own text and frame. */
  const art = !c.image && c.art ? <CoverArtSvg id={c.art} className="absolute inset-0 h-full w-full" /> : null;
  // Title effects: a soft drop shadow and/or a colour box behind the title block.
  const shadow = c.titleShadow ? "0 0.5mm 1.2mm rgba(0,0,0,0.55), 0 0 5mm rgba(0,0,0,0.35)" : undefined;
  const box: React.CSSProperties = c.titleBox
    ? { background: `color-mix(in srgb, ${c.titleBoxColor ?? c.bg} ${Math.round((c.titleBoxOpacity ?? 0.75) * 100)}%, transparent)`, padding: "5mm 6mm", borderRadius: "2mm" }
    : {};
  const h1 = (size: number, lh = 1.15, weight = 800, extra?: React.CSSProperties) => (
    <h1 style={{ fontSize: `${size * scale}pt`, lineHeight: lh, fontWeight: weight, textShadow: shadow, ...extra }}>{title}</h1>
  );
  const sub = (size: number, extra?: React.CSSProperties) => (book.subtitle ? <p style={{ fontSize: `${size}pt`, opacity: 0.9, textShadow: shadow, ...extra }}>{book.subtitle}</p> : null);
  const ctx: MoveCtx = { offsets: c.offsets ?? {}, wmm: w, hmm: h, onMove, label: moveLabel };
  /** Divider under the title in the chosen style; `line` is the design's own bar. */
  const orn = (line: React.CSSProperties, center = true) =>
    c.ornament === "none" ? null : c.ornament === "flourish" ? <Flourish color={c.accent!} center={center} margin={line.margin ?? line.marginTop ?? "6mm 0 0"} /> : <div style={line} />;
  const badgeText = c.badgeText?.trim() || book.settings?.edition?.trim();
  const extras = (
    <>
      {c.badge && badgeText && (
        <Movable id="badge" className="absolute right-[8%] top-[31%]">
          <div className="grid place-items-center rounded-full text-center" style={{ width: "27mm", height: "27mm", padding: "3mm", background: c.accent, color: c.bg, fontSize: "11pt", fontWeight: 700, lineHeight: 1.15, boxShadow: "0 1mm 3mm rgba(0,0,0,0.25)" }}>
            {badgeText}
          </div>
        </Movable>
      )}
      {c.publisherMark && (
        <Movable id="mark" className="absolute right-[7%] top-[4.5%]">
          <PublisherBox name={publisher || DEFAULT_PUBLISHER} small />
        </Movable>
      )}
    </>
  );
  const wrap = (children: React.ReactNode, extraClass = "") => (
    <Move.Provider value={ctx}>
      <div data-cover="" className={`relative overflow-hidden ${extraClass} ${className}`} style={base}>
        {children}
        {extras}
      </div>
    </Move.Provider>
  );

  if (c.template === "art")
    // Title in the calm top 30% of the artwork, author in the clear bottom 15%.
    return wrap(
      <>
        {art}
        <Movable id="title" className="absolute inset-x-[11%] top-[9%] text-center" style={{ textShadow: shadow ? undefined : "0 1px 12px rgba(0,0,0,0.18)", ...box }}>
          {h1(48, 1.12, 800)}
          {sub(15, { marginTop: "4mm" })}
          {orn({ height: "1mm", width: "20mm", background: c.accent, margin: "7mm auto 0" })}
        </Movable>
        <Movable id="author" className="absolute inset-x-[11%] bottom-[6%] text-center" style={{ textShadow: "0 1px 10px rgba(0,0,0,0.2)" }}>
          <p style={{ fontSize: "18pt", fontWeight: 600, letterSpacing: "0.02em" }}>{book.author}</p>
          {publisher && <p style={{ fontSize: "9.5pt", marginTop: "2mm", opacity: 0.8 }}>{publisher}</p>}
        </Movable>
      </>,
    );

  if (c.template === "photo")
    return wrap(
      <>
        {c.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: c.imageOpacity ?? 0.9 }} />
        )}
        {art}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${c.bg} 8%, transparent 60%)` }} />
        <Movable id="title" className="absolute inset-x-[12%] bottom-[22%]" style={box}>
          {h1(46, 1.15, 800)}
          {sub(15, { marginTop: "4mm" })}
          {orn({ height: "1.2mm", width: "22mm", background: c.accent, marginTop: "9mm" }, false)}
        </Movable>
        <Movable id="author" className="absolute inset-x-[12%] bottom-[10%]">
          <p style={{ fontSize: "17pt", fontWeight: 600 }}>{book.author}</p>
        </Movable>
      </>,
    );

  if (c.template === "solid")
    return wrap(
      <>
        {art}
        <Movable id="title" className="absolute inset-x-[12%] top-[14%]" style={box}>
          {c.ornament === "flourish" ? null : orn({ height: "1.4mm", width: "30mm", background: c.accent, marginBottom: "10mm" })}
          {h1(50, 1.12, 800)}
          {sub(16, { marginTop: "6mm", opacity: 0.85 })}
          {c.ornament === "flourish" && <Flourish color={c.accent!} center={false} margin="8mm 0 0" />}
        </Movable>
        {c.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt="" className="absolute bottom-[22%] right-[12%] w-[40%] rounded-sm object-cover" style={{ opacity: c.imageOpacity ?? 1 }} />
        )}
        <Movable id="author" className="absolute inset-x-[12%] bottom-[9%] flex items-end justify-between">
          <p style={{ fontSize: "18pt", fontWeight: 600 }}>{book.author}</p>
          {publisher && <p style={{ fontSize: "10pt", opacity: 0.75 }}>{publisher}</p>}
        </Movable>
      </>,
    );

  if (c.template === "type")
    return wrap(
      <>
        {art}
        <Movable id="author" className="absolute inset-x-[10%] top-[10%]">
          <p style={{ fontSize: "14pt", fontWeight: 600, color: c.accent }}>{book.author}</p>
        </Movable>
        <Movable id="title" className="absolute inset-x-[10%] top-[24%]" style={box}>
          {h1(92, 1.02, 800, { wordBreak: "break-word" })}
          {c.ornament === "flourish" && <Flourish color={c.accent!} center={false} margin="6mm 0 0" />}
        </Movable>
        <div className="absolute inset-x-[10%] bottom-[10%] flex items-end justify-between" style={{ fontSize: "12pt" }}>
          <span style={{ textShadow: shadow }}>{book.subtitle}</span>
          <span style={{ opacity: 0.7 }}>{publisher}</span>
        </div>
      </>,
    );

  if (c.template === "minimal")
    return wrap(
      <>
        {art}
        <Movable id="title" className="absolute inset-x-[14%] top-[36%] flex flex-col items-center text-center" style={box}>
          {h1(30, 1.25, 700)}
          {orn({ height: "0.4mm", width: "16mm", background: c.accent, margin: "8mm 0 0" })}
          {sub(11, { marginTop: "4mm", opacity: 0.75 })}
        </Movable>
        <Movable id="author" className="absolute inset-x-[14%] top-[58%] text-center">
          <p style={{ fontSize: "13pt" }}>{book.author}</p>
        </Movable>
        {publisher && <p style={{ position: "absolute", bottom: "10%", left: 0, right: 0, textAlign: "center", fontSize: "9pt", opacity: 0.6 }}>{publisher}</p>}
      </>,
    );

  // kasavu
  return wrap(
    <>
      {art}
      <div className="absolute" style={{ inset: "9mm", border: `1.6mm solid ${c.accent}` }} />
      <div className="absolute" style={{ inset: "13mm", border: `0.4mm solid ${c.accent}` }} />
      <Movable id="title" className="absolute inset-x-[16%] top-[24%] text-center" style={box}>
        {h1(44, 1.2, 800)}
        {sub(14, { marginTop: "6mm", opacity: 0.8 })}
        {orn({ height: "0.6mm", width: "18mm", background: c.accent, margin: "7mm auto 0" })}
      </Movable>
      {c.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.image} alt="" className="absolute left-1/2 top-[48%] w-[44%] -translate-x-1/2 rounded-sm object-cover" style={{ opacity: c.imageOpacity ?? 1, maxHeight: "28%" }} />
      )}
      <Movable id="author" className="absolute inset-x-[16%] bottom-[14%] text-center">
        <p style={{ fontSize: "17pt", fontWeight: 600 }}>{book.author}</p>
        {publisher && <p style={{ fontSize: "10pt", marginTop: "3mm", color: c.accent }}>{publisher}</p>}
      </Movable>
    </>,
  );
}

/**
 * The publisher's boxed mark (as on the back of printed Malayalam books). Litma Publishing House gets its
 * own two-line lockup; any other name is set in capitals.
 */
function PublisherBox({ name, tagline, small = false }: { name: string; tagline?: string; small?: boolean }) {
  const litma = name === DEFAULT_PUBLISHER;
  const k = small ? 0.72 : 1;
  return (
    <div style={{ fontFamily: "Inter, sans-serif", border: `${0.6 * k}mm solid currentColor`, padding: `${2 * k}mm ${3 * k}mm`, textAlign: "center", maxWidth: `${40 * k}mm`, lineHeight: 1.1 }}>
      {litma ? (
        <>
          <p style={{ fontFamily: "'Anek Malayalam', Inter, sans-serif", fontWeight: 800, fontSize: `${15 * k}pt`, lineHeight: 1 }}>
            ലിറ്റ്മ<span style={{ color: "#5b3ef0" }}>.</span>
          </p>
          <p style={{ fontSize: `${6.2 * k}pt`, fontWeight: 800, letterSpacing: "0.14em", marginTop: `${1 * k}mm` }}>LITMA PUBLISHING HOUSE</p>
        </>
      ) : (
        <p style={{ fontWeight: 800, fontSize: `${11 * k}pt`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{name}</p>
      )}
      {tagline && <p style={{ fontSize: `${6.2 * k}pt`, marginTop: `${1 * k}mm`, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tagline}</p>}
    </div>
  );
}

/** Decorative divider: a fine line with curls and a centre diamond. */
function Flourish({ color, center = true, margin }: { color: string; center?: boolean; margin?: string | number }) {
  return (
    <svg viewBox="0 0 120 16" style={{ width: "44mm", display: "block", margin: `${String(margin ?? "6mm").split(" ")[0]} ${center ? "auto" : "0"} 0` }} fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" aria-hidden>
      <path d="M4 8h36M80 8h36" opacity="0.8" />
      <path d="M40 8c3-6 10-6 12-1c1 3-2 5-4 3M80 8c-3-6-10-6-12-1c-1 3 2 5 4 3" />
      <path d="M40 8c3 5 8 6 11 4M80 8c-3 5-8 6-11 4" opacity="0.7" />
      <path d="M60 3.5l4.5 4.5-4.5 4.5-4.5-4.5z" fill={color} stroke="none" />
      <circle cx="2" cy="8" r="1.2" fill={color} stroke="none" />
      <circle cx="118" cy="8" r="1.2" fill={color} stroke="none" />
    </svg>
  );
}

/** Back cover: title and author beside the author picture, blurb, author note, and an imprint strip with the ISBN barcode. */
export function CoverBack({ book, w, h, className = "", onMove, moveLabel }: CoverProps) {
  const c = resolve(book);
  const font = `'${c.font ?? "Anek Malayalam"}', Inter, sans-serif`;
  const ctx: MoveCtx = { offsets: c.offsets ?? {}, wmm: w, hmm: h, onMove, label: moveLabel };
  const set = book.settings ?? {};
  const head = c.backTitle !== false;
  const picture = c.authorPhoto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.authorPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  ) : c.authorAvatar !== "none" ? (
    <AvatarArt id={c.authorAvatar ?? "letter"} name={book.author} size="100%" square paint={{ fg: c.accent!, bg: `color-mix(in srgb, ${c.accent} 22%, ${c.bg})` }} />
  ) : null;
  const pub = set.publisher?.trim() || DEFAULT_PUBLISHER;
  const hasStrip = c.imprintStrip !== false;
  return (
    <Move.Provider value={ctx}>
      <div data-cover="" className={`relative overflow-hidden ${className}`} style={{ width: `${w}mm`, height: `${h}mm`, background: c.bg, color: c.fg }}>
        {c.art && !c.image && (
          <>
            <CoverArtSvg id={c.art} mirror className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0" style={{ background: c.bg, opacity: 0.62 }} />
          </>
        )}
        {c.template === "kasavu" && <div className="absolute" style={{ inset: "9mm", border: `1.6mm solid ${c.accent}` }} />}
        {head && (
          <Movable id="back-head" className="absolute inset-x-[12%] top-[8%] flex items-start gap-[7mm]">
            {picture && (
              // picture in an offset colour frame
              <div className="relative shrink-0" style={{ width: "38mm", height: "46mm" }}>
                <div className="absolute" style={{ inset: 0, translate: "2.5mm 2.5mm", background: c.accent }} />
                <div className="absolute overflow-hidden" style={{ inset: 0, border: "1.2mm solid #fff", background: "#fff" }}>
                  {picture}
                </div>
              </div>
            )}
            <div style={{ fontFamily: font, paddingTop: "2mm" }}>
              <p style={{ fontSize: "24pt", fontWeight: 800, lineHeight: 1.15, color: c.accent }}>{book.title || "പുസ്തകം"}</p>
              {book.author && <p style={{ fontSize: "13pt", fontWeight: 600, marginTop: "4mm" }}>{book.author}</p>}
            </div>
          </Movable>
        )}
        <Movable id="back-text" className={`absolute inset-x-[16%] ${head ? "top-[30%]" : "top-[14%]"}`} style={{ fontFamily: "'Noto Serif Malayalam', 'Noto Serif', serif" }}>
          {c.blurb && <p style={{ fontSize: "12.5pt", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{c.blurb}</p>}
          {(c.authorBio || (!head && picture)) && (
            <div className="flex items-start gap-[5mm]" style={{ marginTop: c.blurb ? "10mm" : 0 }}>
              {!head && picture && <div className="shrink-0 overflow-hidden rounded-full" style={{ width: "24mm", height: "24mm" }}>{picture}</div>}
              <div>
                {!head && <p style={{ fontFamily: font, fontWeight: 700, fontSize: "12pt", color: c.accent }}>{book.author}</p>}
                <p style={{ fontSize: "10.5pt", lineHeight: 1.7, marginTop: head ? 0 : "2mm", whiteSpace: "pre-wrap", opacity: 0.9 }}>{c.authorBio}</p>
              </div>
            </div>
          )}
        </Movable>
        {hasStrip && (
          // imprint strip: publisher box · genre and credits · category, barcode, price
          <Movable id="back-imprint" className="absolute inset-x-[6%] bottom-[4%]">
            <div className="grid items-center gap-[4mm]" style={{ gridTemplateColumns: "auto 1fr auto", background: "#fff", color: "#141414", padding: "4mm 5mm", borderRadius: "1mm", fontFamily: font, fontSize: "8.5pt", lineHeight: 1.45 }}>
              <PublisherBox name={pub} tagline={c.publisherTagline} />
              <div style={{ borderLeft: "0.3mm solid #999", paddingLeft: "4mm" }}>
                {c.genreLine && <p style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.genreLine}</p>}
                {c.coverCredit && <p style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>{c.coverCredit}</p>}
                {(
                  <p style={{ marginTop: c.genreLine || c.coverCredit ? "2mm" : 0 }}>
                    <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{pub}</span>
                    {c.website && <span style={{ display: "block" }}>{c.website}</span>}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                {c.category && <p style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "1.5mm" }}>{c.category}</p>}
                {isbn13(set.isbn) && (
                  <div style={{ display: "inline-block", textAlign: "left" }}>
                    <p style={{ fontSize: "6.5pt", fontFamily: "monospace", letterSpacing: "0.04em" }}>ISBN {set.isbn}</p>
                    <Barcode isbn={set.isbn} width="34mm" />
                  </div>
                )}
                {c.price && <p style={{ fontWeight: 700, marginTop: "1mm" }}>{c.price}</p>}
              </div>
            </div>
          </Movable>
        )}
      </div>
    </Move.Provider>
  );
}
