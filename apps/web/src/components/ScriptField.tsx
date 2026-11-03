"use client";
import { useEffect, useRef, useState } from "react";
import { manglish } from "@litma/shared/manglish";
import { useT } from "@/i18n/react";

type Mode = "manglish" | "plain";

/** Capitals the Manglish scheme gives a meaning of their own (T ട, N ണ, L ള…); other capitals read as small letters. */
const MEANINGFUL_CAPS = new Set([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((c) => !/[A-Za-z]/.test(manglish(c))));

/**
 * Manglish → Malayalam for fields where people type names: a Name-cased word ("Jagath") reads all small,
 * and capitals with no meaning in the scheme are lowered, so English-style capitals don't leak through.
 */
export function toMalayalam(text: string): string {
  return text.replace(/[A-Za-z~_^]+/g, (w) => {
    const word = /^[A-Z][a-z~_^]+$/.test(w) ? w.toLowerCase() : w.replace(/[A-Z]/g, (c) => (MEANINGFUL_CAPS.has(c) ? c : c.toLowerCase()));
    return manglish(word);
  });
}

/**
 * A text field that takes Manglish, Malayalam or English. In Manglish mode each word turns into Malayalam
 * as it is finished (space, punctuation, Enter or leaving the field); Malayalam typed with a system
 * keyboard passes through. "As typed" leaves English (or anything) untouched. The choice is remembered
 * per field on this device.
 */
export function ScriptField({ label, value, onChange, storageKey, defaultMode = "manglish", placeholder }: { label: string; value: string; onChange: (v: string) => void; storageKey: string; defaultMode?: Mode; placeholder?: string }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  // only text typed in this visit is converted on Enter/blur, so tabbing through never rewrites a name
  const dirty = useRef(false);
  useEffect(() => {
    try {
      const m = localStorage.getItem(`litma:fieldMode:${storageKey}`);
      if (m === "manglish" || m === "plain") setMode(m);
    } catch {}
  }, [storageKey]);
  useEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });
  const pick = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(`litma:fieldMode:${storageKey}`, m);
    } catch {}
  };
  const finishAll = () => {
    if (dirty.current && mode === "manglish" && /[A-Za-z]/.test(value)) onChange(toMalayalam(value));
    dirty.current = false;
  };
  const latin = mode === "manglish" && /[A-Za-z]/.test(value);
  // a whole Manglish value can be converted at once (e.g. text pasted or saved earlier)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <span className="flex overflow-hidden rounded-full border border-line text-[10.5px]" role="group" aria-label={t("field.typing")}>
          {(["manglish", "plain"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => pick(m)} className={`px-2 py-0.5 ${mode === m ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"}`}>
              {t(m === "manglish" ? "field.manglish" : "field.plain")}
            </button>
          ))}
        </span>
      </div>
      <input
        ref={ref}
        className="field !py-1.5"
        value={value}
        placeholder={placeholder}
        style={{ fontFamily: "'Noto Sans Malayalam', Inter, sans-serif" }}
        autoComplete="off"
        spellCheck={mode === "plain"}
        onChange={(e) => {
          const v = e.target.value;
          dirty.current = true;
          const pos = e.target.selectionStart ?? v.length;
          if (mode === "manglish") {
            // a Latin word just finished by a space or punctuation mark before the caret
            const m = v.slice(0, pos).match(/([A-Za-z~_^]+)([^A-Za-z~_^])$/);
            if (m) {
              const ml = toMalayalam(m[1]);
              const start = pos - m[0].length;
              caret.current = start + ml.length + m[2].length;
              onChange(v.slice(0, start) + ml + m[2] + v.slice(pos));
              return;
            }
          }
          onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") finishAll();
        }}
        onBlur={finishAll}
      />
      {latin && (
        <button type="button" className="mt-1 block max-w-full truncate text-left text-[11px] text-muted hover:text-accent" style={{ fontFamily: "'Noto Sans Malayalam', Inter, sans-serif" }} onClick={() => onChange(toMalayalam(value))} title={t("field.convert")}>
          → {toMalayalam(value)}
        </button>
      )}
    </div>
  );
}
