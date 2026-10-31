"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Camera, ExternalLink, FileText, GripVertical, ListOrdered, Loader2, PanelTop, Plus, Printer, Settings2, X } from "lucide-react";
import { useScreen } from "@/lib/useLayout";
import { Select } from "@/components/ui/Select";
import { RequireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { BASE } from "@/lib/config";
import { templateFor } from "@/lib/templates";
import { ITEM_LABELS } from "@/lib/book-sections";
import { resizeImage } from "@/lib/image";
import { COVER_FONTS, COVER_TEMPLATES, CoverBack, CoverFront } from "@/components/book/Cover";
import { MiniEditor } from "@/components/book/MiniEditor";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Book, BookCover, BookItem, BookSettings, LitmaDoc } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);
const ml = { fontFamily: "'Noto Sans Malayalam'" } as const;

const TEXT_PAGES = ["ആമുഖം · Introduction", "മുഖവുര · Preface", "അവതാരിക · Foreword", "നന്ദി · Acknowledgements", "പിൻകുറിപ്പ് · Afterword", "എഴുത്തുകാരനെക്കുറിച്ച് · About the author"];


function BookEditor() {
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
    store.getBook(id).then((b) => {
      setBook(b);
      latest.current = b;
      setSel(b?.structure[0]?.id ?? null);
    });
    store.listDocs().then(setDocs);
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
  if (book === undefined) return <Loader2 className="mx-auto mt-24 animate-spin text-muted" />;
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
      <header className="safe-top flex items-center gap-1.5 border-b border-line bg-header px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
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
            <h2 className="text-sm font-semibold">Book details</h2>
            {screen === "tablet" && (
              <button className="btn btn-ghost !p-1" onClick={() => setDetailsOpen(false)} aria-label="Close book details">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="space-y-3 text-sm">
            <In label="Subtitle" value={book.subtitle ?? ""} onChange={(v) => update({ subtitle: v || null })} />
            <In label="Author" value={book.author ?? ""} onChange={(v) => update({ author: v || null })} />
            <In label="Publisher" value={st.publisher ?? ""} onChange={(v) => setSt({ publisher: v })} />
            <div className="grid grid-cols-2 gap-2">
              <In label="Year" value={st.year ?? ""} onChange={(v) => setSt({ year: v })} />
              <In label="Edition" value={st.edition ?? ""} onChange={(v) => setSt({ edition: v })} />
            </div>
            <In label="ISBN" value={st.isbn ?? ""} onChange={(v) => setSt({ isbn: v })} />
          </div>
          <h2 className="mb-3 mt-6 text-sm font-semibold">Page &amp; type</h2>
          <div className="space-y-3 text-sm">
            <div>
              <Select
                label="Page size"
                labelClassName="mb-1 block text-xs text-muted"
                className="w-full"
                value={st.pageSize ?? "A4"}
                onChange={(v) => setSt({ pageSize: v as BookSettings["pageSize"] })}
                options={[
                  { value: "A4", label: "A4 (default)" },
                  { value: "A5", label: "A5 (paperback)" },
                  { value: "Letter", label: "US Letter" },
                ]}
              />
            </div>
            <div>
              <Select
                label="Body font (prose chapters)"
                labelClassName="mb-1 block text-xs text-muted"
                className="w-full"
                value={st.font ?? "Noto Serif Malayalam"}
                onChange={(v) => setSt({ font: v })}
                options={["Noto Serif Malayalam", "Noto Sans Malayalam", "Manjari", "Gayathri", "Anek Malayalam"].map((f) => ({ value: f, label: f, style: { fontFamily: `'${f}'` } }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1 block text-xs text-muted">Size (pt)</span>
                <input type="number" step={0.5} min={8} max={20} className="field !py-1.5" value={st.fontSize ?? 12} onChange={(e) => setSt({ fontSize: Number(e.target.value) || 12 })} />
              </label>
              <label>
                <span className="mb-1 block text-xs text-muted">Line spacing</span>
                <input type="number" step={0.05} min={1.2} max={2.6} className="field !py-1.5" value={st.lineHeight ?? 1.8} onChange={(e) => setSt({ lineHeight: Number(e.target.value) || 1.8 })} />
              </label>
            </div>
            <fieldset>
              <legend className="mb-1 text-xs text-muted">Margins (mm)</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {(["top", "bottom", "inner", "outer"] as const).map((k) => {
                  const m = st.margins ?? { top: 22, bottom: 24, inner: 24, outer: 20 };
                  return (
                    <label key={k} className="text-[11px] text-muted">
                      {k}
                      <input type="number" className="field !px-1.5 !py-1 !text-[13px]" value={m[k]} onChange={(e) => setSt({ margins: { ...m, [k]: Math.max(5, Number(e.target.value) || 0) } })} />
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--accent)]" checked={!!st.chaptersOnRight} onChange={(e) => setSt({ chaptersOnRight: e.target.checked })} />
              Start chapters on a right-hand page
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--accent)]" checked={st.runningHead !== false} onChange={(e) => setSt({ runningHead: e.target.checked })} />
              Running heads (book title / chapter title)
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="scrollbar-thin max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-canvas p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

function CoverDesigner({ book, back, onCover }: { book: Book; back: boolean; onCover: (c: Partial<BookCover>) => void }) {
  const c = book.cover ?? {};
  const [uploading, setUploading] = useState<string | null>(null);
  const t = c.template ?? "kasavu";
  const tdef = COVER_TEMPLATES.find((x) => x.id === t)!;
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
  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="origin-top-left" style={{ width: `${W * 0.5}mm`, height: `${H * 0.5}mm` }}>
        <div style={{ transform: "scale(0.5)", transformOrigin: "top left", boxShadow: "var(--sheet-shadow)" }}>{back ? <CoverBack book={book} w={W} h={H} /> : <CoverFront book={book} w={W} h={H} />}</div>
      </div>
      <div className="min-w-64 max-w-sm flex-1 space-y-4 text-sm">
        <h2 className="font-semibold">{back ? "Back cover" : "Front cover"}</h2>
        <div>
          <span className="mb-1.5 block text-xs text-muted">Design</span>
          <div className="flex flex-wrap gap-1.5">
            {COVER_TEMPLATES.map((x) => (
              <button key={x.id} onClick={() => onCover({ template: x.id, ...x.defaults })} className={`rounded-full border px-3 py-1 text-xs ${t === x.id ? "border-accent bg-accent-soft text-accent" : "border-line hover:border-accent"}`}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["bg", "Background"],
              ["fg", "Text"],
              ["accent", "Accent"],
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
                label="Title font"
                labelClassName="mb-1 block text-xs text-muted"
                className="w-full"
                value={c.font ?? "Anek Malayalam"}
                onChange={(v) => onCover({ font: v })}
                options={COVER_FONTS.map((f) => ({ value: f, label: f, style: { fontFamily: `'${f}'` } }))}
              />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Title size</span>
              <input type="range" min={0.6} max={1.6} step={0.05} className="w-full" value={c.titleScale ?? 1} onChange={(e) => onCover({ titleScale: Number(e.target.value) })} />
            </label>
            <div>
              <span className="mb-1 block text-xs text-muted">Cover picture</span>
              <label className="btn btn-outline cursor-pointer !text-sm">
                {uploading === "image" ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {c.image ? "Change picture" : "Upload picture"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload("image", e.target.files?.[0])} />
              </label>
              {c.image && (
                <button className="ml-2 text-xs text-muted underline" onClick={() => onCover({ image: null })}>
                  Remove
                </button>
              )}
              {c.image && (
                <label className="mt-2 block text-xs text-muted">
                  Picture strength
                  <input type="range" min={0.2} max={1} step={0.05} className="w-full" value={c.imageOpacity ?? 0.9} onChange={(e) => onCover({ imageOpacity: Number(e.target.value) })} />
                </label>
              )}
            </div>
            <p className="text-xs text-muted">Title, subtitle, author and publisher come from Book details.</p>
          </>
        )}
        {back && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Blurb</span>
              <textarea className="field min-h-36" value={c.blurb ?? ""} onChange={(e) => onCover({ blurb: e.target.value })} placeholder="ഈ പുസ്തകത്തെക്കുറിച്ച്…" style={ml} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">About the author</span>
              <textarea className="field min-h-24" value={c.authorBio ?? ""} onChange={(e) => onCover({ authorBio: e.target.value })} style={ml} />
            </label>
            <div>
              <span className="mb-1 block text-xs text-muted">Author photo</span>
              <label className="btn btn-outline cursor-pointer !text-sm">
                {uploading === "authorPhoto" ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {c.authorPhoto ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload("authorPhoto", e.target.files?.[0])} />
              </label>
              {c.authorPhoto && (
                <button className="ml-2 text-xs text-muted underline" onClick={() => onCover({ authorPhoto: null })}>
                  Remove
                </button>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Price</span>
              <input className="field !py-1.5" value={c.price ?? ""} onChange={(e) => onCover({ price: e.target.value })} placeholder="₹ 250" />
            </label>
            <p className="text-xs text-muted">Publisher and ISBN come from Book details.</p>
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

