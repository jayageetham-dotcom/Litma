"use client";
import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Search, Trash2 } from "lucide-react";
import { bookmarks } from "@/lib/store";
import type { WordBookmark } from "@/lib/types";
import type { LookupResult } from "@/lib/dictionary";
import { useT } from "@/i18n/react";
import { ListSkeleton } from "@/components/ui/Skeleton";

const ml = { fontFamily: "'Noto Sans Malayalam'" } as const;

/** Live list of the writer's saved words (updates when any screen adds or removes one). */
export function useBookmarks() {
  const [items, setItems] = useState<WordBookmark[] | null>(null);
  const load = useCallback(() => {
    bookmarks
      .list()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("litma:bookmarks", load);
    return () => window.removeEventListener("litma:bookmarks", load);
  }, [load]);
  return items;
}

/** A short meaning to keep with the bookmark: the first senses, trimmed. */
function summary(r: LookupResult) {
  const defs = r.meanings.flatMap((m) => m.defs).slice(0, 3);
  const text = (r.lang === "en" ? defs.join(", ") : defs.join(" · ")) || r.translations.slice(0, 4).join(", ");
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

/** Bookmark toggle shown beside a looked-up word. */
export function BookmarkButton({ result, saved }: { result: LookupResult; saved: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const word = result.head ?? result.query;
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={saved}
      onMouseDown={(e) => e.preventDefault()}
      onClick={async () => {
        setBusy(true);
        try {
          if (saved) await bookmarks.remove(word);
          else await bookmarks.add({ word, lang: result.lang, meaning: summary(result), synonyms: result.synonyms.slice(0, 10), note: null });
        } finally {
          setBusy(false);
        }
      }}
      className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        saved ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink hover:bg-subtle"
      }`}
      title={saved ? t("saved.remove") : t("saved.add")}
    >
      {busy ? <span className="ink-spinner" aria-hidden /> : saved ? <BookmarkCheck size={14} aria-hidden /> : <Bookmark size={14} aria-hidden />}
      {saved ? t("saved.saved") : t("saved.save")}
    </button>
  );
}

/**
 * The saved-words list. In the editor, tapping a word or a synonym puts it into the text;
 * on the dictionary page it looks the word up again.
 */
export function SavedWords({ onPick, onOpen, compact = false }: { onPick?: (w: string) => void; onOpen?: (w: string) => void; compact?: boolean }) {
  const t = useT();
  const items = useBookmarks();
  const [q, setQ] = useState("");
  if (!items) return <ListSkeleton rows={4} />;
  if (!items.length)
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center">
        <Bookmark size={20} className="mx-auto text-muted" aria-hidden />
        <p className="mt-2 text-sm font-semibold">{t("saved.emptyTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{t("saved.emptyBody")}</p>
      </div>
    );
  const shown = q ? items.filter((b) => b.word.includes(q) || b.meaning?.includes(q) || b.synonyms.some((s) => s.includes(q))) : items;
  return (
    <div className="space-y-3">
      {items.length > 6 && (
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field !py-1.5 !pl-9 !text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("saved.search")} aria-label={t("saved.search")} style={ml} />
        </label>
      )}
      <ul className="space-y-2">
        {shown.map((b) => (
          <li key={b.id} className="fade-in group rounded-xl border border-line bg-paper p-3">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (onPick ? onPick(b.word) : onOpen?.(b.word))}
                className="text-left text-[17px] font-semibold leading-snug hover:text-accent"
                style={ml}
                title={onPick ? t("saved.insert") : t("saved.lookUp")}
              >
                {b.word}
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => bookmarks.remove(b.word)}
                className="ml-auto rounded-md p-1 text-muted hover:bg-subtle hover:text-danger [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                aria-label={`${t("saved.remove")}: ${b.word}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {b.meaning && (
              <p className={`mt-1 text-[13.5px] leading-relaxed text-muted ${compact ? "line-clamp-2" : ""}`} style={ml}>
                {b.meaning}
              </p>
            )}
            {b.synonyms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {b.synonyms.slice(0, compact ? 6 : 10).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (onPick ? onPick(s) : onOpen?.(s))}
                    className="rounded-full border border-line px-2 py-0.5 text-[13px] hover:border-accent hover:text-accent"
                    style={ml}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {onPick && <p className="text-[11.5px] text-muted">{t("saved.pickHint")}</p>}
    </div>
  );
}
