"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Whether an element is on screen (and the tab is visible). The home page uses it to stop its
 * typing demo, ribbon and floating stickers while they are scrolled away, so phones only animate
 * what the visitor can see.
 */
export function useInView<T extends Element>(rootMargin = "120px"): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin });
    io.observe(el);
    const vis = () => setShown(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [rootMargin]);
  return [ref, seen && shown];
}
