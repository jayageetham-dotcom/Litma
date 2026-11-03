"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { useT } from "@/i18n/react";
import { RequireAuth } from "@/lib/auth";
import { admin } from "@/lib/admin";
import { AppHeader } from "@/components/AppHeader";
import { InkLoader } from "@/components/ui/Skeleton";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

/** /admin/: usage, audience and writers for Litma's admins (app_admins). Everyone else sees a short note. */
export default function AdminPage() {
  return (
    <RequireAuth>
      <Gate />
    </RequireAuth>
  );
}

function Gate() {
  const t = useT();
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    admin.check().then(setOk);
  }, []);
  if (ok === null) return <InkLoader />;
  return (
    <div className="min-h-dvh">
      <AppHeader />
      {ok ? (
        <Suspense fallback={<InkLoader />}>
          <AdminDashboard />
        </Suspense>
      ) : (
        <main className="mx-auto grid max-w-md place-items-center px-5 py-24 text-center">
          <ShieldOff size={36} className="text-muted" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold">{t("admin.denied")}</h1>
          <p className="mt-2 text-sm text-muted">{t("admin.deniedHint")}</p>
          <Link href="/desk/" className="btn btn-primary mt-6">
            {t("nav.desk")}
          </Link>
        </main>
      )}
    </div>
  );
}
