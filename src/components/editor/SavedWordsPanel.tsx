"use client";
import type { Editor } from "@tiptap/react";
import { SavedWords } from "@/components/SavedWords";

/** Saved words beside the manuscript: tap a word or synonym to put it in the text (replaces a selection). */
export function SavedWordsPanel({ editor }: { editor: Editor }) {
  return (
    <SavedWords
      compact
      onPick={(w) => {
        const touch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
        (touch ? editor.chain() : editor.chain().focus()).insertContent(w).run();
      }}
    />
  );
}
