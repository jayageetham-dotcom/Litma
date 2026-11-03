"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { BookmarkButton, useBookmarks } from "@/components/SavedWords";
import { InkDots } from "@/components/ui/Skeleton";
import { track } from "@/lib/analytics";
import { loadIndex, lookup, manglishCandidates, opposites, suggest, type LookupResult } from "@/lib/dictionary";

/** Malayalam text, with the UI font for any Latin letters (glosses, English words) */
const ml = { fontFamily: "'Noto Sans Malayalam', var(--font-ui)" } as const;

/** Part-of-speech abbreviations in the data, spelled out (Malayalam · English). */
const POS: Record<string, [string, string]> = {
  "നാ.": ["നാമം", "noun"],
  "വി.": ["വിശേഷണം", "adjective"],
  "ക്രി.": ["ക്രിയ", "verb"],
  "അവ്യ.": ["അവ്യയം", "indeclinable"],
  "സ.നാ.": ["സർവനാമം", "pronoun"],
  "പ്ര.": ["പ്രയോഗം", "usage"],
  "ക്രി.വി.": ["ക്രിയാവിശേഷണം", "adverb"],
  n: ["നാമം", "noun"],
  v: ["ക്രിയ", "verb"],
  a: ["വിശേഷണം", "adjective"],
  adj: ["വിശേഷണം", "adjective"],
  adv: ["ക്രിയാവിശേഷണം", "adverb"],
  pron: ["സർവനാമം", "pronoun"],
  prep: ["ഉപസർഗം", "preposition"],
  conj: ["സമുച്ചയം", "conjunction"],
  interj: ["വ്യാക്ഷേപകം", "interjection"],
  phr: ["ശൈലി", "phrase"],
};

/** "നാ. ബ.വ." → { ml: "നാമം", en: "noun", extra: "ബ.വ." }; "-" → null */
function posLabel(raw: string) {
  const p = raw.replace(/"/g, "").trim();
  if (!p || p === "-") return null;
  const [first, ...rest] = p.split(/\s+/);
  const known = POS[first] ?? POS[first.toLowerCase()];
  return { ml: known?.[0] ?? first, en: known?.[1] ?? "", extra: rest.join(" ") };
}

/**
 * Olam definitions mix plain senses with phrase entries ("കൊടുങ്കാട് = വലിയകാട്", often after
 * "(പ്ര.)"). Split them: senses stay in the numbered list, phrases get their own section.
 */
function splitDef(d: string) {
  const senses: string[] = [];
  const phrases: { term: string; meaning: string }[] = [];
  for (const part of d.replace(/\(പ്ര\.\)/g, ". ").split(/\.\s+|\.$/)) {
    const s = part.trim().replace(/\.$/, "");
    if (!s) continue;
    const eq = s.indexOf(" = ");
    if (eq > 0) phrases.push({ term: s.slice(0, eq).trim(), meaning: s.slice(eq + 3).trim() });
    else senses.push(s);
  }
  return { sense: senses.join(". "), phrases };
}

/** A section with a Malayalam title, its English name, an optional count and a small tint dot. */
function Section({ ml: title, en, count, dot, compact, children }: { ml: string; en: string; count?: number; dot: string; compact: boolean; children: React.ReactNode }) {
  return (
    <section className={`border-t border-line ${compact ? "py-4" : "py-6"}`}>
      <h4 className={`flex items-center gap-2 ${compact ? "mb-2.5" : "mb-4"}`}>
        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
        <span className={`font-semibold text-ink ${compact ? "text-[14px]" : "text-[15px]"}`} style={ml}>
          {title}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{en}</span>
        {count !== undefined && count > 0 && <span className="ml-auto rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted">{count}</span>}
      </h4>
      {children}
    </section>
  );
}

function Chips({ words, onPick, title, limit, compact }: { words: { word: string; gloss?: string }[]; onPick: (w: string) => void; title: string; limit?: number; compact: boolean }) {
  const [all, setAll] = useState(false);
  if (!words.length) return null;
  const shown = limit && !all ? words.slice(0, limit) : words;
  return (
    <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
      {shown.map((w, i) => (
        <button
          key={w.word + i}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(w.word)}
          title={w.gloss ? `${title} · ${w.gloss}` : title}
          className={`rounded-full border border-line bg-surface text-ink transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent ${compact ? "px-2.5 py-0.5 text-[14px]" : "px-3 py-1 text-[15px]"}`}
          style={ml}
        >
          {w.word}
          {w.gloss && <span className="ml-1.5 text-[11px] text-muted">{w.gloss}</span>}
        </button>
      ))}
      {limit && words.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="px-2 py-1 text-[13px] font-medium text-accent hover:underline">
          {all ? "Show fewer" : `Show all ${words.length}`}
        </button>
      )}
    </div>
  );
}

/**
 * Dictionary & thesaurus: English → Malayalam, Malayalam → Malayalam, Malayalam → English,
 * synonyms (പര്യായം) and opposites (വിപരീതം). Accepts Malayalam, English or Manglish.
 */
export function DictionaryView({
  query: external,
  onPick,
  pickLabel = "Click a word to insert it",
  compact = false,
}: {
  query?: string;
  /** called when a result word is clicked; default: look that word up */
  onPick?: (word: string) => void;
  pickLabel?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState(external ?? "");
  const [res, setRes] = useState<LookupResult | null>(null);
  const [opp, setOpp] = useState<{ word: string; gloss?: string }[] | null>(null);
  const [alts, setAlts] = useState<string[]>([]);
  const [sugs, setSugs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [sources, setSources] = useState<{ name: string; url: string; license: string }[]>([]);
  const seq = useRef(0);
  const sugSeq = useRef(0);
  const saved = useBookmarks();

  useEffect(() => {
    loadIndex().then((i) => {
      setAvailable(!!i);
      if (i) setSources(i.sources);
    });
  }, []);

  // look up the word passed in, including on first render (a link such as /dictionary/?w=താമര)
  useEffect(() => {
    if (external) {
      setQ(external);
      run(external);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external]);

  async function run(word: string) {
    const w = word.trim();
    if (!w) return;
    const id = ++seq.current;
    setBusy(true);
    sugSeq.current++; // a suggestion list still loading must not reopen over the result
    setSugs([]);
    setOpp(null);
    // which kind of word, never the word itself
    track("dictionary_lookup", { script: /[\u0D00-\u0D7F]/.test(w) ? "malayalam" : "latin" });
    const [r, m] = await Promise.all([lookup(w), manglishCandidates(w)]);
    if (id !== seq.current) return;
    setRes(r);
    setBusy(false);
    // Manglish: show Malayalam words the Latin input may stand for
    const found: string[] = [];
    for (const c of m) if ((await lookup(c)).head) found.push(c);
    if (id === seq.current) setAlts(found);
    const o = r.head ? await opposites(r) : [];
    if (id === seq.current) setOpp(o);
  }

  const pick = (w: string) => {
    if (onPick) onPick(w);
    else {
      setQ(w);
      run(w);
    }
  };

  /** meanings grouped by part of speech, with phrase entries pulled out */
  const shaped = useMemo(() => {
    if (!res) return null;
    const groups: { pos: ReturnType<typeof posLabel>; senses: string[] }[] = [];
    const phrases: { term: string; meaning: string }[] = [];
    for (const m of res.meanings) {
      const pos = posLabel(m.pos);
      const senses: string[] = [];
      for (const d of m.defs.slice(0, compact ? 6 : 20)) {
        const { sense, phrases: ph } = splitDef(d);
        if (sense) senses.push(sense);
        phrases.push(...ph);
      }
      if (senses.length) groups.push({ pos, senses });
    }
    return { groups, phrases };
  }, [res, compact]);

  const firstPos = shaped?.groups[0]?.pos;

  return (
    <div>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <Search size={compact ? 16 : 18} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${compact ? "left-3" : "left-4"}`} />
        <input
          className={`field ${compact ? "!py-1.5 !pl-9 !text-sm" : "!rounded-2xl !py-3.5 !pl-11 !text-[17px]"}`}
          value={q}
          placeholder="Malayalam, English or Manglish word"
          aria-label="Word to look up"
          onChange={async (e) => {
            const v = e.target.value;
            setQ(v);
            const id = ++sugSeq.current;
            const list = v.trim().length >= 2 ? await suggest(v, 8) : [];
            if (id === sugSeq.current) setSugs(list);
          }}
          onBlur={() => setTimeout(() => setSugs([]), 150)}
          onKeyDown={(e) => e.key === "Escape" && setSugs([])}
          style={ml}
        />
        {sugs.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface py-1.5 shadow-[var(--pop-shadow)]" role="listbox">
            {sugs.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-[15px] hover:bg-subtle"
                  style={ml}
                  onClick={() => {
                    setQ(s);
                    run(s);
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {available === false && (
        <p className="mt-4 rounded-lg bg-highlight-soft px-3 py-2 text-sm">
          The dictionary data isn’t installed on this site yet. Run <code>npm run dict</code> (or deploy; CI builds it) to add the Olam datasets.
        </p>
      )}

      {busy && <InkDots className="mt-6 py-2" />}

      {res && !busy && (
        <article className={compact ? "mt-4" : "mt-8"}>
          {alts.length > 0 && res.lang === "en" && (
            <div className={compact ? "mb-4" : "mb-6"}>
              <h4 className="mb-2 text-xs font-semibold text-muted">Manglish → മലയാളം</h4>
              <Chips words={alts.map((word) => ({ word }))} onPick={(w) => (onPick ? onPick(w) : pick(w))} title="Malayalam" compact={compact} />
            </div>
          )}
          {!res.head ? (
            <p className="text-[15px] text-muted">
              “{res.query}” isn’t in the dictionary{alts.length ? ". Try one of the Malayalam words above" : ""}.
            </p>
          ) : (
            <>
              {/* ── the headword ── */}
              <header className={`flex items-start justify-between gap-4 ${compact ? "pb-4" : "pb-6"}`}>
                <div className="min-w-0">
                  <h3 className={`${compact ? "text-2xl" : "text-[2.6rem]"} font-bold leading-tight text-ink`} style={ml}>
                    {res.head}
                  </h3>
                  <p className={`mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-muted ${compact ? "text-xs" : "text-sm"}`}>
                    {firstPos && (
                      <span className="font-medium text-highlight" style={ml}>
                        {firstPos.ml}
                        {firstPos.en && <span className="ml-1 font-normal text-muted">({firstPos.en})</span>}
                      </span>
                    )}
                    {res.lang === "ml" && res.translations.length > 0 && (
                      <span>
                        {firstPos && <span aria-hidden className="mr-2">·</span>}
                        {res.translations.slice(0, 3).join(", ")}
                      </span>
                    )}
                    {res.head.toLowerCase() !== res.query.toLowerCase() && <span>for “{res.query}”</span>}
                  </p>
                </div>
                <BookmarkButton result={res} saved={!!saved?.some((b) => b.word === res.head)} />
              </header>

              {/* ── meanings, by part of speech ── */}
              {shaped && shaped.groups.length > 0 && (
                <Section ml={res.lang === "en" ? "മലയാളം അർത്ഥം" : "അർത്ഥം"} en="Meaning" dot="bg-tint-violet" compact={compact}>
                  <div className={compact ? "space-y-4" : "space-y-6"}>
                    {shaped.groups.map((g, gi) => (
                      <div key={gi}>
                        {g.pos && (shaped.groups.length > 1 || g.pos.extra) && (
                          <p className="mb-2 text-[13px] font-semibold text-highlight" style={ml}>
                            {g.pos.ml}
                            {g.pos.en && <span className="ml-1 font-normal text-muted">({g.pos.en})</span>}
                            {g.pos.extra && <span className="ml-1.5 font-normal text-muted">{g.pos.extra}</span>}
                          </p>
                        )}
                        {res.lang === "en" && g.senses.every((s) => s.length < 28) ? (
                          <Chips words={g.senses.map((word) => ({ word }))} onPick={pick} title="Malayalam" compact={compact} />
                        ) : (
                          <ol className={`list-none ${compact ? "space-y-2" : "space-y-3"}`}>
                            {g.senses.map((s, i) => (
                              <li key={i} className={`grid grid-cols-[1.5rem_1fr] gap-x-1 leading-relaxed text-ink ${compact ? "text-[14px]" : "text-[16px]"}`} style={ml}>
                                <span className="pt-[0.15em] text-right font-sans text-[12px] font-semibold tabular-nums text-muted">{i + 1}.</span>
                                <span className="pl-1.5">{s}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── phrases and compounds ── */}
              {shaped && shaped.phrases.length > 0 && (
                <Section ml="പ്രയോഗങ്ങൾ" en="Phrases" count={shaped.phrases.length} dot="bg-tint-tangerine" compact={compact}>
                  <dl className={`grid gap-x-5 ${compact ? "gap-y-2.5" : "gap-y-3 sm:grid-cols-[minmax(7rem,max-content)_1fr]"}`} style={ml}>
                    {shaped.phrases.map((p, i) => (
                      <div key={i} className="contents">
                        <dt className={`font-semibold text-ink ${compact ? "text-[14px]" : "text-[15.5px]"}`}>{p.term}</dt>
                        <dd className={`text-muted ${compact ? "-mt-2 text-[13.5px]" : "text-[15px] max-sm:-mt-2.5"}`}>{p.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                </Section>
              )}

              <Section ml="പര്യായം" en="Synonyms" count={res.synonyms.length} dot="bg-tint-sky" compact={compact}>
                {res.synonyms.length ? <Chips words={res.synonyms.slice(0, 40).map((word) => ({ word }))} onPick={pick} title="Synonym" limit={compact ? 12 : 24} compact={compact} /> : <p className="text-sm text-muted">None listed.</p>}
              </Section>

              <Section ml="വിപരീതം" en="Opposites" count={opp?.length} dot="bg-tint-coral" compact={compact}>
                {opp === null ? <InkDots /> : opp.length ? <Chips words={opp} onPick={pick} title="Opposite" compact={compact} /> : <p className="text-sm text-muted">None found.</p>}
              </Section>

              {res.translations.length > 0 && (
                <Section ml={res.lang === "en" ? "മലയാളം" : "ഇംഗ്ലീഷ്"} en={res.lang === "en" ? "In Malayalam" : "English"} count={Math.min(res.translations.length, 40)} dot="bg-tint-lime" compact={compact}>
                  <Chips words={res.translations.slice(0, 40).map((word) => ({ word }))} onPick={pick} title={res.lang === "en" ? "Malayalam" : "English"} limit={compact ? 12 : 24} compact={compact} />
                </Section>
              )}
              {onPick && <p className="border-t border-line pt-3 text-[11.5px] text-muted">{pickLabel}</p>}
            </>
          )}
        </article>
      )}

      {sources.length > 0 && (
        <p className={`border-t border-line text-[11px] leading-relaxed text-muted ${compact ? "mt-2 pt-3" : "mt-4 pt-5"}`}>
          Data:{" "}
          {sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                {s.name}
              </a>{" "}
              ({s.license})
            </span>
          ))}{" "}
          from Olam. Opposites via Datamuse.
        </p>
      )}
    </div>
  );
}
