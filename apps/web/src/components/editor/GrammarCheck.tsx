"use client";
import { applyFix } from "@/lib/spell-history";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { ArrowRight, Check, ExternalLink, Inbox, Loader2, Sparkles, Square, Wand2, X } from "lucide-react";
import { useT } from "@/i18n/react";
import { store } from "@/lib/store";
import { aiStream, listAiKeys, type AIProvider } from "@/lib/functions";
import { blockText } from "@/extensions/writing-aids";
import { classifyAIError, friendlyAIError, getAIPrefs } from "./Panels";

const ml = { fontFamily: "'Noto Sans Malayalam', var(--font-ui)" } as const;
/** Characters sent per request: small enough for a careful answer, big enough to keep the requests few. */
const CHUNK = 3500;

type Finding = { id: string; wrong: string; right: string; why: string; at: number; state: "open" | "fixed" | "ignored" | "missing" };

/** The text of the textblocks between from and to, with the document position of every character. */
function textIndex(doc: PMNode, from = 0, to = doc.content.size) {
  let text = "";
  const map: number[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const t = blockText(node);
    for (let i = 0; i < t.length; i++) {
      const p = pos + 1 + i;
      if (p < from || p >= to) continue;
      text += t[i];
      map.push(p);
    }
    text += "\n";
    map.push(-1);
    return false;
  });
  return { text, map };
}

/** Split text at line ends into pieces of at most CHUNK characters (a longer line is its own piece). */
function chunks(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK);
    if (end < text.length) {
      const nl = text.lastIndexOf("\n", end);
      if (nl > start) end = nl + 1;
    }
    if (text.slice(start, end).trim()) out.push({ text: text.slice(start, end), start });
    start = end;
  }
  return out;
}

/** The AI's answer → findings. Tolerates text around the JSON. */
function parse(raw: string): { wrong: string; right: string; why: string }[] {
  const a = raw.indexOf("[");
  const b = raw.lastIndexOf("]");
  if (a < 0 || b <= a) return [];
  try {
    const list = JSON.parse(raw.slice(a, b + 1)) as unknown[];
    return list
      .map((x) => x as { wrong?: unknown; right?: unknown; why?: unknown })
      .filter((x) => typeof x.wrong === "string" && typeof x.right === "string" && x.wrong.trim() && x.wrong !== x.right)
      .map((x) => ({ wrong: String(x.wrong), right: String(x.right), why: typeof x.why === "string" ? x.why : "" }));
  } catch {
    return [];
  }
}

/** Where `wrong` is in the document now: the occurrence nearest the position it was found at. */
function locate(doc: PMNode, wrong: string, near: number): { from: number; to: number } | null {
  const { text, map } = textIndex(doc);
  let best: { from: number; to: number } | null = null;
  for (let i = text.indexOf(wrong); i >= 0; i = text.indexOf(wrong, i + 1)) {
    const span = map.slice(i, i + wrong.length);
    if (span.some((p, k) => p < 0 || (k > 0 && p !== span[k - 1] + 1))) continue; // crosses a line or a node
    const r = { from: span[0], to: span[span.length - 1] + 1 };
    if (!best || Math.abs(r.from - near) < Math.abs(best.from - near)) best = r;
  }
  return best;
}

/** The request for Claude when the writer has no API key: each fix comes back to the Assistant inbox. */
function claudeGrammarPrompt(o: { title: string; docId: string; selection: string }) {
  const sel = o.selection.trim();
  const quoted = sel.length > 2500 ? `${sel.slice(0, 1200)}\n[…]\n${sel.slice(-1200)}` : sel;
  return [
    `Using the Litma connector, open my work “${o.title}” (document id ${o.docId}) and read it.`,
    sel ? `Check the spelling, grammar, sandhi and punctuation of this passage:\n"""\n${quoted}\n"""` : "Check the spelling, grammar, sandhi and punctuation of the whole work.",
    "For each mistake, call suggest_edit once with kind “replace”, target_text = the mistaken word or short phrase copied exactly from the work, content = the correction, and note = a short reason in Malayalam. Don't rewrite for style, and don't mark dialect, regional or community words, names, or dialogue written the way people speak. Don't change the document directly. When you have sent them all, tell me how many.",
  ].join("\n\n");
}

/**
 * Grammar inside the Spelling and grammar panel: the AI reads the selection or the whole work (in parts)
 * and each mistake comes back as a card with the fix, ready to apply here. Without an API key the check
 * goes to Claude on the writer's own plan, and the fixes arrive in the Assistant inbox.
 */
export function GrammarCheck({ editor, kind, docId, title, onOpenInbox }: { editor: Editor; kind: string; docId: string; title: string; onOpenInbox: () => void }) {
  const t = useT();
  const cloud = store.isCloud();
  const prefs = useRef(getAIPrefs());
  const [keyed, setKeyed] = useState<AIProvider[] | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [progress, setProgress] = useState<{ part: number; of: number } | null>(null);
  const [error, setError] = useState("");
  const [handoff, setHandoff] = useState<"ready" | "opened" | null>(null);
  const [scopeSel, setScopeSel] = useState(!editor.state.selection.empty);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (cloud)
      listAiKeys()
        .then((k) => setKeyed(k.map((x) => x.provider)))
        .catch(() => setKeyed([]));
    else setKeyed((["anthropic", "openai", "gemini"] as AIProvider[]).filter((p) => !!prefs.current[`${p}Key` as const]));
  }, [cloud]);
  useEffect(() => {
    const on = () => setScopeSel(!editor.state.selection.empty);
    editor.on("selectionUpdate", on);
    return () => {
      editor.off("selectionUpdate", on);
    };
  }, [editor]);
  useEffect(() => () => abort.current?.abort(), []);

  const saved = prefs.current.provider as AIProvider | undefined;
  const provider: AIProvider | null = keyed?.length ? (saved && keyed.includes(saved) ? saved : keyed[0]) : null;
  const providerName = provider === "anthropic" ? "Claude" : provider === "openai" ? "GPT" : provider === "gemini" ? "Gemini" : "";

  const scope = () => {
    const { from, to, empty } = editor.state.selection;
    return empty ? textIndex(editor.state.doc) : textIndex(editor.state.doc, from, to);
  };

  async function check() {
    setError("");
    setHandoff(null);
    if (!provider) {
      if (!cloud) return setError(t("check.ai.needKeyLocal"));
      return setHandoff("ready");
    }
    const { text, map } = scope();
    const parts = chunks(text);
    if (!parts.length) return setFindings([]);
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    const found: Finding[] = [];
    setFindings([]);
    try {
      for (let n = 0; n < parts.length; n++) {
        setProgress({ part: n + 1, of: parts.length });
        const r = await aiStream({ provider, apiKey: cloud ? undefined : prefs.current[`${provider}Key` as const], action: "grammarCheck", kind, selection: parts[n].text, context: "", instruction: "" }, ac.signal);
        if (!r.ok || !r.body) {
          const raw = await r.text();
          const why = classifyAIError(raw);
          if (why && cloud) {
            setHandoff("ready");
            break;
          }
          throw new Error(friendlyAIError(raw, provider));
        }
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let raw = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          raw += dec.decode(value, { stream: true });
        }
        // each finding remembers where it was, so Fix picks the right occurrence even after other edits
        let cursor = 0;
        for (const f of parse(raw)) {
          let i = parts[n].text.indexOf(f.wrong, cursor);
          if (i < 0) i = parts[n].text.indexOf(f.wrong);
          if (i >= 0) cursor = i + f.wrong.length;
          const at = i >= 0 ? map[parts[n].start + i] : -1;
          found.push({ ...f, id: `${n}-${found.length}`, at, state: at >= 0 ? "open" : "missing" });
        }
        setFindings([...found]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || t("check.ai.failed"));
    } finally {
      setProgress(null);
    }
  }

  const stop = () => {
    abort.current?.abort();
    setProgress(null);
  };

  const mark = (id: string, state: Finding["state"]) => setFindings((fs) => fs?.map((f) => (f.id === id ? { ...f, state } : f)) ?? null);

  const fix = (f: Finding) => {
    const r = locate(editor.state.doc, f.wrong, f.at);
    if (!r) return mark(f.id, "missing");
    applyFix(editor, r.from, r.to, f.right);
    mark(f.id, "fixed");
  };
  const show = (f: Finding) => {
    const r = locate(editor.state.doc, f.wrong, f.at);
    if (!r) return mark(f.id, "missing");
    editor.chain().focus().setTextSelection(r).scrollIntoView().run();
  };
  const fixAll = () => {
    // last first, so the positions of the earlier ones stay right
    const open = (findings ?? []).filter((f) => f.state === "open").sort((a, b) => b.at - a.at);
    for (const f of open) fix(f);
  };

  const openClaude = () => {
    const { from, to, empty } = editor.state.selection;
    const prompt = claudeGrammarPrompt({ title, docId, selection: empty ? "" : editor.state.doc.textBetween(from, to, "\n") });
    navigator.clipboard?.writeText(prompt).catch(() => {});
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, "_blank", "noopener");
    setHandoff("opened");
  };

  const open = findings?.filter((f) => f.state === "open") ?? [];
  const busy = !!progress;

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-muted">{t("check.ai.hint")}</p>
      <div className="flex gap-2">
        {busy ? (
          <button type="button" className="btn btn-outline w-full" onClick={stop}>
            <Square size={13} /> {t("check.ai.stop")}
          </button>
        ) : (
          <button type="button" className="btn btn-accent w-full" onClick={check} disabled={keyed === null}>
            <Sparkles size={15} /> {scopeSel ? t("check.ai.checkSelection") : t("check.ai.checkWork")}
          </button>
        )}
      </div>
      {provider && !busy && <p className="mt-1.5 text-center text-[11px] text-muted">{t("check.ai.with", { name: providerName })}</p>}

      {progress && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted" role="status">
          <Loader2 size={13} className="animate-spin" /> {progress.of > 1 ? t("check.ai.part", { n: progress.part, of: progress.of }) : t("check.ai.reading")}
        </p>
      )}
      {error && <p className="mt-3 text-xs font-semibold text-danger">{error}</p>}

      {handoff && (
        <div className="mt-3 rounded-xl border border-line bg-subtle/60 p-3.5 text-[13px] leading-relaxed">
          {handoff === "ready" ? (
            <>
              <p>{t("check.ai.noKey")}</p>
              <button type="button" className="btn btn-primary mt-3 w-full" onClick={openClaude}>
                <ExternalLink size={14} /> {t("check.ai.openClaude")}
              </button>
              <p className="mt-2 text-[11.5px] text-muted">{t("check.ai.connectFirst")}</p>
            </>
          ) : (
            <>
              <p>{t("check.ai.opened")}</p>
              <button type="button" className="btn btn-outline mt-3 w-full" onClick={onOpenInbox}>
                <Inbox size={14} /> {t("check.ai.openInbox")}
              </button>
            </>
          )}
        </div>
      )}

      {findings && !busy && findings.length === 0 && !error && !handoff && (
        <p className="mt-4 flex items-center gap-2 text-muted">
          <Check size={15} className="text-tint-lime" aria-hidden /> {t("check.ai.none")}
        </p>
      )}

      {findings && findings.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted">{t("check.ai.found", { count: open.length })}</p>
            {open.length > 1 && !busy && (
              <button type="button" className="btn btn-outline !px-2.5 !py-1 text-xs" onClick={fixAll}>
                <Wand2 size={13} /> {t("check.ai.fixAll")}
              </button>
            )}
          </div>
          <ul className="space-y-1.5">
            {findings.map((f) => (
              <li key={f.id} className={`rounded-xl border px-3 py-2.5 ${f.state === "open" ? "border-line bg-paper" : "border-transparent bg-subtle/50 opacity-70"}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]" style={ml} data-private>
                  <button type="button" className="text-danger line-through decoration-danger/60 hover:underline" onClick={() => show(f)} disabled={f.state !== "open"} title={t("check.ai.show")}>
                    {f.wrong}
                  </button>
                  <ArrowRight size={13} className="shrink-0 text-muted" aria-hidden />
                  <span className="font-semibold text-ink">{f.right}</span>
                </div>
                {f.why && (
                  <p className="mt-1 text-xs text-muted" style={ml} data-private>
                    {f.why}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  {f.state === "open" ? (
                    <>
                      <button type="button" className="btn btn-primary !px-2.5 !py-1 text-xs" onClick={() => fix(f)}>
                        <Check size={13} /> {t("check.ai.fix")}
                      </button>
                      <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => show(f)}>
                        {t("check.ai.show")}
                      </button>
                      <button type="button" className="btn btn-ghost ml-auto !px-2 !py-1 text-xs text-muted" onClick={() => mark(f.id, "ignored")} aria-label={t("check.ai.ignore")} title={t("check.ai.ignore")}>
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted">{t(`check.ai.state.${f.state}`)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
