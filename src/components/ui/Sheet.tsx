"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * One panel container that adapts like a native app:
 *  - "sheet":  bottom sheet over a dimmed page (phones)
 *  - "drawer": slides over the page from the right, page keeps its full width (tablets/laptops)
 *  - "dock":   sits beside the page (very wide screens)
 */
export function Sheet({
  mode,
  title,
  onClose,
  children,
  side = "right",
  bottomOffset = 0,
}: {
  mode: "sheet" | "drawer" | "dock";
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
  bottomOffset?: number;
}) {
  useEffect(() => {
    if (mode === "dock") return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [mode, onClose]);

  const head = (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label={`Close ${title}`}>
        <X size={16} />
      </button>
    </div>
  );

  if (mode === "dock")
    return (
      <aside className={`no-print scrollbar-thin w-80 shrink-0 overflow-y-auto bg-desk px-4 py-4 ${side === "right" ? "border-l" : "border-r"} border-line`} aria-label={title}>
        {head}
        {children}
      </aside>
    );

  if (mode === "drawer")
    return (
      <aside
        className={`no-print scrollbar-thin absolute inset-y-0 z-30 w-[22rem] max-w-[90%] overflow-y-auto bg-desk px-4 py-4 shadow-2xl ${side === "right" ? "right-0 border-l" : "left-0 border-r"} border-line`}
        aria-label={title}
      >
        {head}
        {children}
      </aside>
    );

  return (
    <div className="no-print fixed inset-x-0 top-0 z-50 flex flex-col justify-end bg-black/35" style={{ bottom: bottomOffset }} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrollbar-thin max-h-[78dvh] overflow-y-auto rounded-t-2xl bg-desk px-4 pb-6 pt-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        {head}
        {children}
      </div>
    </div>
  );
}
