"use client";
import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

/**
 * Focus for a modal dialog or sheet: when it opens, focus moves into it ([initial], else its first
 * control, else the box itself); Tab and Shift+Tab stay inside; Esc closes it; when it closes,
 * focus goes back where it was. Same behaviour as the shortcuts dialog (audit, 26 Nov: the
 * writing-type picker and the phone sheets left focus behind them).
 */
export function useModalFocus(
  active: boolean,
  box: RefObject<HTMLElement | null>,
  onClose: () => void,
  initial?: RefObject<HTMLElement | null>,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active) return;
    const back = document.activeElement as HTMLElement | null;
    const el = box.current;
    const first = initial?.current ?? el?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
    if (first) first.focus({ preventScroll: true });
    else if (el) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // a list or menu inside (a dropdown, Manglish suggestions) closes first: it handles Esc
        // before this bubble-phase listener and marks it handled (verifier, 28 Nov)
        if (e.defaultPrevented) return;
        // a dialog opened over this one (a confirmation) holds focus: Esc is its own, not ours
        const at = document.activeElement;
        if (at && at !== document.body && box.current && !box.current.contains(at)) return;
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (!box.current.contains(document.activeElement)) {
        e.preventDefault();
        a.focus();
      } else if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("keydown", k);
      if (back && back !== document.body && back.isConnected) back.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
