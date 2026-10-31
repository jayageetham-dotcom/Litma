"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { DictionaryView } from "@/components/DictionaryView";

/** Dictionary in the editor: looks up the selected word; clicking a result replaces the selection. */
export function DictionaryPanel({ editor }: { editor: Editor }) {
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
      <h3 className="mb-2 text-sm font-semibold">Dictionary &amp; thesaurus</h3>
      <p className="mb-3 text-xs text-muted">Select a word in your text, or type one. Ctrl/⌘+Shift+L opens this panel.</p>
      <DictionaryView
        compact
        query={word}
        pickLabel="Click a word to put it in your text (replaces the selection)."
        onPick={(w) => {
          editor.chain().focus().insertContent(w).run();
        }}
      />
    </div>
  );
}
