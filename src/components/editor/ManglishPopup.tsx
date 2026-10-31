"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { transliterate } from "@/lib/functions";
import { manglishKey, type ComposeState, type CommitInfo } from "@/extensions/manglish";

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
        setPos({ left, top: top + 200 > window.innerHeight ? c.top - 6 - 190 : top });
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
        <span>Esc keeps English</span>
      </div>
      <ul className="py-1">
        {list.slice(0, 7).map((c, i) => (
          <li key={c + i}>
            <button
              type="button"
              role="option"
              aria-selected={i === st.index}
              onMouseDown={(e) => {
                e.preventDefault();
                editor.commands.commitManglish(i);
              }}
              className={`flex w-full items-center gap-3 px-3 py-1 text-left text-[17px] ${i === st.index ? "bg-accent-soft text-accent" : "hover:bg-subtle"}`}
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
      <div className="border-t border-line px-3 py-1 text-[11px] text-muted">Space accepts · ↑↓ or 1–7 to pick</div>
    </div>
  );
}
