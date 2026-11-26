"use client";
import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { checkStanza, ganaNames, patternOf, type MetreCheck, type LineCheck } from "@litma/shared/metre";
import { useT } from "@/i18n/react";

const ml = { fontFamily: "var(--font-ml)" };

/** A line of the stanza with where it starts in the document. */
interface StanzaLine {
  text: string;
  /** document position of the line's first character */
  pos: number;
}

/** The lines of one paragraph (a hard break starts a new line). Leaf nodes count one character each. */
function paragraphLines(node: PMNode, pos: number): StanzaLine[] {
  const text = node.textBetween(0, node.content.size, "\n", (leaf) => (leaf.type.name === "hardBreak" ? "\n" : " "));
  const out: StanzaLine[] = [];
  let at = 0;
  for (const line of text.split("\n")) {
    out.push({ text: line, pos: pos + 1 + at });
    at += line.length + 1;
  }
  return out;
}

const isVerseLine = (n: PMNode) => n.type.name === "paragraph";

/**
 * The stanza around the cursor: the run of non-empty lines it is in, or the one just above when
 * the cursor sits on an empty line.
 */
function stanzaAt(editor: Editor): StanzaLine[] {
  const { doc, selection } = editor.state;
  let idx = Math.min(selection.$from.index(0), doc.childCount - 1);
  const filled = (i: number) => isVerseLine(doc.child(i)) && !!doc.child(i).textContent.trim();
  if (!filled(idx)) {
    let k = idx - 1;
    while (k >= 0 && !filled(k)) {
      if (!isVerseLine(doc.child(k))) return [];
      k--;
    }
    if (k < 0) return [];
    idx = k;
  }
  let a = idx;
  while (a > 0 && filled(a - 1)) a--;
  let b = idx;
  while (b < doc.childCount - 1 && filled(b + 1)) b++;
  const out: StanzaLine[] = [];
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (i >= a && i <= b) out.push(...paragraphLines(child, pos).filter((l) => l.text.trim()));
    pos += child.nodeSize;
  }
  return out;
}

/**
 * The metre of the stanza being written: its name, the rule it follows, and every line in
 * syllables with laghu (∪) and guru (–), the ones that don't fit marked. Tapping a syllable selects
 * it in the text.
 */
export function MetrePanel({ editor, marks, onMarks }: { editor: Editor; marks: boolean; onMarks: (on: boolean) => void }) {
  const t = useT();
  const [lines, setLines] = useState<StanzaLine[]>([]);
  useEffect(() => {
    let timer = 0;
    const read = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = stanzaAt(editor);
        setLines((prev) => (prev.length === next.length && prev.every((l, i) => l.text === next[i].text && l.pos === next[i].pos) ? prev : next));
      }, 150);
    };
    read();
    editor.on("selectionUpdate", read);
    editor.on("update", read);
    return () => {
      window.clearTimeout(timer);
      editor.off("selectionUpdate", read);
      editor.off("update", read);
    };
  }, [editor]);
  const check = useMemo<MetreCheck | null>(() => (lines.length ? checkStanza(lines.map((l) => l.text)) : null), [lines]);

  // checkStanza trims lines; find each checked line's offset in its original text
  const select = (lineIdx: number, start: number, end: number) => {
    const line = lines[lineIdx];
    if (!line) return;
    const lead = line.text.length - line.text.trimStart().length;
    const from = line.pos + lead + start;
    const to = line.pos + lead + end;
    const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)).scrollIntoView();
    editor.view.dispatch(tr);
    const touch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
    if (!touch) editor.view.focus();
  };

  return (
    <div className="min-w-0 max-w-full overflow-x-clip">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={marks} onChange={(e) => onMarks(e.target.checked)} /> {t("metre.marks")}
      </label>

      {!check ? (
        <p className="mt-5 text-sm text-muted">{t("metre.empty")}</p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-tint-violet" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{t("metre.following")}</h3>
          </div>
          <Summary check={check} />
          <p className="mt-4 text-xs text-muted">
            {t("metre.legend")} · {t("metre.hint")}
          </p>
          <ol className="mt-2 flex flex-col gap-3">
            {check.lines.map((l, i) => (
              <Line key={i} line={l} onPick={(s, e) => select(i, s, e)} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function Summary({ check }: { check: MetreCheck }) {
  const t = useT();
  const m = check.metre;
  const tone =
    check.fit === "exact" || check.fit === "likely" ? "border-accent/40 bg-accent-soft" : check.fit === "none" ? "border-line bg-subtle" : "border-highlight/40 bg-highlight-soft";
  return (
    <div className={`mt-2 rounded-xl border px-4 py-3 ${tone}`} role="status" aria-live="polite">
      {m && (
        <p>
          <b className="text-[17px]" style={ml}>
            {m.ml}
          </b>
          <span className="ml-2 text-xs text-muted">
            {m.en} · {t(`metre.kind.${m.kind}`)}
          </span>
        </p>
      )}
      {m && <p className="mt-1 text-xs text-muted" style={ml}>{ruleOf(t, check)}</p>}
      <p className={`text-[13px] ${m ? "mt-2" : ""}`}>{t(`metre.fit.${check.fit}`)}</p>
    </div>
  );
}

type T = ReturnType<typeof useT>;

function ruleOf(t: T, check: MetreCheck): string {
  const m = check.metre!;
  switch (m.kind) {
    case "sama":
      return t("metre.rule.ganas", { ganas: ganaNames(m.ganas!), n: patternOf(m).length });
    case "ardhasama":
      return t("metre.rule.ardha", { odd: `${ganaNames(m.ganas!)} (${patternOf(m, true).length})`, even: `${ganaNames(m.even!)} (${patternOf(m, false).length})` });
    case "upajati": {
      const [a, b] = m.of!.map((id) => METRE_NAMES[id] ?? id);
      return t("metre.rule.upajati", { a, b });
    }
    case "anushtup":
      return t("metre.rule.anushtup");
    default: {
      if (m.id === "tharangini") return t("metre.rule.tharangini");
      const [first, second] = m.counts!;
      const groups = (m.groups ?? []).join(" ");
      const a = first.join("/");
      return a === second.join("/") ? t("metre.rule.same", { a, groups }) : t("metre.rule.pair", { a, b: second.join("/"), groups });
    }
  }
}

const METRE_NAMES: Record<string, string> = { indravajra: "ഇന്ദ്രവജ്ര", upendravajra: "ഉപേന്ദ്രവജ്ര", vamsastham: "വംശസ്ഥം", indravamsa: "ഇന്ദ്രവംശ" };

function Line({ line, onPick }: { line: LineCheck; onPick: (start: number, end: number) => void }) {
  const t = useT();
  // syllables by gana group, so the groups show with a little space between them; with no metre
  // (free verse) every syllable stands alone so the line can wrap anywhere; a word-final ് left
  // uncounted stays with the syllable before it
  const groups: { key: number; items: LineCheck["syllables"] }[] = [];
  for (const s of line.syllables) {
    const last = groups[groups.length - 1];
    if (last && (s.counted ? s.group >= 0 && last.key === s.group : true)) last.items.push(s);
    else groups.push({ key: s.counted ? s.group : -1, items: [s] });
  }
  return (
    <li className={`min-w-0 rounded-xl border px-3 py-2.5 ${line.ok ? "border-line" : "border-highlight/50"}`}>
      <div className={`flex flex-wrap gap-y-1.5 ${groups.some((g) => g.key >= 0) ? "gap-x-2" : "gap-x-0.5"}`} style={ml}>
        {groups.map((g, gi) => (
          <span key={gi} className="inline-flex max-w-full flex-wrap gap-0.5">
            {g.items.map((s, si) => (
              <button
                key={si}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(s.start, s.end)}
                title={s.wrong ? t(s.weight === "L" ? "metre.wantGuru" : "metre.wantLaghu") : !s.counted ? t("metre.uncounted") : undefined}
                className={`relative flex min-w-[1.6rem] flex-col items-center rounded-md px-0.5 py-0.5 transition-colors hover:bg-subtle ${
                  s.wrong ? "bg-highlight-soft text-highlight ring-1 ring-highlight/50" : !s.counted ? "opacity-45" : ""
                }`}
              >
                <span className="text-[15px] leading-tight" style={ml}>
                  {s.text}
                </span>
                <span aria-hidden className={`font-mono text-[11px] leading-none ${s.wrong ? "" : "text-muted"}`}>
                  {s.counted ? (s.weight === "G" ? "–" : "∪") : "·"}
                </span>
                <span className="sr-only">{s.counted ? t(s.weight === "G" ? "metre.guru" : "metre.laghu") : t("metre.uncounted")}</span>
              </button>
            ))}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        {t("metre.line", { count: line.count, matras: line.matras })}
        {line.expected !== undefined && line.expected !== line.count && <b className="ml-1.5 font-semibold text-highlight">{t("metre.needs", { n: line.expected })}</b>}
      </p>
    </li>
  );
}
