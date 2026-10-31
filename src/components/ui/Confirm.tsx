"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

type Opts = { title: string; body?: React.ReactNode; confirm: string; danger?: boolean };

/**
 * App-styled confirmation (replaces window.confirm): a centred dialog on larger screens,
 * a bottom sheet on phones. `const [dialog, ask] = useConfirm(); if (await ask({...})) …`
 */
export function useConfirm(): [React.ReactNode, (o: Opts) => Promise<boolean>] {
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const ask = useCallback(
    (o: Opts) =>
      new Promise<boolean>((res) => {
        resolver.current = res;
        setOpts(o);
      }),
    []
  );
  const done = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);
  return [opts ? <ConfirmDialog {...opts} onDone={done} /> : null, ask];
}

function ConfirmDialog({ title, body, confirm, danger, onDone }: Opts & { onDone: (v: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onDone(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => onDone(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="safe-bottom w-full rounded-t-2xl bg-paper p-5 shadow-2xl sm:max-w-md sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          {danger && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle size={19} />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-semibold leading-snug">
              {title}
            </h2>
            {body && <div className="mt-1.5 text-sm leading-relaxed text-muted">{body}</div>}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} className="btn btn-outline justify-center !py-2.5 sm:!py-2" onClick={() => onDone(false)}>
            Cancel
          </button>
          <button
            className={`btn justify-center !py-2.5 sm:!py-2 ${danger ? "bg-danger text-white hover:opacity-90" : "btn-primary"}`}
            onClick={() => onDone(true)}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
