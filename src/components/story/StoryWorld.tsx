"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/Select";
import type { Editor } from "@tiptap/react";
import { Camera, GripVertical, Loader2, Plus, Trash2, X } from "lucide-react";
import { store } from "@/lib/store";
import { BEAT_COLORS, FIELDS, defaultGroups, tabsFor, type StoryTab, type StoryItem, type StoryKind } from "@/lib/story";
import { resizeImage } from "@/lib/image";
import { manglish } from "@/shared/manglish";
import type { LitmaDoc } from "@/lib/types";
import { proseReport, scriptReport, verseReport } from "./reports";

const ml = { fontFamily: "'Noto Sans Malayalam'" } as const;

/** Full-screen Story World: characters, locations, props, beat board, timeline, notes and reports. */
export function StoryWorld({ doc, editor, onClose }: { doc: LitmaDoc; editor: Editor | null; onClose: () => void }) {
  const tabs = tabsFor(doc.kind);
  const [tab, setTab] = useState<StoryTab>(tabs[0]);
  const [items, setItems] = useState<StoryItem[] | null>(null);
  const [editing, setEditing] = useState<StoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      let list = await store.listStory(doc.id);
      // bring over characters kept in the older per-document notes
      const legacy = doc.settings.characters ?? [];
      if (!list.some((i) => i.kind === "character") && legacy.length) {
        for (const [i, c] of legacy.entries()) await store.saveStory({ document_id: doc.id, kind: "character", name: c.name, summary: c.note, position: i });
        list = await store.listStory(doc.id);
      }
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the Story World.");
      setItems([]);
    }
  }, [doc.id, doc.settings.characters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && !editing && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, editing]);

  const ofKind = (k: StoryKind) => (items ?? []).filter((i) => i.kind === k).sort((a, b) => a.position - b.position);

  async function create(kind: StoryKind, extra: Partial<StoryItem> = {}) {
    const position = (ofKind(kind).at(-1)?.position ?? 0) + 1;
    const it = await store.saveStory({ document_id: doc.id, kind, name: "", position, ...extra });
    setItems((x) => [...(x ?? []), it]);
    setEditing(it);
  }

  async function save(it: StoryItem) {
    const saved = await store.saveStory(it);
    setItems((x) => (x ?? []).map((y) => (y.id === saved.id ? saved : y)));
    return saved;
  }

  async function remove(it: StoryItem) {
    await store.deleteStory(it.id);
    setItems((x) => (x ?? []).filter((y) => y.id !== it.id));
    setEditing(null);
  }

  const content = editor?.getJSON() ?? doc.content;

  return (
    <div className="no-print fixed inset-0 z-50 flex flex-col bg-desk" role="dialog" aria-modal="true" aria-label="Story World">
      <div className="kasavu-rule" />
      <header className="flex items-center gap-3 border-b border-line bg-paper px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Anek Malayalam'" }}>
            കഥാലോകം <span className="text-sm font-normal text-muted">Story World · {doc.title}</span>
          </h2>
        </div>
        <button className="btn btn-ghost !p-2" onClick={onClose} aria-label="Close Story World">
          <X size={18} />
        </button>
      </header>
      <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-line bg-paper px-4" role="tablist">
        {tabs.map((t) => {
          const n = t.kind === "report" ? null : ofKind(t.kind).length;
          return (
            <button
              key={t.kind}
              role="tab"
              aria-selected={tab.kind === t.kind}
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${tab.kind === t.kind ? "border-kasavu font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t.ml} <span className="text-xs text-muted">{t.label}</span>
              {n ? <span className="ml-1.5 rounded-full bg-desk-2 px-1.5 text-[11px]">{n}</span> : null}
            </button>
          );
        })}
      </nav>

      <main className="scrollbar-thin flex-1 overflow-y-auto px-5 py-6">
        {error && <p className="mb-4 rounded-lg bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
        {!items ? (
          <Loader2 className="animate-spin text-muted" />
        ) : tab.kind === "report" ? (
          <Reports doc={doc} content={content} items={items} />
        ) : tab.kind === "beat" ? (
          <BeatBoard doc={doc} items={ofKind("beat")} onAdd={(group) => create("beat", { data: { group, status: "Idea", color: "kayal" } })} onOpen={setEditing} onMove={save} />
        ) : tab.kind === "event" ? (
          <Timeline items={ofKind("event")} onAdd={() => create("event")} onOpen={setEditing} />
        ) : (
          <CardGrid tab={tab} items={ofKind(tab.kind)} onAdd={() => create(tab.kind as StoryKind)} onOpen={setEditing} onInsert={editor ? (name) => editor.chain().focus().insertContent(name).run() : undefined} />
        )}
      </main>

      {editing && <ItemEditor item={editing} tab={tabs.find((t) => t.kind === editing.kind) ?? tab} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CardGrid({ tab, items, onAdd, onOpen, onInsert }: { tab: StoryTab; items: StoryItem[]; onAdd: () => void; onOpen: (i: StoryItem) => void; onInsert?: (name: string) => void }) {
  const fields = FIELDS[tab.kind as StoryKind];
  const sub = (it: StoryItem) => fields.slice(0, 3).map((f) => it.data?.[f.key]).filter(Boolean).join(" · ");
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
      {items.map((it) => (
        <article key={it.id} className="group relative flex flex-col overflow-hidden rounded-lg bg-paper" style={{ boxShadow: "var(--sheet-shadow)" }}>
          <button className="flex flex-1 flex-col text-left" onClick={() => onOpen(it)}>
            {it.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image_url} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="grid h-20 w-full place-items-center bg-desk-2 text-3xl text-muted" style={ml} aria-hidden>
                {(it.name || "?").slice(0, 1)}
              </div>
            )}
            <div className="flex-1 p-4">
              <h3 className="text-lg font-bold leading-snug" style={ml}>
                {it.name || <span className="text-muted">Untitled</span>}
              </h3>
              {sub(it) && <p className="mt-0.5 text-xs text-kasavu">{sub(it)}</p>}
              <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted" style={ml}>
                {it.summary}
              </p>
            </div>
          </button>
          {onInsert && it.name && (tab.kind === "character" || tab.kind === "location" || tab.kind === "item") && (
            <button className="absolute right-2 top-2 rounded-md bg-paper/90 px-2 py-1 text-xs opacity-0 shadow group-hover:opacity-100 focus:opacity-100" onClick={() => onInsert(it.name)}>
              Insert name
            </button>
          )}
        </article>
      ))}
      <button onClick={onAdd} className="grid min-h-40 place-items-center rounded-lg border-2 border-dashed border-line text-muted hover:border-kayal hover:text-kayal">
        <span className="flex items-center gap-2">
          <Plus size={18} /> Add {tab.label.toLowerCase().replace(/s$/, "")}
        </span>
      </button>
    </div>
  );
}

function BeatBoard({ doc, items, onAdd, onOpen, onMove }: { doc: LitmaDoc; items: StoryItem[]; onAdd: (group: string) => void; onOpen: (i: StoryItem) => void; onMove: (i: StoryItem) => Promise<StoryItem> }) {
  const groups = useMemo(() => {
    const g = new Set(defaultGroups(doc.kind));
    items.forEach((i) => i.data?.group && g.add(i.data.group));
    return [...g];
  }, [items, doc.kind]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const cols = [...groups, ...extra.filter((e) => !groups.includes(e))];

  const drop = async (group: string, before?: StoryItem) => {
    const it = items.find((i) => i.id === dragId);
    setDragId(null);
    if (!it) return;
    const col = items.filter((i) => (i.data?.group ?? cols[0]) === group && i.id !== it.id).sort((a, b) => a.position - b.position);
    const idx = before ? col.findIndex((c) => c.id === before.id) : col.length;
    const prev = col[idx - 1]?.position ?? 0;
    const next = col[idx]?.position ?? prev + 2;
    await onMove({ ...it, position: (prev + next) / 2, data: { ...it.data, group } });
  };

  return (
    <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-4">
      {cols.map((g) => (
        <section
          key={g}
          className="flex w-72 shrink-0 flex-col rounded-lg bg-desk-2/70 p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            drop(g);
          }}
        >
          <h3 className="mb-3 px-1 text-sm font-semibold" style={ml}>
            {g}
          </h3>
          <div className="flex flex-col gap-2.5">
            {items
              .filter((i) => (i.data?.group ?? cols[0]) === g)
              .sort((a, b) => a.position - b.position)
              .map((it) => (
                <div
                  key={it.id}
                  draggable
                  onDragStart={() => setDragId(it.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(g, it);
                  }}
                  className={`cursor-grab rounded-md bg-paper p-3 shadow-sm ${dragId === it.id ? "opacity-40" : ""}`}
                  style={{ borderLeft: `4px solid ${BEAT_COLORS[it.data?.color ?? "kayal"] ?? BEAT_COLORS.kayal}` }}
                >
                  <button className="w-full text-left" onClick={() => onOpen(it)}>
                    <div className="flex items-start gap-1.5">
                      <GripVertical size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                      <div className="min-w-0">
                        <div className="font-semibold leading-snug" style={ml}>
                          {it.name || <span className="text-muted">Untitled beat</span>}
                        </div>
                        <p className="mt-1 line-clamp-3 text-[13px] text-muted" style={ml}>
                          {it.summary}
                        </p>
                        {it.data?.status && <span className="mt-1.5 inline-block rounded bg-desk-2 px-1.5 text-[11px] text-muted">{it.data.status}</span>}
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            <button onClick={() => onAdd(g)} className="rounded-md border border-dashed border-line px-3 py-2 text-left text-sm text-muted hover:border-kayal hover:text-kayal">
              <Plus size={14} className="mr-1 inline" /> Add card
            </button>
          </div>
        </section>
      ))}
      <form
        className="w-60 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const name = manglish(String(f.get("g") ?? "").trim());
          if (name) setExtra((x) => [...x, name]);
          e.currentTarget.reset();
        }}
      >
        <input name="g" className="field !py-2 !text-sm" placeholder="+ New column (act, chapter…)" />
      </form>
    </div>
  );
}

function Timeline({ items, onAdd, onOpen }: { items: StoryItem[]; onAdd: () => void; onOpen: (i: StoryItem) => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <ol className="relative border-l-2 border-kasavu/50 pl-6">
        {items.map((it) => (
          <li key={it.id} className="mb-6">
            <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-kasavu" aria-hidden />
            <button className="w-full rounded-lg bg-paper p-4 text-left" style={{ boxShadow: "var(--sheet-shadow)" }} onClick={() => onOpen(it)}>
              <div className="text-xs font-semibold text-kasavu" style={ml}>
                {it.data?.when || "When?"}
              </div>
              <div className="mt-0.5 font-semibold" style={ml}>
                {it.name || <span className="text-muted">Untitled event</span>}
              </div>
              <p className="mt-1 text-sm text-muted" style={ml}>
                {it.summary}
              </p>
              {(it.data?.who || it.data?.where) && <p className="mt-1.5 text-xs text-muted">{[it.data?.who, it.data?.where].filter(Boolean).join(" · ")}</p>}
            </button>
          </li>
        ))}
      </ol>
      <button onClick={onAdd} className="btn btn-outline ml-6">
        <Plus size={16} /> Add event
      </button>
      <p className="ml-6 mt-2 text-xs text-muted">Events appear in the order you add them.</p>
    </div>
  );
}

function ItemEditor({ item, tab, onSave, onDelete, onClose }: { item: StoryItem; tab: StoryTab; onSave: (i: StoryItem) => Promise<StoryItem>; onDelete: (i: StoryItem) => void; onClose: () => void }) {
  const [it, setIt] = useState(item);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);
  const fields = FIELDS[item.kind];
  const withImage = item.kind === "character" || item.kind === "location" || item.kind === "item";

  // autosave 600 ms after the last change
  useEffect(() => {
    if (it === item) return;
    setState("saving");
    const t = setTimeout(() => {
      onSave(it)
        .then(() => setState("saved"))
        .catch(() => setState("error"));
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it]);

  const set = (patch: Partial<StoryItem>) => setIt((x) => ({ ...x, ...patch }));
  const setData = (k: string, v: string) => setIt((x) => ({ ...x, data: { ...x.data, [k]: v } }));
  const mlBlur = (v: string) => (/[A-Za-z]/.test(v) && !/[ഀ-ൿ]/.test(v) ? v : v); // keep what the writer typed

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" onClick={onClose}>
      <aside className="scrollbar-thin h-full w-full max-w-lg overflow-y-auto bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="Edit card">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-kasavu">
            {tab.ml} · {tab.label}
          </span>
          <span className="text-xs text-muted" aria-live="polite">
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Couldn't save" : ""}
          </span>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {withImage && (
          <div className="mb-4">
            {it.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image_url} alt="" className="mb-2 h-48 w-full rounded-lg object-cover" />
            ) : null}
            <label className="btn btn-outline cursor-pointer !text-sm">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {it.image_url ? "Change picture" : "Add picture"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    set({ image_url: await store.uploadMedia(await resizeImage(f, 1200), "story") });
                  } catch {
                    setState("error");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
            {it.image_url && (
              <button className="ml-2 text-xs text-muted underline" onClick={() => set({ image_url: null })}>
                Remove picture
              </button>
            )}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm">Name</span>
          <input autoFocus className="field !text-lg !font-semibold" value={it.name} onChange={(e) => set({ name: e.target.value })} style={ml} />
        </label>
        <p className="mt-1 text-[11px] text-muted">Typed in Manglish? Use ⇄ below to convert to Malayalam.</p>
        <label className="mt-4 block">
          <span className="mb-1 flex items-center justify-between text-sm">
            {tab.summary ?? "Summary"}
            <button type="button" className="text-xs text-kayal underline" onClick={() => set({ name: manglish(it.name), summary: manglish(it.summary) })} title="Convert Manglish in name and summary to Malayalam">
              ⇄ Manglish → മലയാളം
            </button>
          </span>
          <textarea className="field min-h-24" value={it.summary} onChange={(e) => set({ summary: e.target.value })} style={ml} />
        </label>

        <div className="mt-4 grid gap-4">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-sm">{f.label}</span>
              {f.type === "select" ? (
                <Select
                  className="w-full"
                  aria-label={f.label}
                  value={it.data?.[f.key] ?? ""}
                  onChange={(v) => setData(f.key, v)}
                  options={[{ value: "", label: "—", text: "none" }, ...f.options!.map((o) => ({ value: o, label: o }))]}
                />
              ) : f.type === "textarea" ? (
                <textarea className="field min-h-20" placeholder={f.placeholder} value={it.data?.[f.key] ?? ""} onChange={(e) => setData(f.key, e.target.value)} style={ml} />
              ) : (
                <input className="field" placeholder={f.placeholder} value={it.data?.[f.key] ?? ""} onChange={(e) => setData(f.key, e.target.value)} style={ml} />
              )}
            </label>
          ))}
        </div>

        <div className="mt-8 flex justify-between border-t border-line pt-4">
          <button
            className="btn btn-ghost hover:!text-danger"
            onClick={() => {
              if (confirm(`Delete “${it.name || "this card"}”?`)) onDelete(it);
            }}
          >
            <Trash2 size={15} /> Delete
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-lg bg-paper" style={{ boxShadow: "var(--sheet-shadow)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-1.5 ${typeof c === "number" ? "text-right tabular-nums" : ""}`} style={ml}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reports({ doc, content, items }: { doc: LitmaDoc; content: LitmaDoc["content"]; items: StoryItem[] }) {
  if (doc.kind === "screenplay" || doc.kind === "drama") {
    const r = scriptReport(content);
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <section>
          <h3 className="mb-2 font-semibold">Scenes ({r.scenes.length})</h3>
          <Table head={["#", "Scene", "Time", "Cast", "Speaking", "Words"]} rows={r.scenes.map((s) => [s.n, s.heading, s.time, s.cast.join(", "), s.speakers.join(", "), s.words])} />
        </section>
        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">Characters by dialogue</h3>
            <Table head={["Character", "Lines", "Words", "Scenes"]} rows={r.characters.map((c) => [c.name, c.lines, c.words, c.scenes.join(", ")])} />
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Locations</h3>
            <Table head={["Location", "Scenes"]} rows={r.locations.map((l) => [l.name, l.scenes.join(", ")])} />
          </div>
        </section>
      </div>
    );
  }
  if (doc.kind === "poem" || doc.kind === "lyrics") {
    const r = verseReport(content);
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Table head={["Lines", "Stanzas", "Average aksharas per line"]} rows={[[r.lines, r.stanzas, r.avg]]} />
        <div>
          <h3 className="mb-2 font-semibold">Line lengths (aksharas)</h3>
          <Table head={["Aksharas", "Lines"]} rows={r.spread.map(([a, n]) => [a, n])} />
        </div>
      </div>
    );
  }
  const names = items.filter((i) => i.kind === "character" || i.kind === "location").map((i) => i.name);
  const r = proseReport(content, names);
  return (
    <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-2 font-semibold">Chapters / sections ({r.total.toLocaleString("en-IN")} words)</h3>
        <Table head={["Section", "Words"]} rows={r.chapters.map((c) => [c.title, c.words])} />
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Mentions in the text</h3>
        {r.mentions.length ? <Table head={["Name", "Mentions"]} rows={r.mentions.map((m) => [m.name, m.count])} /> : <p className="text-sm text-muted">Add characters and places to see how often they appear.</p>}
      </div>
    </div>
  );
}
