"use client";
import { Timer } from "lucide-react";
import { useT } from "@/i18n/react";
import { clock } from "@/lib/timer";
import { useTimer } from "./GoalPanel";

/** The writing timer's time left in the editor's header; opens the goal panel. */
export function TimerChip({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const { timer, left } = useTimer();
  if (!timer) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`no-print inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-semibold tabular-nums ${timer.endsAt ? "bg-accent-soft text-accent" : "bg-subtle text-muted"}`}
      aria-label={t("goals.timer.chip", { time: clock(left) })}
      data-track="Writing timer"
    >
      <Timer size={13} aria-hidden /> {clock(left)}
    </button>
  );
}
