"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

const GROUPS: [string, [string, string][]][] = [
  [
    "Typing",
    [
      ["Ctrl/⌘ + M", "Switch Manglish → മലയാളം → English"],
      ["Space · Enter · punctuation", "Accept the highlighted Malayalam word"],
      ["1 – 7  or  ↑ ↓", "Pick another suggestion"],
      ["Esc", "Keep the English word"],
      ["Ctrl/⌘ + Shift + M", "Convert selected Manglish to Malayalam"],
    ],
  ],
  [
    "Document",
    [
      ["Ctrl/⌘ + S", "Save a named version now"],
      ["Ctrl/⌘ + F", "Find and replace"],
      ["Ctrl/⌘ + P", "Print / save as PDF (A4)"],
      ["Ctrl/⌘ + Shift + F", "Focus mode"],
      ["Ctrl/⌘ + Shift + L", "Dictionary & thesaurus for the selected word"],
      ["Ctrl/⌘ + Alt + V", "Show or hide metre marks (poems, lyrics)"],
      ["Ctrl/⌘ + /", "This list"],
    ],
  ],
  [
    "Formatting",
    [
      ["Ctrl/⌘ + B · I · U", "Bold · italic · underline"],
      ["Ctrl/⌘ + Z · Shift + Z", "Undo · redo"],
    ],
  ],
];

const SCREENPLAY: [string, string][] = [
  ["Enter", "Next element (scene → time → cast → action → dialogue)"],
  ["Tab", "Action ↔ dialogue; name → speech"],
  ["Enter on an empty line", "Switch between action and dialogue"],
  ["Ctrl/⌘ + Alt + 1 … 6", "Scene · Time · Cast · Action · Dialogue · Transition"],
  ["Alt + 1 … 7 (in a name)", "Pick a character from the suggestions"],
];

export function ShortcutsDialog({ onClose, screenplay }: { onClose: () => void; screenplay: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const groups = screenplay ? [...GROUPS, ["Screenplay", SCREENPLAY] as [string, [string, string][]]] : GROUPS;
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="scrollbar-thin max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Keyboard shortcuts</h2>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {groups.map(([title, rows]) => (
          <section key={title} className="mb-4">
            <h3 className="mb-1.5 text-sm font-semibold text-highlight">{title}</h3>
            <dl className="divide-y divide-line text-sm">
              {rows.map(([k, d]) => (
                <div key={k} className="flex justify-between gap-4 py-1.5">
                  <dt className="font-mono text-[12.5px]">{k}</dt>
                  <dd className="text-right text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
