"use client";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/react";
import { admin, type AdminUser, type UserActivity } from "@/lib/admin";
import { useScreen } from "@/lib/useLayout";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonLines } from "@/components/ui/Skeleton";
import { DayBars, SERIES, compact, num } from "./charts";
import { ago, duration, featureKey } from "./AdminDashboard";

/** One writer: account facts, 90 days of activity, devices and a timeline of what they used. No writing. */
export function UserDetail({ user: u, onClose, countryName }: { user: AdminUser; onClose: () => void; countryName: (c: string | null) => string }) {
  const t = useT();
  const screen = useScreen();
  const [act, setAct] = useState<UserActivity | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setAct(null);
    setErr(null);
    admin.user(u.id).then(setAct, (e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [u.id]);

  const facts: [string, React.ReactNode][] = [
    [t("admin.users.joined"), new Date(u.joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })],
    [t("admin.users.lastSeen"), ago(u.last_seen) ?? t("admin.users.never")],
    [t("admin.user.provider"), u.provider],
    [t("admin.users.where"), countryName(u.country)],
    ...(u.location ? ([[t("admin.user.location"), u.location]] as [string, React.ReactNode][]) : []),
    [t("admin.users.visits"), num(u.sessions)],
    [t("admin.users.activeDays"), num(u.active_days)],
    [t("admin.user.activeTime"), duration(u.engaged_seconds)],
    [t("admin.users.words"), num(u.words)],
    [t("admin.users.works"), num(u.works)],
    [t("admin.user.books"), num(u.books)],
    [t("admin.user.ai"), num(u.ai_requests)],
    [t("admin.user.mcp"), num(u.mcp_calls)],
  ];

  const what = (e: UserActivity["events"][number]) => {
    const key = featureKey(e.name);
    const base = e.name === "page_view" ? t("admin.events.page_view") : e.name === "click" ? t("admin.events.click") : key ? t(key) : e.name;
    const extra = e.label ?? (typeof e.props?.kind === "string" ? e.props.kind : typeof e.props?.format === "string" ? e.props.format : typeof e.props?.to === "string" && e.name === "click" ? `→ ${e.props.to}` : null);
    return (
      <>
        {base}
        {extra && <span className="font-semibold"> {extra}</span>}
      </>
    );
  };

  return (
    <Sheet mode={screen === "phone" ? "sheet" : "drawer"} title={u.name || u.email || "Writer"} onClose={onClose}>
      <div className="space-y-7 px-5 py-5">
        <div>
          {u.name && u.email && <p className="text-sm text-muted">{u.email}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="truncate font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-[10px] bg-subtle px-3 py-2 text-xs text-muted">{t("admin.user.private")}</p>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}
        {!act && !err && <SkeletonLines lines={6} />}
        {act && (
          <>
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
                {t("admin.user.activity")}
              </h3>
              <p className="mb-1 text-xs text-muted">{t("admin.user.events")}</p>
              <DayBars data={act.daily} field="events" label={t("admin.user.events")} height={110} />
              <p className="mb-1 mt-3 text-xs text-muted">{t("admin.users.words")}</p>
              <DayBars data={act.daily} field="words" label={t("admin.users.words")} color={SERIES[2]} height={110} />
            </section>

            {act.devices.length > 0 && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
                  {t("admin.user.devices")}
                </h3>
                <ul className="space-y-2 text-sm">
                  {act.devices.map((d, i) => (
                    <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 rounded-[10px] border border-line px-3 py-2">
                      <span>
                        {[d.os, d.browser, d.device].filter(Boolean).join(" · ")}
                        {d.app_version && d.platform === "desktop" && <span className="text-muted"> · v{d.app_version}</span>}
                      </span>
                      <span className="text-xs text-muted">
                        {countryName(d.country)} · {compact(d.sessions)} · {ago(d.last_seen)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
                {t("admin.user.recent")}
              </h3>
              {!act.events.length ? (
                <p className="text-sm text-muted">{t("admin.user.noEvents")}</p>
              ) : (
                <ol className="space-y-1.5 text-sm">
                  {act.events.map((e, i) => {
                    const prev = act.events[i - 1];
                    const newVisit = !prev || prev.session_id !== e.session_id;
                    return (
                      <li key={i} className={newVisit && i ? "border-t border-line pt-2.5" : ""}>
                        <div className="flex gap-3">
                          <time className="w-[4.5rem] shrink-0 text-xs tabular-nums text-muted" dateTime={e.created_at} title={new Date(e.created_at).toLocaleString("en-IN")}>
                            {new Date(e.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                            {newVisit && <span className="block">{new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                          </time>
                          <span className="min-w-0 flex-1">
                            {what(e)}
                            {e.path && <code className="ml-1.5 text-xs text-muted">{e.path}</code>}
                            {e.before_sign_in && <span className="ml-1.5 text-xs text-muted">({t("admin.user.beforeSignIn")})</span>}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}
