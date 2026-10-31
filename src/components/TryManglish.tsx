"use client";
import { useEffect, useState } from "react";
import { manglish } from "@/shared/manglish";
import { transliterate } from "@/lib/functions";

const DEMO = "ente kadha ivide thudangunnu. puzhayude theerathe oru cheriya veedu.";

/** Landing-page demo: type Manglish, watch it land on the page in Malayalam. */
export function TryManglish() {
  const [text, setText] = useState("");
  const [typed, setTyped] = useState(0);
  const [touched, setTouched] = useState(false);

  // a short typed-out demo until the visitor types themselves
  useEffect(() => {
    if (touched || typed >= DEMO.length) return;
    const t = setTimeout(() => setTyped((n) => n + 1), typed === 0 ? 600 : 55);
    return () => clearTimeout(t);
  }, [typed, touched]);

  const input = touched ? text : DEMO.slice(0, typed);
  const [google, setGoogle] = useState<Record<string, string>>({});

  useEffect(() => {
    const words = Array.from(new Set(input.match(/[A-Za-z]+/g) ?? [])).filter((w) => !google[w]);
    if (!words.length) return;
    const t = setTimeout(async () => {
      const found: Record<string, string> = {};
      await Promise.all(
        words.slice(-6).map(async (w) => {
          const j = await transliterate(w, 1);
          if (j.source !== "offline" && j.candidates?.[0]) found[w] = j.candidates[0];
        })
      );
      setGoogle((g) => ({ ...g, ...found }));
    }, 250);
    return () => clearTimeout(t);
  }, [input, google]);

  const output = input.replace(/[A-Za-z~_^]+/g, (w) => google[w] ?? manglish(w));

  return (
    <div className="w-full">
      <label htmlFor="try" className="mb-2 block text-sm text-muted">
        Type Manglish here
      </label>
      <input
        id="try"
        className="field font-mono !text-[0.95rem]"
        value={input}
        placeholder="ente kadha…"
        onChange={(e) => {
          setTouched(true);
          setText(e.target.value);
        }}
        onFocus={() => {
          if (!touched) {
            setTouched(true);
            setText(DEMO.slice(0, typed));
          }
        }}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="relative mt-4 bg-paper px-8 pb-10 pt-8" style={{ boxShadow: "var(--sheet-shadow)" }}>
        <div className="kasavu-rule absolute inset-x-0 top-0" />
        <p className="min-h-[5.5rem] text-[1.35rem] leading-[1.9] text-ink" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
          {output}
          <span className="ml-0.5 inline-block h-[1.2em] w-[2px] translate-y-[0.2em] animate-pulse bg-kayal" />
        </p>
        <span className="absolute bottom-3 right-4 text-xs text-muted">A4 · 1</span>
      </div>
    </div>
  );
}
