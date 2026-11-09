"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InkLoader, PagesSkeleton } from "@/components/ui/Skeleton";
import { AvatarArt, AVATAR_TINTS, isAvatarImage, tintFor, type AvatarTint } from "@/components/art/Avatars";
import { paginate } from "@/lib/paginate";
import { documentPrint } from "@/lib/book-sections";
import { store } from "@/lib/store";
import { useUser } from "@/lib/auth";
import { kindDot } from "@/lib/tints";
import { templateFor } from "@/lib/templates";
import type { LitmaDoc } from "@/lib/types";

/** Reading time at a calm pace for Malayalam prose (about 150 words a minute). */
const minutes = (words: number) => Math.max(1, Math.round(words / 150));

/**
 * Close the reader. It usually opens in its own tab (from the editor), so close that tab; when the
 * browser won't allow it (the tab wasn't opened by the app), go back, or to the desk or home page.
 */
function useClose() {
  const router = useRouter();
  const user = useUser();
  return () => {
    window.close();
    setTimeout(() => {
      if (window.closed) return;
      if (window.history.length > 1) window.history.back();
      else router.push(user ? "/desk/" : "/");
    }, 120);
  };
}

/** Thin violet line under the header that fills as you read. */
function useProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return p;
}

type Heading = { id: string; text: string; level: number };

/**
 * Document outline beside the page on wide screens, like Google Docs: title, chapters, scenes and
 * headings; click to jump, and the part being read is highlighted.
 */
function Outline({ root, laid }: { root: React.RefObject<HTMLElement | null>; laid: number | null }) {
  const [items, setItems] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(".sb-title, .sb-chapter, .sp-scene, .sb-subhead, h1, h2, h3"));
    const list = nodes
      .map((n, i) => {
        n.id ||= `part-${i + 1}`;
        n.style.scrollMarginTop = "6rem";
        const level = n.matches(".sb-title, h1") ? 1 : n.matches(".sb-chapter, .sp-scene, h2") ? 2 : 3;
        return { id: n.id, text: (n.textContent ?? "").trim(), level };
      })
      .filter((h) => h.text);
    setItems(list);
    if (!list.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root, laid]);

  if (items.length < 2) return <div aria-hidden className="max-xl:hidden" />;
  return (
    <nav aria-label="Outline" className="no-print sticky top-24 self-start max-xl:hidden">
      <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Outline</p>
      <ul className="space-y-0.5 border-l border-line">
        {items.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`-ml-px block truncate border-l-2 py-1.5 pr-2 text-[13.5px] transition-colors ${h.level === 1 ? "pl-3 font-semibold" : h.level === 2 ? "pl-3" : "pl-6"} ${active === h.id ? "border-[var(--brand-mark)] text-accent" : "border-transparent text-muted hover:text-ink"}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const MM = 96 / 25.4;

/** The author block's text in the work itself, for when the byline can't be looked up. */
function authorInWork(doc: LitmaDoc): string | null {
  const block = (doc.content.content ?? []).find((n: JSONContent) => n.type === "styledBlock" && n.attrs?.variant === "author");
  const text = (block?.content ?? []).map((c: JSONContent) => c.text ?? "").join("").trim();
  return text || null;
}

/**
 * Public, read-only reader for shared works: /read/?s=<share id>. The work is shown on its printed
 * pages (the same layout as its PDF), pages without any text are left out (an inserted page the
 * writer never filled), the rest are numbered in order, and the pages shrink to fit a phone.
 */
function Reader() {
  const shareId = useSearchParams().get("s") ?? "";
  const [doc, setDoc] = useState<LitmaDoc | null | undefined>(undefined);
  const [author, setAuthor] = useState<{ name: string | null; avatar: string | null; tint: string | null } | null>(null);
  const [laid, setLaid] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const close = useClose();
  const progress = useProgress();
  const pages = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shareId) return setDoc(null);
    store.getShared(shareId).then(setDoc);
    store.getSharedAuthor(shareId).then(setAuthor).catch(() => setAuthor(null));
  }, [shareId]);

  const print = useMemo(() => (doc ? documentPrint(doc) : null), [doc]);

  // lay the work out on pages, then drop the empty ones and number the rest 1, 2, 3…
  useEffect(() => {
    if (!print || !pages.current) return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      if (cancelled || !pages.current) return;
      await paginate(pages.current, print.spec, print.sections);
      if (cancelled || !pages.current) return;
      const all = Array.from(pages.current.querySelectorAll<HTMLElement>(".pp-page"));
      const kept = all.filter((pg) => {
        const flow = pg.querySelector(".pp-flow");
        const empty = !(flow?.textContent ?? "").trim() && !flow?.querySelector("img, svg, hr");
        if (empty) pg.remove();
        return !empty;
      });
      kept.forEach((pg, i) => {
        const folio = pg.querySelector(".pp-folio");
        if (folio) folio.textContent = String(i + 1);
      });
      setLaid(kept.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [print]);

  // shrink the pages to the screen's width (phones), never enlarge them
  useEffect(() => {
    const el = frame.current;
    if (!el || !print) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / (print.spec.w * MM)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [print, laid]);

  const words = useMemo(() => {
    if (!doc) return 0;
    if (doc.word_count) return doc.word_count;
    const text = JSON.stringify(doc.content).match(/"text":"([^"]*)"/g) ?? [];
    return text.join(" ").split(/\s+/).filter(Boolean).length;
  }, [doc]);

  if (doc === undefined) return <InkLoader />;

  const header = (
    <header className="app-bar no-print">
      <div className="mx-auto flex items-center justify-between gap-3 px-5 py-2.5" style={{ maxWidth: "calc(210mm + 2.5rem)" }}>
        <Logo size="sm" />
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button type="button" onClick={close} className="btn btn-outline !px-3 !py-1.5" aria-label="Close reader view">
            <X size={16} aria-hidden /> Close
          </button>
        </div>
      </div>
      {doc && (
        <div className="h-0.5 w-full" aria-hidden>
          <div className="h-full origin-left bg-[var(--brand-mark)] transition-transform duration-150" style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
    </header>
  );

  if (!doc || !print)
    return (
      <div className="min-h-dvh">
        {header}
        <main className="mx-auto max-w-md px-5 pt-24 text-center">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            This work isn’t shared
          </h1>
          <p className="mt-3 leading-relaxed text-muted">The writer may have turned off the link, or it was copied incompletely.</p>
          <Link href="/" className="btn btn-primary mt-8 !px-5 !py-2.5">
            Go to Litma
          </Link>
        </main>
      </div>
    );

  const tpl = templateFor(doc.kind);
  const byline = author?.name || authorInWork(doc);
  const tint = AVATAR_TINTS.includes(author?.tint as AvatarTint) ? (author!.tint as AvatarTint) : tintFor(byline);
  return (
    <div className="min-h-dvh">
      {header}
      <main className="px-3 pb-20 pt-8 sm:px-5 sm:pt-12">
        {/* what this is and who wrote it, before the pages */}
        <div className="no-print mx-auto mb-8 text-center sm:mb-10" style={{ maxWidth: "210mm" }}>
          <h1 className="text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]" style={{ fontFamily: "var(--font-display)" }}>
            {doc.title}
          </h1>
          {byline && (
            <p className="mt-3 inline-flex items-center gap-2.5 text-[1.05rem] font-semibold">
              <AvatarArt id={isAvatarImage(author?.avatar) ? author!.avatar : null} name={byline} tint={tint} size={30} />
              <span style={{ fontFamily: "var(--font-display)" }}>{byline}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5 font-semibold text-highlight" style={{ fontFamily: "var(--font-display)" }}>
              <span aria-hidden className={`size-1.5 rounded-full ${kindDot(doc.kind)}`} />
              {tpl.ml}
            </span>
            <span aria-hidden>·</span>
            <span>{words.toLocaleString("en-IN")} words</span>
            <span aria-hidden>·</span>
            <span>{minutes(words)} min read</span>
            {laid !== null && laid > 1 && (
              <>
                <span aria-hidden>·</span>
                <span>{laid} pages</span>
              </>
            )}
          </div>
        </div>

        <div className="mx-auto grid justify-center gap-10 xl:grid-cols-[14rem_minmax(0,210mm)_14rem]">
          <Outline root={pages} laid={laid} />
          <div ref={frame} className="relative min-w-0" style={{ width: `min(100%, ${print.spec.w}mm)` }}>
            {laid === null && (
              <div className="absolute inset-x-0 top-0 z-10">
                <PagesSkeleton pages={1} />
              </div>
            )}
            <div style={{ zoom: scale, visibility: laid === null ? "hidden" : undefined }} aria-label={doc.title} role="document">
              <div ref={pages} className="pp-root" />
            </div>
          </div>
          <div aria-hidden className="max-xl:hidden" />
        </div>

        <footer className="no-print mx-auto mt-12 text-center text-sm text-muted" style={{ maxWidth: "210mm" }}>
          Written in{" "}
          <Link href="/" className="font-semibold text-accent hover:underline">
            Litma
          </Link>
          , a writing desk for Malayalam literature.
        </footer>
      </main>
    </div>
  );
}

export default function ReadPage() {
  return (
    <Suspense>
      <Reader />
    </Suspense>
  );
}
