/**
 * Punctuation and spacing checks: plain rules, free and offline, that are almost never wrong.
 * Doubled ?? and !! and the ellipsis are left alone (writers use them on purpose), and so is
 * spacing at the start of a line (poems indent with it). Dependency-free; shared by the apps
 * and the litma-spell Edge Function.
 */

export type PunctRule = "spaceBefore" | "spaceAfter" | "doubleSpace" | "doubleComma";

export interface PunctIssue {
  from: number;
  to: number;
  text: string;
  rule: PunctRule;
  fix: string;
}

const ML = "ഀ-ൿ";

export function punctuationIssues(text: string): PunctIssue[] {
  const out: PunctIssue[] = [];
  const add = (from: number, to: number, rule: PunctRule, fix: string) => {
    if (out.some((o) => from < o.to && to > o.from)) return;
    out.push({ from, to, text: text.slice(from, to), rule, fix });
  };
  // a word, then spaces, then , . ; ? ! (not an ellipsis): "പോയി ," → "പോയി,"
  for (const m of text.matchAll(new RegExp(`([${ML}A-Za-z0-9)"'”’])( +)([,.;?!])(?!\\.)`, "gu"))) {
    const at = m.index! + m[1].length;
    add(at, at + m[2].length + 1, "spaceBefore", m[3]);
  }
  // , ; ? ! or a full stop right before a Malayalam letter: "പോയി,വന്നു" → "പോയി, വന്നു"
  for (const m of text.matchAll(new RegExp(`([${ML}])([,;?!.])(?=[${ML}])`, "gu"))) {
    const at = m.index! + m[1].length;
    add(at, at + 1, "spaceAfter", `${m[2]} `);
  }
  // two commas
  for (const m of text.matchAll(/,{2,}/g)) add(m.index!, m.index! + m[0].length, "doubleComma", ",");
  // more than one space between two words (not at the start of a line)
  for (const m of text.matchAll(/(?<=\S) {2,}(?=\S)/g)) add(m.index!, m.index! + m[0].length, "doubleSpace", " ");
  return out.sort((a, b) => a.from - b.from);
}
