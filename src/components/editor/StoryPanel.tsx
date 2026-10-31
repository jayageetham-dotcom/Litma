"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BookOpenText, CornerDownLeft } from "lucide-react";
import { store } from "@/lib/store";
import { tabsFor, type StoryItem } from "@/lib/story";
import { collectCharacters } from "@/extensions/screenplay";
import type { DocSettings, LitmaDoc } from "@/lib/types";

const ml = { fontFamily: "'Noto Sans Malayalam'" } as const;

/** Side-panel view of the Story World: quick insert of names, plus document notes. */
export function StoryPanel({ editor, doc, settings, onChange, onOpen, refresh = 0 }: { editor: Editor; doc: LitmaDoc; settings: DocSettings; onChange: (p: Partial<DocSettings>) => void; onOpen: () => void; refresh?: number }) {
  const [items, setItems] = useState<StoryItem[]>([]);
  useEffect(() => {
    store.listStory(doc.id).then(setItems).catch(() => {});
  }, [doc.id, refresh]);
  const tabs = tabsFor(doc.kind).filter((t) => t.kind === "character" || t.kind === "location" || t.kind === "item");
  const detected = doc.kind === "screenplay" || doc.kind === "drama" ? collectCharacters(editor.state.doc) : [];
  const known = new Set(items.filter((i) => i.kind === "character").map((i) => i.name));
  const insert = (name: string) => editor.chain().focus().insertContent(name).run();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Story World</h3>
        <button className="btn btn-primary !px-2.5 !py-1 !text-xs" onClick={onOpen}>
          <BookOpenText size={14} /> Open Story World
        </button>
      </div>
      {tabs.map((t) => {
        const list = items.filter((i) => i.kind === t.kind && i.name);
        const extra = t.kind === "character" ? detected.filter((d) => !known.has(d)) : [];
        return (
          <section key={t.kind}>
            <h4 className="mb-1.5 text-xs font-semibold text-kasavu">
              {t.ml} · {t.label}
            </h4>
            {list.length + extra.length === 0 ? (
              <p className="text-xs text-muted">None yet — add them in Story World.</p>
            ) : (
              <ul className="space-y-0.5">
                {list.map((i) => (
                  <li key={i.id} className="group flex items-center justify-between rounded px-2 py-1 hover:bg-desk-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium" style={ml}>
                        {i.name}
                      </span>
                      {i.summary && (
                        <span className="block truncate text-xs text-muted" style={ml}>
                          {i.summary}
                        </span>
                      )}
                    </span>
                    <button className="rounded p-1 text-muted opacity-0 hover:text-kayal group-hover:opacity-100" onClick={() => insert(i.name)} title="Insert name" aria-label={`Insert ${i.name}`}>
                      <CornerDownLeft size={13} />
                    </button>
                  </li>
                ))}
                {extra.map((n) => (
                  <li key={n} className="group flex items-center justify-between rounded px-2 py-1 hover:bg-desk-2">
                    <span className="truncate text-[14px] text-muted" style={ml}>
                      {n} <span className="text-[11px]">(in script)</span>
                    </span>
                    <button
                      className="text-xs text-kayal opacity-0 group-hover:opacity-100"
                      onClick={async () => {
                        const it = await store.saveStory({ document_id: doc.id, kind: "character", name: n });
                        setItems((x) => [...x, it]);
                      }}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <section>
        <h4 className="mb-1.5 text-xs font-semibold text-kasavu">കുറിപ്പ് · Quick notes</h4>
        <textarea className="field min-h-36 !text-[14px] leading-relaxed" placeholder="Plot points, reminders…" value={settings.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value })} style={ml} />
      </section>
    </div>
  );
}
