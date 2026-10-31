"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Workspace } from "@/components/editor/Workspace";
import { RequireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { settingsFor } from "@/lib/templates";
import type { LitmaDoc } from "@/lib/types";

function Writer() {
  const id = useSearchParams().get("id") ?? "";
  const [doc, setDoc] = useState<LitmaDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return setDoc(null);
    store
      .getDoc(id)
      .then((d) => setDoc(d ? { ...d, settings: { ...settingsFor(d.kind), ...d.settings } } : null))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't open this document."));
  }, [id]);

  if (error || doc === null)
    return (
      <div className="mx-auto max-w-md px-5 pt-24 text-center">
        <h1 className="text-xl font-bold">{error ? "Couldn't open this document" : "Document not found"}</h1>
        <p className="mt-2 text-muted">{error ?? "It may have been deleted, or it belongs to another account."}</p>
        <Link href="/desk/" className="btn btn-primary mt-6">
          Back to your desk
        </Link>
      </div>
    );
  if (!doc)
    return (
      <div className="grid h-dvh place-items-center text-muted" aria-busy="true">
        <span className="animate-pulse" style={{ fontFamily: "'Anek Malayalam'" }}>
          താൾ തുറക്കുന്നു…
        </span>
      </div>
    );
  return <Workspace key={doc.id} initial={doc} />;
}

export default function WritePage() {
  return (
    <RequireAuth>
      <Suspense>
        <Writer />
      </Suspense>
    </RequireAuth>
  );
}
