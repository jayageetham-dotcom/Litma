import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { SpellIssue } from "@litma/shared/spell";

/**
 * Writing aids drawn over the text, never saved in it:
 * - spelling marks (`spellKey`): each text block is checked in the background by `check` (set from
 *   the Check panel), a block again only when it changes;
 * - read aloud (`readKey`): the sentence being read, and the word when the voice reports words.
 */

export interface DocIssue extends SpellIssue {
  /** positions in the document */
  pos: number;
  end: number;
}
interface SpellState {
  deco: DecorationSet;
}
type SpellMeta = { reset: true } | { block: { from: number; to: number }; issues: DocIssue[] };

export const spellKey = new PluginKey<SpellState>("spell");
export const readKey = new PluginKey<DecorationSet>("readAloud");

export interface WritingAidsStorage {
  /** checks a block's text; null switches the marks off */
  check: ((text: string) => Promise<SpellIssue[]>) | null;
}

const LEAF = "￼";
/** The text of a text block, one character per document position (inline leaves count as one). */
export const blockText = (node: PMNode) => node.textBetween(0, node.content.size, "\n", (leaf) => (leaf.isText ? leaf.text ?? "" : LEAF));

function textBlocks(doc: PMNode, from = 0, to = doc.content.size) {
  const out: { node: PMNode; pos: number }[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      out.push({ node, pos });
      return false;
    }
    return true;
  });
  return out;
}

const CLASS: Record<SpellIssue["kind"], string> = { unicode: "spell-unicode", mistake: "spell-mistake", suspect: "spell-suspect", punct: "spell-punct", unknown: "spell-unknown" };

/** All spelling issues currently marked, in document order. */
export function spellIssues(state: EditorState): DocIssue[] {
  const deco = spellKey.getState(state)?.deco;
  if (!deco) return [];
  return deco
    .find()
    .map((d) => ({ ...(d.spec.issue as DocIssue), pos: d.from, end: d.to }))
    .sort((a, b) => a.pos - b.pos);
}

/**
 * The marked word (or spacing mark) the cursor is in, or that holds the whole selection, while
 * its text is still what was checked: a word being edited waits for its new check, so the
 * suggestions are always for the complete word.
 */
export function issueAt(state: EditorState): DocIssue | null {
  const deco = spellKey.getState(state)?.deco;
  if (!deco) return null;
  const { from, to } = state.selection;
  for (const d of deco.find(Math.max(0, from - 1), to + 1)) {
    if (from < d.from || to > d.to) continue;
    const issue = d.spec.issue as DocIssue;
    if (state.doc.textBetween(d.from, d.to, "\n", LEAF) !== issue.text) continue;
    return { ...issue, pos: d.from, end: d.to };
  }
  return null;
}

/** Start the check over (after switching it on, or changing what it marks). */
export function recheckSpelling(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(spellKey, { reset: true }).setMeta("addToHistory", false));
}

export interface ReadingRange {
  from: number;
  to: number;
  /** the word being spoken, when the voice sends word boundaries */
  word?: { from: number; to: number };
}

/** Show the sentence (and word) being read (null clears it). */
export function setReading(editor: Editor, range: ReadingRange | null) {
  editor.view.dispatch(editor.state.tr.setMeta(readKey, range).setMeta("addToHistory", false));
}

export const WritingAids = Extension.create<object, WritingAidsStorage>({
  name: "writingAids",
  addStorage() {
    return { check: null };
  },
  addProseMirrorPlugins() {
    const ext = this;
    let dirty: { from: number; to: number }[] = [];
    let all = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let run = 0;

    const spell = new Plugin<SpellState>({
      key: spellKey,
      state: {
        init: () => ({ deco: DecorationSet.empty }),
        apply(tr, prev) {
          const meta = tr.getMeta(spellKey) as SpellMeta | undefined;
          let deco = prev.deco.map(tr.mapping, tr.doc);
          if (meta && "reset" in meta) {
            deco = DecorationSet.empty;
            all = true;
          } else if (meta && "block" in meta) {
            const { from, to } = meta.block;
            deco = deco.remove(deco.find(from, to));
            deco = deco.add(
              tr.doc,
              meta.issues.map((i) => Decoration.inline(i.pos, i.end, { class: CLASS[i.kind], "data-spell": i.kind, "aria-invalid": i.kind === "punct" ? "grammar" : "spelling" }, { issue: i, inclusiveStart: false, inclusiveEnd: false }))
            );
          }
          if (tr.docChanged) {
            const ranges: { from: number; to: number }[] = [];
            tr.mapping.maps.forEach((m) => m.forEach((_a, _b, s, e) => ranges.push({ from: s, to: e })));
            dirty = dirty.map((r) => ({ from: tr.mapping.map(r.from, -1), to: tr.mapping.map(r.to, 1) })).concat(ranges);
          }
          return { deco };
        },
      },
      props: { decorations: (state) => spellKey.getState(state)?.deco },
      view: (view) => {
        const schedule = (delay: number) => {
          clearTimeout(timer);
          timer = setTimeout(work, delay);
        };
        const work = async () => {
          const check = ext.storage.check;
          if (!check) {
            // switched off: clear any marks left
            dirty = [];
            const left = spellKey.getState(view.state)?.deco.find().length ?? 0;
            if (left) view.dispatch(view.state.tr.setMeta(spellKey, { reset: true }).setMeta("addToHistory", false));
            all = false;
            return;
          }
          const mine = ++run;
          const doc = view.state.doc;
          const size = doc.content.size;
          const blocks = all
            ? textBlocks(doc)
            : dirty.flatMap((r) => textBlocks(doc, Math.max(0, Math.min(r.from, size)), Math.max(0, Math.min(r.to, size))));
          all = false;
          dirty = [];
          const seen = new Set<number>();
          for (const { node, pos } of blocks) {
            if (seen.has(pos)) continue;
            seen.add(pos);
            const found = await check(blockText(node));
            if (mine !== run || view.isDestroyed) return;
            // the block changed while it was being checked: it is dirty again and will be redone
            if (view.state.doc.nodeAt(pos) !== node) continue;
            const issues: DocIssue[] = found.map((i) => ({ ...i, pos: pos + 1 + i.from, end: pos + 1 + i.to }));
            view.dispatch(view.state.tr.setMeta(spellKey, { block: { from: pos, to: pos + node.nodeSize }, issues }).setMeta("addToHistory", false));
            // let typing through on long works
            await new Promise((r) => setTimeout(r, 0));
          }
        };
        schedule(400);
        return {
          update(v, prevState) {
            if (v.state.doc !== prevState.doc) schedule(700);
            else if (all) schedule(50);
          },
          destroy() {
            clearTimeout(timer);
            run++;
          },
        };
      },
    });

    const read = new Plugin<DecorationSet>({
      key: readKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, prev) {
          const meta = tr.getMeta(readKey) as ReadingRange | null | undefined;
          if (meta === null) return DecorationSet.empty;
          if (meta) {
            const size = tr.doc.content.size;
            const ok = (a: number, b: number) => a >= 0 && b <= size && a < b;
            const decos = ok(meta.from, meta.to) ? [Decoration.inline(meta.from, meta.to, { class: "reading-now" })] : [];
            if (meta.word && ok(meta.word.from, meta.word.to)) decos.push(Decoration.inline(meta.word.from, meta.word.to, { class: "reading-word" }));
            return DecorationSet.create(tr.doc, decos);
          }
          return prev.map(tr.mapping, tr.doc);
        },
      },
      props: { decorations: (state) => readKey.getState(state) },
    });
    return [spell, read];
  },
});
