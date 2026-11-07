"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { transliterate } from "@/lib/functions";
import { manglishKey, topCandidates, pageOf, MAX_CANDIDATES, PAGE_SIZE, STRIP_SIZE, type ComposeState, type CommitInfo } from "@/extensions/manglish";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/i18n/react";

const cache = new Map<string, string[]>();

async function fetchCandidates(word: string): Promise<string[] | null> {
  if (cache.has(word)) return cache.get(word)!;
  const j = await transliterate(word, MAX_CANDIDATES);
  if (!j.candidates?.length || j.source === "offline") return null;
  const list = topCandidates(j.candidates);
  cache.set(word, list);
  return list;
}

/** Height of one suggestion row (h-9). */
const ROW = 36;
const ML_FONT = { fontFamily: "'Noto Sans Malayalam'" };
const keep = (e: React.SyntheticEvent) => e.preventDefault();

/**
 * Malayalam spellings for the word being typed in Manglish mode, best first. Desktop: a list under
 * the word, PAGE_SIZE at a time with a pager for more. Phones: STRIP_SIZE in a strip.
 * `docked` (phones) shows them as a strip on top of the keyboard, like a phone keyboard's own
 * suggestions; otherwise a one-line bar sits under the word, so the page stays readable.
 */
export function ManglishPopup({ editor, docked = false }: { editor: Editor; docked?: boolean }) {
  const t = useT();
  const [st, setSt] = useState<ComposeState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWord = useRef("");
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const s = manglishKey.getState(editor.state);
      if (!s || !s.active || s.dismissed || !editor.isFocused) {
        setSt(null);
        lastWord.current = "";
        return;
      }
      setSt(s);
      if (!docked) {
        try {
          const c = editor.view.coordsAtPos(s.from);
          const width = bar.current?.offsetWidth ?? 320;
          const left = Math.max(8, Math.min(c.left - 8, window.innerWidth - width - 8));
          const vv = window.visualViewport;
          const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
          const h = bar.current?.offsetHeight ?? 260;
          setPos({ left, top: c.bottom + 6 + h > bottom ? Math.max(8, c.top - 6 - h) : c.bottom + 6 });
        } catch {
          setPos(null);
        }
      }
      if (s.word !== lastWord.current) {
        lastWord.current = s.word;
        const word = s.word;
        if (timer.current) clearTimeout(timer.current);
        if (cache.has(word)) {
          queueMicrotask(() => {
            const now = manglishKey.getState(editor.state);
            if (now?.active && now.word === word && !now.fetched) editor.view.dispatch(editor.state.tr.setMeta(manglishKey, { candidates: cache.get(word), word }));
          });
          return;
        }
        timer.current = setTimeout(async () => {
          const list = await fetchCandidates(word);
          if (!list) return; // offline: the local engine's candidate is already shown
          const now = manglishKey.getState(editor.state);
          if (now?.active && now.word === word) editor.view.dispatch(editor.state.tr.setMeta(manglishKey, { candidates: list, word }));
        }, 90);
      }
    };
    // Late correction: if a word was committed before Google's prediction arrived,
    // swap in the better spelling as soon as it lands (if the text is untouched).
    const pending: CommitInfo[] = [];
    const track = ({ transaction }: { transaction: Transaction }) => {
      for (const p of pending) p.from = transaction.mapping.map(p.from, -1);
      const meta = transaction.getMeta(manglishKey) as { committed?: CommitInfo } | undefined;
      const c = meta?.committed;
      if (!c || c.fetched) return;
      const item = { ...c };
      pending.push(item);
      fetchCandidates(c.word).then((list) => {
        pending.splice(pending.indexOf(item), 1);
        const best = list?.[0];
        if (!best || best === item.text || editor.isDestroyed) return;
        const doc = editor.state.doc;
        const end = item.from + item.text.length;
        if (end > doc.content.size || doc.textBetween(item.from, end) !== item.text) return;
        // not an undo step of its own, and the cursor stays where the writer is typing
        editor.view.dispatch(editor.state.tr.insertText(best, item.from, end).setMeta("addToHistory", false));
      });
    };
    editor.on("transaction", track);
    editor.on("transaction", update);
    editor.on("blur", update);
    return () => {
      editor.off("transaction", track);
      editor.off("transaction", update);
      editor.off("blur", update);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, docked]);

  if (!st) {
    // phones: keep the row while Manglish is on, so the strip above it doesn't jump at every word
    return docked && editor.storage.manglish?.mode === "manglish" ? <div className="no-print h-11 border-t border-line bg-paper" aria-hidden /> : null;
  }
  const all = st.candidates;
  const pick = (i: number) => editor.commands.commitManglish(i);
  const keepEnglish = () => editor.view.dispatch(editor.state.tr.setMeta(manglishKey, { dismiss: true }));
  const show = (index: number) => editor.view.dispatch(editor.state.tr.setMeta(manglishKey, { index }));

  if (docked) {
    // Phones: the original word in quotes on the left (keeps English), the spellings beside it
    const start = pageOf(st.index, STRIP_SIZE) * STRIP_SIZE;
    const strip = all.slice(start, start + STRIP_SIZE);
    return (
      <div className="no-print flex h-11 items-stretch gap-1 border-t border-line bg-paper px-1.5 py-1 text-ink" role="listbox" aria-label={t("manglish.suggestions")}>
        <button
          type="button"
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={keepEnglish}
          aria-label={t("manglish.keepEnglishAria", { word: st.word })}
          className="max-w-[30%] shrink-0 truncate rounded-[8px] px-2.5 font-sans text-[15px] text-muted active:bg-subtle"
        >
          “{st.word}”
        </button>
        {strip.map((c, k) => {
          const i = start + k;
          return (
            <button
              key={c + i}
              type="button"
              role="option"
              aria-selected={i === st.index}
              onPointerDown={keep}
              onMouseDown={keep}
              onClick={() => pick(i)}
              className={`min-w-0 flex-1 truncate rounded-[8px] px-2 text-[17px] ${i === st.index ? "bg-accent-soft font-medium text-accent" : "active:bg-subtle"}`}
              style={ML_FONT}
            >
              {c}
            </button>
          );
        })}
      </div>
    );
  }

  if (!pos) return null;
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(pageOf(st.index), pages - 1);
  const rows = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  return (
    <div
      ref={bar}
      className="no-print fixed z-50 flex w-max min-w-[13rem] max-w-[calc(100vw-16px)] flex-col rounded-[12px] border border-line bg-paper p-1.5 text-ink shadow-lg"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={keep}
      onMouseDown={keep}
    >
      <div
        role="listbox"
        aria-label={t("manglish.suggestions")}
        className="flex flex-col gap-[2px]"
        // a shorter last page keeps the full height, so the pager never jumps under the mouse
        style={pages > 1 ? { minHeight: PAGE_SIZE * ROW + (PAGE_SIZE - 1) * 2 } : undefined}
      >
        {rows.map((c, k) => {
          const i = page * PAGE_SIZE + k;
          const on = i === st.index;
          return (
            <button
              key={c + i}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => pick(i)}
              className={`flex h-9 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[6px] pl-1.5 pr-3 text-left text-[17px] ${on ? "bg-accent-soft text-accent" : "hover:bg-subtle"}`}
              style={ML_FONT}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-[5px] text-[11px] font-semibold leading-none ${on ? "bg-accent text-accent-ink" : "bg-subtle text-muted"}`}
                style={{ fontFamily: "var(--font-ui)" }}
              >
                {k + 1}
              </span>
              {c}
            </button>
          );
        })}
      </div>
      {/* keep the word as typed (Esc), and the pager when there is more than one page */}
      <div className="mt-1 flex items-center gap-1 border-t border-line pt-1" style={{ fontFamily: "var(--font-ui)" }}>
        <button
          type="button"
          onClick={keepEnglish}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[6px] py-1 pl-1.5 pr-2 text-left text-[13px] text-muted hover:bg-subtle"
          aria-label={t("manglish.keepEnglishAria", { word: st.word })}
          title={t("manglish.escHint")}
        >
          <span className="grid h-5 shrink-0 place-items-center rounded-[5px] bg-subtle px-1 text-[10px] font-semibold">Aa</span>
          <span className="max-w-[9rem] truncate font-sans">{st.word}</span>
        </button>
        {pages > 1 && (
          <div className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted" title={t("manglish.pageHint")}>
            <button type="button" onClick={() => show(((page - 1 + pages) % pages) * PAGE_SIZE)} className="grid size-7 place-items-center rounded-[6px] hover:bg-subtle hover:text-ink" aria-label={t("manglish.prevPage")}>
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <span className="min-w-[2.2rem] text-center tabular-nums" aria-live="polite">
              {t("manglish.page", { n: page + 1, total: pages })}
            </span>
            <button type="button" onClick={() => show(((page + 1) % pages) * PAGE_SIZE)} className="grid size-7 place-items-center rounded-[6px] hover:bg-subtle hover:text-ink" aria-label={t("manglish.nextPage")}>
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
