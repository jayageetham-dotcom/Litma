"use client";
/**
 * Print paginator: lays HTML out onto fixed-size pages (A4 by default), splitting long
 * paragraphs and lists across pages at line boundaries, with running heads, folios
 * (roman for front matter, arabic for the body), recto chapter starts and a table of
 * contents filled with real page numbers. The result prints 1:1 to PDF.
 */

export interface PageSpec {
  w: number; // mm
  h: number; // mm
  top: number;
  bottom: number;
  inner: number;
  outer: number;
  /** mirror inner/outer margins on left/right pages (books) */
  mirror: boolean;
}

interface Common {
  id: string;
  /** "roman" folios (front matter), "arabic" (body; restarts at 1 on first use), or none */
  numbering: "roman" | "arabic" | "none";
  startRight?: boolean;
  /** shown in the running head on the right-hand pages of this section */
  runningHead?: string;
  /** hide the folio on this section's first page */
  quietFirst?: boolean;
}

export interface FlowSection extends Common {
  kind: "flow";
  html: string;
  /** e.g. "tpl-novel" — applies the form's manuscript typography */
  className: string;
  vars: Record<string, string>;
}

export interface FixedSection extends Common {
  kind: "fixed";
  html: string;
  className?: string;
  vars?: Record<string, string>;
}

export type Section = FlowSection | FixedSection;

const MM = 96 / 25.4;

function roman(n: number) {
  const map: [number, string][] = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let s = "";
  for (const [v, r] of map) while (n >= v) ((s += r), (n -= v));
  return s;
}

export interface PaginateResult {
  pages: number;
  /** section id → printed page label where it starts */
  starts: Record<string, string>;
}

/** Make sure every font the pages use is loaded before measuring (fonts load lazily otherwise). */
async function loadFonts(sections: Section[]) {
  if (!document.fonts?.load) return;
  const families = new Set<string>(["Anek Malayalam", "Noto Serif Malayalam", "Noto Sans Malayalam"]);
  sections.forEach((s) => {
    const f = s.vars?.["--doc-font"];
    if (f) families.add(f.replace(/['"]/g, ""));
  });
  const sample = "അആഇകഖഗ ക്ഷ ന്റ abc";
  await Promise.all(
    [...families].flatMap((f) => ["400", "700"].map((w) => document.fonts.load(`${w} 16px "${f}"`, sample).catch(() => [])))
  );
  await document.fonts.ready;
}

export async function paginate(root: HTMLElement, spec: PageSpec, sections: Section[], bookTitle = ""): Promise<PaginateResult> {
  await loadFonts(sections);
  root.innerHTML = "";
  root.style.setProperty("--pp-w", `${spec.w}mm`);
  root.style.setProperty("--pp-h", `${spec.h}mm`);
  const bodyH = (spec.h - spec.top - spec.bottom) * MM;

  let pageNo = 0; // physical page count
  let romanNo = 0;
  let arabicNo = 0;
  let arabicStarted = false;
  const starts: Record<string, string> = {};

  interface Page {
    el: HTMLElement;
    body: HTMLElement;
    flow: HTMLElement;
    label: string;
  }

  function newPage(sec: Section | null, first: boolean): Page {
    pageNo++;
    const recto = pageNo % 2 === 1;
    let label = "";
    if (sec?.numbering === "roman") label = roman(++romanNo);
    else if (sec?.numbering === "arabic") {
      if (!arabicStarted) {
        arabicStarted = true;
        arabicNo = 0;
      }
      label = String(++arabicNo);
    }
    const el = document.createElement("section");
    el.className = `pp-page ${recto ? "pp-recto" : "pp-verso"}`;
    const left = spec.mirror ? (recto ? spec.inner : spec.outer) : spec.inner;
    const right = spec.mirror ? (recto ? spec.outer : spec.inner) : spec.outer;
    const body = document.createElement("div");
    body.className = `pp-body ${sec?.className ?? ""}`;
    Object.assign(body.style, { top: `${spec.top}mm`, left: `${left}mm`, right: `${right}mm`, height: `${spec.h - spec.top - spec.bottom}mm` });
    for (const [k, v] of Object.entries(sec?.vars ?? {})) body.style.setProperty(k, v);
    const flow = document.createElement("div");
    flow.className = "ProseMirror pp-flow";
    body.appendChild(flow);
    el.appendChild(body);
    if (sec && label && !(first && sec.quietFirst)) {
      const foot = document.createElement("div");
      foot.className = "pp-folio";
      Object.assign(foot.style, { left: `${left}mm`, right: `${right}mm`, bottom: `${spec.bottom * 0.45}mm` });
      foot.textContent = label;
      el.appendChild(foot);
    }
    const head = recto ? sec?.runningHead : bookTitle;
    if (sec && head && !first && sec.numbering !== "none") {
      const h = document.createElement("div");
      h.className = "pp-head";
      Object.assign(h.style, { left: `${left}mm`, right: `${right}mm`, top: `${spec.top * 0.45}mm`, textAlign: recto ? "right" : "left" });
      h.textContent = head;
      el.appendChild(h);
    }
    root.appendChild(el);
    return { el, body, flow, label };
  }

  function blank() {
    pageNo++;
    const el = document.createElement("section");
    el.className = "pp-page pp-blank";
    root.appendChild(el);
  }

  const overflows = (flow: HTMLElement) => {
    const last = flow.lastElementChild as HTMLElement | null;
    return !!last && last.offsetTop + last.offsetHeight > bodyH + 0.5;
  };

  for (const sec of sections) {
    if (sec.startRight && pageNo % 2 === 1) blank();
    let page = newPage(sec, true);
    starts[sec.id] = page.label;

    if (sec.kind === "fixed") {
      page.flow.classList.add("pp-fixed");
      page.flow.innerHTML = sec.html;
      continue;
    }

    const src = document.createElement("div");
    src.innerHTML = sec.html;
    const blocks = Array.from(src.children) as HTMLElement[];
    const queue = [...blocks];
    let guard = 0;
    while (queue.length && guard++ < 20000) {
      const block = queue.shift()!;
      if (block.matches("[data-page-break], .page-break")) {
        if (page.flow.children.length) page = newPage(sec, false);
        continue;
      }
      page.flow.appendChild(block);
      if (!overflows(page.flow)) continue;

      // Doesn't fit: try to split it at a line boundary, else move it to the next page.
      const limit = bodyH - block.offsetTop;
      const tail = splitBlock(block, limit);
      if (tail) {
        queue.unshift(tail);
        page = newPage(sec, false);
        continue;
      }
      if (page.flow.children.length === 1) {
        // a single block taller than a page: leave it (clipped) rather than loop
        page = newPage(sec, false);
        continue;
      }
      block.remove();
      // keep headings with the following text
      const prev = page.flow.lastElementChild as HTMLElement | null;
      const carry: HTMLElement[] = [];
      if (prev && prev.matches("h1,h2,h3,.sb-chapter,.sb-subhead,.sb-part,.sp-scene,.sp-time,.sp-cast,.pp-chapter")) {
        carry.push(prev);
        prev.remove();
      }
      page = newPage(sec, false);
      for (const c of carry) page.flow.appendChild(c);
      queue.unshift(block);
    }
  }

  // Fill table-of-contents page numbers
  root.querySelectorAll<HTMLElement>("[data-toc]").forEach((el) => {
    const num = el.querySelector(".pp-toc-num");
    if (num) num.textContent = starts[el.dataset.toc!] ?? "";
  });

  return { pages: pageNo, starts };
}

/** Split a paragraph or list so the head fits in `limit` px. Returns the tail element, or null. */
function splitBlock(el: HTMLElement, limit: number): HTMLElement | null {
  const style = getComputedStyle(el);
  const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6;
  if (limit < lh * 2) return null; // avoid a lone first line (orphan)

  if (el.tagName === "UL" || el.tagName === "OL") {
    const items = Array.from(el.children) as HTMLElement[];
    let k = 0;
    while (k < items.length && items[k].offsetTop + items[k].offsetHeight <= limit) k++;
    if (k === 0 || k === items.length) return null;
    const tail = el.cloneNode(false) as HTMLElement;
    if (el.tagName === "OL") tail.setAttribute("start", String((parseInt(el.getAttribute("start") ?? "1") || 1) + k));
    items.slice(k).forEach((li) => tail.appendChild(li));
    return tail;
  }

  if (!el.matches("p, .sp-action, blockquote > p")) return null;

  // candidate split points: after each space in the text
  const points: { node: Text; off: number }[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const t = n.data;
    for (let i = 0; i < t.length; i++) if (t[i] === " ") points.push({ node: n, off: i + 1 });
  }
  if (!points.length) return null;
  const top = el.getBoundingClientRect().top;
  const range = document.createRange();
  const fits = (i: number) => {
    range.setStart(el, 0);
    range.setEnd(points[i].node, points[i].off);
    const rects = range.getClientRects();
    const bottom = rects.length ? rects[rects.length - 1].bottom : top;
    return bottom - top <= limit;
  };
  let lo = -1,
    hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  if (lo < 0) return null;
  // the head's height must leave at least two lines; the tail at least one word
  const p = points[lo];
  const tailRange = document.createRange();
  tailRange.setStart(p.node, p.off);
  tailRange.setEnd(el, el.childNodes.length);
  const frag = tailRange.extractContents();
  if (!frag.textContent?.trim()) {
    el.appendChild(frag);
    return null;
  }
  const tail = el.cloneNode(false) as HTMLElement;
  tail.classList.add("pp-cont");
  tail.appendChild(frag);
  el.classList.add("pp-split");
  return tail;
}
