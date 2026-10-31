"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { loadIndex, lookup, manglishCandidates, opposites, suggest, type LookupResult } from "@/lib/dictionary";

const ml = { fontFamily: "'Noto Sans Malayalam'" } as const;

function Chips({ words, onPick, title }: { words: { word: string; gloss?: string }[]; onPick: (w: string) => void; title: string }) {
  if (!words.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map((w, i) => (
        <button
          key={w.word + i}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(w.word)}
          title={w.gloss ? `${title} · ${w.gloss}` : title}
          className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[14px] hover:border-kayal hover:text-kayal"
          style={ml}
        >
          {w.word}
          {w.gloss && <span className="ml-1 text-[11px] text-muted">{w.gloss}</span>}
        </button>
      ))}
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

  useEffect(() => {
    loadIndex().then((i) => {
      setAvailable(!!i);
      if (i) setSources(i.sources);
    });
  }, []);

  useEffect(() => {
    if (external && external !== q) {
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
    setSugs([]);
    setOpp(null);
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

  return (
    <div className="space-y-4">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className={`field !pl-9 ${compact ? "!py-1.5 !text-sm" : "!py-2.5 !text-base"}`}
          value={q}
          placeholder="Malayalam, English or Manglish word"
          aria-label="Word to look up"
          onChange={async (e) => {
            setQ(e.target.value);
            setSugs(e.target.value.trim().length >= 2 ? await suggest(e.target.value, 8) : []);
          }}
          style={ml}
        />
        {sugs.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-paper py-1 shadow-lg" role="listbox">
            {sugs.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-[15px] hover:bg-desk-2"
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
        <p className="rounded-lg bg-kasavu-soft px-3 py-2 text-sm">
          The dictionary data isn’t installed on this site yet. Run <code>npm run dict</code> (or deploy — CI builds it) to add the Olam datasets.
        </p>
      )}

      {busy && <Loader2 size={18} className="animate-spin text-muted" />}

      {res && !busy && (
        <div className="space-y-4">
          {alts.length > 0 && res.lang === "en" && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold text-muted">Manglish → മലയാളം</h4>
              <Chips words={alts.map((word) => ({ word }))} onPick={(w) => (onPick ? onPick(w) : pick(w))} title="Malayalam" />
            </div>
          )}
          {!res.head ? (
            <p className="text-sm text-muted">
              “{res.query}” isn’t in the dictionary{alts.length ? " — try one of the Malayalam words above" : ""}.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <h3 className={`${compact ? "text-xl" : "text-3xl"} font-bold`} style={ml}>
                  {res.head}
                </h3>
                {res.head.toLowerCase() !== res.query.toLowerCase() && <span className="text-xs text-muted">for “{res.query}”</span>}
              </div>

              {res.meanings.length > 0 && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold text-kasavu">{res.lang === "en" ? "മലയാളം അർത്ഥം · Meaning" : "അർത്ഥം · Meaning"}</h4>
                  <ol className="space-y-1.5">
                    {res.meanings.slice(0, compact ? 6 : 20).map((m, i) => (
                      <li key={i} className="text-[15px] leading-relaxed" style={ml}>
                        {m.pos && m.pos !== "-" && <span className="mr-1.5 rounded bg-desk-2 px-1 text-[11px] text-muted">{m.pos}</span>}
                        {m.defs.slice(0, compact ? 4 : 12).join(" · ")}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section>
                <h4 className="mb-1.5 text-xs font-semibold text-kasavu">പര്യായം · Synonyms</h4>
                {res.synonyms.length ? <Chips words={res.synonyms.slice(0, compact ? 18 : 40).map((word) => ({ word }))} onPick={pick} title="Synonym" /> : <p className="text-sm text-muted">None listed.</p>}
              </section>

              <section>
                <h4 className="mb-1.5 text-xs font-semibold text-kasavu">വിപരീതം · Opposites</h4>
                {opp === null ? <Loader2 size={14} className="animate-spin text-muted" /> : opp.length ? <Chips words={opp} onPick={pick} title="Opposite" /> : <p className="text-sm text-muted">None found.</p>}
              </section>

              {res.translations.length > 0 && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold text-kasavu">{res.lang === "en" ? "മലയാളം · In Malayalam" : "English"}</h4>
                  <Chips words={res.translations.slice(0, compact ? 15 : 40).map((word) => ({ word }))} onPick={pick} title={res.lang === "en" ? "Malayalam" : "English"} />
                </section>
              )}
              {onPick && <p className="text-[11.5px] text-muted">{pickLabel}</p>}
            </>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
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
