"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Bookmark, ChevronRight } from "lucide-react";
import { DictionaryView } from "@/components/DictionaryView";
import { useBookmarks } from "@/components/SavedWords";
import { useT } from "@/i18n/react";

/** Dictionary in the editor: looks up the selected word; clicking a result replaces the selection. */
export function DictionaryPanel({ editor, onSaved }: { editor: Editor; onSaved?: () => void }) {
  const t = useT();
  const saved = useBookmarks();
  const [word, setWord] = useState<string | undefined>(undefined);
  useEffect(() => {
    const read = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) return;
      const t = editor.state.doc.textBetween(from, to, " ").trim();
      if (t && t.length <= 40 && !/\s{2,}/.test(t) && t.split(/\s+/).length <= 3) setWord(t);
    };
    read();
    editor.on("selectionUpdate", read);
    return () => {
      editor.off("selectionUpdate", read);
    };
  }, [editor]);
  return (
    <div>
      {onSaved && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onSaved} className="mb-3 flex w-full items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-left text-sm hover:bg-subtle">
          <Bookmark size={15} className="text-accent" aria-hidden />
          <span className="font-medium">{t("saved.title")}</span>
          {saved && saved.length > 0 && <span className="rounded-full bg-subtle px-2 text-xs text-muted">{saved.length}</span>}
          <ChevronRight size={15} className="ml-auto text-muted" aria-hidden />
        </button>
      )}
      <p className="mb-3 text-xs text-muted">Select a word in your text, or type one. Ctrl/⌘+Shift+L opens this panel.</p>
      <DictionaryView
        compact
        query={word}
        pickLabel="Click a word to put it in your text (replaces the selection)."
        onPick={(w) => {
          // touch screens: don't pop the keyboard back up just to place a word
          const touch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
          (touch ? editor.chain() : editor.chain().focus()).insertContent(w).run();
        }}
      />
    </div>
  );
}
