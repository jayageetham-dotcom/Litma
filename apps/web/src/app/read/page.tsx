"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { generateHTML } from "@tiptap/core";
import { X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InkLoader } from "@/components/ui/Skeleton";
import { store } from "@/lib/store";
import { useUser } from "@/lib/auth";
import { kindDot } from "@/lib/tints";
import { buildExtensions } from "@/components/editor/extensions";
import { settingsFor, templateFor } from "@/lib/templates";
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

/** Public, read-only reader view for shared works: /read/?s=<share id> */
function Reader() {
  const shareId = useSearchParams().get("s") ?? "";
  const [doc, setDoc] = useState<LitmaDoc | null | undefined>(undefined);
  const close = useClose();
  const progress = useProgress();
  useEffect(() => {
    if (!shareId) return setDoc(null);
    store.getShared(shareId).then(setDoc);
  }, [shareId]);

  const view = useMemo(() => {
    if (!doc) return null;
    const s = { ...settingsFor(doc.kind), ...doc.settings };
    const html = generateHTML(doc.content, buildExtensions(doc.kind, s, "english"));
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

        <article
          className={`page-stack tpl-${doc.kind} overflow-hidden rounded-md`}
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
          <div className="ProseMirror !min-h-0 pb-16" dangerouslySetInnerHTML={{ __html: html }} />
        </article>

        <footer className="no-print mx-auto mt-10 flex flex-wrap items-center justify-between gap-3 text-sm text-muted" style={{ maxWidth: "210mm" }}>
          <span>
            Written in{" "}
            <Link href="/" className="font-semibold text-accent hover:underline">
              Litma
            </Link>
            , a writing desk for Malayalam literature.
          </span>
          <button type="button" onClick={close} className="font-medium text-ink hover:text-accent">
            Close
          </button>
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
