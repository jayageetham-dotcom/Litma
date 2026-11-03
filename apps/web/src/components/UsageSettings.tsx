"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useT } from "@/i18n/react";
import { setUsageStatsOn, usageStatsOn } from "@/lib/analytics";
import { admin, isDemo } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Settings: the writer's switch for usage statistics, and the admin dashboard link for admins. */
export function UsageSettings() {
  const t = useT();
  const [on, setOn] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    setOn(usageStatsOn());
    if (isSupabaseConfigured && !isDemo()) admin.check().then(setIsAdmin);
  }, []);
  return (
    <section>
      <h2 className="text-xl font-semibold">{t("settings.usage")}</h2>
      <p className="mt-1 text-sm text-muted">{t("settings.usageHint")}</p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            setUsageStatsOn(e.target.checked);
          }}
        />
        {t("settings.usageOn")}
      </label>
      {isAdmin && (
        <Link href="/admin/" className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:bg-subtle">
          <BarChart3 size={20} className="text-tint-violet" aria-hidden />
          <span className="min-w-0">
            <span className="block font-semibold">{t("settings.admin")}</span>
            <span className="block text-xs text-muted">{t("settings.adminHint")}</span>
          </span>
        </Link>
      )}
    </section>
  );
}
