"use client";
import { useEffect, useState } from "react";

/**
 * Screen classes used across Litma (mirrors a native app's size classes):
 *  phone   < 768 px   — bottom tab bar, bottom sheets
 *  tablet  768–1279   — top bar + rail, panels slide over the page
 *  desktop 1280–1535  — outline can dock on the left, panels slide over
 *  wide    ≥ 1536     — panels dock beside the page
 */
export type ScreenClass = "phone" | "tablet" | "desktop" | "wide";

function classify(w: number): ScreenClass {
  if (w < 768) return "phone";
  if (w < 1280) return "tablet";
  if (w < 1536) return "desktop";
  return "wide";
}

export function useScreen(): ScreenClass {
  const [s, setS] = useState<ScreenClass>("desktop");
  useEffect(() => {
    const update = () => setS(classify(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return s;
}

/** Height of the on-screen keyboard (0 when hidden), from the visual viewport. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const h = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setInset(h > 80 ? h : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
