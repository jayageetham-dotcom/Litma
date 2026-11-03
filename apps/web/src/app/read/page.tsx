"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InkLoader } from "@/components/ui/Skeleton";
import { store } from "@/lib/store";
import { useUser } from "@/lib/auth";
import { kindDot } from "@/lib/tints";
import { renderDocHtml } from "@/lib/doc-html";
import { docClasses, settingsFor, templateFor } from "@/lib/templates";
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
function Outline({ root, html }: { root: React.RefObject<HTMLElement | null>; html: string }) {
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
  }, [root, html]);

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

/** Public, read-only reader view for shared works: /read/?s=<share id> */
function Reader() {
  const shareId = useSearchParams().get("s") ?? "";
  const [doc, setDoc] = useState<LitmaDoc | null | undefined>(undefined);
  const close = useClose();
  const progress = useProgress();
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!shareId) return setDoc(null);
    store.getShared(shareId).then(setDoc);
  }, [shareId]);

  const view = useMemo(() => {
    if (!doc) return null;
    const s = { ...settingsFor(doc.kind), ...doc.settings };
    // One continuous sheet, like a pageless Google Doc: inserted pages become a little space
    // in the flow (see .reader-sheet .page-break). Trailing blank lines are dropped so the
    // page ends with a proper margin under the last line.
    const isBlank = (n: JSONContent) => n.type === "paragraph" && !(n.content ?? []).some((c) => c.type !== "hardBreak");
    const blocks = [...(doc.content.content ?? [])];
    while (blocks.length && (isBlank(blocks[blocks.length - 1]) || blocks[blocks.length - 1].type === "pageBreak")) blocks.pop();
    const html = renderDocHtml(doc, { ...doc.content, content: blocks });
    const words = doc.word_count || html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return { s, html, words };
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

  if (!doc || !view)
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

  const { s, html, words } = view;
  const tpl = templateFor(doc.kind);
  return (
    <div className="min-h-dvh">
      {header}
      <main className="px-3 pb-20 pt-8 sm:px-5 sm:pt-12">
        {/* what this is, before the page */}
        <div className="no-print mx-auto mb-6 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-sm text-muted sm:mb-8" style={{ maxWidth: "210mm" }}>
          <span className="inline-flex items-center gap-1.5 font-semibold text-highlight" style={{ fontFamily: "var(--font-display)" }}>
            <span aria-hidden className={`size-1.5 rounded-full ${kindDot(doc.kind)}`} />
            {tpl.ml}
          </span>
          <span aria-hidden>·</span>
          <span>{words.toLocaleString("en-IN")} words</span>
          <span aria-hidden>·</span>
          <span>{minutes(words)} min read</span>
        </div>

        <div className="mx-auto grid justify-center gap-10 xl:grid-cols-[14rem_minmax(0,210mm)_14rem]">
          <Outline root={sheet} html={html} />
          <article
            ref={sheet}
            className={`reader-sheet page-stack ${docClasses(doc.kind, s)} overflow-hidden rounded-md`}
            aria-label={doc.title}
            style={
              {
                "--page-w": "210mm",
                "--page-h": "auto",
                "--m-top": "min(22mm, 9vw)",
                // the work's own margins on wide screens; narrower on phones so the text gets the width
                "--m-right": `min(${s.margins.right}mm, 7vw)`,
                "--m-bottom": "min(22mm, 9vw)",
                "--m-left": `min(${s.margins.left}mm, 7vw)`,
                "--doc-font": `'${s.font}'`,
                "--doc-size": `${s.fontSize}pt`,
                "--doc-lh": s.lineHeight,
                maxWidth: "100%",
                background: "var(--paper)",
                boxShadow: "var(--sheet-shadow)",
              } as React.CSSProperties
            }
          >
            {/* a full bottom margin under the last line, like the end of a printed page */}
            <div className="ProseMirror !min-h-0" style={{ paddingBottom: "calc(min(22mm, 9vw) + 3rem)" }} dangerouslySetInnerHTML={{ __html: html }} />
          </article>
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
