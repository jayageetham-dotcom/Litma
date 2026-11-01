"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { PagesSkeleton } from "@/components/ui/Skeleton";
import { RequireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { paginate, type PageSpec, type Section } from "@/lib/paginate";
import { bookSections, bookSpec, documentPrint } from "@/lib/book-sections";
import { CoverBack, CoverFront } from "@/components/book/Cover";
import type { Book, LitmaDoc } from "@/lib/types";

/** Print-ready pages for a document (?doc=) or a whole book (?book=). Save as PDF from the print dialog. */
function PrintView() {
  const params = useSearchParams();
  const router = useRouter();
  const docId = params.get("doc");
  const bookId = params.get("book");
  const auto = params.get("auto") === "1";
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ spec: PageSpec; sections: Section[]; title: string; book?: Book } | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    (async () => {
      try {
        if (docId) {
          const d = await store.getDoc(docId);
          if (!d) throw new Error("Document not found.");
          const { spec, sections } = documentPrint(d);
          setState({ spec, sections, title: d.title });
        } else if (bookId) {
          const b = await store.getBook(bookId);
          if (!b) throw new Error("Book not found.");
          const ids = b.structure.filter((i) => i.type === "document" && i.documentId).map((i) => i.documentId!);
          const docs = new Map<string, LitmaDoc>();
          for (const id of ids) {
            const d = await store.getDoc(id);
            if (d) docs.set(id, d);
          }
          setState({ spec: bookSpec(b), sections: bookSections(b, docs), title: b.title, book: b });
        } else throw new Error("Nothing to print.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't prepare the pages.");
      }
    })();
  }, [docId, bookId]);

  useEffect(() => {
    if (!state || !root.current) return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      if (cancelled || !root.current) return;
      root.current.style.zoom = "1";
      const r = await paginate(root.current, state.spec, state.sections, state.book?.title ?? "");
      if (cancelled) return;
      setPages(r.pages);
      if (auto) setTimeout(() => window.print(), 400);
    })();
    return () => {
      cancelled = true;
    };
  }, [state, auto]);

  const hasCover = !!state?.book?.structure.some((i) => i.type === "cover");
  const hasBack = !!state?.book?.structure.some((i) => i.type === "back-cover");

  return (
    <div className="min-h-dvh bg-canvas">
      {state && <style>{`@page { size: ${state.spec.w}mm ${state.spec.h}mm; margin: 0 } @media print { html, body { background: #fff } }`}</style>}
      <header className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-header px-4 py-2.5">
        <button className="btn btn-ghost !p-2" onClick={() => (history.length > 1 ? router.back() : router.push("/desk/"))} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{state?.title ?? "…"}</div>
          <div className="text-xs text-muted">
            {pages === null ? "Laying out pages…" : `${pages + (hasCover ? 1 : 0) + (hasBack ? 1 : 0)} pages · ${state?.spec.w === 210 ? "A4" : `${state?.spec.w}×${state?.spec.h} mm`}`}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          Zoom
          <input type="range" min={0.3} max={1} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        <button className="btn btn-primary" disabled={pages === null} onClick={() => window.print()}>
          <Printer size={16} /> Save as PDF
        </button>
      </header>
      <p className="no-print mx-auto max-w-2xl px-4 pt-3 text-center text-xs text-muted">
        In the print dialog choose <b>Save as PDF</b>, margins <b>None</b>, and turn on <b>Background graphics</b> for covers.
      </p>
      {error && <p className="mx-auto mt-10 max-w-md text-center text-danger">{error}</p>}
      {!state && !error && <PagesSkeleton />}
      <div className="pp-root py-8" style={{ zoom: pages === null ? 1 : zoom }}>
        {state?.book && hasCover && <CoverFront book={state.book} w={state.spec.w} h={state.spec.h} className="pp-cover" />}
        <div ref={root} className="pp-root" />
        {state?.book && hasBack && <CoverBack book={state.book} w={state.spec.w} h={state.spec.h} className="pp-cover" />}
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <RequireAuth>
      <Suspense>
        <PrintView />
      </Suspense>
    </RequireAuth>
  );
}
