"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, Timer, X } from "lucide-react";
import { useT } from "@/i18n/react";
import { notificationsOn, reminderOf, systemNotify, useWriting } from "@/lib/goals";
import { TIMER_EVENT, chime, getTimer, markTimerDone, startTimer, timerWritten, type TimerState } from "@/lib/timer";
import { localDay, reminderDue } from "@litma/shared/goals";

const PUBLIC = ["/", "/login/", "/signup/", "/forgot-password/", "/reset-password/", "/auth/callback/", "/download/", "/privacy/", "/terms/"];
const LS_RANG = "litma:reminded";

type Toast = { kind: "reminder"; left: number } | { kind: "timer"; words: number; minutes: number; docId?: string };

/**
 * Daily writing reminder and the end of the writing timer, on every page of the app.
 * - Reminder: at the writer's time, on their days, while today's goal isn't met; once a day. The
 *   desktop app's main process keeps it (it rings with the window closed); in a browser it rings
 *   while Litma is open in a tab. A system notification when allowed on this device, and a card
 *   in the app either way.
 * - Timer: a chime, a notification and a card with the words written.
 * The phone app schedules its reminder with the phone's own notifications (works closed).
 */
export function Reminders() {
  const t = useT();
  const path = usePathname();
  const w = useWriting();
  const [toast, setToast] = useState<Toast | null>(null);
  const wRef = useRef(w);
  wRef.current = w;
  const inApp = !PUBLIC.includes(path);

  // keep the desktop app's reminder in step with the writer's settings and today's words
  const desktop = typeof window !== "undefined" ? window.litmaDesktop : undefined;
  useEffect(() => {
    if (!desktop?.setReminder || !w.goals) return;
    const r = reminderOf(w.goals);
    const goal = w.goals.daily ?? 0;
    const left = Math.max(0, goal - w.today);
    desktop
      .setReminder({
        on: r.on && notificationsOn(),
        time: r.time,
        days: r.days,
        day: localDay(),
        done: goal > 0 ? w.today >= goal : w.today > 0,
        title: t("goals.reminder.title"),
        body: goal > 0 ? t("goals.reminder.bodyLeft", { n: left.toLocaleString("en-IN") }) : t("goals.reminder.body"),
      })
      .catch(() => {});
  }, [desktop, w.goals, w.today, t]);

  // reminder check, every minute
  useEffect(() => {
    const check = () => {
      const { goals, today } = wRef.current;
      if (!goals) return;
      const day = localDay();
      let rang = "";
      try {
        rang = localStorage.getItem(LS_RANG) ?? "";
      } catch {
        /* storage blocked */
      }
      if (rang === day) return;
      if (!reminderDue(reminderOf(goals), new Date(), today, goals.daily ?? 0)) return;
      try {
        localStorage.setItem(LS_RANG, day);
      } catch {
        /* storage blocked */
      }
      const left = Math.max(0, (goals.daily ?? 0) - today);
      // the desktop app rings from its main process; elsewhere the browser does
      if (!window.litmaDesktop?.setReminder) systemNotify(t("goals.reminder.title"), left ? t("goals.reminder.bodyLeft", { n: left.toLocaleString("en-IN") }) : t("goals.reminder.body"), "litma-reminder");
      else window.litmaDesktop.reminderRang?.(day).catch(() => {});
      setToast({ kind: "reminder", left });
    };
    const first = setTimeout(check, 5000);
    const every = setInterval(check, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [t]);

  // writing timer: announce the end once (any tab)
  useEffect(() => {
    const check = () => {
      const s: TimerState | null = getTimer();
      if (!s || s.done || !s.endsAt || s.endsAt > Date.now()) return;
      markTimerDone();
      const words = timerWritten(s);
      chime();
      systemNotify(t("goals.timer.doneTitle"), t("goals.timer.doneBody", { count: words, minutes: s.minutes }), "litma-timer");
      setToast({ kind: "timer", words, minutes: s.minutes, docId: s.docId });
    };
    const every = setInterval(check, 1000);
    window.addEventListener(TIMER_EVENT, check);
    return () => {
      clearInterval(every);
      window.removeEventListener(TIMER_EVENT, check);
    };
  }, [t]);

  if (!toast || (!inApp && toast.kind === "reminder")) return null;
  return (
    <div role="status" className="no-print pop-in dialog fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-sm rounded-2xl p-4 shadow-lg sm:left-6 sm:right-auto sm:mx-0">
      <button type="button" onClick={() => setToast(null)} className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label={t("common.close")}>
        <X size={15} />
      </button>
      {toast.kind === "reminder" ? (
        <>
          <p className="flex items-center gap-2 pr-6 font-semibold">
            <BellRing size={17} className="text-tint-tangerine" aria-hidden /> {t("goals.reminder.title")}
          </p>
          <p className="mt-1 text-sm text-muted">{toast.left ? t("goals.reminder.bodyLeft", { n: toast.left.toLocaleString("en-IN") }) : t("goals.reminder.body")}</p>
          <div className="mt-3 flex gap-2">
            {path !== "/write/" && (
              <Link href="/desk/" className="btn btn-primary !py-1.5 text-sm" onClick={() => setToast(null)}>
                {t("goals.reminder.write")}
              </Link>
            )}
            <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => setToast(null)}>
              {t("goals.reminder.later")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 pr-6 font-semibold">
            <Timer size={17} className="text-tint-sky" aria-hidden /> {t("goals.timer.doneTitle")}
          </p>
          <p className="mt-1 text-sm text-muted">{t("goals.timer.doneBody", { count: toast.words, minutes: toast.minutes })}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-primary !py-1.5 text-sm"
              onClick={() => {
                const s = getTimer();
                startTimer(toast.minutes, toast.docId, s?.words ?? 0);
                setToast(null);
              }}
            >
              {t("goals.timer.again", { minutes: toast.minutes })}
            </button>
            <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => setToast(null)}>
              {t("goals.timer.finish")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
