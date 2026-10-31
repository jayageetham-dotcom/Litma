"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { collectCharacters } from "@/extensions/screenplay";
import { manglish } from "@/shared/manglish";

/**
 * Character-name autocomplete for screenplay/drama cues (like Final Draft's SmartType).
 * Shows Story World characters and names already used in the script; Alt+1…9 or click picks one.
 */
export function CueSuggest({ editor, names }: { editor: Editor; names: string[] }) {
  const [state, setState] = useState<{ list: string[]; left: number; top: number; from: number; to: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const { $from, empty } = editor.state.selection;
      if (!empty || $from.parent.type.name !== "dialogueCue" || !editor.isFocused) return setState(null);
      const typed = $from.parent.textContent.replace(/^\(.*?\)\s*/, "").trim();
      const mlTyped = /[A-Za-z]/.test(typed) ? manglish(typed) : typed;
      const pool = Array.from(new Set([...names, ...collectCharacters(editor.state.doc)])).filter((n) => n && n !== typed && n !== mlTyped);
      const list = pool.filter((n) => !typed || n.startsWith(mlTyped) || n.toLowerCase().startsWith(typed.toLowerCase())).slice(0, 7);
      if (!list.length) return setState(null);
      try {
        const c = editor.view.coordsAtPos($from.pos);
        const start = $from.start();
        // sit above the line so it never covers the Manglish suggestions below
        setState({ list, left: c.left, top: Math.max(8, c.top - 6 - (list.length * 34 + 28)), from: start, to: start + $from.parent.content.size });
      } catch {
        setState(null);
      }
    };
    editor.on("transaction", update);
    editor.on("blur", update);
    return () => {
      editor.off("transaction", update);
      editor.off("blur", update);
    };
  }, [editor, names]);

  const pick = (name: string) => {
    if (!state) return;
    const { from, to } = state;
    const cur = editor.state.doc.textBetween(from, to);
    const paren = cur.match(/^\(.*?\)\s*/)?.[0] ?? "";
    const tr = editor.state.tr.insertText(paren + name, from, to);
    tr.setSelection(TextSelection.create(tr.doc, from + paren.length + name.length));
    editor.view.dispatch(tr);
    editor.view.focus();
  };

  useEffect(() => {
    if (!state) return;
    const k = (e: KeyboardEvent) => {
      if (e.altKey && /^Digit[1-9]$/.test(e.code)) {
        const n = Number(e.code.slice(5)) - 1;
        if (state.list[n]) {
          e.preventDefault();
          pick(state.list[n]);
        }
      }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state) return null;
  return (
    <div className="no-print fixed z-40 w-56 overflow-hidden rounded-lg border border-line bg-paper shadow-xl" style={{ left: Math.min(state.left, window.innerWidth - 240), top: state.top }} role="listbox" aria-label="Characters">
      <div className="border-b border-line bg-desk-2/60 px-3 py-1 text-[11px] text-muted">Characters · Alt+number to pick</div>
      {state.list.map((n, i) => (
        <button
          key={n}
          role="option"
          aria-selected={false}
          onMouseDown={(e) => {
            e.preventDefault();
            pick(n);
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[15px] hover:bg-kayal-soft"
          style={{ fontFamily: "'Noto Sans Malayalam'" }}
        >
          <span className="w-3 text-[11px] text-muted">{i + 1}</span>
          {n}
        </button>
      ))}
    </div>
  );
}
