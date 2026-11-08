"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Pause, Play, Square, Target, Timer } from "lucide-react";
import { useT } from "@/i18n/react";
import { useWriting } from "@/lib/goals";
import { TIMER_EVENT, clock, getTimer, pauseTimer, resumeTimer, startTimer, stopTimer, timerLeft, timerWritten, type TimerState } from "@/lib/timer";
import { TIMER_CHOICES, deadlinePace } from "@litma/shared/goals";
import type { DocSettings } from "@/lib/types";

/** The writing timer, refreshed every second while it runs. */
export function useTimer() {
  const [s, setS] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const read = () => setS(getTimer());
    read();
    window.addEventListener(TIMER_EVENT, read);
    window.addEventListener("storage", read);
    const every = setInterval(() => {
      setNow(Date.now());
      read();
    }, 1000);
    return () => {
      window.removeEventListener(TIMER_EVENT, read);
      window.removeEventListener("storage", read);
      clearInterval(every);
    };
  }, []);
  return { timer: s && !s.done ? s : null, left: timerLeft(s, now) };
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className="block h-full rounded-full bg-highlight transition-[width]" style={{ width: `${pct}%` }} />
    </span>
  );
}

function Group({ title, dot, children }: { title: string; dot: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-4 first:border-0 first:pt-0">
      <h4 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
        <span aria-hidden className={`size-1.5 rounded-full ${dot}`} /> {title}
      </h4>
      {children}
    </section>
  );
}

/** Goal and timer beside the manuscript: today's goal, this work's goal and finish date, and a writing timer. */
export function GoalPanel({ docId, words, settings, onChange }: { docId: string; words: number; settings: DocSettings; onChange: (p: Partial<DocSettings>) => void }) {
  const t = useT();
  const w = useWriting();
  const { timer, left } = useTimer();
  const [minutes, setMinutes] = useState(25);
  useEffect(() => {
    if (w.goals?.timer) setMinutes(w.goals.timer);
  }, [w.goals?.timer]);
  const daily = w.goals?.daily ?? 0;
  const pace = deadlinePace(words, settings.goal ?? 0, settings.deadline);
  const running = !!timer?.endsAt;

  return (
    <div className="space-y-5 text-sm">
      <Group title={t("goals.panel.timer")} dot="bg-tint-sky">
        {timer ? (
          <div className="rounded-xl border border-line bg-paper p-4 text-center">
            <p className="font-mono text-4xl font-semibold tabular-nums" aria-live="off">{clock(left)}</p>
            <p className="mt-1 text-xs text-muted">{t("goals.timer.written", { count: timerWritten(timer) })}</p>
            <div className="mt-3 flex justify-center gap-2">
              {running ? (
                <button type="button" className="btn btn-outline !py-1.5" onClick={pauseTimer}>
                  <Pause size={15} /> {t("goals.timer.pause")}
                </button>
              ) : (
                <button type="button" className="btn btn-primary !py-1.5" onClick={resumeTimer}>
                  <Play size={15} /> {t("goals.timer.resume")}
                </button>
              )}
              <button type="button" className="btn btn-ghost !py-1.5" onClick={stopTimer}>
                <Square size={14} /> {t("goals.timer.stop")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("goals.timer.length")}>
              {TIMER_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={minutes === m}
                  onClick={() => setMinutes(m)}
                  className={`rounded-full border px-3 py-1 text-[13px] ${minutes === m ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line-strong text-muted hover:text-ink"}`}
                >
                  {t("goals.timer.min", { n: m })}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-accent mt-3 w-full" onClick={() => startTimer(minutes, docId, words)}>
              <Timer size={16} /> {t("goals.timer.start", { n: minutes })}
            </button>
            <p className="mt-2 text-xs text-muted">{t("goals.timer.hint")}</p>
          </>
        )}
      </Group>

      <Group title={t("goals.panel.today")} dot="bg-tint-tangerine">
        <p className="flex items-baseline justify-between">
          <span>
            <b className="text-lg">{w.today.toLocaleString("en-IN")}</b>
            {daily > 0 && <span className="text-muted"> / {daily.toLocaleString("en-IN")}</span>} {t("goals.words")}
          </span>
          {w.streak.current > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-highlight-soft px-2 py-0.5 text-xs font-semibold text-highlight">
              <Flame size={13} aria-hidden /> {t("goals.streakDays", { count: w.streak.current })}
            </span>
          )}
        </p>
        {daily > 0 && <Bar value={w.today} max={daily} />}
        {daily > 0 && w.today >= daily && <p className="mt-2 text-xs font-medium text-highlight">{t("goals.met")}</p>}
      </Group>

      <Group title={t("goals.panel.work")} dot="bg-tint-violet">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{t("goals.work.goal")}</span>
            <input type="number" min={0} step={100} className="field !py-1.5" value={settings.goal ?? 0} onChange={(e) => onChange({ goal: Number(e.target.value) || 0 })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{t("goals.work.deadline")}</span>
            <input type="date" className="field !py-1.5" value={settings.deadline ?? ""} onChange={(e) => onChange({ deadline: e.target.value || undefined })} />
          </label>
        </div>
        {(settings.goal ?? 0) > 0 && (
          <>
            <p className="mt-3 text-xs text-muted">
              {t("goals.work.progress", { words: words.toLocaleString("en-IN"), goal: (settings.goal ?? 0).toLocaleString("en-IN") })}
            </p>
            <Bar value={words} max={settings.goal ?? 0} />
          </>
        )}
        {pace && (
          <p className="mt-2 flex items-center gap-1.5 text-xs">
            <Target size={13} className="text-tint-violet" aria-hidden />
            {pace.left === 0
              ? t("goals.work.reached")
              : pace.daysLeft === 0
                ? t("goals.work.passed", { n: pace.left.toLocaleString("en-IN") })
                : t("goals.work.pace", { n: pace.perDay.toLocaleString("en-IN"), count: pace.daysLeft })}
          </p>
        )}
      </Group>

      <Link href="/goals/" className="btn btn-outline w-full">
        {t("goals.panel.more")}
      </Link>
    </div>
  );
}
