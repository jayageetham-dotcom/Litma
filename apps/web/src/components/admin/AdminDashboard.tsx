"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, RefreshCw, Search } from "lucide-react";
import { useT, type MessageKey } from "@/i18n/react";
import { FORM_NAMES, type DocKind } from "@litma/shared/forms";
import { admin, isDemo, type AdminUser, type Dashboard } from "@/lib/admin";
import { useScreen } from "@/lib/useLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Select";
import { DayBars, Funnel, HBars, HourHeatmap, LineChart, SERIES, ShareBar, Stat, compact, num } from "./charts";
import { UserDetail } from "./UserDetail";

type View = "overview" | "audience" | "behaviour" | "writers";
const VIEWS: View[] = ["overview", "audience", "behaviour", "writers"];
const RANGES = [7, 30, 90, 365] as const;

const countryName = (() => {
  const dn = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
  return (c: string | null | undefined) => {
    if (!c || c === "??") return "Unknown";
    try {
      return dn?.of(c) ?? c;
    } catch {
      return c;
    }
  };
})();
const langName = (() => {
  const dn = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "language" }) : null;
  return (l: string) => {
    if (l === "ml") return "മലയാളം (Malayalam)";
    try {
      return dn?.of(l) ?? l;
    } catch {
      return l;
    }
  };
})();
export const duration = (s: number) => {
  if (!s) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m` : `${Math.round(s)}s`;
};
export const ago = (iso: string | null) => {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 90) return "just now";
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  if (d < 86400 * 30) return `${Math.round(d / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const kindName = (k: string) => (k in FORM_NAMES ? `${FORM_NAMES[k as DocKind].ml} · ${FORM_NAMES[k as DocKind].en}` : k);

function Card({ title, children, className = "", note }: { title: string; children: React.ReactNode; className?: string; note?: string }) {
  return (
    <section className={`min-w-0 rounded-[18px] border border-line bg-surface p-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
        {title}
      </h2>
      {children}
      {note && <p className="mt-4 text-xs leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

function Table({ head, rows, empty }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} className={`pb-2 font-medium ${i ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`py-2 ${j ? "text-right tabular-nums" : "max-w-[18rem] truncate pr-3"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-[14px]" />
        ))}
      </div>
      <Skeleton className="h-[300px] rounded-[18px]" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[220px] rounded-[18px]" />
        <Skeleton className="h-[220px] rounded-[18px]" />
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const q = useSearchParams();
  const view = (VIEWS.includes(q.get("view") as View) ? q.get("view") : "overview") as View;
  const days = RANGES.includes(Number(q.get("days")) as (typeof RANGES)[number]) ? Number(q.get("days")) : 30;
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (patch: Record<string, string | number | null>) => {
    const p = new URLSearchParams(q.toString());
    for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, String(v));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [d, u] = await Promise.all([admin.dashboard(days, includeAdmins), admin.users(includeAdmins)]);
      setData(d);
      setUsers(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [days, includeAdmins]);
  useEffect(() => {
    void load();
  }, [load]);

  const k = data?.kpi;
  const perVisit = k && k.sessions ? k.engaged_seconds / k.sessions : 0;
  const perVisitPrev = k && k.sessions_prev ? k.engaged_seconds_prev / k.sessions_prev : 0;
  const vs = t("admin.vsPrev");
  const platform = (p: string) => (["web", "desktop", "installed", "android", "ios", "server", "unknown"].includes(p) ? t(`admin.platforms.${p}` as "admin.platforms.web") : p);
  const device = (p: string) => (["phone", "computer", "tablet", "unknown"].includes(p) ? t(`admin.devices.${p}` as "admin.devices.phone") : p);
  const feature = (n: string) => (n in FEATURE_KEYS ? t(FEATURE_KEYS[n]) : n);

  return (
    <main className="mx-auto max-w-7xl px-5 pb-24 pt-4 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{t("admin.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {k && (
            <span className="inline-flex items-center gap-2 rounded-full bg-subtle px-3 py-1.5 text-xs font-semibold">
              <span aria-hidden className={`h-2 w-2 rounded-full ${k.online_now ? "animate-pulse" : ""}`} style={{ background: k.online_now ? "var(--chart-3)" : "var(--muted)" }} />
              {t("admin.onlineNow", { n: k.online_now })}
            </span>
          )}
          <div className="inline-flex rounded-full bg-subtle p-1 text-sm" role="group" aria-label={t("admin.range.label")}>
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={days === r}
                onClick={() => go({ days: r === 30 ? null : r })}
                className={`rounded-full px-3 py-1 transition-colors ${days === r ? "bg-switch font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"}`}
              >
                {t(`admin.range.d${r}` as "admin.range.d30")}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-outline !px-2.5 !py-1.5" onClick={() => void load()} disabled={busy} aria-label={t("admin.refresh")} title={t("admin.refresh")}>
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-subtle p-1 text-sm" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => go({ view: v === "overview" ? null : v, user: null })}
              className={`shrink-0 rounded-full px-4 py-1.5 transition-colors ${view === v ? "bg-switch font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"}`}
            >
              {t(`admin.tabs.${v}`)}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={includeAdmins} onChange={(e) => setIncludeAdmins(e.target.checked)} />
          {t("admin.includeMe")}
        </label>
      </div>

      {isDemo() && <p className="mt-4 rounded-[12px] bg-highlight-soft px-4 py-2.5 text-sm text-highlight">{t("admin.demo")}</p>}
      {error && (
        <p className="mt-4 rounded-[12px] border border-line px-4 py-2.5 text-sm text-danger">
          {t("admin.error")} {error}
        </p>
      )}

      <div className="mt-6">
        {!data || !users ? (
          <DashSkeleton />
        ) : view === "overview" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label={t("admin.kpi.visitors")} hint={t("admin.kpi.visitorsHint")} value={k!.visitors} prev={k!.visitors_prev} vs={vs} />
              <Stat label={t("admin.kpi.activeWriters")} hint={t("admin.kpi.activeWritersHint")} value={k!.active_writers} prev={k!.active_writers_prev} vs={vs} />
              <Stat label={t("admin.kpi.newWriters")} value={k!.new_writers} prev={k!.new_writers_prev} vs={vs} />
              <Stat label={t("admin.kpi.totalWriters")} value={k!.writers_total} />
              <Stat label={t("admin.kpi.sessions")} value={k!.sessions} prev={k!.sessions_prev} vs={vs} />
              <Stat label={t("admin.kpi.engaged")} hint={t("admin.kpi.engagedHint")} value={perVisit} prev={perVisitPrev} display={duration(perVisit)} vs={vs} />
              <Stat label={t("admin.kpi.words")} value={k!.words} prev={k!.words_prev} vs={vs} />
              <Stat label={t("admin.kpi.works")} value={k!.works} prev={k!.works_prev} vs={vs} />
            </div>

            <Card title={t("admin.charts.traffic")}>
              <LineChart
                data={data.daily}
                series={[
                  { key: "visitors", label: t("admin.kpi.visitors") },
                  { key: "active_writers", label: t("admin.kpi.activeWriters") },
                ]}
              />
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title={t("admin.charts.words")}>
                <DayBars data={data.daily} field="words" label={t("admin.kpi.words")} color={SERIES[2]} />
              </Card>
              <Card title={t("admin.charts.signups")}>
                <DayBars data={data.daily} field="signups" label={t("admin.kpi.newWriters")} color={SERIES[1]} />
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card title={t("admin.charts.hours")}>
                <HourHeatmap cells={data.hours} />
              </Card>
              <Card title={t("admin.charts.funnel")}>
                <Funnel
                  steps={[
                    { label: t("admin.funnel.visitors"), n: data.funnel.visitors },
                    { label: t("admin.funnel.signedUp"), n: data.funnel.signed_up },
                    { label: t("admin.funnel.started"), n: data.funnel.started_a_work },
                    { label: t("admin.funnel.wrote"), n: data.funnel.wrote },
                  ]}
                />
              </Card>
            </div>

            <Card title={t("admin.charts.pageViews")}>
              <DayBars data={data.daily} field="page_views" label={t("admin.kpi.pageViews")} color={SERIES[3]} />
            </Card>
          </div>
        ) : view === "audience" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={t("admin.charts.platform")}>
              <ShareBar rows={data.breakdown.platform ?? []} label={platform} />
            </Card>
            <Card title={t("admin.charts.device")}>
              <ShareBar rows={data.breakdown.device ?? []} label={device} />
            </Card>
            <Card title={t("admin.charts.country")} note={t("admin.charts.countryNote")} className="lg:row-span-2">
              <HBars rows={data.breakdown.country ?? []} label={countryName} limit={12} />
            </Card>
            <Card title={t("admin.charts.locale")}>
              <ShareBar rows={data.breakdown.locale ?? []} label={langName} />
            </Card>
            <Card title={t("admin.charts.lang")}>
              <HBars rows={data.breakdown.lang ?? []} label={langName} color={SERIES[3]} />
            </Card>
            <Card title={t("admin.charts.os")}>
              <HBars rows={data.breakdown.os ?? []} color={SERIES[3]} />
            </Card>
            <Card title={t("admin.charts.browser")}>
              <HBars rows={data.breakdown.browser ?? []} color={SERIES[3]} />
            </Card>
            <Card title={t("admin.charts.referrer")}>
              <HBars rows={data.breakdown.referrer ?? []} color={SERIES[1]} />
            </Card>
            <Card title={t("admin.charts.providers")}>
              <ShareBar rows={data.providers} />
            </Card>
            {(data.breakdown.app_version?.length ?? 0) > 0 && (
              <Card title={t("admin.charts.appVersion")}>
                <HBars rows={data.breakdown.app_version ?? []} color={SERIES[2]} />
              </Card>
            )}
          </div>
        ) : view === "behaviour" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={t("admin.charts.pages")}>
              <Table
                empty={t("admin.charts.noData")}
                head={[t("admin.cols.page"), t("admin.cols.views"), t("admin.cols.visitors")]}
                rows={data.pages.map((p) => [<code key="p" className="text-[13px]">{p.path}</code>, num(p.views), num(p.visitors)])}
              />
            </Card>
            <Card title={t("admin.charts.features")}>
              <Table
                empty={t("admin.charts.noData")}
                head={[t("admin.cols.feature"), t("admin.cols.uses"), t("admin.cols.people")]}
                rows={data.features.map((f) => [
                  <span key="f">
                    {feature(f.name)}
                    {f.label && <span className="text-muted"> · {f.label}</span>}
                  </span>,
                  num(f.n),
                  num(f.people),
                ])}
              />
            </Card>
            <Card title={t("admin.charts.clicks")} className="lg:col-span-2">
              <Table
                empty={t("admin.charts.noData")}
                head={[t("admin.cols.button"), t("admin.cols.page"), t("admin.cols.clicks"), t("admin.cols.visitors")]}
                rows={data.clicks.map((c) => [c.label, <code key="p" className="text-[13px] text-muted">{c.path ?? ""}</code>, num(c.n), num(c.visitors)])}
              />
            </Card>
            <Card title={t("admin.charts.kinds")} className="lg:col-span-2">
              <div className="grid gap-8 md:grid-cols-2">
                <HBars rows={data.kinds.map((x) => ({ key: x.kind, n: x.works }))} label={kindName} limit={10} unit={t("admin.cols.works").toLowerCase()} />
                <Table
                  empty={t("admin.charts.noData")}
                  head={[t("admin.cols.type"), t("admin.cols.writers"), t("admin.cols.words")]}
                  rows={data.kinds.map((x) => [kindName(x.kind), num(x.writers), compact(x.words)])}
                />
              </div>
            </Card>
          </div>
        ) : (
          <Writers users={users} />
        )}
      </div>
      {data && <p className="mt-8 text-xs text-muted">{t("admin.updated", { time: new Date(data.generated_at).toLocaleString("en-IN") })}</p>}
    </main>
  );
}

const FEATURE_KEYS: Record<string, MessageKey> = {
  work_created: "admin.features.work_created",
  book_created: "admin.features.book_created",
  export: "admin.features.export",
  dictionary_lookup: "admin.features.dictionary_lookup",
  ai_request: "admin.features.ai_request",
  mcp_call: "admin.features.mcp_call",
  sign_in: "admin.features.sign_in",
  sign_up: "admin.features.sign_up",
};
export const featureKey = (n: string) => FEATURE_KEYS[n];

type Sort = "seen" | "joined" | "words" | "active";

function Writers({ users }: { users: AdminUser[] }) {
  const t = useT();
  const screen = useScreen();
  const router = useRouter();
  const pathname = usePathname();
  const q = useSearchParams();
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<Sort>("seen");
  const open = q.get("user");

  const list = useMemo(() => {
    const s = term.trim().toLowerCase();
    const f = s ? users.filter((u) => [u.name, u.email, u.location, countryName(u.country)].some((v) => v?.toLowerCase().includes(s))) : users;
    const by: Record<Sort, (u: AdminUser) => number> = {
      seen: (u) => (u.last_seen ? new Date(u.last_seen).getTime() : 0),
      joined: (u) => new Date(u.joined).getTime(),
      words: (u) => u.words,
      active: (u) => u.active_days,
    };
    return [...f].sort((a, b) => by[sort](b) - by[sort](a));
  }, [users, term, sort]);

  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(q.toString());
    id ? p.set("user", id) : p.delete("user");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const csv = () => {
    const cols: (keyof AdminUser)[] = ["name", "email", "provider", "joined", "last_seen", "country", "location", "platform", "device", "os", "locale", "sessions", "active_days", "engaged_seconds", "words", "writing_days", "works", "books", "ai_requests", "mcp_calls"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = [cols.join(","), ...list.map((u) => cols.map((c) => esc(u[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
    a.download = `litma-writers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const selected = users.find((u) => u.id === open) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field w-full !pl-9" placeholder={t("admin.users.search")} value={term} onChange={(e) => setTerm(e.target.value)} aria-label={t("admin.users.search")} />
        </label>
        <Select
          size="sm"
          aria-label={t("admin.users.sort")}
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={[
            { value: "seen", label: t("admin.users.sortSeen") },
            { value: "joined", label: t("admin.users.sortJoined") },
            { value: "words", label: t("admin.users.sortWords") },
            { value: "active", label: t("admin.users.sortActive") },
          ]}
        />
        <button type="button" className="btn btn-outline !py-1.5 !text-sm" onClick={csv}>
          <Download size={14} aria-hidden /> {t("admin.users.export")}
        </button>
        <span className="text-sm text-muted">{t("admin.users.count", { count: list.length })}</span>
      </div>

      {!list.length ? (
        <p className="py-10 text-center text-sm text-muted">{t("admin.users.none")}</p>
      ) : screen === "phone" ? (
        <ul className="space-y-2">
          {list.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => setOpen(u.id)} className="w-full rounded-[14px] border border-line bg-surface p-4 text-left">
                <WriterName u={u} />
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    {t("admin.users.lastSeen")}: {ago(u.last_seen) ?? t("admin.users.never")}
                  </span>
                  <span>{countryName(u.country)}</span>
                  <span>
                    {num(u.words)} {t("admin.users.words").toLowerCase()}
                  </span>
                  <span>
                    {u.works} {t("admin.users.works").toLowerCase()}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-[18px] border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                {[t("admin.users.writer"), t("admin.users.joined"), t("admin.users.lastSeen"), t("admin.users.where"), t("admin.users.device"), t("admin.users.visits"), t("admin.users.activeDays"), t("admin.users.words"), t("admin.users.works")].map((h, i) => (
                  <th key={h} className={`px-4 py-3 font-medium ${i >= 5 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className={`cursor-pointer border-b border-line/60 last:border-0 hover:bg-subtle ${open === u.id ? "bg-subtle" : ""}`} onClick={() => setOpen(u.id)}>
                  <td className="max-w-[16rem] px-4 py-2.5">
                    <button type="button" className="block w-full text-left" onClick={() => setOpen(u.id)}>
                      <WriterName u={u} />
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{new Date(u.joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{ago(u.last_seen) ?? <span className="text-muted">{t("admin.users.never")}</span>}</td>
                  <td className="max-w-[10rem] truncate px-4 py-2.5">{countryName(u.country)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{[u.os, u.platform === "desktop" ? "app" : null].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(u.sessions)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(u.active_days)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{compact(u.words)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(u.works)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <UserDetail user={selected} onClose={() => setOpen(null)} countryName={countryName} />}
    </div>
  );
}

function WriterName({ u }: { u: AdminUser }) {
  const t = useT();
  return (
    <span className="block min-w-0">
      <span className="flex items-center gap-1.5 font-semibold">
        <span className="truncate">{u.name || u.email || u.id.slice(0, 8)}</span>
        {u.is_admin && <span className="shrink-0 rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted">{t("admin.users.admin")}</span>}
      </span>
      {u.name && u.email && <span className="block truncate text-xs text-muted">{u.email}</span>}
      {!u.confirmed && <span className="block text-xs text-highlight">{t("admin.users.unconfirmed")}</span>}
    </span>
  );
}
