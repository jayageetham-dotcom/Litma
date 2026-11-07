"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InkLoader } from "@/components/ui/Skeleton";
import { ArrowDown, ArrowLeft, ArrowUp, Camera, ExternalLink, FileText, GripVertical, ListOrdered, Loader2, PanelTop, Plus, Printer, RotateCcw, Settings2, X } from "lucide-react";
import { useScreen } from "@/lib/useLayout";
import { Select } from "@/components/ui/Select";
import { RequireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { BASE, PHOTO_UPLOADS } from "@/lib/config";
import { templateFor } from "@/lib/templates";
import { ITEM_LABELS } from "@/lib/book-sections";
import { withSamples } from "@/lib/book-samples";
import { resizeImage } from "@/lib/image";
import { COVER_FONTS, COVER_PARTS, COVER_PRESETS, COVER_TEMPLATES, CoverBack, CoverFront, DEFAULT_PUBLISHER, presetPatch } from "@/components/book/Cover";
import { MiniEditor } from "@/components/book/MiniEditor";
import { ScriptField } from "@/components/ScriptField";
import { COVER_ART, CoverArtSvg, coverArtId } from "@/components/art/CoverArt";
import { AVATAR_CHOICES, AVATAR_IMAGES, AvatarArt } from "@/components/art/Avatars";
import { useT } from "@/i18n/react";
import type { MessageKey } from "@litma/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Book, BookCover, BookItem, BookSettings, CoverOffset, LitmaDoc } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);
const ml = { fontFamily: "'Noto Sans Malayalam'" } as const;

const TEXT_PAGES = ["ആമുഖം · Introduction", "മുഖവുര · Preface", "അവതാരിക · Foreword", "നന്ദി · Acknowledgements", "പിൻകുറിപ്പ് · Afterword", "എഴുത്തുകാരനെക്കുറിച്ച് · About the author"];


function BookEditor() {
  const tr = useT();
  const id = useSearchParams().get("id") ?? "";
  const [book, setBook] = useState<Book | null | undefined>(undefined);
  const [docs, setDocs] = useState<LitmaDoc[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const screen = useScreen();
  const phone = screen === "phone";
  // phones show one pane at a time (tab bar); tablets slide "Book details" over the page
  const [pane, setPane] = useState<"contents" | "item" | "details">("contents");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Book | null>(null);

  useEffect(() => {
    store.getBook(id).then((loaded) => {
      // fields never filled in start with sample text the writer can edit
      const filled = loaded ? withSamples(loaded) : null;
      const b = filled ?? loaded;
      setBook(b);
      latest.current = b;
      if (filled) store.updateBook(filled.id, { subtitle: filled.subtitle, author: filled.author, settings: filled.settings, cover: filled.cover }).catch(() => {});
      setSel(b?.structure[0]?.id ?? null);
    }).catch(() => setBook(null)); // offline and never opened on this device
    store.listDocs().then(setDocs).catch(() => {});
  }, [id]);

  const flush = useCallback(async () => {
    const b = latest.current;
    if (!b) return;
    setSave("saving");
    try {
      await store.updateBook(b.id, { title: b.title, subtitle: b.subtitle, author: b.author, structure: b.structure, settings: b.settings, cover: b.cover });
      setSave("saved");
    } catch {
      setSave("error");
      timer.current = setTimeout(flush, 4000);
    }
  }, []);

  const update = useCallback(
    (patch: Partial<Book>) => {
      setBook((b) => {
        if (!b) return b;
        const next = { ...b, ...patch };
        latest.current = next;
        return next;
      });
      setSave("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
    },
    [flush]
  );

  useEffect(() => {
    const out = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    };
    window.addEventListener("pagehide", out);
    return () => {
      window.removeEventListener("pagehide", out);
      out();
    };
  }, [flush]);

  const docMap = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  if (book === undefined) return <InkLoader label="loading.book" />;
  if (!book)
    return (
      <div className="mx-auto max-w-md px-5 pt-24 text-center">
        <h1 className="text-xl font-bold">Book not found</h1>
        <Link href="/desk/" className="btn btn-primary mt-6">
          Back to your desk
        </Link>
      </div>
    );

  const items = book.structure;
  const setItems = (structure: BookItem[]) => update({ structure });
  const setItem = (itemId: string, patch: Partial<BookItem>) => setItems(items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  const insertBeforeBack = (list: BookItem[]) => {
    const back = items.findIndex((i) => i.type === "back-cover");
    const at = back < 0 ? items.length : back;
    setItems([...items.slice(0, at), ...list, ...items.slice(at)]);
    setSel(list[0]?.id ?? sel);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setItems(next);
  };
  const selected = items.find((i) => i.id === sel) ?? null;
  const label = (it: BookItem) =>
    it.type === "document" ? it.title || docMap.get(it.documentId ?? "")?.title || "(missing document)" : it.type === "text" || it.type === "part" ? it.title || ITEM_LABELS[it.type].ml : ITEM_LABELS[it.type].ml;
  const st = book.settings ?? {};
  const setSt = (p: Partial<BookSettings>) => update({ settings: { ...st, ...p } });
  const chapters = items.filter((i) => i.type === "document").length;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-1.5 border-b border-line bg-header px-2 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 sm:py-2">
        <Link href="/desk/" className="btn btn-ghost !p-2" aria-label="Back to desk">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <input value={book.title} onChange={(e) => update({ title: e.target.value })} className="w-full max-w-xl rounded-md bg-transparent px-1.5 py-0.5 text-[1.05rem] font-semibold hover:bg-subtle focus:bg-subtle focus:outline-none" aria-label="Book title" style={ml} />
          <div className="px-1.5 text-[11.5px] text-muted">
            <span className="font-semibold text-highlight">പുസ്തകം</span> · {chapters} {chapters === 1 ? "chapter" : "chapters"} · {save === "saving" ? "Saving…" : save === "error" ? "Offline — will retry" : "All changes saved"}
          </div>
        </div>
        {!phone && <ThemeToggle />}
        {screen === "tablet" && (
          <button className={`btn btn-ghost !px-2.5 ${detailsOpen ? "text-accent" : ""}`} onClick={() => setDetailsOpen((o) => !o)} aria-pressed={detailsOpen}>
            <Settings2 size={16} /> Details
          </button>
        )}
        <a href={`${BASE}/print/?book=${book.id}`} target="_blank" rel="noreferrer" className="btn btn-primary !px-3" onClick={() => flush()} aria-label="Preview and export PDF">
          <Printer size={16} /> <span className="hidden sm:inline">Preview &amp; export</span> PDF
        </a>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Contents */}
        <aside className={`scrollbar-thin overflow-y-auto bg-surface p-3 md:w-72 md:shrink-0 md:border-r md:border-line ${phone ? (pane === "contents" ? "flex-1" : "hidden") : ""}`}>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Book contents</h2>
            <button className="btn btn-outline !px-2 !py-1 !text-xs" onClick={() => setAdding(true)}>
              <Plus size={14} /> Add
            </button>
          </div>
          <ol className="space-y-1">
            {items.map((it, i) => (
              <li
                key={it.id}
                draggable
                onDragStart={() => setDragId(it.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = items.findIndex((x) => x.id === dragId);
                  if (from >= 0) move(from, i);
                  setDragId(null);
                }}
                className={`group flex items-center gap-1.5 rounded-md px-1.5 py-2 md:py-1.5 ${sel === it.id ? "bg-paper shadow-sm" : "hover:bg-subtle"} ${dragId === it.id ? "opacity-40" : ""}`}
              >
                <GripVertical size={14} className="shrink-0 cursor-grab text-muted" aria-hidden />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setSel(it.id);
                    if (phone) setPane("item");
                  }}
                >
                  <span className="block truncate text-[13.5px] font-medium" style={ml}>
                    {label(it)}
                  </span>
                  <span className="block text-[11px] text-muted">{it.type === "document" ? templateFor(docMap.get(it.documentId ?? "")?.kind ?? "blank").ml : ITEM_LABELS[it.type].en}</span>
                </button>
                <span className="flex group-hover:opacity-100 [@media(hover:hover)]:opacity-0 [&_button]:p-1.5 md:[&_button]:p-0.5">
                  <button className="rounded p-0.5 hover:bg-subtle" onClick={() => move(i, i - 1)} aria-label="Move up">
                    <ArrowUp size={13} />
                  </button>
                  <button className="rounded p-0.5 hover:bg-subtle" onClick={() => move(i, i + 1)} aria-label="Move down">
                    <ArrowDown size={13} />
                  </button>
                  <button
                    className="rounded p-0.5 hover:bg-subtle hover:text-danger"
                    onClick={() => {
                      setItems(items.filter((x) => x.id !== it.id));
                      if (sel === it.id) setSel(null);
                    }}
                    aria-label="Remove from book"
                  >
                    <X size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
          {chapters === 0 && (
            <button className="mt-3 w-full rounded-md border-2 border-dashed border-line px-3 py-4 text-sm text-muted hover:border-accent hover:text-accent" onClick={() => setPicking(true)}>
              <Plus size={15} className="mr-1 inline" /> Add documents as chapters
            </button>
          )}
        </aside>

        {/* Selected item */}
        <main className={`scrollbar-thin min-w-0 flex-1 overflow-y-auto bg-canvas px-3 py-4 sm:px-6 sm:py-6 ${phone && pane !== "item" ? "hidden" : ""}`}>
          {!selected ? (
            <p className="text-muted">Choose a page from the contents, or add one.</p>
          ) : selected.type === "cover" || selected.type === "back-cover" ? (
            <CoverDesigner book={book} back={selected.type === "back-cover"} onCover={(c) => update({ cover: { ...book.cover, ...c } })} />
          ) : (
            <ItemPanel item={selected} book={book} doc={docMap.get(selected.documentId ?? "")} onChange={(p) => setItem(selected.id, p)} />
          )}
        </main>

        {/* Book settings */}
        <aside
          className={`scrollbar-thin overflow-y-auto bg-surface p-4 ${
            phone
              ? pane === "details"
                ? "flex-1"
                : "hidden"
              : screen === "tablet"
                ? detailsOpen
                  ? "absolute inset-y-0 right-0 z-30 w-80 border-l border-line shadow-2xl"
                  : "hidden"
                : "w-80 shrink-0 border-l border-line"
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{tr("bookDetails.heading")}</h2>
            {screen === "tablet" && (
              <button className="btn btn-ghost !p-1" onClick={() => setDetailsOpen(false)} aria-label="Close book details">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="space-y-3 text-sm">
            {/* title, subtitle and author take Manglish, Malayalam or English (a cleared field stays empty) */}
            <ScriptField label={tr("bookDetails.title")} storageKey="book.title" value={book.title ?? ""} onChange={(v) => update({ title: v })} />
            <ScriptField label={tr("bookDetails.subtitle")} storageKey="book.subtitle" value={book.subtitle ?? ""} onChange={(v) => update({ subtitle: v })} />
            <ScriptField label={tr("bookDetails.author")} storageKey="book.author" defaultMode="plain" value={book.author ?? ""} onChange={(v) => update({ author: v })} />
            <In label={tr("bookDetails.publisher")} value={st.publisher ?? ""} onChange={(v) => setSt({ publisher: v })} placeholder={DEFAULT_PUBLISHER} />
            <div className="grid grid-cols-2 gap-2">
              <In label={tr("bookDetails.year")} value={st.year ?? ""} onChange={(v) => setSt({ year: v })} />
              <In label={tr("bookDetails.edition")} value={st.edition ?? ""} onChange={(v) => setSt({ edition: v })} />
            </div>
            <In label={tr("bookDetails.isbn")} value={st.isbn ?? ""} onChange={(v) => setSt({ isbn: v })} />
          </div>
          <h2 className="mb-3 mt-6 text-sm font-semibold">{tr("bookDetails.pageType")}</h2>
          <div className="space-y-3 text-sm">
            <div>
              <Select
                label={tr("bookDetails.pageSize")}
                labelClassName="mb-1 block text-xs text-muted"
                className="w-full"
                value={st.pageSize ?? "A4"}
                onChange={(v) => setSt({ pageSize: v as BookSettings["pageSize"] })}
                options={[
                  { value: "A4", label: tr("bookDetails.pageSizes.A4") },
                  { value: "A5", label: tr("bookDetails.pageSizes.A5") },
                  { value: "Letter", label: tr("bookDetails.pageSizes.Letter") },
                ]}
              />
            </div>
            <div>
              <Select
                label={tr("bookDetails.bodyFont")}
                labelClassName="mb-1 block text-xs text-muted"
                className="w-full"
                value={st.font ?? "Noto Serif Malayalam"}
                onChange={(v) => setSt({ font: v })}
                options={["Noto Serif Malayalam", "Noto Sans Malayalam", "Manjari", "Gayathri", "Anek Malayalam"].map((f) => ({ value: f, label: f, style: { fontFamily: `'${f}'` } }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1 block text-xs text-muted">{tr("bookDetails.fontSize")}</span>
                <input type="number" step={0.5} min={8} max={20} className="field !py-1.5" value={st.fontSize ?? 12} onChange={(e) => setSt({ fontSize: Number(e.target.value) || 12 })} />
              </label>
              <label>
                <span className="mb-1 block text-xs text-muted">{tr("bookDetails.lineHeight")}</span>
                <input type="number" step={0.05} min={1.2} max={2.6} className="field !py-1.5" value={st.lineHeight ?? 1.8} onChange={(e) => setSt({ lineHeight: Number(e.target.value) || 1.8 })} />
              </label>
            </div>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">{tr("bookDetails.margins")}</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {(["top", "bottom", "inner", "outer"] as const).map((k) => {
                  const m = st.margins ?? { top: 22, bottom: 24, inner: 24, outer: 20 };
                  return (
                    <label key={k} className="text-[11px] text-muted">
                      {tr(`bookDetails.margin.${k}`)}
                      <input type="number" className="field !px-1.5 !py-1 !text-[13px]" value={m[k]} onChange={(e) => setSt({ margins: { ...m, [k]: Math.max(5, Number(e.target.value) || 0) } })} />
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--accent)]" checked={!!st.chaptersOnRight} onChange={(e) => setSt({ chaptersOnRight: e.target.checked })} />
              {tr("bookDetails.chaptersOnRight")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--accent)]" checked={st.runningHead !== false} onChange={(e) => setSt({ runningHead: e.target.checked })} />
              {tr("bookDetails.runningHead")}
            </label>
          </div>
          {phone && (
            <div className="mt-6 flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-2 text-sm">
              <span>Theme</span>
              <ThemeToggle />
            </div>
          )}
        </aside>
      </div>

      {phone && (
        <nav className="safe-bottom grid grid-cols-3 border-t border-line bg-paper" aria-label="Book sections">
          {(
            [
              ["contents", "Contents", ListOrdered],
              ["item", "Page", PanelTop],
              ["details", "Details", Settings2],
            ] as const
          ).map(([id, l, Icon]) => (
            <button key={id} onClick={() => setPane(id)} aria-pressed={pane === id} className={`flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium ${pane === id ? "text-accent" : "text-muted"}`}>
              <span className={`grid h-7 w-14 place-items-center rounded-full ${pane === id ? "bg-accent-soft" : ""}`}>
                <Icon size={19} />
              </span>
              {l}
            </button>
          ))}
        </nav>
      )}

      {adding && (
        <Modal title="Add to book" onClose={() => setAdding(false)}>
          <div className="grid gap-2 sm:grid-cols-2">
            <AddBtn
              label="Documents as chapters"
              hint="Pick works from your desk"
              onClick={() => {
                setAdding(false);
                setPicking(true);
              }}
            />
            <AddBtn label="Part divider" hint="ഭാഗം: groups chapters" onClick={() => (insertBeforeBack([{ id: uid(), type: "part", title: "ഒന്നാം ഭാഗം" }]), setAdding(false))} />
            {TEXT_PAGES.map((t) => (
              <AddBtn key={t} label={t.split(" · ")[1]} hint={t.split(" · ")[0]} onClick={() => (insertBeforeBack([{ id: uid(), type: "text", title: t.split(" · ")[0] }]), setAdding(false))} />
            ))}
            <AddBtn label="Custom page" hint="Any heading and text" onClick={() => (insertBeforeBack([{ id: uid(), type: "text", title: "" }]), setAdding(false))} />
            {(["dedication", "epigraph", "toc", "title", "half-title", "copyright", "cover", "back-cover"] as const).map((t) => (
              <AddBtn
                key={t}
                label={ITEM_LABELS[t].en}
                hint={ITEM_LABELS[t].ml}
                onClick={() => {
                  const it: BookItem = { id: uid(), type: t, title: t === "toc" ? "ഉള്ളടക്കം" : undefined };
                  if (t === "cover") setItems([it, ...items]);
                  else if (t === "back-cover") setItems([...items, it]);
                  else {
                    // front matter goes before the first chapter
                    const first = items.findIndex((x) => x.type === "document" || x.type === "part" || x.type === "back-cover");
                    const at = first < 0 ? items.length : first;
                    setItems([...items.slice(0, at), it, ...items.slice(at)]);
                  }
                  setSel(it.id);
                  setAdding(false);
                }}
              />
            ))}
          </div>
        </Modal>
      )}

      {picking && (
        <DocPicker
          docs={docs}
          already={new Set(items.filter((i) => i.type === "document").map((i) => i.documentId!))}
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            insertBeforeBack(ids.map((d) => ({ id: uid(), type: "document", documentId: d, showTitle: true })));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function In({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input className="field !py-1.5" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={ml} />
    </label>
  );
}

function AddBtn({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-line bg-paper px-3 py-2.5 text-left hover:border-accent">
      <span className="block text-sm font-semibold">{label}</span>
      <span className="block text-xs text-muted" style={ml}>
        {hint}
      </span>
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center scrim p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="scrollbar-thin max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl dialog p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DocPicker({ docs, already, onPick, onClose }: { docs: LitmaDoc[]; already: Set<string>; onPick: (ids: string[]) => void; onClose: () => void }) {
  const [chosen, setChosen] = useState<string[]>([]);
  return (
    <Modal title="Choose documents" onClose={onClose}>
      {docs.length === 0 ? (
        <p className="text-muted">Your desk is empty. Write something first, then add it here.</p>
      ) : (
        <ul className="space-y-1">
          {docs.map((d) => {
            const on = chosen.includes(d.id);
            return (
              <li key={d.id}>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${on ? "bg-accent-soft" : "hover:bg-subtle"}`}>
                  <input type="checkbox" className="accent-[var(--accent)]" checked={on} onChange={() => setChosen((c) => (on ? c.filter((x) => x !== d.id) : [...c, d.id]))} />
                  <FileText size={15} className="text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium" style={ml}>
                      {d.title}
                    </span>
                    <span className="text-xs text-muted">
                      {templateFor(d.kind).ml} · {d.word_count} words {already.has(d.id) && "· already in this book"}
                    </span>
                  </span>
                  {on && <span className="text-xs font-semibold text-accent">{chosen.indexOf(d.id) + 1}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!chosen.length} onClick={() => onPick(chosen)}>
          Add {chosen.length || ""} {chosen.length === 1 ? "chapter" : "chapters"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Chapters are added in the order you tick them. Edits you make to a document appear in the book automatically.</p>
    </Modal>
  );
}

function ItemPanel({ item, book, doc, onChange }: { item: BookItem; book: Book; doc?: LitmaDoc; onChange: (p: Partial<BookItem>) => void }) {
  const info = ITEM_LABELS[item.type];
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <span className="text-xs font-semibold text-highlight">
          {info.ml} · {info.en}
        </span>
      </div>
      {item.type === "document" && (
        <>
          {doc ? (
            <div className="rounded-lg bg-paper p-4" style={{ boxShadow: "var(--sheet-shadow)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold" style={ml}>
                    {doc.title}
                  </div>
                  <div className="text-xs text-muted">
                    {templateFor(doc.kind).ml} · {doc.word_count} words
                  </div>
                </div>
                <Link href={`/write/?id=${doc.id}`} className="btn btn-outline !px-2.5 !py-1 !text-xs">
                  <ExternalLink size={13} /> Open
                </Link>
              </div>
              <p className="mt-3 line-clamp-4 text-sm text-muted" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
                {doc.excerpt}
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">This document was deleted. Remove it from the book.</p>
          )}
          <In label="Chapter title in the book (leave empty to use the document’s title)" value={item.title ?? ""} onChange={(v) => onChange({ title: v })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" checked={item.showTitle !== false} onChange={(e) => onChange({ showTitle: e.target.checked })} />
            Print a chapter heading (number and title)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" checked={item.inToc !== false} onChange={(e) => onChange({ inToc: e.target.checked })} />
            List in the table of contents
          </label>
        </>
      )}
      {(item.type === "text" || item.type === "part") && <In label="Heading" value={item.title ?? ""} onChange={(v) => onChange({ title: v })} />}
      {(item.type === "text" || item.type === "dedication" || item.type === "epigraph" || item.type === "copyright") && (
        <>
          <MiniEditor
            key={item.id}
            value={item.content}
            onChange={(content) => onChange({ content })}
            placeholder={item.type === "copyright" ? "Leave empty to use the standard copyright notice from Book details." : item.type === "dedication" ? "അമ്മയ്ക്ക്…" : "എഴുതൂ…"}
          />
          {item.type === "text" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--accent)]" checked={item.inToc !== false} onChange={(e) => onChange({ inToc: e.target.checked })} />
              List in the table of contents (when it comes after the contents page)
            </label>
          )}
        </>
      )}
      {item.type === "toc" && (
        <>
          <In label="Heading" value={item.title ?? "ഉള്ളടക്കം"} onChange={(v) => onChange({ title: v })} />
          <p className="text-sm text-muted">The contents list is built automatically from your chapters, parts and later text pages, with page numbers.</p>
        </>
      )}
      {(item.type === "title" || item.type === "half-title") && (
        <p className="text-sm text-muted">
          Uses the book title{item.type === "title" ? ", subtitle, author and publisher" : ""} from Book details: <b style={ml}>{book.title}</b>
          {item.type === "title" && book.author ? <span style={ml}> · {book.author}</span> : null}
        </p>
      )}
    </div>
  );
}

/** A tiny wireframe of where each layout puts the title (thick bars) and the author (thin bar). */
function LayoutIcon({ id }: { id: string }) {
  const bar = (x: number, y: number, w: number, h: number, o = 1) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="currentColor" opacity={o} />;
  const parts: Record<string, React.ReactNode> = {
    art: [bar(9, 8, 26, 5), bar(14, 15, 16, 2.5, 0.6), bar(14, 54, 16, 3, 0.8)],
    kasavu: [bar(9, 17, 26, 5), bar(14, 24, 16, 2.5, 0.6), bar(14, 48, 16, 3, 0.8)],
    solid: [bar(6, 7, 10, 2, 0.6), bar(6, 11, 28, 5), bar(6, 18, 18, 2.5, 0.6), bar(6, 54, 16, 3, 0.8)],
    type: [bar(6, 6, 12, 2.5, 0.8), bar(6, 15, 30, 9), bar(6, 26, 22, 9)],
    minimal: [bar(9, 25, 26, 5), bar(17, 32, 10, 1.5, 0.6), bar(14, 38, 16, 3, 0.8)],
    photo: [bar(6, 38, 28, 5), bar(6, 45, 18, 2.5, 0.6), bar(6, 52, 16, 3, 0.8)],
  };
  return (
    <svg viewBox="0 0 44 62" className="block w-full" aria-hidden>
      <rect x="0.5" y="0.5" width="43" height="61" rx="2" fill="currentColor" opacity="0.08" />
      {parts[id]}
    </svg>
  );
}

function CoverDesigner({ book, back, onCover }: { book: Book; back: boolean; onCover: (c: Partial<BookCover>) => void }) {
  const tr = useT();
  const c = book.cover ?? {};
  const [uploading, setUploading] = useState<string | null>(null);
  const t = c.template ?? "kasavu";
  const tdef = COVER_TEMPLATES.find((x) => x.id === t)!;
  const paint = { bg: c.bg ?? tdef.defaults.bg!, fg: c.fg ?? tdef.defaults.fg!, accent: c.accent ?? tdef.defaults.accent! };
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={on} onClick={onClick} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-accent bg-accent-soft text-accent" : "border-line hover:border-accent"}`}>
      {label}
    </button>
  );
  const tile = (on: boolean) => `overflow-hidden rounded-[6px] border-2 transition ${on ? "border-accent" : "border-transparent hover:border-line-strong"}`;
  const upload = async (key: "image" | "authorPhoto", f?: File) => {
    if (!f) return;
    setUploading(key);
    try {
      onCover({ [key]: await store.uploadMedia(await resizeImage(f, key === "image" ? 2400 : 600, key === "authorPhoto"), "covers") });
    } finally {
      setUploading(null);
    }
  };
  const W = 210,
    H = 297;
  // dragging the title, author or back-cover blocks on the preview
  const parts: readonly string[] = back ? COVER_PARTS.back : COVER_PARTS.front;
  const move = (id: string, o: CoverOffset) => onCover({ offsets: { ...(c.offsets ?? {}), [id]: o } });
  const moveLabel = (id: string) => tr(`cover.move.${id}` as MessageKey);
  const moved = parts.some((k) => c.offsets?.[k] && (c.offsets[k].x || c.offsets[k].y));
  // the cover part the writer clicked, for the size slider
  const [part, setPart] = useState<string | null>(null);
  useEffect(() => setPart(null), [back]);
  const sizePart = part && parts.includes(part) ? part : back ? "back-text" : "title";
  const partSize = sizePart === "title" ? c.titleScale ?? 1 : c.sizes?.[sizePart] || 1;
  const setPartSize = (v: number) => (sizePart === "title" ? onCover({ titleScale: v }) : onCover({ sizes: { ...(c.sizes ?? {}), [sizePart]: v } }));
  return (
    <div className="flex flex-wrap items-start gap-8">
      {/* the preview stays in view while the tools beside it scroll */}
      <div className="origin-top-left self-start md:sticky md:top-4" style={{ width: `${W * 0.5}mm` }} onPointerDown={() => setPart(null)}>
        <div style={{ height: `${H * 0.5}mm` }}>
        <div style={{ transform: "scale(0.5)", transformOrigin: "top left", boxShadow: "var(--sheet-shadow)" }}>
          {back ? (
            <CoverBack book={book} w={W} h={H} onMove={move} moveLabel={moveLabel} selected={part} onSelect={setPart} />
          ) : (
            <CoverFront book={book} w={W} h={H} onMove={move} moveLabel={moveLabel} selected={part} onSelect={setPart} />
          )}
        </div>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3" style={{ width: `${W * 0.5}mm` }}>
          <p className="text-xs text-muted">{tr(back ? "cover.moveHintBack" : "cover.moveHint")}</p>
          {moved && (
            <button type="button" className="btn btn-ghost shrink-0 !px-2 !py-1 !text-xs" onClick={() => onCover({ offsets: Object.fromEntries(Object.entries(c.offsets ?? {}).filter(([k]) => !parts.includes(k as never))) })}>
              <RotateCcw size={13} /> {tr("cover.resetPositions")}
            </button>
          )}
        </div>
      </div>
      <div className="min-w-64 max-w-sm flex-1 space-y-4 text-sm">
        <h2 className="font-semibold">{tr(back ? "cover.back" : "cover.front")}</h2>
        <div>
          <span className="mb-1.5 block text-xs text-muted">{tr("cover.presetsTitle")}</span>
          <div className="grid grid-cols-[repeat(auto-fill,104px)] gap-2.5">
            {COVER_PRESETS.map((p) => {
              const on = c.preset === p.id;
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => onCover(presetPatch(p.id))} className="group text-left">
                  <span className={`block overflow-hidden rounded-[6px] border-2 transition ${on ? "border-accent" : "border-transparent group-hover:border-line-strong"}`} style={{ width: 104, height: 147 }}>
                    <span className="pointer-events-none block origin-top-left" style={{ transform: `scale(${104 / ((W / 25.4) * 96)})` }}>
                      <CoverFront book={{ ...book, cover: { ...c, ...presetPatch(p.id), badge: false, publisherMark: false } }} w={W} h={H} />
                    </span>
                  </span>
                  <span className={`mt-1 block text-xs ${on ? "font-medium text-accent" : "text-muted"}`}>{tr(`cover.presets.${p.id}` as MessageKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* font size of the text last clicked on the cover (the title until another part is picked) */}
        <div className="rounded-[10px] border border-line p-3">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">{tr("cover.fontSizeOf", { part: tr(`cover.part.${sizePart}` as MessageKey) })}</span>
            <span className="tabular-nums text-muted">{Math.round(partSize * 100)}%</span>
          </div>
          <input type="range" min={0.5} max={sizePart === "title" ? 2 : 2.5} step={0.05} className="w-full" value={partSize} aria-label={tr("cover.fontSizeOf", { part: tr(`cover.part.${sizePart}` as MessageKey) })} onChange={(e) => setPartSize(Number(e.target.value))} />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{tr("cover.fontSizeHint")}</span>
            {partSize !== 1 && (
              <button type="button" className="shrink-0 text-xs text-muted underline" onClick={() => setPartSize(1)}>
                {tr("cover.resetSize")}
              </button>
            )}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{tr("cover.layout")}</span>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input type="checkbox" className="accent-[var(--accent)]" checked={c.frame ?? t === "kasavu"} onChange={(e) => onCover({ frame: e.target.checked })} />
              {tr("cover.frame")}
            </label>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,64px)] gap-2">
            {COVER_TEMPLATES.map((x) => {
              const on = t === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={on}
                  // a new layout keeps colours, background and font, and starts from the designed positions and sizes
                  onClick={() => onCover({ template: x.id, frame: c.frame ?? t === "kasavu", offsets: {}, sizes: {}, titleScale: 1, preset: undefined })}
                  className="group text-center"
                >
                  <span className={`mx-auto block rounded-[6px] border-2 p-0.5 transition ${on ? "border-accent text-accent" : "border-line text-muted group-hover:border-line-strong"}`} style={{ width: 52 }}>
                    <LayoutIcon id={x.id} />
                  </span>
                  <span className={`mt-1 block text-[11px] leading-tight ${on ? "font-medium text-accent" : "text-muted"}`}>{tr(`cover.layouts.${x.id}` as MessageKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["bg", tr("cover.colour.bg")],
              ["fg", tr("cover.colour.fg")],
              ["accent", tr("cover.colour.accent")],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="text-xs text-muted">
              {l}
              <input type="color" className="mt-1 block h-9 w-full cursor-pointer rounded border border-line" value={(c[k] ?? tdef.defaults[k] ?? "#000000") as string} onChange={(e) => onCover({ [k]: e.target.value })} />
            </label>
          ))}
        </div>
        {!back && (
          <>
            <div>
              <Select
                label={tr("cover.titleFont")}
                labelClassName="mb-1 block text-xs text-muted"
                className="w-full"
                value={c.font ?? "Anek Malayalam"}
                onChange={(v) => onCover({ font: v })}
                options={COVER_FONTS.map((f) => ({ value: f.name, label: `${f.name} · പുസ്തകം`, text: f.name, hint: tr(`cover.fontKind.${f.kind}` as MessageKey), style: { fontFamily: `'${f.name}'` } }))}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs text-muted">{tr("cover.titleEffects")}</span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["titleShadow", "cover.shadow"],
                    ["titleBox", "cover.box"],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={!!c[k]} onClick={() => onCover({ [k]: !c[k] })} className={`rounded-full border px-3 py-1 text-xs ${c[k] ? "border-accent bg-accent-soft text-accent" : "border-line hover:border-accent"}`}>
                    {tr(l)}
                  </button>
                ))}
              </div>
              {c.titleBox && (
                <div className="mt-2 grid grid-cols-[5rem_1fr] items-end gap-3">
                  <label className="text-xs text-muted">
                    {tr("cover.boxColour")}
                    <input type="color" className="mt-1 block h-9 w-full cursor-pointer rounded border border-line" value={c.titleBoxColor ?? paint.bg} onChange={(e) => onCover({ titleBoxColor: e.target.value })} />
                  </label>
                  <label className="text-xs text-muted">
                    {tr("cover.boxStrength")}
                    <input type="range" min={0.2} max={1} step={0.05} className="mt-2 w-full" value={c.titleBoxOpacity ?? 0.75} onChange={(e) => onCover({ titleBoxOpacity: Number(e.target.value) })} />
                  </label>
                </div>
              )}
            </div>
            <div>
              <span className="mb-1.5 block text-xs text-muted">{tr("cover.illustration")}</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {t !== "art" && (
                  <button type="button" onClick={() => onCover({ art: null })} className={`${tile(!c.art)} grid aspect-[2/3] place-items-center text-[11px] text-muted`} style={{ background: paint.bg }} title={tr("cover.none")} aria-pressed={!c.art}>
                    <span className="rounded bg-surface/80 px-1">{tr("cover.none")}</span>
                  </button>
                )}
                {COVER_ART.map((a) => (
                  <button key={a.id} type="button" onClick={() => onCover({ art: a.id, bg: a.bg, fg: a.fg, accent: a.accent })} className={tile(coverArtId(c.art) === a.id)} title={tr(`cover.art.${a.id}` as MessageKey)} aria-label={tr(`cover.art.${a.id}` as MessageKey)} aria-pressed={coverArtId(c.art) === a.id}>
                    <CoverArtSvg id={a.id} className="block aspect-[2/3] w-full" />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">{tr("cover.artHint")}</p>
            </div>
            {/* Cover photo upload is paused (PHOTO_UPLOADS in lib/config.ts); older covers keep their picture. */}
            {(PHOTO_UPLOADS || c.image) && (
              <div>
                <span className="mb-1 block text-xs text-muted">Cover picture</span>
                {PHOTO_UPLOADS && (
                  <label className="btn btn-outline cursor-pointer !text-sm">
                    {uploading === "image" ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {c.image ? "Change picture" : "Upload picture"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => upload("image", e.target.files?.[0])} />
                  </label>
                )}
                {c.image && (
                  <button className="ml-2 text-xs text-muted underline" onClick={() => onCover({ image: null })}>
                    {tr("cover.removePicture")}
                  </button>
                )}
                {c.image && (
                  <label className="mt-2 block text-xs text-muted">
                    Picture strength
                    <input type="range" min={0.2} max={1} step={0.05} className="w-full" value={c.imageOpacity ?? 0.9} onChange={(e) => onCover({ imageOpacity: Number(e.target.value) })} />
                  </label>
                )}
              </div>
            )}
            <div>
              <span className="mb-1.5 block text-xs text-muted">{tr("cover.ornament")}</span>
              <div className="flex flex-wrap gap-1.5">
                {(["line", "flourish", "none"] as const).map((o) => chip((c.ornament ?? "line") === o, tr(`cover.ornaments.${o}`), () => onCover({ ornament: o })))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs text-muted">{tr("cover.extras")}</span>
              <div className="flex flex-wrap gap-1.5">
                {chip(!!c.badge, tr("cover.badge"), () => onCover({ badge: !c.badge }))}
                {chip(!!c.publisherMark, tr("cover.publisherMark"), () => onCover({ publisherMark: !c.publisherMark }))}
              </div>
              {c.badge && (
                <input className="field mt-2 !py-1.5" value={c.badgeText ?? ""} onChange={(e) => onCover({ badgeText: e.target.value })} placeholder={book.settings?.edition || "14-ാം പതിപ്പ്"} aria-label={tr("cover.badgeText")} style={ml} />
              )}
            </div>
            <p className="text-xs text-muted">{tr("cover.fromDetails")}</p>
          </>
        )}
        {back && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {chip(c.backTitle !== false, tr("cover.backTitle"), () => onCover({ backTitle: c.backTitle === false }))}
              {chip(c.imprintStrip !== false, tr("cover.imprintStrip"), () => onCover({ imprintStrip: c.imprintStrip === false }))}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">{tr("cover.blurb")}</span>
              <textarea className="field min-h-36" value={c.blurb ?? ""} onChange={(e) => onCover({ blurb: e.target.value })} placeholder="ഈ പുസ്തകത്തെക്കുറിച്ച്…" style={ml} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">{tr("cover.authorBio")}</span>
              <textarea className="field min-h-24" value={c.authorBio ?? ""} onChange={(e) => onCover({ authorBio: e.target.value })} style={ml} />
            </label>
            <div>
              <span className="mb-1.5 block text-xs text-muted">{tr("cover.authorPicture")}</span>
              {c.authorPhoto ? (
                <p className="mb-2 text-xs text-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.authorPhoto} alt="" className="mr-2 inline-block h-10 w-10 rounded-full object-cover align-middle" />
                  <button className="text-xs text-muted underline" onClick={() => onCover({ authorPhoto: null })}>
                    {tr("cover.removePhoto")}
                  </button>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("cover.authorPicture")}>
                {[{ id: "none", label: tr("cover.none") }, { id: "letter", label: tr("cover.letter") }, ...AVATAR_CHOICES.map((id) => ({ id, label: tr("avatar.picture", { n: AVATAR_IMAGES.indexOf(id) + 1 }) }))].map((o) => {
                  const on = !c.authorPhoto && (c.authorAvatar ?? "letter") === o.id;
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={on} title={o.label} onClick={() => onCover({ authorAvatar: o.id, authorPhoto: null })} className={`rounded-full p-0.5 ${on ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-line-strong"}`}>
                      {o.id === "none" ? (
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-line-strong text-muted">
                          <X size={14} />
                        </span>
                      ) : (
                        <AvatarArt id={o.id} name={book.author} size={36} paint={{ fg: paint.accent, bg: `color-mix(in srgb, ${paint.accent} 18%, ${paint.bg})` }} title={o.label} />
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Author photo upload is paused (PHOTO_UPLOADS in lib/config.ts). */}
              {PHOTO_UPLOADS && (
                <label className="btn btn-outline mt-2 cursor-pointer !text-sm">
                  {uploading === "authorPhoto" ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {c.authorPhoto ? "Change photo" : "Upload photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => upload("authorPhoto", e.target.files?.[0])} />
                </label>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">{tr("cover.price")}</span>
              <input className="field !py-1.5" value={c.price ?? ""} onChange={(e) => onCover({ price: e.target.value })} placeholder="₹ 250" />
            </label>
            <div className="space-y-2">
              <span className="block text-xs text-muted">{tr("cover.imprint")}</span>
              {(
                [
                  ["genreLine", "cover.genreLine", "മലയാളം നോവൽ"],
                  ["category", "cover.category", "Fiction"],
                  ["coverCredit", "cover.coverCredit", "Cover design: …"],
                  ["publisherTagline", "cover.publisherTagline", ""],
                  ["website", "cover.website", "www.example.com"],
                ] as const
              ).map(([k, l, ph]) => (
                <label key={k} className="block text-xs text-muted">
                  {tr(l)}
                  <input className="field mt-1 !py-1.5" value={c[k] ?? ""} onChange={(e) => onCover({ [k]: e.target.value })} placeholder={ph} style={ml} />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">{tr("cover.imprintHint")}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <RequireAuth>
      <Suspense>
        <BookEditor />
      </Suspense>
    </RequireAuth>
  );
}

