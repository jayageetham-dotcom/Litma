"use client";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Search } from "lucide-react";
import { NATTARIVU, type NattarivuCategory, type NattarivuTint, type NattarivuWord } from "@litma/shared/nattarivu";
import { useT } from "@/i18n/react";

const DOT: Record<NattarivuTint, string> = {
  violet: "bg-tint-violet",
  coral: "bg-tint-coral",
  sky: "bg-tint-sky",
  lime: "bg-tint-lime",
  tangerine: "bg-tint-tangerine",
};

const display = { fontFamily: "'Anek Malayalam'" };

/** Words in their sections, in order (categories without sections give one unnamed section). */
function sections(words: NattarivuWord[]) {
  const out: { key: string; group?: NattarivuWord["group"]; words: NattarivuWord[] }[] = [];
  for (const w of words) {
    const key = w.group?.ml ?? "";
    const last = out[out.length - 1];
    if (last && last.key === key) last.words.push(w);
    else out.push({ key, group: w.group, words: [w] });
  }
  return out;
}


/** നാട്ടറിവ് home: every category as a card. */
export function NattarivuCategories({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  return (
    <div className="fade-in">
      <p className="max-w-2xl leading-relaxed text-muted">{t("nattarivu.intro")}</p>
      <div className="mt-6 grid grid-flow-row-dense grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {NATTARIVU.map((c) => {
          // the longest word decides the size: a title stays on one line and never breaks mid-word
          const longest = Math.max(...c.ml.split(" ").map((w) => [...w].length));
          const long = longest > 12;
          return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className={`group flex min-w-0 flex-col items-start rounded-2xl border border-line bg-surface p-4 text-left transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:border-transparent hover:shadow-[var(--pop-shadow)] focus-visible:-translate-y-0.5 [container-type:inline-size] sm:p-5 ${long ? "max-sm:col-span-2" : ""}`}
          >
            <span className={`h-2 w-2 rounded-full ${DOT[c.tint]}`} aria-hidden />
            <span className="mt-3 w-full font-bold leading-snug" style={{ ...display, fontSize: `min(1.25rem, ${(100 / (longest * 0.75)).toFixed(1)}cqi)` }}>
              {c.ml}
            </span>
            <span className="mt-0.5 text-sm text-muted">{c.en}</span>
            <span className="mt-3 line-clamp-1 w-full text-[13px] text-muted max-sm:hidden">{c.words.slice(0, 4).map((w) => w.ml).join(" · ")}</span>
            <span className="mt-auto pt-3 text-xs font-medium text-muted">{t("nattarivu.words", { count: c.words.length })}</span>
          </button>
          );
        })}
      </div>
    </div>
  );
}

/** One category: its words with English meanings; a word opens in the dictionary. */
export function NattarivuCategoryView({ category, onBack, onWord, onOpen }: { category: NattarivuCategory; onBack: () => void; onWord: (word: string) => void; onOpen: (id: string) => void }) {
  const t = useT();
  const [filter, setFilter] = useState("");
  const words = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? category.words.filter((w) => w.ml.includes(f) || w.en.toLowerCase().includes(f) || !!w.group?.ml.includes(f) || !!w.group?.en.toLowerCase().includes(f)) : category.words;
  }, [category, filter]);
  const i = NATTARIVU.findIndex((c) => c.id === category.id);
  const next = NATTARIVU[(i + 1) % NATTARIVU.length];
  return (
    <div className="fade-in">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted hover:bg-subtle hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> {t("nattarivu.all")}
      </button>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-[1.6rem] font-bold leading-tight sm:text-[2rem]" style={display}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[category.tint]}`} aria-hidden />
            {category.ml}
          </h2>
          <p className="mt-1 text-muted">
            {category.en} · {t("nattarivu.words", { count: category.words.length })}
          </p>
        </div>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">{t("nattarivu.filter")}</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("nattarivu.filter")} className="field !pl-9 max-md:!text-base" />
        </label>
      </div>

      {words.length === 0 ? (
        <p className="mt-8 text-muted">{t("nattarivu.noMatch", { q: filter.trim() })}</p>
      ) : (
        <div className="mt-6 space-y-8">
          {sections(words).map((sec) => (
            <section key={sec.key}>
              {sec.group && (
                <h3 className="mb-2 flex items-baseline gap-2 border-b border-line pb-2">
                  <span className="text-[1.15rem] font-bold" style={display}>
                    {sec.group.ml}
                  </span>
                  <span className="text-sm text-muted">{sec.group.en}</span>
                </h3>
              )}
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {sec.words.map((w) => (
                  <li key={w.ml} className="border-b border-line">
                    <button type="button" onClick={() => onWord(w.ml)} title={t("nattarivu.open")} className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-3 text-left hover:bg-subtle">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1.1rem] font-semibold leading-snug" style={display}>
                          {w.ml}
                        </span>
                        <span className="block text-sm text-muted">{w.en}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <button type="button" onClick={() => onOpen(next.id)} className="mt-8 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm hover:bg-subtle">
        {t("nattarivu.next")} <span className="font-semibold" style={display}>{next.ml}</span> <ArrowRight size={15} aria-hidden />
      </button>
    </div>
  );
}
