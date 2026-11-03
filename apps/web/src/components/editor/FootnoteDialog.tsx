"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { X } from "lucide-react";
import { useT } from "@/i18n/react";
import { manglish } from "@litma/shared/manglish";
import { FOOTNOTE_EVENT, type FootnoteEventDetail } from "@/extensions/footnote";

/**
 * Add or edit a footnote. Opened by the toolbar's footnote button (adds one at the cursor) or by
 * clicking a footnote number in the text (edits or removes that note).
 */
export function FootnoteDialog({ editor, bottomOffset = 0 }: { editor: Editor; bottomOffset?: number }) {
  const t = useT();
  const [open, setOpen] = useState<FootnoteEventDetail | null>(null);
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<FootnoteEventDetail>).detail ?? {};
      setOpen(d);
      setText(d.text ?? "");
      setTimeout(() => area.current?.focus(), 30);
    };
    window.addEventListener(FOOTNOTE_EVENT, on);
    return () => window.removeEventListener(FOOTNOTE_EVENT, on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const editing = open.pos != null;

  function close() {
    setOpen(null);
    editor.commands.focus();
  }
  function save() {
    const note = text.trim();
    if (!note) return close();
    if (editing) {
      const pos = open!.pos!;
      const node = editor.state.doc.nodeAt(pos);
      if (node?.type.name === "footnote") editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { text: note }));
    } else {
      editor.chain().focus().insertContent({ type: "footnote", attrs: { text: note } }).run();
    }
    setOpen(null);
    editor.commands.focus();
  }
  function remove() {
    const pos = open!.pos!;
    const node = editor.state.doc.nodeAt(pos);
    if (node?.type.name === "footnote") editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
    close();
  }

  return (
    <div className="no-print scrim fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog pop-in w-full max-w-md rounded-2xl p-5" role="dialog" aria-modal="true" aria-label={editing ? t("editor.footnote.edit") : t("editor.footnote.title")} style={{ marginBottom: bottomOffset }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{editing ? t("editor.footnote.edit") : t("editor.footnote.title")}</h2>
          <button className="btn btn-ghost !p-1.5" onClick={close} aria-label={t("editor.footnote.cancel")}>
            <X size={16} />
          </button>
        </div>
        <textarea
          ref={area}
          data-private
          className="field min-h-28 max-md:!text-base"
          style={{ fontFamily: "'Noto Serif Malayalam', serif" }}
          value={text}
          placeholder={t("editor.footnote.placeholder")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className="text-xs leading-relaxed text-muted">{t("editor.footnote.help")}</p>
          <button type="button" className="shrink-0 text-xs text-accent underline" onClick={() => setText(manglish(text))} title="Convert Manglish to Malayalam">
            ⇄ Manglish → മലയാളം
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {editing && (
            <button className="btn btn-danger !px-3" onClick={remove}>
              {t("editor.footnote.remove")}
            </button>
          )}
          <span className="flex-1" />
          <button className="btn btn-ghost" onClick={close}>
            {t("editor.footnote.cancel")}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!text.trim()}>
            {editing ? t("editor.footnote.save") : t("editor.footnote.insert")}
          </button>
        </div>
      </div>
    </div>
  );
}
