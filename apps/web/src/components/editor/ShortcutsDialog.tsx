"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/react";

/** Keys and what they do, as i18n keys under `shortcuts` (k: key.* or literal keys, d: do.*). */
type Row = { k: string; key?: boolean; d: string };
const lit = (k: string, d: string): Row => ({ k, d });
const tr = (k: string, d: string): Row => ({ k, key: true, d });

const GROUPS: [string, Row[]][] = [
  [
    "typing",
    [
      lit("Ctrl/⌘ + M", "cycle"),
      tr("spaceEnter", "accept"),
      tr("pick", "pick"),
      tr("pages", "pages"),
      lit("Esc", "keepEnglish"),
      lit("Ctrl/⌘ + Shift + M", "convert"),
    ],
  ],
  ["spelling", [tr("spellOpen", "spellOpen"), lit("Enter", "spellUse"), lit("Esc", "spellClose")]],
  [
    "document",
    [
      lit("Ctrl/⌘ + S", "version"),
      lit("Ctrl/⌘ + F", "find"),
      lit("Ctrl/⌘ + P", "print"),
      lit("Ctrl/⌘ + Shift + F", "focus"),
      lit("Ctrl/⌘ + Shift + L", "dictionary"),
      lit("Ctrl/⌘ + Alt + V", "metre"),
      lit("Ctrl/⌘ + /", "list"),
    ],
  ],
  ["formatting", [lit("Ctrl/⌘ + B · I · U", "bold"), lit("Ctrl/⌘ + Z · Shift + Z", "undo")]],
];

const SCREENPLAY: Row[] = [
  lit("Enter", "next"),
  lit("Tab", "tab"),
  tr("emptyLine", "switch"),
  lit("Ctrl/⌘ + Alt + 1 … 6", "element"),
  tr("castPick", "cast"),
];

/**
 * The editor's shortcut list (? button, Ctrl/⌘ + /). A modal dialog: focus moves to Close when it
 * opens, Tab stays inside, Esc or a click outside closes it, and focus goes back where it was.
 */
export function ShortcutsDialog({ onClose, screenplay }: { onClose: () => void; screenplay: boolean }) {
  const t = useT();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!box.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("keydown", k);
      back?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  const groups: [string, Row[]][] = screenplay ? [...GROUPS, ["screenplay", SCREENPLAY]] : GROUPS;
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center scrim p-4" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="scrollbar-thin max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl dialog p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold">
            {t("shortcuts.title")}
          </h2>
          <button ref={closeBtn} className="btn btn-ghost !p-1.5" onClick={onClose} aria-label={t("shortcuts.close")}>
            <X size={16} aria-hidden />
          </button>
        </div>
        {groups.map(([group, rows]) => (
          <section key={group} className="mb-4">
            <h3 className="mb-1.5 text-sm font-semibold text-highlight">{t(`shortcuts.group.${group as "typing"}`)}</h3>
            <dl className="divide-y divide-line text-sm">
              {rows.map((r) => (
                <div key={r.k + r.d} className="flex justify-between gap-4 py-1.5">
                  <dt className="font-mono text-[12.5px]">{r.key ? t(`shortcuts.key.${r.k as "pick"}`) : r.k}</dt>
                  <dd className="text-right text-muted">{t(`shortcuts.do.${r.d as "pick"}`)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
