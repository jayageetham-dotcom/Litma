"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookPlus, Copy, FileUp, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { CoverFront } from "@/components/book/Cover";
import { DEFAULT_STRUCTURE } from "@/lib/book-structure";
import { AppHeader } from "@/components/AppHeader";
import { TemplatePreview } from "@/components/TemplatePreview";
import { RequireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { TEMPLATES, templateFor } from "@/lib/templates";
import type { Book, DocKind, LitmaDoc } from "@/lib/types";

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Desk() {
  const router = useRouter();
  const [view, setView] = useState<"works" | "books" | "trash">("works");
  const [books, setBooks] = useState<Book[] | null>(null);
  const [docs, setDocs] = useState<LitmaDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DocKind | "all">("all");
  const [sort, setSort] = useState<"updated" | "title" | "words">("updated");
  const [choosing, setChoosing] = useState(false);
  const [importing, setImporting] = useState<File | null>(null);
  const [creating, setCreating] = useState<DocKind | null>(null);
  const [today, setToday] = useState<{ words: number; streak: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      if (view === "works") await store.discardPristine(30).catch(() => 0);
      if (view === "books") {
        setBooks(await store.listBooks());
        setDocs([]);
        return;
      }
      setDocs(await store.listDocs({ trash: view === "trash" }));
      const days = await store.wordsByDay();
      if (days.length) {
        const key = (d: Date) => d.toISOString().slice(0, 10);
        const map = new Map(days.map((x) => [x.day, x.words]));
        const d = new Date();
        if (!map.get(key(d))) d.setDate(d.getDate() - 1);
        let streak = 0;
        while ((map.get(key(d)) ?? 0) > 0) {
          streak++;
          d.setDate(d.getDate() - 1);
        }
        setToday({ words: map.get(key(new Date())) ?? 0, streak });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your documents.");
      setDocs([]);
    }
  }, [view]);

  useEffect(() => {
    setDocs(null);
    load();
  }, [load]);

  async function create(kind: DocKind) {
    setCreating(kind);
    try {
      if (importing) {
        const text = await importing.text();
        const title = importing.name.replace(/\.(txt|md|markdown)$/i, "");
        const d = await store.importText(kind, title, text);
        router.push(`/write/?id=${d.id}`);
      } else {
        const d = await store.createDoc(kind);
        router.push(`/write/?id=${d.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the document.");
      setCreating(null);
    }
  }

  const shown = useMemo(() => {
    const list = (docs ?? []).filter(
      (d) => (filter === "all" || d.kind === filter) && (!q || d.title.toLowerCase().includes(q.toLowerCase()) || d.excerpt?.toLowerCase().includes(q.toLowerCase()))
    );
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title, "ml"));
    if (sort === "words") list.sort((a, b) => b.word_count - a.word_count);
    return list;
  }, [docs, q, filter, sort]);
  const totalWords = (docs ?? []).reduce((n, d) => n + (d.word_count || 0), 0);
  const kindsUsed = Array.from(new Set((docs ?? []).map((d) => d.kind)));
  const closeChooser = () => {
    setChoosing(false);
    setImporting(null);
  };

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Anek Malayalam'" }}>
              {view === "works" ? "എഴുത്തുമേശ" : view === "books" ? "പുസ്തകങ്ങൾ" : "ചവറ്റുകുട്ട"}
            </h1>
            <p className="mt-1 text-muted">
              {view === "books"
                ? "Collect your works into a book with covers, contents and front pages, then export it as one PDF."
                : view === "trash"
                ? "Works you deleted. Restore them, or empty the trash to remove them for good."
                : docs
                  ? `${docs.length} ${docs.length === 1 ? "work" : "works"} · ${totalWords.toLocaleString("en-IN")} words${today ? ` · ${today.words.toLocaleString("en-IN")} today` : ""}${today && today.streak > 1 ? ` · ${today.streak}-day streak` : ""}`
                  : "Loading…"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view === "books" ? (
              <button
                className="btn btn-primary !px-4 !py-2.5"
                onClick={async () => {
                  const prof = await store.getProfile().catch(() => null);
                  const b = await store.createBook({ title: "പുതിയ പുസ്തകം", author: prof?.pen_name || prof?.display_name || null, structure: DEFAULT_STRUCTURE(), settings: { pageSize: "A4", chaptersOnRight: true, runningHead: true }, cover: { template: "kasavu" } });
                  router.push(`/book/?id=${b.id}`);
                }}
              >
                <BookPlus size={18} /> New book
              </button>
            ) : view === "works" ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) {
                      setImporting(f);
                      setChoosing(true);
                    }
                  }}
                />
                <button className="btn btn-outline" onClick={() => fileRef.current?.click()} title="Import a .txt or .md file">
                  <FileUp size={16} /> Import
                </button>
                <button className="btn btn-primary !px-4 !py-2.5" onClick={() => setChoosing(true)}>
                  <Plus size={18} /> New work
                </button>
              </>
            ) : (
              docs &&
              docs.length > 0 && (
                <button
                  className="btn btn-outline hover:!border-danger hover:!text-danger"
                  onClick={async () => {
                    if (!confirm(`Delete ${docs.length} ${docs.length === 1 ? "work" : "works"} permanently? This can't be undone.`)) return;
                    await store.emptyTrash();
                    load();
                  }}
                >
                  <Trash2 size={16} /> Empty trash
                </button>
              )
            )}
          </div>
        </div>

        {!store.isCloud() && (
          <p className="mt-5 rounded-lg border border-kasavu/40 bg-kasavu-soft px-4 py-3 text-sm">Local mode: your work is saved in this browser only.</p>
        )}
        {error && <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-b border-line pb-3">
          <div className="flex gap-1 text-sm" role="tablist">
            {(
              [
                ["works", "Works"],
                ["books", "Books"],
                ["trash", "Trash"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 ${view === v ? "bg-paper font-semibold shadow-sm" : "text-muted hover:text-ink"}`}>
                {l}
              </button>
            ))}
          </div>
          {view !== "books" && docs && docs.length > 0 && (
            <>
              <label className="relative ml-auto">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="field !w-56 !py-1.5 !pl-9" placeholder="Search titles and text" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
              </label>
              <select className="field !w-auto !py-1.5 !text-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
                <option value="updated">Last edited</option>
                <option value="title">Title</option>
                <option value="words">Longest</option>
              </select>
            </>
          )}
        </div>
        {view === "works" && kindsUsed.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1 text-sm">
            {(["all", ...kindsUsed] as (DocKind | "all")[]).map((k) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 ${filter === k ? "bg-kayal text-kayal-ink" : "text-muted hover:bg-desk-2"}`}>
                {k === "all" ? "All" : templateFor(k).ml}
              </button>
            ))}
          </div>
        )}

        {docs && docs.length === 0 && view === "works" && !choosing && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Start your first work</h2>
            <p className="mt-1 text-muted">Choose a form. You can change fonts, margins and page size later.</p>
            <Chooser onPick={create} creating={creating} />
          </section>
        )}
        {docs && docs.length === 0 && view === "trash" && <p className="mt-10 text-muted">The trash is empty.</p>}

        {view === "books" && books && (
          <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-6 gap-y-8">
            {books.length === 0 && <li className="col-span-full text-muted">No books yet. Use “New book” to collect chapters from your works.</li>}
            {books.map((b) => (
              <li key={b.id} className="group">
                <Link href={`/book/?id=${b.id}`} className="block overflow-hidden rounded-sm transition-transform group-hover:-translate-y-1" style={{ width: 170, height: 170 * (297 / 210), boxShadow: "var(--sheet-shadow)" }}>
                  <div style={{ transform: `scale(${170 / 793.7})`, transformOrigin: "top left" }}>
                    <CoverFront book={b} w={210} h={297} />
                  </div>
                </Link>
                <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{b.title}</div>
                    <div className="text-xs text-muted">{b.structure.filter((i) => i.type === "document").length} chapters · {timeAgo(b.updated_at)}</div>
                  </div>
                  <button
                    className="rounded p-1 text-muted opacity-0 hover:text-danger group-hover:opacity-100"
                    aria-label={`Delete ${b.title}`}
                    onClick={async () => {
                      if (!confirm(`Delete the book “${b.title}”? Its chapters stay on your desk.`)) return;
                      await store.deleteBook(b.id);
                      load();
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-6 gap-y-8">
          {shown.map((d) => {
            const t = templateFor(d.kind);
            const card = (
              <>
                <div className="text-xs font-semibold text-kasavu">{t.ml}</div>
                <div className="mt-2 line-clamp-2 text-lg font-bold leading-snug">{d.title}</div>
                <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-muted" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
                  {d.excerpt || "—"}
                </p>
              </>
            );
            return (
              <li key={d.id} className="group">
                {view === "works" ? (
                  <Link href={`/write/?id=${d.id}`} className="block rounded-md bg-paper p-5 transition-shadow hover:ring-2 hover:ring-kayal" style={{ boxShadow: "var(--sheet-shadow)", aspectRatio: "210 / 200" }}>
                    {card}
                  </Link>
                ) : (
                  <div className="block rounded-md bg-paper p-5 opacity-70" style={{ boxShadow: "var(--sheet-shadow)", aspectRatio: "210 / 200" }}>
                    {card}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted">
                  <span>
                    {d.word_count.toLocaleString("en-IN")} words · {timeAgo(d.updated_at)}
                  </span>
                  <span className={`flex gap-1 ${view === "works" ? "opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100" : ""}`}>
                    {view === "works" ? (
                      <>
                        <button
                          className="rounded p-1 hover:bg-desk-2"
                          title="Duplicate"
                          aria-label={`Duplicate ${d.title}`}
                          onClick={async () => {
                            await store.duplicateDoc(d.id);
                            load();
                          }}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="rounded p-1 hover:bg-desk-2 hover:text-danger"
                          title="Move to trash"
                          aria-label={`Move ${d.title} to trash`}
                          onClick={async () => {
                            await store.trashDoc(d.id);
                            load();
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-desk-2 hover:text-ink"
                          onClick={async () => {
                            await store.restoreDoc(d.id);
                            load();
                          }}
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                        <button
                          className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-desk-2 hover:text-danger"
                          onClick={async () => {
                            if (!confirm(`Delete “${d.title}” permanently? This can't be undone.`)) return;
                            await store.deleteDoc(d.id);
                            load();
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </main>

      {choosing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12" role="dialog" aria-modal="true" aria-label="Choose a form" onClick={closeChooser}>
          <div className="w-full max-w-5xl rounded-xl bg-desk p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{importing ? `Import “${importing.name}” as…` : "What are you writing?"}</h2>
              <button className="btn btn-ghost !p-2" onClick={closeChooser} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {importing && <p className="mt-1 text-sm text-muted"># lines become titles, ## chapters; in a screenplay, “Name: line” becomes dialogue.</p>}
            <Chooser onPick={create} creating={creating} />
          </div>
        </div>
      )}
    </div>
  );
}

function Chooser({ onPick, creating }: { onPick: (k: DocKind) => void; creating: DocKind | null }) {
  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-7">
      {TEMPLATES.map((t) => (
        <button key={t.kind} onClick={() => onPick(t.kind)} disabled={!!creating} className="group flex flex-col items-start self-start text-left" title={t.blurb}>
          <div className="transition-transform group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
            <TemplatePreview kind={t.kind} width={150} />
          </div>
          <div className="mt-2.5 font-semibold">
            {t.ml} <span className="text-sm font-normal text-muted">{t.en}</span>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-muted">{creating === t.kind ? "Opening…" : t.blurb}</p>
        </button>
      ))}
    </div>
  );
}

export default function DeskPage() {
  return (
    <RequireAuth>
      <Desk />
    </RequireAuth>
  );
}
