"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Workspace } from "@/components/editor/Workspace";
import { RequireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { settingsFor } from "@/lib/templates";
import type { LitmaDoc } from "@/lib/types";
import { EditorSkeleton } from "@/components/ui/Skeleton";
import { OfflineError } from "@/lib/offline";
import { useT } from "@/i18n/react";

function Writer() {
  const id = useSearchParams().get("id") ?? "";
  const [doc, setDoc] = useState<LitmaDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!id) return setDoc(null);
    store
      .getDoc(id)
      .then((d) => setDoc(d ? { ...d, settings: { ...settingsFor(d.kind), ...d.settings } } : null))
      .catch((e) => {
        setOffline(e instanceof OfflineError);
        setError(e instanceof Error ? e.message : "Couldn't open this document.");
      });
  }, [id]);

  if (offline)
    return (
      <div className="mx-auto max-w-md px-5 pt-24 text-center">
        <h1 className="text-xl font-bold">{t("offline.notOnDeviceTitle")}</h1>
        <p className="mt-2 text-muted">{t("offline.notOnDevice")}</p>
        <Link href="/desk/" className="btn btn-primary mt-6">
          Back to your desk
        </Link>
      </div>
    );

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
  if (!doc) return <EditorSkeleton />;
  return <Workspace key={doc.id} initial={doc} />;
}

export default function WritePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<EditorSkeleton />}>
        <Writer />
      </Suspense>
    </RequireAuth>
  );
}
