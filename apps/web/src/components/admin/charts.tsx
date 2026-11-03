"use client";
/**
 * Small SVG charts for the admin page. Colours come from the --chart-* tokens (a categorical set checked
 * for colour-blind separation, used in fixed order), text stays in ink/muted, every chart has a hover
 * tooltip, and two or more series always get a legend.
 */
import { useEffect, useMemo, useRef, useState } from "react";

export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const fmt = new Intl.NumberFormat("en-IN");
export const num = (n: number) => fmt.format(Math.round(n));
export const compact = (n: number) => (Math.abs(n) >= 1e5 ? new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n) : num(n));

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round "nice" upper bound and 4 gridlines. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10;
  return m * p;
}

const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: React.ReactNode }) {
  const left = Math.min(Math.max(x, 70), w - 70);
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg" style={{ left, top: y - 8 }}>
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

type Point = { day: string } & Record<string, number | string>;

/** Lines over days, one y axis, crosshair tooltip. */
export function LineChart({ data, series, height = 220 }: { data: Point[]; series: { key: string; label: string }[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 12, t: 10, b: 24 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 70))));

  return (
    <div className="space-y-3">
      {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s.label, color: SERIES[i] }))} />}
      <div ref={ref} className="relative w-full min-w-0 overflow-hidden" onMouseLeave={() => setHover(null)}>
        <svg width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px]">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={d.day} x={x(i)} y={height - 6} textAnchor="middle" className="fill-muted text-[10px]">
                {shortDay(d.day)}
              </text>
            ) : null
          )}
          {series.map((s, si) => (
            <path
              key={s.key}
              d={data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(Number(d[s.key]) || 0)}`).join("")}
              fill="none"
              stroke={SERIES[si]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--chart-axis)" />
              {series.map((s, si) => (
                <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]) || 0)} r={4} fill={SERIES[si]} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={pad.l}
            y={pad.t}
            width={iw}
            height={ih}
            fill="transparent"
            onMouseMove={(e) => {
              const box = (e.currentTarget as SVGRectElement).getBoundingClientRect();
              const i = Math.round(((e.clientX - box.left) / box.width) * (data.length - 1));
              setHover(Math.max(0, Math.min(data.length - 1, i)));
            }}
          />
        </svg>
        {hover !== null && (
          <Tip x={x(hover)} y={pad.t + 10} w={w}>
            <div className="mb-0.5 font-semibold">{shortDay(data[hover].day)}</div>
            {series.map((s, si) => (
              <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: SERIES[si] }} />
                <span className="text-muted">{s.label}</span>
                <span className="ml-auto pl-3 font-semibold tabular-nums">{num(Number(data[hover][s.key]) || 0)}</span>
              </div>
            ))}
          </Tip>
        )}
      </div>
    </div>
  );
}

/** One measure per day as bars (rounded tops, 2px gaps). */
export function DayBars({ data, field, label, color = SERIES[0], height = 160 }: { data: Point[]; field: string; label: string; color?: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 6, t: 8, b: 22 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map((d) => Number(d[field]) || 0)));
  const slot = iw / Math.max(1, data.length);
  const bw = Math.max(1, slot - 2);
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 70))));
  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label={label}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih - f * ih} y2={pad.t + ih - f * ih} stroke={f === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} />
            <text x={pad.l - 6} y={pad.t + ih - f * ih} dy="0.32em" textAnchor="end" className="fill-muted text-[10px]">
              {compact(f * max)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = Number(d[field]) || 0;
          const h = (v / max) * ih;
          const x = pad.l + i * slot + 1;
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={ih} fill="transparent" />
              {v > 0 && (
                <path
                  d={`M${x},${pad.t + ih}V${pad.t + ih - h + r}Q${x},${pad.t + ih - h} ${x + r},${pad.t + ih - h}H${x + bw - r}Q${x + bw},${pad.t + ih - h} ${x + bw},${pad.t + ih - h + r}V${pad.t + ih}Z`}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {i % every === 0 && (
                <text x={x + bw / 2} y={height - 6} textAnchor="middle" className="fill-muted text-[10px]">
                  {shortDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={pad.l + hover * slot + slot / 2} y={pad.t + 10} w={w}>
          <span className="font-semibold">{shortDay(data[hover].day)}</span> <span className="text-muted">{label}</span> <span className="font-semibold tabular-nums">{num(Number(data[hover][field]) || 0)}</span>
        </Tip>
      )}
    </div>
  );
}

/** Ranked horizontal bars with value and share; beyond `limit` rows fold into "Other". */
export function HBars({ rows, label = (k: string) => k, limit = 8, color = SERIES[0], unit, other = "Other" }: { rows: { key: string; n: number }[]; label?: (k: string) => string; limit?: number; color?: string; unit?: string; other?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = rows.reduce((a, r) => a + r.n, 0) || 1;
  const shown = useMemo(() => {
    if (rows.length <= limit) return rows;
    const head = rows.slice(0, limit - 1);
    return [...head, { key: "__other", n: rows.slice(limit - 1).reduce((a, r) => a + r.n, 0) }];
  }, [rows, limit]);
  const max = Math.max(1, ...shown.map((r) => r.n));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">—</p>;
  return (
    <ul className="space-y-2">
      {shown.map((r) => (
        <li key={r.key} className="group" onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)} title={`${r.key === "__other" ? other : label(r.key)}: ${num(r.n)}${unit ? ` ${unit}` : ""} (${Math.round((r.n / total) * 100)}%)`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.key === "__other" ? other : label(r.key)}</span>
            <span className="shrink-0 tabular-nums text-muted">
              <span className="font-semibold text-ink">{num(r.n)}</span> · {Math.round((r.n / total) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-subtle">
            <div className="h-2 rounded-full transition-opacity" style={{ width: `${Math.max(1.5, (r.n / max) * 100)}%`, background: color, opacity: hover && hover !== r.key ? 0.55 : 1 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One 100% bar split into a few parts (2px gaps), with a legend that carries the numbers. */
export function ShareBar({ rows, label = (k: string) => k, other = "Other" }: { rows: { key: string; n: number }[]; label?: (k: string) => string; other?: string }) {
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((a, r) => a + r.n, 0);
  const parts = rest ? [...top, { key: "__other", n: rest }] : top;
  const total = parts.reduce((a, r) => a + r.n, 0) || 1;
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">—</p>;
  return (
    <div className="space-y-3">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.key === "__other" ? other : label(p.key)} ${Math.round((p.n / total) * 100)}%`).join(", ")}>
        {parts.map((p, i) => (
          <div key={p.key} title={`${p.key === "__other" ? other : label(p.key)}: ${num(p.n)}`} style={{ flexGrow: p.n, flexBasis: 0, background: SERIES[i % SERIES.length] }} />
        ))}
      </div>
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="min-w-0 truncate">{p.key === "__other" ? other : label(p.key)}</span>
            <span className="ml-auto tabular-nums text-muted">
              <span className="font-semibold text-ink">{Math.round((p.n / total) * 100)}%</span> · {num(p.n)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Weekday × hour of day (India time), one hue from light to dark. */
export function HourHeatmap({ cells }: { cells: { dow: number; hour: number; n: number }[] }) {
  const [hover, setHover] = useState<{ dow: number; hour: number; n: number } | null>(null);
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.n]));
  const max = Math.max(1, ...cells.map((c) => c.n));
  const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[2px]" style={{ gridTemplateColumns: "2.5rem repeat(24, minmax(0, 1fr))" }} role="img" aria-label="Activity by weekday and hour">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[10px] text-muted">
              {h % 3 === 0 ? hourLabel(h) : ""}
            </span>
          ))}
          {DOW.map((d, di) => (
            <div key={d} className="contents">
              <span className="self-center text-[11px] text-muted">{d}</span>
              {Array.from({ length: 24 }, (_, h) => {
                const n = grid.get(`${di + 1}-${h}`) ?? 0;
                const pct = n ? 12 + Math.round((n / max) * 88) : 0;
                return (
                  <span
                    key={h}
                    className="h-5 rounded-[4px]"
                    style={{ background: n ? `color-mix(in oklch, var(--chart-1) ${pct}%, var(--surface))` : "var(--subtle)", outline: hover?.dow === di && hover.hour === h ? "2px solid var(--ink)" : undefined }}
                    onMouseEnter={() => setHover({ dow: di, hour: h, n })}
                    onMouseLeave={() => setHover(null)}
                    title={`${d} ${hourLabel(h)}: ${num(n)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="h-4 text-xs text-muted">{hover ? `${DOW[hover.dow]}, ${hourLabel(hover.hour)} to ${hourLabel((hover.hour + 1) % 24)}: ${num(hover.n)}` : ""}</p>
    </div>
  );
}

/** A count with the change against the previous period of the same length. */
export function Stat({ label, value, prev, hint, display, vs = "" }: { label: string; value: number; prev?: number; hint?: string; display?: string; vs?: string }) {
  const delta = prev === undefined ? null : prev === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - prev) / prev) * 100);
  return (
    <div className="rounded-[14px] border border-line bg-surface p-4" title={hint}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{display ?? (value < 1e7 ? num(value) : compact(value))}</div>
      {delta !== null && (
        <div className="mt-0.5 text-xs font-medium tabular-nums text-muted">
          <span aria-hidden style={{ color: delta > 0 ? "var(--chart-3)" : delta < 0 ? "var(--danger)" : undefined }}>{delta > 0 ? "▲" : delta < 0 ? "▼" : "●"}</span> {delta > 0 ? "+" : delta < 0 ? "−" : ""}
          {Math.abs(delta)}% <span className="font-normal">{vs}</span>
        </div>
      )}
    </div>
  );
}

/** Steps from visit to writing, each as a share of the first. */
export function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const first = Math.max(1, steps[0]?.n ?? 1);
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{s.label}</span>
            <span className="tabular-nums text-muted">
              <span className="font-semibold text-ink">{num(s.n)}</span>
              {i > 0 && ` · ${Math.round((s.n / first) * 100)}%`}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-subtle">
            <div className="h-2.5 rounded-full" style={{ width: `${Math.max(1.5, (s.n / first) * 100)}%`, background: SERIES[i % SERIES.length] }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
