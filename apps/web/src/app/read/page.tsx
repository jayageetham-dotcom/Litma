"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { generateHTML } from "@tiptap/core";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { store } from "@/lib/store";
import { buildExtensions } from "@/components/editor/extensions";
import { settingsFor, templateFor } from "@/lib/templates";
import type { LitmaDoc } from "@/lib/types";

/** Public, read-only reader view for shared works: /read/?s=<share id> */
function Reader() {
  const shareId = useSearchParams().get("s") ?? "";
  const [doc, setDoc] = useState<LitmaDoc | null | undefined>(undefined);
  useEffect(() => {
    if (!shareId) return setDoc(null);
    store.getShared(shareId).then(setDoc);
  }, [shareId]);

  if (doc === undefined) return <div className="grid h-dvh place-items-center text-muted">…</div>;
  if (!doc)
    return (
      <div className="mx-auto max-w-md px-5 pt-24 text-center">
        <h1 className="text-xl font-bold">This work isn’t shared</h1>
        <p className="mt-2 text-muted">The writer may have turned off the link.</p>
      </div>
    );
  const s = { ...settingsFor(doc.kind), ...doc.settings };
  const html = generateHTML(doc.content, buildExtensions(doc.kind, s, "english"));
  return (
    <div className="min-h-dvh">
      <header className="app-bar no-print">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-2.5">
        <Logo size="sm" />
        <div className="flex items-center gap-2 text-sm text-muted">
          {templateFor(doc.kind).ml}
          <ThemeToggle />
        </div>
        </div>
      </header>
      <main className="px-4 pb-16">
        <div
          className={`page-stack tpl-${doc.kind}`}
          style={
            {
              "--page-w": "210mm",
              "--page-h": "auto",
              "--m-top": "18mm",
              "--m-right": `${s.margins.right}mm`,
              "--m-bottom": "18mm",
              "--m-left": `${s.margins.left}mm`,
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
        </div>
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
