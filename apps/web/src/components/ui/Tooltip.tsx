"use client";
import { useId, useState } from "react";

/**
 * A small explanation for a badge or icon. Shows on hover and keyboard focus, toggles on tap
 * (phones), closes with Esc or when focus leaves. Screen readers get it through aria-describedby.
 */
export function Tooltip({ label, children, className = "", align = "start" }: { label: string; children: React.ReactNode; className?: string; align?: "start" | "center" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={`cursor-help ${className}`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute top-full z-40 mt-2 w-max max-w-[16rem] rounded-lg bg-primary px-3 py-2 text-left text-xs font-normal leading-snug text-primary-ink shadow-[var(--pop-shadow)] transition duration-150 ${align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"} ${open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"}`}
      >
        {label}
      </span>
    </span>
  );
}
