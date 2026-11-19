"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { issueAt, type DocIssue } from "@/extensions/writing-aids";
import { manglishKey } from "@/extensions/manglish";
import { addMyWord, ignoreWord } from "@/lib/spell";
import { useT } from "@/i18n/react";

const ML_FONT = { fontFamily: "'Noto Sans Malayalam'" };
const keep = (e: React.SyntheticEvent) => e.preventDefault();
const keyOf = (i: DocIssue) => `${i.pos}:${i.end}:${i.text}`;

/**
 * The marked word the cursor is in (tapped, clicked, selected or just edited), while no Manglish
 * word is being composed. Esc (or "Ignore") closes it for that word; typing on simply goes on.
 */
function useSpellAt(editor: Editor) {
  const [issue, setIssue] = useState<DocIssue | null>(null);
  const [closed, setClosed] = useState("");
  useEffect(() => {
    const read = () => {
      const st = manglishKey.getState(editor.state);
      const composing = !!st?.active && !st.dismissed;
      const next = !composing && editor.isFocused ? issueAt(editor.state) : null;
      setIssue((prev) => (prev && next && keyOf(prev) === keyOf(next) ? prev : next));
    };
    read();
    editor.on("transaction", read);
    editor.on("focus", read);
    editor.on("blur", read);
    return () => {
      editor.off("transaction", read);
      editor.off("focus", read);
      editor.off("blur", read);
    };
  }, [editor]);
  const shown = issue && keyOf(issue) !== closed ? issue : null;
  return { issue: shown, close: () => issue && setClosed(keyOf(issue)) };
}

function useActions(editor: Editor, issue: DocIssue | null, close: () => void) {
  const fix = (text: string) => {
    if (!issue) return;
    editor.view.dispatch(editor.state.tr.insertText(text, issue.pos, issue.end));
    editor.commands.focus();
  };
  const ignore = () => {
    if (!issue) return;
    close();
    if (issue.kind !== "punct") ignoreWord(issue.text);
  };
  const keepWord = () => {
    if (!issue) return;
    close();
    addMyWord(issue.text);
  };
  return { fix, ignore, keepWord, canKeep: !!issue && issue.kind !== "unicode" && issue.kind !== "punct" };
}

/**
 * Spelling suggestions for a marked word on phones: a row on top of the keyboard, where the
 * Manglish suggestions go (they take the row while a word is being typed). Shows `placeholder`
 * (an empty row of the same height) when there is nothing to suggest, so the strip never jumps.
 */
export function SpellStrip({ editor, placeholder = false }: { editor: Editor; placeholder?: boolean }) {
  const t = useT();
  const { issue, close } = useSpellAt(editor);
  const { fix, ignore, keepWord, canKeep } = useActions(editor, issue, close);
  if (!issue) return placeholder ? <div className="no-print h-11 border-t border-line bg-paper" aria-hidden /> : null;
  const fixes = issue.fix.slice(0, 6);
  return (
    <div className="no-print flex h-11 items-stretch gap-1 border-t border-line bg-paper px-1.5 py-1 text-ink" role="listbox" aria-label={t("check.suggestions")}>
      <div className="scrollbar-none flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto overscroll-x-contain">
        {fixes.length === 0 && (
          <span className="flex shrink-0 items-center px-2.5 text-[13px] text-muted">{t(`check.kind.${issue.kind}`)}</span>
        )}
        {fixes.map((f, i) => (
          <button
            key={f + i}
            type="button"
            role="option"
            aria-selected={i === 0}
            onPointerDown={keep}
            onMouseDown={keep}
            onClick={() => fix(f)}
            className={`shrink-0 whitespace-nowrap rounded-[8px] px-3 text-[17px] ${i === 0 ? "bg-accent-soft font-medium text-accent" : "active:bg-subtle"}`}
            style={issue.kind === "punct" ? undefined : ML_FONT}
            data-private
          >
            {issue.kind === "punct" ? t("check.ai.fix") : f}
          </button>
        ))}
      </div>
      <button type="button" onPointerDown={keep} onMouseDown={keep} onClick={ignore} title={t("check.ignoreHint")} className="shrink-0 rounded-[8px] px-2.5 text-[13px] text-muted active:bg-subtle">
        {t("check.ignore")}
      </button>
      {canKeep && (
        <button type="button" onPointerDown={keep} onMouseDown={keep} onClick={keepWord} title={t("check.keepHint")} className="shrink-0 rounded-[8px] px-2.5 text-[13px] text-muted active:bg-subtle">
          {t("check.keep")}
        </button>
      )}
    </div>
  );
}

/**
 * Spelling suggestions under a marked word (desktop, Electron, tablets): shown when the cursor is
 * in the word, the word is selected, or it was just edited (after its new check). Pick a spelling,
 * or Ignore / Keep; Esc closes it and typing simply goes on.
 */
export function SpellSuggest({ editor }: { editor: Editor }) {
  const t = useT();
  const { issue, close } = useSpellAt(editor);
  const { fix, ignore, keepWord, canKeep } = useActions(editor, issue, close);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  // under the word, or above it when there's no room below
  useEffect(() => {
    if (!issue) {
      setPos(null);
      return;
    }
    const place = () => {
      try {
        const a = editor.view.coordsAtPos(issue.pos);
        const b = editor.view.coordsAtPos(issue.end);
        const w = card.current?.offsetWidth ?? 220;
        const h = card.current?.offsetHeight ?? 160;
        const vv = window.visualViewport;
        const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        const left = Math.max(8, Math.min(a.left - 8, window.innerWidth - w - 8));
        const below = Math.max(a.bottom, b.bottom) + 6;
        setPos({ left, top: below + h > bottom ? Math.max(8, Math.min(a.top, b.top) - 6 - h) : below });
      } catch {
        setPos(null);
      }
    };
    place();
    const frame = requestAnimationFrame(place); // again once the card has its real size
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [editor, issue]);

  // Esc closes it (the Manglish list handles its own Esc while a word is being typed)
  useEffect(() => {
    if (!issue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !editor.isFocused) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editor, issue, close]);

  if (!issue || !pos) return null;
  const fixes = issue.fix.slice(0, 6);
  return (
    <div
      ref={card}
      className="no-print fixed z-50 flex w-max min-w-[12rem] max-w-[calc(100vw-16px)] flex-col rounded-[12px] border border-line bg-paper p-1.5 text-ink shadow-lg"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={keep}
      onMouseDown={keep}
      role="dialog"
      aria-label={t("check.suggestions")}
    >
      <p className="px-1.5 pb-1 pt-0.5 text-[11.5px] font-medium text-muted" style={{ fontFamily: "var(--font-ui)" }}>
        {issue.kind === "punct" ? t(`check.punct.${(issue.rule ?? "spaceBefore") as "spaceBefore"}`) : t(`check.kind.${issue.kind}`)}
      </p>
      {fixes.length > 0 && (
        <div role="listbox" className="flex flex-col gap-[2px]">
          {fixes.map((f, i) => (
            <button
              key={f + i}
              type="button"
              role="option"
              aria-selected={i === 0}
              onClick={() => fix(f)}
              className={`flex h-9 shrink-0 items-center whitespace-nowrap rounded-[6px] px-2.5 text-left text-[17px] ${i === 0 ? "bg-accent-soft font-medium text-accent hover:brightness-95" : "hover:bg-subtle"}`}
              style={issue.kind === "punct" ? { fontFamily: "var(--font-ui)", fontSize: 14 } : ML_FONT}
              data-private
            >
              {issue.kind === "punct" ? t("check.ai.fix") : f}
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1 border-t border-line pt-1 text-[13px]" style={{ fontFamily: "var(--font-ui)" }}>
        <button type="button" onClick={ignore} title={t("check.ignoreHint")} className="flex-1 rounded-[6px] px-2 py-1 text-left text-muted hover:bg-subtle hover:text-ink">
          {t("check.ignore")}
        </button>
        {canKeep && (
          <button type="button" onClick={keepWord} title={t("check.keepHint")} className="rounded-[6px] px-2 py-1 text-muted hover:bg-subtle hover:text-ink">
            {t("check.keep")}
          </button>
        )}
      </div>
    </div>
  );
}
