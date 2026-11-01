"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { Baseline, Highlighter, Ban, Pipette, Check } from "lucide-react";

/** Text colours: ink first, then readable mid-tones that hold up on white paper (all ≥ 4.5:1). */
export const TEXT_COLORS = [
  { c: "#1a2220", n: "Ink" },
  { c: "#5b6461", n: "Grey" },
  { c: "#b42318", n: "Red" },
  { c: "#b54708", n: "Orange" },
  { c: "#8a6100", n: "Ochre" },
  { c: "#1d6b40", n: "Green" },
  { c: "#1d5a52", n: "Teal" },
  { c: "#1f4fbf", n: "Blue" },
  { c: "#4338ca", n: "Indigo" },
  { c: "#7a2fa8", n: "Purple" },
  { c: "#a3226b", n: "Magenta" },
  { c: "#6b4423", n: "Brown" },
];
/** Highlights: soft backgrounds so black text stays readable. */
export const HIGHLIGHT_COLORS = [
  { c: "#fde68a", n: "Yellow" },
  { c: "#fed7aa", n: "Orange" },
  { c: "#fecaca", n: "Red" },
  { c: "#fbcfe8", n: "Pink" },
  { c: "#e9d5ff", n: "Purple" },
  { c: "#c7d2fe", n: "Indigo" },
  { c: "#bfdbfe", n: "Blue" },
  { c: "#bbf7d0", n: "Green" },
  { c: "#d9f99d", n: "Lime" },
  { c: "#e5e7eb", n: "Grey" },
];

const RECENT_KEY = "litma:recentColors";
function readRecent(kind: string): string[] {
  try {
    return (JSON.parse(localStorage.getItem(`${RECENT_KEY}:${kind}`) || "[]") as string[]).slice(0, 6);
  } catch {
    return [];
  }
}
function pushRecent(kind: string, c: string) {
  try {
    const next = [c, ...readRecent(kind).filter((x) => x !== c)].slice(0, 6);
    localStorage.setItem(`${RECENT_KEY}:${kind}`, JSON.stringify(next));
  } catch {
    /* storage may be unavailable */
  }
}

/** Small popover anchored to a toolbar button, rendered in a portal so scrolling toolbars never clip it. */
function Popover({ anchor, open, onClose, children, label }: { anchor: React.RefObject<HTMLElement | null>; open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const place = useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const w = 248;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const below = window.innerHeight - r.bottom;
    setPos(below < 300 && r.top > below ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
  }, [anchor]);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose, anchor]);
  if (!open || !pos || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={label}
      className="pop-in fixed z-[80] w-62 rounded-xl border border-line bg-surface p-3 text-ink shadow-[var(--pop-shadow)]"
      style={{ ...pos, width: 248 }}
      onMouseDown={(e) => {
        // keep the editor selection while clicking swatches (but let the colour input open)
        if (!(e.target as HTMLElement).closest("input")) e.preventDefault();
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function Swatches({ colors, current, onPick, round }: { colors: { c: string; n: string }[]; current?: string; onPick: (c: string) => void; round?: boolean }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {colors.map(({ c, n }) => {
        const on = current?.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            title={n}
            aria-label={n}
            aria-pressed={on}
            onClick={() => onPick(c)}
            className={`grid h-8 w-8 place-items-center border border-black/10 transition-transform hover:scale-110 focus-visible:scale-110 ${round ? "rounded-full" : "rounded-md"} ${on ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
            style={{ background: c }}
          >
            {on && <Check size={14} className={round ? "text-white" : "text-ink"} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

function CustomPicker({ value, onPick, kind }: { value: string; onPick: (c: string) => void; kind: string }) {
  const [v, setV] = useState(value || "#1a2220");
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent(kind)), [kind]);
  return (
    <div className="mt-3 border-t border-line pt-3">
      {recent.length > 0 && (
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Recent</span>
          {recent.map((c) => (
            <button key={c} type="button" aria-label={`Recent colour ${c}`} title={c} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c }} onClick={() => onPick(c)} />
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-line" style={{ background: v }}>
          <Pipette size={14} className="mix-blend-difference text-white" aria-hidden />
          <input
            type="color"
            value={v}
            aria-label="Custom colour"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => setV(e.target.value)}
          />
        </span>
        <input
          className="field !h-8 !min-h-0 w-24 !px-2 font-mono !text-xs uppercase"
          value={v}
          aria-label="Colour code"
          onChange={(e) => setV(e.target.value)}
          maxLength={7}
        />
        <button
          type="button"
          className="btn btn-outline !h-8 !px-2.5 !py-0 !text-xs"
          disabled={!/^#[0-9a-f]{6}$/i.test(v)}
          onClick={() => {
            pushRecent(kind, v);
            onPick(v);
          }}
        >
          Apply
        </button>
      </label>
    </div>
  );
}

function ToolButton({ label, open, onToggle, btnRef, children, size }: { label: string; open: boolean; onToggle: () => void; btnRef: React.RefObject<HTMLButtonElement | null>; children: React.ReactNode; size: "bar" | "sheet" }) {
  return (
    <button
      ref={btnRef}
      type="button"
      title={label}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      className={`grid shrink-0 place-items-center rounded-md px-1.5 transition-colors ${size === "sheet" ? "h-10 min-w-10" : "h-8 min-w-8"} ${open ? "bg-accent-soft text-accent" : "text-ink hover:bg-subtle"}`}
    >
      {children}
    </button>
  );
}

/** Text colour: changes the colour of the letters. Swatches, a full colour picker and "Automatic". */
export function TextColorTool({ editor, size = "bar" }: { editor: Editor; size?: "bar" | "sheet" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const current = (editor.getAttributes("textStyle").color as string | undefined) ?? "";
  const pick = (c: string) => {
    editor.chain().focus().setColor(c).run();
    setOpen(false);
  };
  return (
    <>
      <ToolButton label="Text colour" open={open} onToggle={() => setOpen((o) => !o)} btnRef={ref} size={size}>
        <span className="flex flex-col items-center leading-none">
          <Baseline size={16} aria-hidden />
          <span className="mt-[1px] h-[3px] w-4 rounded-full" style={{ background: current || "var(--ink)" }} />
        </span>
      </ToolButton>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} label="Text colour">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">Text colour</span>
          <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => (editor.chain().focus().unsetColor().run(), setOpen(false))}>
            Automatic
          </button>
        </div>
        <Swatches colors={TEXT_COLORS} current={current} onPick={pick} round />
        <CustomPicker value={current} onPick={pick} kind="text" />
      </Popover>
    </>
  );
}

/** Highlight: adds or removes a background colour behind the text. */
export function HighlightTool({ editor, size = "bar" }: { editor: Editor; size?: "bar" | "sheet" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const active = editor.isActive("highlight");
  const current = (editor.getAttributes("highlight").color as string | undefined) ?? "";
  const pick = (c: string) => {
    if (active && current.toLowerCase() === c.toLowerCase()) editor.chain().focus().unsetHighlight().run();
    else editor.chain().focus().setHighlight({ color: c }).run();
    setOpen(false);
  };
  return (
    <>
      <ToolButton label="Highlight" open={open} onToggle={() => setOpen((o) => !o)} btnRef={ref} size={size}>
        <span className="flex flex-col items-center leading-none">
          <Highlighter size={15} aria-hidden />
          <span className="mt-[2px] h-[3px] w-4 rounded-full border border-black/10" style={{ background: current || "#fde68a" }} />
        </span>
      </ToolButton>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} label="Highlight">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">Highlight</span>
          <button
            type="button"
            disabled={!active}
            className="flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:text-muted disabled:no-underline"
            onClick={() => (editor.chain().focus().unsetHighlight().run(), setOpen(false))}
          >
            <Ban size={12} aria-hidden /> None
          </button>
        </div>
        <Swatches colors={HIGHLIGHT_COLORS} current={current} onPick={pick} />
        <CustomPicker value={current || "#fde68a"} onPick={pick} kind="highlight" />
      </Popover>
    </>
  );
}
