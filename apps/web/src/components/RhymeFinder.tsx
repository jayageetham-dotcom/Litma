"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { InkDots } from "@/components/ui/Skeleton";
import { rhymes } from "@/lib/dictionary";
import { manglishWord } from "@litma/shared/manglish";
import { metrePattern } from "@litma/shared/manglish";
import { RHYME_KINDS, rhymeKey, type Rhyme, type RhymeKind } from "@litma/shared/rhyme";
import { track } from "@/lib/analytics";
import { useT } from "@/i18n/react";

const ml = { fontFamily: "'Noto Sans Malayalam', var(--font-ui)" } as const;

/** Rhymes shown at a time; "Next set" moves through the rest. */
const PAGE = 40;

/** Malayalam as typed, or Manglish turned into Malayalam. */
export function toMalayalamWord(raw: string): string {
  const w = raw.trim().split(/\s+/)[0] ?? "";
  if (!w || /[ഀ-ൿ]/.test(w)) return w.replace(/[^ഀ-ൿ‌‍]/g, "");
  return /^[A-Za-z~_^]+$/.test(w) ? manglishWord(w) : "";
}

/**
 * Rhyme finder (പ്രാസം): words from the dictionary that share the second akshara's consonant
 * (ദ്വിതീയാക്ഷര പ്രാസം), the last akshara (അന്ത്യപ്രാസം) or the first letter (ആദിപ്രാസം), with
 * their laghu–guru pattern. `word` comes from outside (the line being written); the writer can
 * also type Malayalam or Manglish.
 */
export function RhymeFinder({
  word: external,
  kind: externalKind,
  onPick,
  onKind,
  compact = false,
  pickHint,
}: {
  word?: string;
  kind?: RhymeKind;
  onPick: (w: string) => void;
  onKind?: (k: RhymeKind) => void;
  compact?: boolean;
  pickHint?: string;
}) {
  const t = useT();
  const [typed, setTyped] = useState(external ?? "");
  const [kind, setKind] = useState<RhymeKind>(externalKind ?? "second");
  const [sameLength, setSameLength] = useState(false);
  const [sameMetre, setSameMetre] = useState(false);
  const [list, setList] = useState<Rhyme[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(0);

  useEffect(() => {
    if (external !== undefined) setTyped(external);
  }, [external]);
  useEffect(() => {
    if (externalKind) setKind(externalKind);
  }, [externalKind]);

  const word = toMalayalamWord(typed);
  const key = word ? rhymeKey(word, kind) : null;

  useEffect(() => {
    let live = true;
    if (!word || !key) {
      setList(null);
      return;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      rhymes
        .find(word, kind, { max: 1000, sameLength, sameMetre })
        .then((r) => {
          if (!live) return;
          setList(r);
          setStart(0);
          track("rhyme_lookup", { kind });
        })
        .finally(() => live && setBusy(false));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [word, key, kind, sameLength, sameMetre]);

  const pick = (k: RhymeKind) => {
    setKind(k);
    onKind?.(k);
  };

  return (
    <div>
      <label className="relative block">
        <Search size={compact ? 15 : 18} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${compact ? "left-3" : "left-4"}`} aria-hidden />
        <input
          className={`field ${compact ? "!py-1.5 !pl-9 !text-sm" : "!rounded-2xl !py-3.5 !pl-11 !text-[17px]"}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t("rhyme.placeholder")}
          aria-label={t("rhyme.placeholder")}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-private
          style={ml}
          lang="ml"
        />
      </label>

      <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-3" : "mt-4"}`} role="radiogroup" aria-label={t("rhyme.kindLabel")}>
        {RHYME_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(k)}
            className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${kind === k ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line-strong text-muted hover:text-ink"}`}
          >
            <span style={ml}>{t(`rhyme.kind.${k}.ml`)}</span>
            <span className="ml-1.5 text-[11px]">{t(`rhyme.kind.${k}.en`)}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{t(`rhyme.kind.${kind}.hint`)}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={sameLength} onChange={(e) => setSameLength(e.target.checked)} /> {t("rhyme.sameLength")}
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={sameMetre} onChange={(e) => setSameMetre(e.target.checked)} /> {t("rhyme.sameMetre")}
        </label>
      </div>

      {word && key && (
        <p className={`text-sm ${compact ? "mt-3" : "mt-5"}`}>
          <span className="text-muted">{t("rhyme.for")} </span>
          <b style={ml}>{word}</b>
          <span className="ml-2 font-mono text-xs text-muted" title={t("rhyme.metreTitle")}>{metrePattern(word)}</span>
          <span className="ml-2 rounded-full bg-subtle px-2 py-0.5 text-xs" style={ml}>{key}</span>
        </p>
      )}

      <div className={compact ? "mt-3" : "mt-4"}>
        {!word ? (
          <p className="text-sm text-muted">{t("rhyme.empty")}</p>
        ) : busy && !list ? (
          <InkDots />
        ) : !key ? (
          <p className="text-sm text-muted">{t("rhyme.tooShort")}</p>
        ) : list && list.length === 0 ? (
          <p className="text-sm text-muted">{t("rhyme.none")}</p>
        ) : list ? (
          <>
            {pickHint && <p className="mb-2 text-xs text-muted">{pickHint}</p>}
            <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
              {list.slice(start, start + PAGE).map((r) => (
                <button
                  key={r.word}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick(r.word)}
                  title={`${r.word} · ${r.metre}`}
                  className={`rounded-full border bg-surface text-ink transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent ${r.sameMetre ? "border-line-strong" : "border-line"} ${compact ? "px-2.5 py-0.5 text-[14px]" : "px-3 py-1 text-[15px]"}`}
                  style={ml}
                >
                  {r.word}
                  <span className="ml-1.5 font-mono text-[10px] text-muted">{r.metre}</span>
                </button>
              ))}
            </div>
            {list.length > PAGE && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setStart((s) => (s + PAGE >= list.length ? 0 : s + PAGE));
                    track("rhyme_next");
                  }}
                  className="btn btn-outline !gap-1.5 !rounded-full !px-3.5 !py-1.5 text-[13px]"
                >
                  <RefreshCw size={14} aria-hidden /> {t("rhyme.next")}
                </button>
                <span className="text-xs text-muted" aria-live="polite">
                  {t("rhyme.range", { from: start + 1, to: Math.min(start + PAGE, list.length), total: list.length })}
                </span>
              </div>
            )}
            <p className="mt-4 text-[11px] text-muted">{t("rhyme.source")}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
