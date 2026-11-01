"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { transliterate } from "@/lib/functions";
import { manglishKey, type ComposeState, type CommitInfo } from "@/extensions/manglish";
import { useT } from "@/i18n/react";

const cache = new Map<string, string[]>();

async function fetchCandidates(word: string): Promise<string[] | null> {
  if (cache.has(word)) return cache.get(word)!;
  const j = await transliterate(word, 6);
  if (!j.candidates?.length || j.source === "offline") return null;
  cache.set(word, j.candidates);
  return j.candidates;
}

/** Candidate list shown under the word being typed in Manglish mode. */
export function ManglishPopup({ editor }: { editor: Editor }) {
  const t = useT();
  const [st, setSt] = useState<ComposeState | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWord = useRef("");

  useEffect(() => {
    const update = () => {
      const s = manglishKey.getState(editor.state);
      if (!s || !s.active || s.dismissed || !editor.isFocused) {
        setSt(null);
        lastWord.current = "";
        return;
      }
      setSt(s);
      try {
        const c = editor.view.coordsAtPos(s.from);
        const top = c.bottom + 6;
        const left = Math.min(c.left, window.innerWidth - 260);
        // phones: measure against the visible area above the on-screen keyboard
        const vv = window.visualViewport;
        const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        const h = Math.min(260, 44 + (s.candidates.length || 1) * 34 + 44);
        setPos({ left, top: top + h > bottom ? Math.max(8, c.top - 6 - h) : top });
      } catch {
        setPos(null);
      }
      if (s.word !== lastWord.current) {
        lastWord.current = s.word;
        const word = s.word;
        if (timer.current) clearTimeout(timer.current);
        if (cache.has(word)) {
          queueMicrotask(() => {
            const now = manglishKey.getState(editor.state);
            if (now?.active && now.word === word) editor.view.dispatch(editor.state.tr.setMeta(manglishKey, { candidates: cache.get(word), word }));
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
        editor.view.dispatch(editor.state.tr.insertText(best, item.from, end));
      });
    };
    editor.on("transaction", track);
    editor.on("transaction", update);
    editor.on("blur", update);
    return () => {
      editor.off("transaction", track);
      editor.off("transaction", update);
      editor.off("blur", update);
    };
  }, [editor]);

  if (!st || !pos) return null;
  const list = st.candidates.length ? st.candidates : [];
  return (
    <div
      className="no-print fixed z-50 w-60 overflow-hidden rounded-lg border border-line bg-paper text-ink shadow-xl"
      style={{ left: pos.left, top: pos.top }}
      role="listbox"
      aria-label="Malayalam suggestions"
    >
      <div className="flex items-center justify-between border-b border-line bg-subtle/60 px-3 py-1 text-[11px] text-muted">
        <span className="font-mono">{st.word}</span>
        <span className="[@media(hover:none)]:hidden">{t("manglish.escHint")}</span>
      </div>
      <ul className="p-1.5 [&>li+li]:mt-0.5">
        {list.slice(0, 7).map((c, i) => (
          <li key={c + i}>
            <button
              type="button"
              role="option"
              aria-selected={i === st.index}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => {
                e.preventDefault();
                editor.commands.commitManglish(i);
              }}
              className={`flex w-full items-center gap-3 rounded-[6px] px-2.5 py-1 text-left text-[17px] [@media(hover:none)]:py-2 ${i === st.index ? "bg-accent-soft text-accent" : "hover:bg-subtle"}`}
              style={{ fontFamily: "'Noto Sans Malayalam'" }}
            >
              <span className="w-3 text-[11px] text-muted" style={{ fontFamily: "var(--font-ui)" }}>
                {i + 1}
              </span>
              {c}
            </button>
          </li>
        ))}
      </ul>
      {/* keep the word as typed: the touch-friendly version of Esc */}
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.view.dispatch(editor.state.tr.setMeta(manglishKey, { dismiss: true }))}
        className="flex w-full items-center gap-3 border-t border-line px-3 py-2 text-left hover:bg-subtle active:bg-subtle"
        aria-label={t("manglish.keepEnglishAria", { word: st.word })}
      >
        <span className="grid h-5 min-w-5 place-items-center rounded bg-subtle px-1 text-[10px] font-semibold text-muted">Aa</span>
        <span className="min-w-0 flex-1 truncate font-sans text-[15px]">{st.word}</span>
        <span className="shrink-0 text-[11px] text-muted">{t("manglish.keepEnglish")}</span>
      </button>
      <div className="border-t border-line px-3 py-1 text-[11px] text-muted [@media(hover:none)]:hidden">{t("manglish.keysHint")}</div>
    </div>
  );
}
