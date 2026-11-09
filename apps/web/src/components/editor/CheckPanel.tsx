"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Check, Wand2 } from "lucide-react";
import { GrammarCheck } from "./GrammarCheck";
import { useT } from "@/i18n/react";
import { SPELL_EVENT, addMyWord, setSpellPrefs, spellPrefs, type SpellPrefs } from "@/lib/spell";
import { spellIssues, type DocIssue } from "@/extensions/writing-aids";

const ml = { fontFamily: "'Noto Sans Malayalam', var(--font-ui)" } as const;

function Group({ title, dot, children }: { title: string; dot: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-4 first:border-0 first:pt-0">
      <h4 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
        <span aria-hidden className={`size-1.5 rounded-full ${dot}`} /> {title}
      </h4>
      {children}
    </section>
  );
}

/** Spelling marks in the text and their list (free, on the device), and an AI grammar check whose fixes apply here. */
export function CheckPanel({ editor, kind, docId, title, onOpenInbox }: { editor: Editor; kind: string; docId: string; title: string; onOpenInbox: () => void }) {
  const t = useT();
  const [prefs, setPrefs] = useState<SpellPrefs>(() => spellPrefs());
  const [issues, setIssues] = useState<DocIssue[]>([]);
  useEffect(() => {
    const read = () => setPrefs(spellPrefs());
    window.addEventListener(SPELL_EVENT, read);
    return () => window.removeEventListener(SPELL_EVENT, read);
  }, []);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setIssues(spellIssues(editor.state)));
    };
    read();
    editor.on("transaction", read);
    return () => {
      editor.off("transaction", read);
      cancelAnimationFrame(frame);
    };
  }, [editor]);

  const replace = (i: DocIssue, fix: string) => editor.chain().focus().insertContentAt({ from: i.pos, to: i.end }, fix).run();
  const show = (i: DocIssue) => {
    editor.chain().focus().setTextSelection({ from: i.pos, to: i.end }).scrollIntoView().run();
  };
  const fixAll = () => {
    // from the end, so earlier positions stay right
    const tr = editor.state.tr;
    [...issues].filter((i) => i.kind === "unicode" && i.fix[0]).reverse().forEach((i) => tr.insertText(i.fix[0], i.pos, i.end));
    editor.view.dispatch(tr);
  };
  const broken = issues.filter((i) => i.kind === "unicode").length;
  const shown = issues.slice(0, 200);

  return (
    <div className="space-y-5 text-sm">
      <Group title={t("check.spelling")} dot="bg-tint-coral">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-[var(--accent)]" checked={prefs.on} onChange={(e) => setSpellPrefs({ on: e.target.checked })} />
          {t("check.markOn")}
        </label>
        <label className={`mt-2 flex items-start gap-2 ${prefs.on ? "" : "opacity-60"}`}>
          <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" disabled={!prefs.on} checked={prefs.unknown} onChange={(e) => setSpellPrefs({ unknown: e.target.checked })} />
          <span>
            {t("check.unknown")}
            <span className="block text-xs text-muted">{t("check.unknownHint")}</span>
          </span>
        </label>

        {prefs.on && (
          <div className="mt-4">
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-muted">
                <Check size={15} className="text-tint-lime" aria-hidden /> {t("check.none")}
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted">{t("check.count", { count: issues.length })}</p>
                {broken > 1 && (
                  <button type="button" className="btn btn-outline mb-3 w-full !py-1.5" onClick={fixAll}>
                    <Wand2 size={15} /> {t("check.fixAll", { count: broken })}
                  </button>
                )}
                <ul className="space-y-1.5">
                  {shown.map((i) => (
                    <li key={`${i.pos}-${i.text}`} className="rounded-xl border border-line bg-paper px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button type="button" className="min-w-0 truncate text-left text-[15px] hover:underline" style={ml} onClick={() => show(i)} data-private>
                          {i.text}
                        </button>
                        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] ${i.kind === "unknown" ? "bg-subtle text-muted" : "bg-danger-soft text-danger"}`}>{t(`check.kind.${i.kind}`)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {i.fix.map((f) => (
                          <button key={f} type="button" onClick={() => replace(i, f)} className="rounded-full border border-line-strong px-2.5 py-0.5 text-[14px] hover:border-accent hover:text-accent" style={ml} data-private>
                            {f}
                          </button>
                        ))}
                        {i.kind !== "unicode" && (
                          <button type="button" onClick={() => addMyWord(i.text)} className="px-1.5 py-0.5 text-xs text-muted hover:text-ink">
                            {t("check.keep")}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {!prefs.on && <p className="mt-3 text-xs text-muted">{t("check.offHint")}</p>}
      </Group>

      <Group title={t("check.grammar")} dot="bg-tint-violet">
        <GrammarCheck editor={editor} kind={kind} docId={docId} title={title} onOpenInbox={onOpenInbox} />
      </Group>
    </div>
  );
}
