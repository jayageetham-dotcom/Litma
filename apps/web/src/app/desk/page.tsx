"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookPlus, Copy, FileUp, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { CoverFront } from "@/components/book/Cover";
import { DEFAULT_STRUCTURE } from "@/lib/book-structure";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import { useConfirm } from "@/components/ui/Confirm";
import { Select } from "@/components/ui/Select";
import { TemplatePreview } from "@/components/TemplatePreview";
import { RequireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { TEMPLATES, templateFor } from "@/lib/templates";
import type { Book, DocKind, LitmaDoc } from "@/lib/types";
import { useT } from "@/i18n/react";
import type { MessageKey, Params } from "@litma/i18n";
import { DesktopDownload } from "@/components/landing/DesktopDownload";
import { kindDot } from "@/lib/tints";
import { DeskSkeleton, BooksSkeleton, InkLoader } from "@/components/ui/Skeleton";

function timeAgo(iso: string, t: (k: MessageKey, p?: Params) => string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t("common.justNow");
  if (s < 3600) return t("common.minAgo", { n: Math.floor(s / 60) });
  if (s < 86400) return t("common.hoursAgo", { n: Math.floor(s / 3600) });
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Desk() {
  const router = useRouter();
  const t = useT();
  // the view lives in the URL so the phone tab bar (and the back button) can switch it
  const params = useSearchParams();
  const pv = params.get("view");
  const view: "works" | "books" | "trash" = pv === "books" || pv === "trash" ? pv : "works";
  const setView = (v: typeof view) => router.replace(v === "works" ? "/desk/" : `/desk/?view=${v}`);
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
  const [confirmDialog, ask] = useConfirm();

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
      setError(e instanceof Error ? e.message : t("desk.loadError"));
      setDocs([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(e instanceof Error ? e.message : t("desk.createError"));
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
  async function newBook() {
    const prof = await store.getProfile().catch(() => null);
    const b = await store.createBook({ title: "പുതിയ പുസ്തകം", author: prof?.pen_name || prof?.display_name || null, structure: DEFAULT_STRUCTURE(), settings: { pageSize: "A4", chaptersOnRight: true, runningHead: true }, cover: { template: "kasavu" } });
    router.push(`/book/?id=${b.id}`);
  }
  const closeChooser = () => {
    setChoosing(false);
    setImporting(null);
  };

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-5 md:pb-20">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-6 pt-8 sm:pt-12">
          <div>
            <h1 className="text-[1.9rem] font-bold leading-tight sm:text-[2.5rem]" style={{ fontFamily: "'Anek Malayalam'" }}>
              {view === "works" ? t("desk.title") : view === "books" ? t("books.title") : t("trash.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-muted">{view === "books" ? t("books.description") : view === "trash" ? t("trash.description") : t("desk.description")}</p>
            {view === "works" && (
              <p className="mt-5 flex min-h-7 flex-wrap items-center gap-x-2.5 gap-y-2 text-sm text-muted" aria-live="polite">
                {docs ? (
                  <>
                    <span className="font-medium text-ink">{t("common.works", { count: docs.length })}</span>
                    <span aria-hidden>·</span>
                    <span>{t("common.words", { count: totalWords })}</span>
                    {today && today.words > 0 && (
                      <span className="ml-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">{t("desk.today", { n: today.words })}</span>
                    )}
                    {today && today.streak > 1 && (
                      <span className="rounded-full bg-highlight-soft px-2.5 py-1 text-xs font-medium text-highlight">{t("desk.streak", { n: today.streak })}</span>
                    )}
                  </>
                ) : (
                  <span className="skeleton h-4 w-48 rounded" aria-label={t("common.loading")} />
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {view === "books" ? (
              <button className="btn btn-primary !px-4 !py-2.5 max-md:!hidden" onClick={newBook}>
                <BookPlus size={18} /> {t("desk.newBook")}
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
                <button className="btn btn-outline" onClick={() => fileRef.current?.click()} title={t("desk.importTitle")}>
                  <FileUp size={16} /> {t("desk.import")}
                </button>
                <button className="btn btn-primary !px-4 !py-2.5 max-md:!hidden" onClick={() => setChoosing(true)}>
                  <Plus size={18} /> {t("desk.newWork")}
                </button>
              </>
            ) : (
              docs &&
              docs.length > 0 && (
                <button
                  className="btn btn-outline hover:!border-danger hover:!text-danger"
                  onClick={async () => {
                    if (
                      !(await ask({
                        title: t("trash.emptyConfirm.title"),
                        body: t("trash.emptyConfirm.body", { works: t("common.works", { count: docs.length }) }),
                        confirm: t("trash.emptyConfirm.confirm"),
                        danger: true,
                      }))
                    )
                      return;
                    await store.emptyTrash();
                    load();
                  }}
                >
                  <Trash2 size={16} /> {t("trash.emptyButton")}
                </button>
              )
            )}
          </div>
        </div>

        {!store.isCloud() && (
          <p className="mt-8 rounded-lg border border-highlight/40 bg-highlight-soft px-4 py-3 text-sm">{t("desk.localMode")}</p>
        )}
        {error && <p className="mt-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

        <div className="mt-10 flex flex-wrap items-center gap-3 border-b border-line pb-4 sm:mt-14">
          <div className="flex gap-1 text-sm" role="tablist">
            {(
              [
                ["works", t("desk.tabs.works")],
                ["books", t("desk.tabs.books")],
                ["trash", t("desk.tabs.trash")],
              ] as const
            ).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-full px-3.5 py-1.5 ${view === v ? "bg-primary font-semibold text-primary-ink" : "text-muted hover:bg-subtle hover:text-ink"}`}>
                {l}
              </button>
            ))}
          </div>
          {view !== "books" && docs && docs.length > 0 && (
            <>
              <label className="relative order-last w-full sm:order-none sm:ml-auto sm:w-auto">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="field !py-1.5 !pl-9 sm:!w-56" placeholder={t("desk.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("desk.search")} />
              </label>
              <Select
                size="sm"
                className="ml-auto min-w-36 sm:ml-0"
                aria-label={t("desk.sort.label")}
                value={sort}
                onChange={(v) => setSort(v as typeof sort)}
                options={[
                  { value: "updated", label: t("desk.sort.updated") },
                  { value: "title", label: t("desk.sort.title") },
                  { value: "words", label: t("desk.sort.words") },
                ]}
              />
            </>
          )}
        </div>
        {view === "works" && kindsUsed.length > 1 && (
          <div className="scrollbar-none -mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
            {(["all", ...kindsUsed] as (DocKind | "all")[]).map((k) => (
              <button key={k} onClick={() => setFilter(k)} className={`shrink-0 rounded-full px-3.5 py-1.5 ${filter === k ? "bg-accent text-accent-ink" : "text-muted hover:bg-subtle"}`}>
                {k === "all" ? t("desk.all") : templateFor(k).ml}
              </button>
            ))}
          </div>
        )}

        {docs && docs.length === 0 && view === "works" && !choosing && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold">{t("desk.firstWork")}</h2>
            <p className="mt-1 text-muted">{t("desk.firstWorkHint")}</p>
            <Chooser onPick={create} creating={creating} />
          </section>
        )}
        {docs && docs.length === 0 && view === "trash" && <p className="mt-10 text-muted">{t("trash.empty")}</p>}
        {!docs && view !== "books" && <DeskSkeleton />}
        {view === "books" && !books && <BooksSkeleton />}

        {view === "books" && books && (
          <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-7 sm:mt-10 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-x-6 sm:gap-y-8">
            {books.length === 0 && <li className="col-span-full text-muted">{t("books.empty")}</li>}
            {books.map((b) => (
              <li key={b.id} className="group">
                <Link href={`/book/?id=${b.id}`} className="block overflow-hidden rounded-sm transition-transform group-hover:-translate-y-1" style={{ width: 150, height: 150 * (297 / 210), boxShadow: "var(--sheet-shadow)" }}>
                  <div style={{ transform: `scale(${150 / 793.7})`, transformOrigin: "top left" }}>
                    <CoverFront book={b} w={210} h={297} />
                  </div>
                </Link>
                <div className="mt-2 flex items-start justify-between gap-2 px-0.5">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{b.title}</div>
                    <div className="text-xs text-muted">{t("common.chapters", { count: b.structure.filter((i) => i.type === "document").length })} · {timeAgo(b.updated_at, t)}</div>
                  </div>
                  <button
                    className="rounded p-1 text-muted hover:text-danger [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                    aria-label={`Delete ${b.title}`}
                    onClick={async () => {
                      if (!(await ask({ title: t("books.delete.title", { title: b.title }), body: t("books.delete.body"), confirm: t("books.delete.confirm"), danger: true }))) return;
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

        <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-10 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-x-6 sm:gap-y-10">
          {shown.map((d) => {
            const tpl = templateFor(d.kind);
            const card = (
              <>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-highlight">
                  <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${kindDot(d.kind)}`} />
                  {tpl.ml}
                </div>
                <div className="mt-1.5 line-clamp-2 text-[15px] font-bold leading-snug sm:mt-2 sm:text-lg">{d.title}</div>
                <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-muted sm:mt-3 sm:line-clamp-5 sm:text-sm" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
                  {d.excerpt || "—"}
                </p>
              </>
            );
            return (
              <li key={d.id} className="group">
                {view === "works" ? (
                  <Link href={`/write/?id=${d.id}`} className="block overflow-hidden rounded-2xl border border-line bg-surface p-3.5 transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:border-transparent hover:shadow-[var(--pop-shadow)] sm:p-5" style={{ aspectRatio: "210 / 200" }}>
                    {card}
                  </Link>
                ) : (
                  <div className="block overflow-hidden rounded-2xl border border-line bg-surface p-3.5 opacity-70 sm:p-5" style={{ aspectRatio: "210 / 200" }}>
                    {card}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-y-1 px-1 text-xs text-muted">
                  <span className="truncate">
                    {t("common.words", { count: d.word_count })} · {timeAgo(d.updated_at, t)}
                  </span>
                  <span className={`flex gap-1 ${view === "works" ? "transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0" : ""}`}>
                    {view === "works" ? (
                      <>
                        <button
                          className="rounded p-1 hover:bg-subtle"
                          title={t("common.duplicate")}
                          aria-label={`${t("common.duplicate")}: ${d.title}`}
                          onClick={async () => {
                            await store.duplicateDoc(d.id);
                            load();
                          }}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="rounded p-1 hover:bg-subtle hover:text-danger"
                          title={t("desk.moveToTrash")}
                          aria-label={`${t("desk.moveToTrash")}: ${d.title}`}
                          onClick={async () => {
                            if (
                              !(await ask({
                                title: t("desk.trashWork.title", { title: d.title }),
                                body: t("desk.trashWork.body"),
                                confirm: t("desk.trashWork.confirm"),
                                danger: true,
                              }))
                            )
                              return;
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
                          className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-subtle hover:text-ink"
                          onClick={async () => {
                            await store.restoreDoc(d.id);
                            load();
                          }}
                        >
                          <RotateCcw size={13} /> {t("common.restore")}
                        </button>
                        <button
                          className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-subtle hover:text-danger"
                          onClick={async () => {
                            if (!(await ask({ title: t("trash.deleteForever.title", { title: d.title }), body: t("trash.deleteForever.body"), confirm: t("trash.deleteForever.confirm"), danger: true }))) return;
                            await store.deleteDoc(d.id);
                            load();
                          }}
                        >
                          <Trash2 size={13} /> {t("common.delete")}
                        </button>
                      </>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        {view === "works" && docs && <DesktopDownload variant="card" />}
      </main>

      {/* Phone: floating action button, like a native app */}
      {(view === "works" || view === "books") && !choosing && (
        <button
          className="btn btn-primary fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 !rounded-full !px-5 !py-3.5 shadow-xl md:!hidden"
          onClick={view === "books" ? newBook : () => setChoosing(true)}
        >
          {view === "books" ? <BookPlus size={20} /> : <Plus size={20} />} {view === "books" ? t("desk.newBook") : t("desk.newWork")}
        </button>
      )}
      <MobileNav />
      {confirmDialog}

      {choosing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 sm:items-start sm:p-4 sm:pt-12" role="dialog" aria-modal="true" aria-label="Choose a writing type" onClick={closeChooser}>
          <div className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-t-2xl bg-canvas p-4 pb-8 sm:max-h-none sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold sm:text-xl">{importing ? t("desk.importAs", { name: importing.name }) : t("desk.chooserTitle")}</h2>
              <button className="btn btn-ghost !p-2" onClick={closeChooser} aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>
            {importing && <p className="mt-1 text-sm text-muted">{t("desk.importHint")}</p>}
            <Chooser onPick={create} creating={creating} />
          </div>
        </div>
      )}
    </div>
  );
}

function Chooser({ onPick, creating }: { onPick: (k: DocKind) => void; creating: DocKind | null }) {
  const tr = useT();
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-x-5 sm:gap-y-7">
      {TEMPLATES.map((t) => (
        <button key={t.kind} onClick={() => onPick(t.kind)} disabled={!!creating} className="group flex flex-col items-start self-start text-left" title={t.blurb}>
          <div className="transition-transform group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
            <TemplatePreview kind={t.kind} width={140} />
          </div>
          <div className="mt-2.5 font-semibold">
            {t.ml} <span className="text-sm font-normal text-muted">{t.en}</span>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-muted">{creating === t.kind ? <span className="inline-flex items-center gap-1.5 text-accent"><span className="ink-spinner" aria-hidden />{tr("desk.opening")}</span> : t.blurb}</p>
        </button>
      ))}
    </div>
  );
}

export default function DeskPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<InkLoader label="loading.desk" />}>
        <Desk />
      </Suspense>
    </RequireAuth>
  );
}
