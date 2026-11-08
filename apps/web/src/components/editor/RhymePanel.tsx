"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { RhymeFinder } from "@/components/RhymeFinder";
import { rhymeSource, type RhymeKind } from "@litma/shared/rhyme";
import { useT } from "@/i18n/react";

/**
 * Rhymes beside the manuscript. Without a selection it takes the line being written, or the
 * line above when this one is still empty, so the next line can rhyme with it. A pick goes in at
 * the cursor (or replaces the selection).
 */
export function RhymePanel({ editor }: { editor: Editor }) {
  const t = useT();
  const [kind, setKind] = useState<RhymeKind>("second");
  const [word, setWord] = useState("");
  useEffect(() => {
    const read = () => {
      const { state } = editor;
      const { from, to, empty, $from } = state.selection;
      if (!empty) {
        const sel = state.doc.textBetween(from, to, " ").trim();
        if (sel && sel.split(/\s+/).length <= 2) return setWord(sel);
      }
      let line = $from.parent.textContent;
      if (!line.trim()) {
        // the line above: the one this line should rhyme with
        const idx = $from.index(0);
        for (let i = idx - 1; i >= 0; i--) {
          const text = state.doc.child(i).textContent;
          if (text.trim()) {
            line = text;
            break;
          }
        }
      }
      setWord(rhymeSource(line, kind));
    };
    read();
    editor.on("selectionUpdate", read);
    return () => {
      editor.off("selectionUpdate", read);
    };
  }, [editor, kind]);
  return (
    <RhymeFinder
      compact
      word={word}
      kind={kind}
      onKind={setKind}
      pickHint={t("rhyme.pickHint")}
      onPick={(w) => {
        const touch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
        (touch ? editor.chain() : editor.chain().focus()).insertContent(w).run();
      }}
    />
  );
}
