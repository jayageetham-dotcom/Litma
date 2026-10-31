"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = {
  value: string;
  label: React.ReactNode;
  /** plain text for type-ahead and screen readers when `label` isn't a string */
  text?: string;
  hint?: React.ReactNode;
  style?: React.CSSProperties;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** visible label rendered above the control */
  label?: React.ReactNode;
  labelClassName?: string;
  /** accessible name when there is no visible label */
  "aria-label"?: string;
  /** shown when no option matches `value` (e.g. action menus such as "Title page…") */
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  buttonStyle?: React.CSSProperties;
  title?: string;
  disabled?: boolean;
  /** keep the caret in the editor while choosing (toolbar pickers) */
  preventFocusSteal?: boolean;
};

const textOf = (o: SelectOption) => o.text ?? (typeof o.label === "string" ? o.label : o.value);

/**
 * Accessible custom dropdown (WAI-ARIA "select-only combobox" pattern).
 * Trigger: role=combobox, aria-haspopup=listbox, aria-expanded, aria-controls, aria-activedescendant.
 * Keys: ↑/↓ Home/End PageUp/PageDown, Enter/Space choose, Esc/Tab close, type-ahead by letters.
 * The list renders in a portal with fixed positioning so scrolling toolbars and panels never clip it.
 */
export function Select({ value, onChange, options, label, labelClassName, placeholder, size = "md", className = "", buttonStyle, title, disabled, preventFocusSteal, ...rest }: Props) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listId = `${id}-list`;
  const optId = (i: number) => `${id}-opt-${i}`;
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; minWidth: number; maxHeight: number } | null>(null);
  const typed = useRef({ s: "", t: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const enabled = useMemo(() => options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0), [options]);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const vh = window.innerHeight;
    const below = vh - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 220 && above > below;
    const maxHeight = Math.max(160, Math.min(320, (up ? above : below) - 4));
    const left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8));
    setPos(up ? { left, bottom: vh - r.top + 4, minWidth: r.width, maxHeight } : { left, top: r.bottom + 4, minWidth: r.width, maxHeight });
  }, []);

  const openList = useCallback(
    (at?: number) => {
      if (disabled) return;
      place();
      setActive(at ?? (selectedIndex >= 0 ? selectedIndex : enabled[0] ?? -1));
      setOpen(true);
    },
    [disabled, place, selectedIndex, enabled]
  );
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus && !preventFocusSteal) btn.current?.focus();
  }, [preventFocusSteal]);
  const choose = useCallback(
    (i: number) => {
      const o = options[i];
      if (!o || o.disabled) return;
      close();
      if (o.value !== value || placeholder) onChange(o.value);
    },
    [options, value, onChange, close, placeholder]
  );

  // keep the list attached to the trigger while things scroll or resize
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const h = () => place();
    window.addEventListener("resize", h);
    window.addEventListener("scroll", h, true);
    return () => {
      window.removeEventListener("resize", h);
      window.removeEventListener("scroll", h, true);
    };
  }, [open, place]);

  // close on outside press
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !list.current?.contains(t)) close(false);
    };
    // Esc closes even when focus stayed elsewhere (toolbar pickers keep the caret in the editor)
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement !== btn.current) {
        e.preventDefault();
        close(false);
      }
    };
    document.addEventListener("pointerdown", h, true);
    document.addEventListener("keydown", k, true);
    return () => {
      document.removeEventListener("pointerdown", h, true);
      document.removeEventListener("keydown", k, true);
    };
  }, [open, close]);

  // keep the active option in view
  useEffect(() => {
    if (open && active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const move = (from: number, dir: 1 | -1, steps = 1) => {
    if (!enabled.length) return -1;
    let k = enabled.indexOf(from);
    if (k < 0) k = dir > 0 ? -1 : enabled.length;
    k = Math.max(0, Math.min(enabled.length - 1, k + dir * steps));
    return enabled[k];
  };

  const typeahead = (ch: string) => {
    const now = Date.now();
    typed.current = { s: now - typed.current.t > 700 ? ch : typed.current.s + ch, t: now };
    const q = typed.current.s.toLowerCase();
    const start = active >= 0 ? active : 0;
    const order = [...enabled.filter((i) => i > start), ...enabled.filter((i) => i <= start)];
    const hit = (q.length === 1 ? order : [start, ...order]).find((i) => textOf(options[i]).toLowerCase().startsWith(q));
    return hit ?? -1;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) {
        e.preventDefault();
        openList(k === "ArrowUp" ? move(selectedIndex, -1) : undefined);
      } else if (k === "Home" || k === "End") {
        e.preventDefault();
        openList(k === "Home" ? enabled[0] : enabled[enabled.length - 1]);
      } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const i = typeahead(k);
        if (i >= 0) openList(i);
      }
      return;
    }
    if (k === "ArrowDown") (e.preventDefault(), setActive((a) => move(a, 1)));
    else if (k === "ArrowUp") {
      e.preventDefault();
      if (e.altKey) choose(active);
      else setActive((a) => move(a, -1));
    } else if (k === "PageDown") (e.preventDefault(), setActive((a) => move(a, 1, 10)));
    else if (k === "PageUp") (e.preventDefault(), setActive((a) => move(a, -1, 10)));
    else if (k === "Home") (e.preventDefault(), setActive(enabled[0]));
    else if (k === "End") (e.preventDefault(), setActive(enabled[enabled.length - 1]));
    else if (k === "Enter" || k === " ") (e.preventDefault(), choose(active));
    else if (k === "Escape") (e.preventDefault(), e.stopPropagation(), close());
    else if (k === "Tab") {
      choose(active);
      setOpen(false);
    } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const i = typeahead(k);
      if (i >= 0) setActive(i);
    }
  };

  const sizing = size === "sm" ? "h-8 rounded-md px-2.5 text-[13px] gap-1.5" : "min-h-10 rounded-lg px-3 py-2 text-[0.95rem] gap-2";
  const ariaLabel = rest["aria-label"];

  return (
    <>
      {label && (
        <span id={labelId} className={labelClassName ?? "mb-1 block text-sm"} onClick={() => btn.current?.focus()}>
          {label}
        </span>
      )}
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        title={title}
        onMouseDown={preventFocusSteal ? (e) => e.preventDefault() : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`inline-flex shrink-0 items-center justify-between border border-line bg-paper text-left text-ink transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--accent)_20%,transparent)] disabled:opacity-50 ${open ? "border-accent" : ""} ${sizing} ${className}`}
        style={{ ...selected?.style, ...buttonStyle }}
      >
        <span id={valueId} className={`min-w-0 truncate ${selected ? "" : "text-muted"}`}>
          {selected ? selected.label : placeholder ?? "Choose…"}
        </span>
        <ChevronDown size={size === "sm" ? 14 : 16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : ariaLabel}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            className="scrollbar-thin fixed z-[80] max-w-[min(22rem,calc(100vw-16px))] overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-[var(--pop-shadow)]"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: Math.max(pos.minWidth, 160), maxHeight: pos.maxHeight }}
          >
            {options.map((o, i) => {
              const sel = i === selectedIndex;
              return (
                <li
                  key={`${o.value}-${i}`}
                  id={optId(i)}
                  role="option"
                  aria-selected={sel}
                  aria-disabled={o.disabled || undefined}
                  onPointerEnter={() => !o.disabled && setActive(i)}
                  onClick={() => choose(i)}
                  className={`mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink transition-colors ${i === active && !sel ? "bg-[var(--option-hover)]" : ""} ${i === active && sel ? "ring-1 ring-inset ring-[var(--option-selected-ink)]/25" : ""} ${sel ? "bg-[var(--option-selected)] font-semibold text-[var(--option-selected-ink)]" : ""} ${o.disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  style={o.style}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs font-normal text-muted">{o.hint}</span>}
                  </span>
                  <Check size={15} className={`shrink-0 ${sel ? "" : "invisible"}`} aria-hidden />
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
