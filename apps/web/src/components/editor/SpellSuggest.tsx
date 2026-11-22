"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { issueAt, type DocIssue } from "@/extensions/writing-aids";
import { manglishKey } from "@/extensions/manglish";
import { addMyWord, ignoreWord } from "@/lib/spell";
import { useT } from "@/i18n/react";
import { domId, ownAttr } from "./aria-owner";

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

const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);

/**
 * Keyboard for the suggestions, like the Manglish list: focus stays in the text. ↓/↑ move through
 * the rows (spellings, then Ignore and Keep), Enter uses the highlighted row, Esc closes, Alt+↓
 * always opens the list. Until an arrow has been pressed nothing is highlighted, so Enter still
 * starts a new line. When the card appeared because the writer was moving with the arrow keys,
 * plain ↑/↓ go on moving the cursor (only Alt+↓ opens it), so the card never traps them.
 * Screen readers follow the highlighted row through aria-activedescendant on the editor.
 */
function useSpellKeys(editor: Editor, issue: DocIssue | null, count: number, run: (i: number) => void, close: () => void) {
  const [active, setActive] = useState(-1);
  const lastNav = useRef(0);
  const passive = useRef(false);
  const id = useId();
  const optId = (i: number) => `${domId("spell-opt", id)}-${i}`;
  const key = issue ? keyOf(issue) : "";

  // a new word: nothing highlighted yet; remember whether arrow keys brought the cursor here
  useEffect(() => {
    setActive(-1);
    passive.current = !!key && Date.now() - lastNav.current < 400;
  }, [key]);

  const live = useRef({ active, count, run, close, issue });
  live.current = { active, count, run, close, issue };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editor.isFocused || e.isComposing) return;
      const { active, count, run, close, issue } = live.current;
      const open = e.altKey && !e.metaKey && !e.ctrlKey && e.key === "ArrowDown";
      if (!issue || count === 0) {
        if (NAV_KEYS.has(e.key)) lastNav.current = Date.now();
        return;
      }
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === "Escape") {
        stop();
        close();
        return;
      }
      if (open) {
        stop();
        passive.current = false;
        setActive((a) => (a < 0 ? 0 : (a + 1) % count));
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && (active >= 0 || !passive.current)) {
        stop();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setActive(active < 0 ? (d > 0 ? 0 : count - 1) : (active + d + count) % count);
        return;
      }
      if (e.key === "Enter" && active >= 0) {
        stop();
        run(active);
        return;
      }
      if (NAV_KEYS.has(e.key)) lastNav.current = Date.now();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editor]);

  // tell screen readers which row is highlighted (the editor keeps focus, like a combobox)
  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    ownAttr(dom, "aria-activedescendant", issue && active >= 0 && active < count ? optId(active) : null, "spell-");
    return () => ownAttr(dom, "aria-activedescendant", null, "spell-");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, issue, active, count]);

  return { active, optId };
}

/** What a screen reader hears when the card opens (a polite live region that is always there). */
function SpellAnnounce({ issue }: { issue: DocIssue | null }) {
  const t = useT();
  const [text, setText] = useState("");
  const key = issue ? keyOf(issue) : "";
  useEffect(() => {
    if (!issue) return setText("");
    const kind = issue.kind === "punct" ? t(`check.punct.${(issue.rule ?? "spaceBefore") as "spaceBefore"}`) : t(`check.kind.${issue.kind}`);
    setText(t("check.announce", { kind, word: issue.text }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true" data-private>
      {text}
    </div>
  );
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
  const fixes = issue ? issue.fix.slice(0, 6) : [];
  const count = issue ? fixes.length + 1 + (canKeep ? 1 : 0) : 0;
  const run = (i: number) => (i < fixes.length ? fix(fixes[i]) : i === fixes.length ? ignore() : keepWord());
  const { active, optId } = useSpellKeys(editor, issue, count, run, close);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active >= 0) strip.current?.querySelector(`#${optId(active)}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  if (!issue)
    return (
      <>
        <SpellAnnounce issue={null} />
        {placeholder ? <div className="no-print h-11 border-t border-line bg-paper" aria-hidden /> : null}
      </>
    );
  const ring = (i: number) => (i === active ? " outline outline-2 -outline-offset-2 outline-accent" : "");
  const ml = issue.kind !== "punct";
  return (
    <>
      <SpellAnnounce issue={issue} />
      <div ref={strip} className="no-print flex h-11 items-stretch gap-1 border-t border-line bg-paper px-1.5 py-1 text-ink" role="listbox" aria-label={t("check.suggestions")} onPointerDown={keep} onMouseDown={keep}>
        <div className="scrollbar-none flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto overscroll-x-contain" role="group">
          {fixes.length === 0 && (
            <span className="flex shrink-0 items-center px-2.5 text-[13px] text-muted" aria-hidden>
              {t(`check.kind.${issue.kind}`)}
            </span>
          )}
          {fixes.map((f, i) => (
            <button
              key={f + i}
              id={optId(i)}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              lang={ml ? "ml" : undefined}
              onClick={() => fix(f)}
              className={`shrink-0 whitespace-nowrap rounded-[8px] px-3 text-[17px] ${i === 0 ? "bg-accent-soft font-medium text-accent" : "active:bg-subtle"}${ring(i)}`}
              style={ml ? ML_FONT : undefined}
              data-private
            >
              {ml ? f : t("check.ai.fix")}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-stretch gap-1" role="group">
          <button id={optId(fixes.length)} type="button" role="option" tabIndex={-1} aria-selected={active === fixes.length} onClick={ignore} title={t("check.ignoreHint")} className={`shrink-0 rounded-[8px] px-2.5 text-[13px] text-muted active:bg-subtle${ring(fixes.length)}`}>
            {t("check.ignore")}
          </button>
          {canKeep && (
            <button id={optId(fixes.length + 1)} type="button" role="option" tabIndex={-1} aria-selected={active === fixes.length + 1} onClick={keepWord} title={t("check.keepHint")} className={`shrink-0 rounded-[8px] px-2.5 text-[13px] text-muted active:bg-subtle${ring(fixes.length + 1)}`}>
              {t("check.keep")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Spelling suggestions under a marked word (desktop, Electron, tablets): shown when the cursor is
 * in the word, the word is selected, or it was just edited (after its new check). Pick a spelling
 * with the mouse or the keyboard (see useSpellKeys), or Ignore / Keep; Esc closes it and typing
 * simply goes on.
 */
export function SpellSuggest({ editor }: { editor: Editor }) {
  const t = useT();
  const { issue, close } = useSpellAt(editor);
  const { fix, ignore, keepWord, canKeep } = useActions(editor, issue, close);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const fixes = issue ? issue.fix.slice(0, 6) : [];
  const count = issue && pos ? fixes.length + 1 + (canKeep ? 1 : 0) : 0;
  const run = (i: number) => (i < fixes.length ? fix(fixes[i]) : i === fixes.length ? ignore() : keepWord());
  const { active, optId } = useSpellKeys(editor, issue, count, run, close);
  const headId = useId();
  const listId = domId("spell-list", useId());

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

  // the editor controls the list while it is open (combobox-like, focus stays in the text)
  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    ownAttr(dom, "aria-controls", issue && pos ? listId : null, "spell-");
    return () => ownAttr(dom, "aria-controls", null, "spell-");
  }, [editor, issue, pos, listId]);

  if (!issue || !pos)
    return (
      <>
        <SpellAnnounce issue={null} />
      </>
    );
  const ml = issue.kind !== "punct";
  const row = (i: number, base: string) => `${base}${i === active ? " outline outline-2 -outline-offset-2 outline-accent" : ""}`;
  return (
    <>
      <SpellAnnounce issue={issue} />
      <div
        ref={card}
        className="no-print fixed z-50 flex w-max min-w-[12rem] max-w-[calc(100vw-16px)] flex-col rounded-[12px] border border-line bg-paper p-1.5 text-ink shadow-lg"
        style={{ left: pos.left, top: pos.top }}
        onPointerDown={keep}
        onMouseDown={keep}
      >
        <p id={headId} className="px-1.5 pb-1 pt-0.5 text-[11.5px] font-medium text-muted" style={{ fontFamily: "var(--font-ui)" }}>
          {ml ? t(`check.kind.${issue.kind}`) : t(`check.punct.${(issue.rule ?? "spaceBefore") as "spaceBefore"}`)}
        </p>
        <div id={listId} role="listbox" aria-labelledby={headId} className="flex flex-col">
          {fixes.length > 0 && (
            <div role="group" className="flex flex-col gap-[2px]">
              {fixes.map((f, i) => (
                <button
                  key={f + i}
                  id={optId(i)}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === active}
                  lang={ml ? "ml" : undefined}
                  onClick={() => fix(f)}
                  className={row(i, `flex h-9 shrink-0 items-center whitespace-nowrap rounded-[6px] px-2.5 text-left text-[17px] ${i === 0 ? "bg-accent-soft font-medium text-accent hover:brightness-95" : "hover:bg-subtle"}`)}
                  style={ml ? ML_FONT : { fontFamily: "var(--font-ui)", fontSize: 14 }}
                  data-private
                >
                  {ml ? f : t("check.ai.fix")}
                </button>
              ))}
            </div>
          )}
          <div role="group" className="mt-1 flex items-center gap-1 border-t border-line pt-1 text-[13px]" style={{ fontFamily: "var(--font-ui)" }}>
            <button id={optId(fixes.length)} type="button" role="option" tabIndex={-1} aria-selected={active === fixes.length} onClick={ignore} title={t("check.ignoreHint")} className={row(fixes.length, "flex-1 rounded-[6px] px-2 py-1 text-left text-muted hover:bg-subtle hover:text-ink")}>
              {t("check.ignore")}
            </button>
            {canKeep && (
              <button id={optId(fixes.length + 1)} type="button" role="option" tabIndex={-1} aria-selected={active === fixes.length + 1} onClick={keepWord} title={t("check.keepHint")} className={row(fixes.length + 1, "rounded-[6px] px-2 py-1 text-muted hover:bg-subtle hover:text-ink")}>
                {t("check.keep")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
