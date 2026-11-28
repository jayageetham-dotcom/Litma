"use client";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Flame, Target, Timer } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { DayBars, HBars, SERIES, num } from "@/components/admin/charts";
import { RequireAuth } from "@/lib/auth";
import { useT } from "@/i18n/react";
import { store, type WorkDay } from "@/lib/store";
import { templateFor } from "@/lib/templates";
import type { LitmaDoc } from "@/lib/types";
import {
  askNotificationPermission,
  notificationsBlocked,
  notificationsOn,
  notificationsSupported,
  reminderOf,
  saveGoals,
  setNotificationsOn,
  useWriting,
  GOALS_EVENT,
} from "@/lib/goals";
import { KEEP_DAYS, TIMER_CHOICES, addDays, localDay, summarise } from "@litma/shared/goals";

const DAYS = [1, 2, 3, 4, 5, 6, 0];

function Card({ title, dot, children, className = "" }: { title: string; dot: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-paper p-5 ${className}`} style={{ boxShadow: "var(--sheet-shadow)" }}>
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <span aria-hidden className={`size-2 rounded-full ${dot}`} /> {title}
      </h2>
      {children}
    </section>
  );
}

function Big({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-highlight transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

function GoalsView() {
  const t = useT();
  const w = useWriting();
  const [span, setSpan] = useState<7 | 30 | 90>(30);
  const [docs, setDocs] = useState<LitmaDoc[]>([]);
  const [work, setWork] = useState<WorkDay[]>([]);
  const [device, setDevice] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    store.listDocs().then(setDocs).catch(() => {});
    store.workDays().then(setWork).catch(() => {});
    const read = () => {
      setDevice(notificationsOn());
      setBlocked(notificationsBlocked());
    };
    read();
    window.addEventListener(GOALS_EVENT, read);
    return () => window.removeEventListener(GOALS_EVENT, read);
  }, []);

  const today = localDay();
  const sum = useMemo(() => summarise(w.days, span, today), [w.days, span, today]);
  const series = useMemo(() => {
    const map = new Map(w.days.map((d) => [d.day, d]));
    return Array.from({ length: span }, (_, i) => {
      const day = addDays(today, i - span + 1);
      return { day, words: map.get(day)?.words ?? 0, minutes: map.get(day)?.minutes ?? 0 };
    });
  }, [w.days, span, today]);
  const from = addDays(today, -(span - 1));
  const byWork = useMemo(() => {
    const m = new Map<string, number>();
    work.filter((r) => r.day >= from).forEach((r) => m.set(r.document_id, (m.get(r.document_id) ?? 0) + r.words));
    return [...m.entries()].map(([key, n]) => ({ key, n })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  }, [work, from]);
  const byKind = useMemo(() => {
    const kind = new Map(docs.map((d) => [d.id, d.kind]));
    const m = new Map<string, number>();
    byWork.forEach((r) => {
      const k = kind.get(r.key);
      if (k) m.set(k, (m.get(k) ?? 0) + r.n);
    });
    return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
  }, [byWork, docs]);
  const titles = useMemo(() => new Map(docs.map((d) => [d.id, d.title || t("goals.stats.untitled")])), [docs, t]);

  if (!w.goals)
    return (
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-5 sm:pt-12">
        <FormSkeleton cards={3} />
      </div>
    );
  const g = w.goals;
  const r = reminderOf(g);
  const setReminder = (patch: Partial<typeof r>) => saveGoals({ reminder: { ...r, ...patch } });
  const allowHere = async () => {
    const ok = await askNotificationPermission();
    setNotificationsOn(ok);
    setBlocked(notificationsBlocked());
  };
  const hours = sum.hours.map((n, h) => ({ day: `${h}`, words: n }));

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-5 sm:pt-12">
      <h1 className="text-[1.8rem] font-bold leading-tight sm:text-[2.2rem]">{t("goals.title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("goals.intro")}</p>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
        <Card title={t("goals.panel.today")} dot="bg-tint-tangerine">
          <dl className="grid grid-cols-2 gap-4">
            <Big label={t("goals.todayLabel")} value={num(w.today)} hint={g.daily ? t("goals.ofGoal", { n: num(g.daily) }) : undefined} />
            <div>
              <dt className="text-xs text-muted">{t("goals.streak")}</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
                <Flame size={20} className="text-highlight" aria-hidden /> {w.streak.current}
              </dd>
              <dd className="text-xs text-muted">{t("goals.best", { count: w.streak.best })}</dd>
            </div>
          </dl>
          {g.daily > 0 && <Progress value={w.today} max={g.daily} label={t("goals.todayLabel")} />}
          {g.weekly ? (
            <div className="mt-5">
              <p className="flex justify-between text-sm">
                <span className="text-muted">{t("goals.thisWeek")}</span>
                <span className="tabular-nums">
                  <b>{num(w.week)}</b> / {num(g.weekly)}
                </span>
              </p>
              <Progress value={w.week} max={g.weekly} label={t("goals.thisWeek")} />
            </div>
          ) : (
            <p className="mt-5 flex justify-between text-sm">
              <span className="text-muted">{t("goals.thisWeek")}</span> <b className="tabular-nums">{num(w.week)}</b>
            </p>
          )}
        </Card>

        <Card title={t("goals.set")} dot="bg-tint-violet">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">{t("goals.daily")}</span>
              <input type="number" min={0} step={50} className="field" defaultValue={g.daily} onBlur={(e) => saveGoals({ daily: Number(e.target.value) || 0 })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">{t("goals.weekly")}</span>
              <input type="number" min={0} step={250} className="field" defaultValue={g.weekly ?? 0} onBlur={(e) => saveGoals({ weekly: Number(e.target.value) || 0 })} />
            </label>
          </div>
          <p className="mb-1.5 mt-4 text-xs text-muted">{t("goals.restDays")}</p>
          <div className="flex gap-1.5" role="radiogroup" aria-label={t("goals.restDays")}>
            {[0, 1, 2].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={(g.restDays ?? 0) === n} onClick={() => saveGoals({ restDays: n })} className={`rounded-full border px-3 py-1 text-[13px] ${(g.restDays ?? 0) === n ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line-strong text-muted hover:text-ink"}`}>
                {t("goals.restN", { count: n })}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">{t("goals.restHint")}</p>
          <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-xs text-muted">
            <Timer size={13} aria-hidden /> {t("goals.timerDefault")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TIMER_CHOICES.map((m) => (
              <button key={m} type="button" onClick={() => saveGoals({ timer: m })} className={`rounded-full border px-3 py-1 text-[13px] ${(g.timer ?? 25) === m ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line-strong text-muted hover:text-ink"}`}>
                {t("goals.timer.min", { n: m })}
              </button>
            ))}
          </div>
        </Card>

        <Card title={t("goals.reminder.heading")} dot="bg-tint-sky">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" checked={r.on} onChange={(e) => setReminder({ on: e.target.checked })} />
            {t("goals.reminder.on")}
          </label>
          {/* while reminders are off the settings stay readable (no fading: it failed contrast) but can't be changed */}
          <fieldset disabled={!r.on} className="m-0 mt-3 min-w-0 space-y-3 border-0 p-0 disabled:[&_button]:cursor-not-allowed disabled:[&_input]:cursor-not-allowed">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted">{t("goals.reminder.time")}</span>
              <input type="time" className="field" value={r.time} onChange={(e) => e.target.value && setReminder({ time: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-1" role="group" aria-label={t("goals.reminder.days")}>
              {DAYS.map((d) => {
                const on = r.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setReminder({ days: on ? r.days.filter((x) => x !== d) : [...r.days, d].sort() })}
                    className={`size-8 rounded-full border text-[11px] font-semibold ${on ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-muted"}`}
                  >
                    {t(`goals.dow.${d}` as "goals.dow.0")}
                  </button>
                );
              })}
            </div>
            {notificationsSupported() ? (
              device && !blocked ? (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <Bell size={14} className="text-tint-lime" aria-hidden /> {t("goals.reminder.deviceOn")}
                  <button type="button" className="ml-auto text-accent hover:underline" onClick={() => setNotificationsOn(false)}>
                    {t("goals.reminder.deviceOff")}
                  </button>
                </p>
              ) : blocked ? (
                <p className="flex items-start gap-2 text-xs text-muted">
                  <BellOff size={14} className="mt-0.5 shrink-0" aria-hidden /> {t("goals.reminder.blocked")}
                </p>
              ) : (
                <button type="button" className="btn btn-outline w-full !py-1.5 text-sm" onClick={allowHere}>
                  <Bell size={15} /> {t("goals.reminder.allow")}
                </button>
              )
            ) : null}
            <p className="text-xs text-muted">{t(typeof window !== "undefined" && window.litmaDesktop ? "goals.reminder.whereDesktop" : "goals.reminder.whereWeb")}</p>
          </fieldset>
        </Card>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("goals.stats.title")}</h2>
        <div className="inline-flex gap-1 rounded-full bg-subtle p-1 text-sm" role="tablist">
          {([7, 30, 90] as const).map((n) => (
            <button key={n} role="tab" aria-selected={span === n} onClick={() => setSpan(n)} className={`rounded-full px-3.5 py-1 ${span === n ? "bg-switch font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"}`}>
              {t("goals.stats.days", { n })}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-paper p-5 sm:grid-cols-4" style={{ boxShadow: "var(--sheet-shadow)" }}>
        <Big label={t("goals.stats.words")} value={num(sum.words)} />
        <Big label={t("goals.stats.time")} value={sum.minutes >= 60 ? t("goals.stats.hm", { h: Math.floor(sum.minutes / 60), m: sum.minutes % 60 }) : t("goals.stats.m", { m: sum.minutes })} />
        <Big label={t("goals.stats.writingDays")} value={`${sum.writingDays} / ${span}`} />
        <Big label={t("goals.stats.perDay")} value={num(sum.perWritingDay)} hint={sum.bestDay ? t("goals.stats.bestDay", { n: num(sum.bestDay.words) }) : undefined} />
      </dl>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card title={t("goals.stats.perDayChart")} dot="bg-tint-tangerine">
          <DayBars data={series} field="words" label={t("goals.words")} color={SERIES[0]} />
        </Card>
        <Card title={t("goals.stats.when")} dot="bg-tint-sky">
          {sum.bestHour === null ? (
            <p className="py-6 text-center text-sm text-muted">{t("goals.stats.noHours")}</p>
          ) : (
            <>
              <HourBars rows={hours} />
              <p className="mt-2 text-xs text-muted">{t("goals.stats.bestHour", { h: `${sum.bestHour}:00` })}</p>
            </>
          )}
        </Card>
        <Card title={t("goals.stats.byKind")} dot="bg-tint-violet">
          <HBars rows={byKind} label={(k) => templateFor(k as LitmaDoc["kind"]).ml} color={SERIES[1]} unit={t("goals.words")} />
        </Card>
        <Card title={t("goals.stats.byWork")} dot="bg-tint-lime">
          <div data-private>
            <HBars rows={byWork} label={(k) => titles.get(k) ?? t("goals.stats.deleted")} color={SERIES[2]} unit={t("goals.words")} limit={6} other={t("goals.stats.other")} />
          </div>
        </Card>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted">
        <Target size={13} aria-hidden /> {t("goals.stats.kept", { n: KEEP_DAYS })}
      </p>
    </main>
  );
}

/** Words per hour of the day as 24 small bars. */
function HourBars({ rows }: { rows: { day: string; words: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.words));
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Words by hour of the day">
        {rows.map((r) => (
          <span key={r.day} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max(r.words ? 4 : 0, (r.words / max) * 100)}%`, background: "var(--chart-3)" }} title={`${r.day}:00 · ${num(r.words)}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  return (
    <RequireAuth>
      <div className="min-h-dvh">
        <AppHeader />
        <GoalsView />
        <MobileNav />
      </div>
    </RequireAuth>
  );
}
