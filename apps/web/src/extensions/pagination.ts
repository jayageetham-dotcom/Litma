import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";

/**
 * Visual A4 pagination.
 *
 * Measures every top-level block and inserts spacer widgets so that blocks never
 * straddle a page edge. The page sheets themselves are drawn behind the editor
 * (see PageCanvas). Print/PDF uses the browser's own @page pagination.
 */

export interface PageGeometry {
  /** usable content height of a page, px */
  contentHeight: number;
  /** distance from the bottom of one page's content area to the top of the next page's, px */
  gap: number;
}

interface PagState {
  breaks: { pos: number; height: number }[];
  pages: number;
  deco: DecorationSet;
}

export const paginationKey = new PluginKey<PagState>("pagination");

export const MM = 96 / 25.4;

export const PAGE_SIZES = {
  A4: { w: 210, h: 297, label: "A4 (210 × 297 mm)" },
  A5: { w: 148, h: 210, label: "A5 (148 × 210 mm)" },
  Letter: { w: 215.9, h: 279.4, label: "US Letter" },
  Legal: { w: 215.9, h: 355.6, label: "US Legal" },
} as const;
export type PageSizeKey = keyof typeof PAGE_SIZES;

export const PAGE_GAP_PX = 28;

export function geometryFor(size: PageSizeKey, margins: { top: number; bottom: number }): PageGeometry {
  const p = PAGE_SIZES[size] ?? PAGE_SIZES.A4;
  return {
    contentHeight: (p.h - margins.top - margins.bottom) * MM,
    gap: (margins.bottom + margins.top) * MM + PAGE_GAP_PX,
  };
}

function spacer(height: number) {
  const el = document.createElement("div");
  el.className = "page-spacer";
  el.style.height = `${height}px`;
  el.contentEditable = "false";
  el.setAttribute("aria-hidden", "true");
  return el;
}

function outerHeight(el: HTMLElement) {
  const cs = getComputedStyle(el);
  return el.offsetHeight + parseFloat(cs.marginTop || "0") + parseFloat(cs.marginBottom || "0");
}

function measure(view: EditorView, geo: PageGeometry) {
  const breaks: { pos: number; height: number }[] = [];
  let used = 0;
  const H = geo.contentHeight;
  let forceNext = false;
  view.state.doc.forEach((node, offset) => {
    if (node.type.name === "pageBreak") {
      // an inserted page: the break ends its page; two breaks in a row make an empty page between them
      if (forceNext) {
        breaks.push({ pos: offset, height: Math.max(0, H - used) + geo.gap });
        used = 0;
      }
      forceNext = true;
      return;
    }
    const dom = view.nodeDOM(offset) as HTMLElement | null;
    if (!dom || !(dom instanceof HTMLElement)) return;
    const h = outerHeight(dom);
    if (forceNext || (used + h > H + 0.5 && used > 0)) {
      breaks.push({ pos: offset, height: Math.max(0, H - used) + geo.gap });
      used = 0;
    }
    forceNext = false;
    used += h;
    while (used > H) used -= H; // blocks taller than a page simply flow on
  });
  return breaks;
}

export const Pagination = Extension.create<{ geometry: PageGeometry }, { geometry: PageGeometry; pages: number }>({
  name: "pagination",

  addOptions() {
    return { geometry: geometryFor("A4", { top: 25, bottom: 25 }) };
  },

  addStorage() {
    return { geometry: this.options.geometry, pages: 1 };
  },

  addProseMirrorPlugins() {
    const ext = this;
    let frame = 0;
    return [
      new Plugin<PagState>({
        key: paginationKey,
        state: {
          init: () => ({ breaks: [], pages: 1, deco: DecorationSet.empty }),
          apply(tr, prev, _o, state) {
            const meta = tr.getMeta(paginationKey) as { breaks: PagState["breaks"] } | undefined;
            if (meta) {
              const deco = DecorationSet.create(
                state.doc,
                meta.breaks.map((b, i) =>
                  Decoration.widget(b.pos, () => spacer(b.height), { side: -1, key: `pb-${i}-${Math.round(b.height)}`, ignoreSelection: true })
                )
              );
              return { breaks: meta.breaks, pages: meta.breaks.length + 1, deco };
            }
            return { ...prev, deco: prev.deco.map(tr.mapping, tr.doc) };
          },
        },
        props: {
          decorations(state) {
            return paginationKey.getState(state)?.deco;
          },
        },
        view(view) {
          const run = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
              if (!view.dom.isConnected) return;
              const breaks = measure(view, ext.storage.geometry);
              const prev = paginationKey.getState(view.state)?.breaks ?? [];
              const same =
                prev.length === breaks.length &&
                prev.every((b, i) => b.pos === breaks[i].pos && Math.abs(b.height - breaks[i].height) < 1);
              ext.storage.pages = breaks.length + 1;
              if (!same) view.dispatch(view.state.tr.setMeta(paginationKey, { breaks }).setMeta("addToHistory", false));
            });
          };
          run();
          document.fonts?.ready.then(run);
          const onRemeasure = () => run();
          window.addEventListener("litma:remeasure", onRemeasure);
          return {
            update(v, prevState) {
              if (v.state.doc !== prevState.doc) run();
            },
            destroy() {
              cancelAnimationFrame(frame);
              window.removeEventListener("litma:remeasure", onRemeasure);
            },
          };
        },
      }),
    ];
  },
});

export function remeasurePages() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("litma:remeasure"));
}
