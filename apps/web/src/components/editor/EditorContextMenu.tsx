"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { BookA, Bold, ClipboardPaste, ClipboardType, Copy, Italic, Keyboard, Repeat2, RemoveFormatting, Scissors, Sparkles, TextSelect, Trash2, Underline } from "lucide-react";
import { issueAt, type DocIssue } from "@/extensions/writing-aids";
import { boldIsOn } from "@/extensions/bold";
import { addMyWord, ignoreWord } from "@/lib/spell";
import { desktop } from "@/lib/desktop";
import { useT } from "@/i18n/react";
import { domId, ownAttr } from "./aria-owner";

/** Fired on window while the menu is open, so the spelling card under the word steps aside. */
export const CONTEXT_MENU_EVENT = "litma:context-menu";

const ML_FONT = { fontFamily: "'Noto Sans Malayalam'" };
const keep = (e: React.SyntheticEvent) => e.preventDefault();
const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** "⌘X" on a Mac, "Ctrl+X" elsewhere. */
const keys = (k: string, shift = false) => (isMac() ? `${shift ? "⇧" : ""}⌘${k}` : `Ctrl+${shift ? "Shift+" : ""}${k}`);
/** Letters of a word, for finding the word under the pointer. */
const WORD = /[ഀ-ൿ‌‍A-Za-z0-9']/;

type Item =
  | { kind: "sep" }
  | { kind: "item"; id: string; label: string; icon?: React.ComponentType<{ size?: number }>; keys?: string; run: () => void; disabled?: boolean; active?: boolean; ml?: boolean; strong?: boolean };

export interface EditorContextMenuProps {
  editor: Editor;
  onLookUp: () => void;
  onRhymes: () => void;
  onAskAI: () => void;
  onShortcuts: () => void;
}

/**
 * Litma's own right-click menu in the manuscript (web and the desktop app), like Google Docs:
 * spelling fixes for a marked word first, then cut, copy, paste (with and without formatting),
 * delete and select all, then Litma's tools for the word or selection (dictionary, rhymes, AI)
 * and formatting, each with its shortcut. Focus stays in the text (combobox-style keys: ↑↓, Enter,
 * Esc), so copy and cut act on the real selection. Shift + right-click, and touch screens, keep
 * the browser's own menu.
 */
export function EditorContextMenu({ editor, onLookUp, onRhymes, onAskAI, onShortcuts }: EditorContextMenuProps) {
  const t = useT();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [issue, setIssue] = useState<DocIssue | null>(null);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [toast, setToast] = useState("");
  const menu = useRef<HTMLDivElement>(null);
  const listId = domId("ctx-menu", useId());
  const optId = (i: number) => `${listId}-${i}`;

  const close = useCallback(() => {
    setAt(null);
    setActive(-1);
  }, []);

  // open on right-click (or the menu key / Shift+F10) in the text
  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    const onMenu = (e: MouseEvent) => {
      if (e.shiftKey || !editor.isEditable) return; // the browser's own menu
      const keyboard = e.button !== 2 && e.clientX === 0 && e.clientY === 0;
      // touch screens: a long press selects text and shows the system's handles and bar
      if (!keyboard && typeof window.matchMedia === "function" && !window.matchMedia("(pointer: fine)").matches) return;
      e.preventDefault();
      const { state, view } = editor;
      let x = e.clientX, y = e.clientY;
      if (keyboard) {
        const c = view.coordsAtPos(state.selection.head);
        x = c.left;
        y = c.bottom;
      } else {
        // like Docs: a click outside the selection moves the cursor there; inside keeps it
        const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
        const { from, to } = state.selection;
        if (hit && (state.selection.empty || hit.pos < from || hit.pos > to)) {
          view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, hit.pos)));
        }
      }
      if (!editor.isFocused) editor.commands.focus();
      setIssue(issueAt(editor.state));
      setActive(-1);
      setAt({ x, y });
    };
    dom.addEventListener("contextmenu", onMenu);
    return () => dom.removeEventListener("contextmenu", onMenu);
  }, [editor]);

  // tell the spelling card to step aside while the menu is open
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CONTEXT_MENU_EVENT, { detail: { open: !!at } }));
  }, [at]);
  useEffect(() => () => void window.dispatchEvent(new CustomEvent(CONTEXT_MENU_EVENT, { detail: { open: false } })), []);

  /** The selection, or the word under the cursor selected first (for Look up and Rhymes). */
  const selectWord = () => {
    const { state, view } = editor;
    if (!state.selection.empty) return;
    const $p = state.selection.$from;
    const text = $p.parent.textBetween(0, $p.parent.content.size, "\n", "￼");
    let a = $p.parentOffset, b = $p.parentOffset;
    while (a > 0 && WORD.test(text[a - 1])) a--;
    while (b < text.length && WORD.test(text[b])) b++;
    if (a === b) return;
    const start = $p.start();
    view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, start + a, start + b)));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? "" : m)), 3500);
  };

  const paste = async (plain: boolean) => {
    editor.commands.focus();
    const d = desktop();
    if (d?.edit) return void d.edit(plain ? "pasteAndMatchStyle" : "paste");
    try {
      if (!plain && navigator.clipboard?.read) {
        for (const item of await navigator.clipboard.read()) {
          if (item.types.includes("text/html")) {
            const html = await (await item.getType("text/html")).text();
            if (editor.view.pasteHTML(html)) return;
          }
          if (item.types.includes("text/plain")) {
            editor.view.pasteText(await (await item.getType("text/plain")).text());
            return;
          }
        }
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text) editor.view.pasteText(text);
    } catch {
      showToast(t("editorMenu.pasteBlocked", { key: keys("V", plain) }));
    }
  };

  const sel = editor.state.selection;
  const hasSel = !sel.empty;
  const ml = issue && issue.kind !== "punct";
  const items: Item[] = [];
  if (issue) {
    issue.fix.slice(0, 4).forEach((f, i) =>
      items.push({
        kind: "item",
        id: `fix${i}`,
        label: ml ? f : t("check.ai.fix"),
        ml: !!ml,
        strong: i === 0,
        run: () => {
          editor.view.dispatch(editor.state.tr.insertText(f, issue.pos, issue.end));
          editor.commands.focus();
        },
      }),
    );
    items.push({ kind: "item", id: "ignore", label: t("check.ignore"), run: () => issue.kind !== "punct" && ignoreWord(issue.text) });
    if (issue.kind !== "unicode" && issue.kind !== "punct") items.push({ kind: "item", id: "keep", label: t("check.keep"), run: () => addMyWord(issue.text) });
    items.push({ kind: "sep" });
  }
  items.push(
    { kind: "item", id: "cut", label: t("editorMenu.cut"), icon: Scissors, keys: keys("X"), disabled: !hasSel, run: () => document.execCommand("cut") },
    { kind: "item", id: "copy", label: t("editorMenu.copy"), icon: Copy, keys: keys("C"), disabled: !hasSel, run: () => document.execCommand("copy") },
    { kind: "item", id: "paste", label: t("editorMenu.paste"), icon: ClipboardPaste, keys: keys("V"), run: () => void paste(false) },
    { kind: "item", id: "pastePlain", label: t("editorMenu.pastePlain"), icon: ClipboardType, keys: keys("V", true), run: () => void paste(true) },
    { kind: "item", id: "delete", label: t("editorMenu.delete"), icon: Trash2, disabled: !hasSel, run: () => editor.chain().focus().deleteSelection().run() },
    { kind: "item", id: "selectAll", label: t("editorMenu.selectAll"), icon: TextSelect, keys: keys("A"), run: () => editor.chain().focus().selectAll().run() },
    { kind: "sep" },
    { kind: "item", id: "lookUp", label: t("editorMenu.lookUp"), icon: BookA, keys: keys("L", true), run: () => { selectWord(); onLookUp(); } },
    { kind: "item", id: "rhymes", label: t("editorMenu.rhymes"), icon: Repeat2, run: () => { selectWord(); onRhymes(); } },
    { kind: "item", id: "askAI", label: t("editorMenu.askAI"), icon: Sparkles, run: onAskAI },
    { kind: "sep" },
    { kind: "item", id: "bold", label: t("editorMenu.bold"), icon: Bold, keys: keys("B"), active: boldIsOn(editor), run: () => editor.chain().focus().toggleSmartBold().run() },
    { kind: "item", id: "italic", label: t("editorMenu.italic"), icon: Italic, keys: keys("I"), active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { kind: "item", id: "underline", label: t("editorMenu.underline"), icon: Underline, keys: keys("U"), active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
    { kind: "item", id: "clear", label: t("editorMenu.clearFormatting"), icon: RemoveFormatting, disabled: !hasSel, run: () => editor.chain().focus().unsetAllMarks().run() },
    { kind: "sep" },
    { kind: "item", id: "keys", label: t("editorMenu.shortcuts"), icon: Keyboard, keys: keys("/"), run: onShortcuts },
  );
  const usable = items.map((it, i) => (it.kind === "item" && !it.disabled ? i : -1)).filter((i) => i >= 0);

  const choose = (i: number) => {
    const it = items[i];
    if (!it || it.kind !== "item" || it.disabled) return;
    close();
    it.run();
  };

  // keys while open (focus stays in the text), and closing on a click elsewhere, scroll or resize
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  const usableRef = useRef(usable);
  usableRef.current = usable;
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => {
      const u = usableRef.current;
      const a = activeRef.current;
      const k = u.indexOf(a);
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown") setActive(k < 0 ? u[0] : u[(k + 1) % u.length]);
      else if (e.key === "ArrowUp") setActive(k < 0 ? u[u.length - 1] : u[(k - 1 + u.length) % u.length]);
      else if (e.key === "Home") setActive(u[0]);
      else if (e.key === "End") setActive(u[u.length - 1]);
      else if (e.key === "Enter") {
        if (a >= 0) chooseRef.current(a);
        else close();
      } else {
        close(); // any other key: back to writing
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    document.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [at, close]);

  // keep it on screen: flip left/up when it would run past the edge
  useLayoutEffect(() => {
    if (!at) return setPos(null);
    const w = menu.current?.offsetWidth ?? 280;
    const h = menu.current?.offsetHeight ?? 480;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = at.x + w + 8 > vw ? Math.max(8, at.x - w) : at.x;
    const top = at.y + h + 8 > vh ? Math.max(8, Math.min(at.y - h, vh - h - 8)) : at.y;
    setPos({ left, top });
  }, [at, issue]);

  // the text controls the menu (like the suggestion lists)
  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    ownAttr(dom, "aria-controls", at ? listId : null, "ctx-");
    ownAttr(dom, "aria-activedescendant", at && active >= 0 ? optId(active) : null, "ctx-");
    return () => {
      ownAttr(dom, "aria-controls", null, "ctx-");
      ownAttr(dom, "aria-activedescendant", null, "ctx-");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, at, active, listId]);

  return (
    <>
      {at && (
        <div
          ref={menu}
          id={listId}
          role="menu"
          aria-label={t("editorMenu.label")}
          className="pop-in no-print fixed z-[60] flex w-max min-w-[15rem] max-w-[calc(100vw-16px)] flex-col overflow-y-auto rounded-[12px] border border-line bg-paper p-1.5 text-[13.5px] text-ink shadow-[var(--pop-shadow)]"
          style={{ left: pos?.left ?? at.x, top: pos?.top ?? at.y, maxHeight: "calc(100vh - 16px)", visibility: pos ? "visible" : "hidden", fontFamily: "var(--font-ui)" }}
          onPointerDown={keep}
          onMouseDown={keep}
          onContextMenu={keep}
        >
          {issue && (
            <p className="px-2.5 pb-1 pt-0.5 text-[11.5px] font-medium text-muted">
              {ml ? t(`check.kind.${issue.kind}`) : t(`check.punct.${(issue.rule ?? "spaceBefore") as "spaceBefore"}`)}
            </p>
          )}
          {items.map((it, i) =>
            it.kind === "sep" ? (
              <div key={`sep${i}`} role="separator" className="my-1 h-px shrink-0 bg-line" />
            ) : (
              <button
                key={it.id}
                id={optId(i)}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={it.disabled}
                aria-disabled={it.disabled}
                lang={it.ml ? "ml" : undefined}
                onPointerEnter={() => !it.disabled && setActive(i)}
                onClick={() => choose(i)}
                className={`flex h-8 shrink-0 items-center gap-2.5 rounded-[6px] px-2.5 text-left ${it.disabled ? "text-muted opacity-50" : i === active ? "bg-subtle" : ""} ${it.strong ? "font-medium text-accent" : ""} ${it.ml ? "h-9 text-[16px]" : ""}`}
                style={it.ml ? ML_FONT : undefined}
                data-private={it.ml || undefined}
              >
                {it.icon ? (
                  <span className={`flex w-4 shrink-0 justify-center ${it.active ? "text-accent" : "text-muted"}`} aria-hidden>
                    <it.icon size={15} />
                  </span>
                ) : (
                  !it.ml && <span className="w-4 shrink-0" aria-hidden />
                )}
                <span className="flex-1 whitespace-nowrap">{it.label}</span>
                {it.keys && <span className="ml-6 shrink-0 text-[12px] text-muted">{it.keys}</span>}
              </button>
            ),
          )}
          <p className="mt-1 border-t border-line px-2.5 pb-0.5 pt-1.5 text-[11px] text-muted">{t("editorMenu.nativeHint")}</p>
        </div>
      )}
      {toast && (
        <div role="status" className="pop-in no-print fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-line bg-paper px-4 py-2 text-[13px] text-ink shadow-[var(--pop-shadow)]" style={{ fontFamily: "var(--font-ui)" }}>
          {toast}
        </div>
      )}
    </>
  );
}
