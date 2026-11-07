"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/Select";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { InkDots, ListSkeleton } from "@/components/ui/Skeleton";
import { MalayalamKeyboardSettings } from "./KeyboardTools";
import { Check, Copy, CornerDownLeft, History, Inbox, RotateCcw, Square, X } from "lucide-react";
import { AI_ACTIONS, type AIAction } from "@litma/shared/ai-prompts";
import { store } from "@/lib/store";
import { aiStream, listAiKeys, type AIProvider } from "@/lib/functions";
import { BASE } from "@/lib/config";
import type { DocKind, DocSettings, DocVersion, LitmaDoc, Suggestion } from "@/lib/types";
import { FONTS } from "@/lib/templates";
import { PAGE_SIZES, type PageSizeKey } from "@/extensions/pagination";
import { collectCharacters } from "@/extensions/screenplay";
import { manglish } from "@litma/shared/manglish";
import { useT } from "@/i18n/react";
import { useConfirm } from "@/components/ui/Confirm";

const BILLING: Record<AIProvider, [string, string]> = {
  anthropic: ["Anthropic Console", "https://console.anthropic.com/settings/billing"],
  openai: ["OpenAI Platform", "https://platform.openai.com/settings/organization/billing"],
  gemini: ["Google AI Studio", "https://aistudio.google.com/usage"],
};

/** Turn a provider's raw error into one plain sentence the writer can act on. */
function friendlyAIError(raw: string, provider: AIProvider): string {
  const [where] = BILLING[provider];
  const m = raw.toLowerCase();
  if (/credit balance|insufficient_quota|billing|exceeded your current quota|payment/.test(m))
    return `Your ${where} account has no API credit left. API use is billed separately from chat plans like Claude Pro or ChatGPT Plus. Add credit in ${where}, then try again.`;
  if (/invalid x-api-key|invalid api key|incorrect api key|api key not valid|authentication_error|401/.test(m))
    return "That API key wasn't accepted. Check it, or save a new one in Settings → AI.";
  if (/no .*key|add .*key|missing.*key/.test(m)) return "Add your API key in Settings → AI to use the companion.";
  if (/rate.?limit|429|overloaded|529/.test(m)) return "The AI service is busy right now. Wait a moment and try again.";
  const msg = raw.match(/"message"\s*:\s*"([^"]+)"/)?.[1];
  return msg ?? (raw.length > 240 ? raw.slice(0, 240) + "…" : raw) ?? "The assistant didn't respond.";
}

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>;

/** Insert plain text (with line breaks as paragraphs) at the cursor or over the selection. */
export function insertText(editor: Editor, text: string, replace = false) {
  const paras = text.replace(/\r/g, "").split(/\n{2,}|\n/).map((t) => t.trim());
  const content: JSONContent[] = paras.map((t) => (t ? { type: "paragraph", content: [{ type: "text", text: t }] } : { type: "paragraph" }));
  const chain = editor.chain().focus();
  if (!replace) chain.setTextSelection(editor.state.selection.to);
  if (paras.length === 1) chain.insertContent(paras[0]).run();
  else chain.insertContent(content).run();
}

// ─── Outline ────────────────────────────────────────────────────────────

export function OutlinePanel({ editor, title = true, labelsEn = false }: { editor: Editor; title?: boolean; labelsEn?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const h = () => {
      clearTimeout(t);
      t = setTimeout(() => force((n) => n + 1), 300);
    };
    editor.on("update", h);
    return () => {
      editor.off("update", h);
      clearTimeout(t);
    };
  }, [editor]);

  const items: { pos: number; label: string; level: number }[] = [];
  let scene = 0;
  let act = 0;
  let dscene = 0;
  let stanza = 0;
  editor.state.doc.forEach((node, pos) => {
    const n = node.type.name;
    const text = node.textContent.trim();
    const v = n === "styledBlock" ? (node.attrs.variant as string) : "";
    if (n === "heading") items.push({ pos, label: text || "—", level: node.attrs.level });
    else if (n === "sceneHeading") items.push({ pos, label: `${++scene}. ${text || "—"}`, level: 1 });
    // a play's acts and scenes are numbered even without words of their own
    else if (v === "act") {
      dscene = 0;
      items.push({ pos, label: `${labelsEn ? "Act" : "അങ്കം"} ${++act}${text ? `: ${text}` : ""}`, level: 1 });
    } else if (v === "scene") items.push({ pos, label: `${labelsEn ? "Scene" : "രംഗം"} ${++dscene}${text ? `: ${text}` : ""}`, level: act ? 2 : 1 });
    else if (v === "stanza") items.push({ pos, label: `${++stanza}${text ? `. ${text}` : ""}`, level: 2 });
    else if (["title", "chapter", "subhead", "part", "dateline", "references"].includes(v) && text)
      items.push({ pos, label: text, level: v === "subhead" || v === "part" ? 2 : 1 });
  });

  const go = (pos: number) => {
    const tr = editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos + 1)));
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <nav aria-label="Outline">
      {title && <H>Outline</H>}
      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">Titles, chapters, scenes and subheads appear here as you write. Click one to jump to it.</p>
      ) : (
        <ul className="space-y-0.5 text-[13.5px]">
          {items.map((it) => (
            <li key={it.pos}>
              <button onClick={() => go(it.pos)} className={`w-full truncate rounded px-2 py-1 text-left hover:bg-subtle ${it.level > 1 ? "pl-5 text-muted" : ""}`}>
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

// ─── AI companion ──────────────────────────────────────────────────────

type Engine = AIProvider | "claude-app";

/**
 * The prompt Litma hands to the Claude app. Claude reads the work through the Litma connector (MCP)
 * and sends its answer back as a suggestion, so it runs on the writer's Claude plan, not API credit.
 */
function claudeAppPrompt(o: { action: AIAction; instruction: string; title: string; docId: string; selection: string }) {
  const task = o.action === "custom" ? o.instruction.trim() : AI_ACTIONS[o.action].label;
  const sel = o.selection.trim();
  const quoted = sel.length > 2500 ? `${sel.slice(0, 1200)}\n[…]\n${sel.slice(-1200)}` : sel;
  return [
    `Using the Litma connector, open my work “${o.title}” (document id ${o.docId}) and read it for context.`,
    `Task: ${task}${o.action !== "custom" && o.instruction.trim() ? `. Also: ${o.instruction.trim()}` : ""}.`,
    sel ? `Work on this passage:\n"""\n${quoted}\n"""` : "Work from where the text ends.",
    o.action === "toEnglish" ? "Write the result in English." : "Write in Malayalam script.",
    "Send the result to my editor with suggest_edit so I can review it: kind “replace” with target_text for a rewritten passage, “insert” for new text, “comment” for lists, ideas or notes. Don't change the document directly.",
  ].join("\n\n");
}

export function getAIPrefs() {
  try {
    return JSON.parse(localStorage.getItem("litma:ai") || "{}") as { provider?: Engine; anthropicKey?: string; openaiKey?: string; geminiKey?: string };
  } catch {
    return {};
  }
}

type Why = "nokey" | "nocredit" | "badkey";

/** What went wrong with an API call, in a form the panel can act on. */
function classifyAIError(raw: string): Why | null {
  const m = raw.toLowerCase();
  if (/credit balance|insufficient_quota|billing|exceeded your current quota|payment/.test(m)) return "nocredit";
  if (/invalid x-api-key|invalid api key|incorrect api key|api key not valid|authentication_error|\b401\b/.test(m)) return "badkey";
  return null;
}

export function AIPanel({ editor, kind, docId, title, onOpenInbox }: { editor: Editor; kind: string; docId: string; title: string; onOpenInbox?: () => void }) {
  const prefs = useMemo(getAIPrefs, []);
  const cloud = store.isCloud();
  const [provider, setProvider] = useState<AIProvider>(prefs.provider && prefs.provider !== "claude-app" ? prefs.provider : "anthropic");
  // which providers this writer has a key for: account keys (cloud) or this browser's keys (local mode)
  const [keyed, setKeyed] = useState<AIProvider[] | null>(null);
  // has this writer connected Litma to an AI assistant? (a Litma token that has been used)
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    if (cloud) {
      listAiKeys()
        .then((k) => setKeyed(k.map((x) => x.provider)))
        .catch(() => setKeyed([]));
      store
        .listTokens()
        .then((t) => setConnected((t as { last_used_at: string | null }[]).some((x) => !!x.last_used_at)))
        .catch(() => setConnected(false));
    } else setKeyed((["anthropic", "openai", "gemini"] as AIProvider[]).filter((p) => !!prefs[`${p}Key` as const]));
  }, [prefs, cloud]);
  const hasKey = keyed?.includes(provider) ?? false;

  const [instruction, setInstruction] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState<AIAction | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [usedSelection, setUsedSelection] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const selRange = useRef<{ from: number; to: number } | null>(null);
  // the hand-over to Claude: the request is ready, then (once opened) we point back to the inbox
  const [handoff, setHandoff] = useState<{ prompt: string; why: Why; task: string; opened: boolean } | null>(null);

  const hasSel = !editor.state.selection.empty;

  function prepareHandoff(action: AIAction, selection: string, why: Why) {
    setOut("");
    setErr(null);
    setHandoff({ prompt: claudeAppPrompt({ action, instruction, title, docId, selection }), why, task: action === "custom" ? instruction.trim() : AI_ACTIONS[action].label, opened: false });
  }

  function openClaude() {
    if (!handoff) return;
    navigator.clipboard?.writeText(handoff.prompt).catch(() => {});
    window.open(`https://claude.ai/new?q=${encodeURIComponent(handoff.prompt)}`, "_blank", "noopener");
    setHandoff({ ...handoff, opened: true });
  }

  async function run(action: AIAction) {
    const { from, to, empty } = editor.state.selection;
    const selection = empty ? "" : editor.state.doc.textBetween(from, to, "\n");
    setHandoff(null);
    if (!hasKey) {
      // without cloud sync there is no Litma connector for Claude to use, so a key is the only way
      if (!cloud) return setErr("Add your API key in Settings → AI to use the companion.");
      return prepareHandoff(action, selection, "nokey");
    }
    const context = editor.state.doc.textBetween(0, from, "\n").slice(-6000);
    selRange.current = empty ? null : { from, to };
    setUsedSelection(!empty);
    setOut("");
    setErr(null);
    setBusy(action);
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    try {
      const r = await aiStream(
        {
          provider,
          // signed-in writers use the key saved to their account; local mode uses this browser's key
          apiKey: cloud ? undefined : prefs[`${provider}Key` as const],
          action,
          kind,
          selection,
          context,
          instruction,
        },
        ac.signal
      );
      if (!r.ok || !r.body) {
        const raw = await r.text();
        const why = classifyAIError(raw);
        // a key without credit (or a rejected key): don't strand the writer, offer Claude instead
        if (why && cloud) return prepareHandoff(action, selection, why);
        throw new Error(friendlyAIError(raw, provider));
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        setOut((o) => o + dec.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr((e as Error).message || "The assistant didn't respond.");
    } finally {
      setBusy(null);
    }
  }

  const replace = () => {
    const r = selRange.current;
    if (!r) return;
    editor.chain().focus().setTextSelection(r).run();
    insertText(editor, out.trim(), true);
  };

  const providerName = provider === "anthropic" ? "Claude" : provider === "openai" ? "GPT" : "Gemini";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-subtle/60 py-2 pl-3.5 pr-2">
        <span className="text-[13px] font-medium text-muted">Answer with</span>
        <Select
          size="sm"
          className="min-w-28"
          aria-label="AI provider"
          value={provider}
          onChange={(x) => {
            const v = x as AIProvider;
            setHandoff(null);
            setProvider(v);
            try {
              localStorage.setItem("litma:ai", JSON.stringify({ ...getAIPrefs(), provider: v }));
            } catch {}
          }}
          options={[
            { value: "anthropic", label: "Claude", hint: keyed?.includes("anthropic") ? "Your API key" : "Opens Claude" },
            { value: "openai", label: "GPT", hint: keyed?.includes("openai") ? "Your API key" : "No key added" },
            { value: "gemini", label: "Gemini", hint: keyed?.includes("gemini") ? "Your API key" : "No key added" },
          ]}
        />
      </div>
      {/* actions in two groups: what works on the whole piece, and what needs a selection */}
      {(
        [
          { id: "work", label: "For the whole work", hint: "Uses the text around your cursor.", dot: "bg-tint-violet", sel: false },
          { id: "sel", label: "For selected text", hint: hasSel ? "Working on your selection." : "Select a passage first.", dot: "bg-tint-coral", sel: true },
        ] as const
      ).map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <span aria-hidden className={`size-1.5 rounded-full ${g.dot}`} />
            {g.label}
          </h3>
          <p className="mt-1 text-xs text-muted">{g.hint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(AI_ACTIONS) as AIAction[])
              .filter((a) => a !== "custom" && AI_ACTIONS[a].needsSelection === g.sel)
              .map((a) => {
                const meta = AI_ACTIONS[a];
                const disabled = !!busy || (meta.needsSelection && !hasSel);
                return (
                  <button
                    key={a}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run(a)}
                    disabled={disabled}
                    title={meta.label}
                    aria-label={meta.label}
                    className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:bg-subtle/60 disabled:text-muted ${busy === a ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:border-accent hover:bg-accent-soft hover:text-accent"}`}
                  >
                    {meta.ml}
                  </button>
                );
              })}
          </div>
        </section>
      ))}

      <div className="border-t border-line pt-5">
        <h3 className="mb-3 text-[13px] font-semibold text-ink">Ask in your own words</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (instruction.trim()) run("custom");
        }}
        className="flex gap-2"
      >
        <input className="field !py-2 !text-sm" placeholder="Ask anything about your text…" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
        <button className="btn btn-accent !px-3" disabled={!!busy || !instruction.trim()} aria-label="Ask">
          <CornerDownLeft size={15} />
        </button>
      </form>
      </div>

      {/* ── Hand-over to Claude ── */}
      {handoff && (
        <div className="rounded-xl border border-line bg-paper p-4 text-sm leading-relaxed" role="status">
          {connected === false ? (
            <>
              <p className="font-semibold text-ink">Connect Litma to Claude first</p>
              <p className="mt-1 text-muted">
                {handoff.why === "nocredit" ? "Your API key has no credits, so Claude needs to work on this from your Claude account. " : handoff.why === "badkey" ? "Your API key didn’t work, so Claude needs to work on this from your Claude account. " : ""}
                To do that, add the Litma connector to Claude once. It takes about a minute, then come back and tap the action again.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="btn btn-primary !px-3 !py-2 !text-sm" href={`${BASE}/settings/#mcp`} target="_blank" rel="noreferrer">
                  Set up in Settings
                </a>
                <button className="btn btn-ghost !px-3 !py-2 !text-sm" onClick={() => setConnected(true)}>
                  I’ve connected it
                </button>
              </div>
            </>
          ) : !handoff.opened ? (
            <>
              <p className="font-semibold text-ink">{handoff.why === "nocredit" ? "Your API key needs credits" : handoff.why === "badkey" ? "Your API key didn’t work" : "Get help from Claude"}</p>
              <p className="mt-1 text-muted">
                {handoff.why === "nocredit"
                  ? `The ${providerName} API is paid for separately from chat plans, and your key has no credits left. If you have a Claude plan, Litma can take you to Claude with this request ready.`
                  : handoff.why === "badkey"
                    ? "The saved key was not accepted. If you have a Claude plan, Litma can take you to Claude with this request ready."
                    : "Litma will open Claude with this request ready."}{" "}
                Claude reads this work and sends its suggestion back to Litma. Then come back here and check the Assistant inbox.
              </p>
              <p className="mt-2 text-xs text-muted">
                Request: <b className="text-ink">{handoff.task}</b>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="btn btn-primary !px-3 !py-2 !text-sm" onClick={openClaude}>
                  Open Claude
                </button>
                <button className="btn btn-ghost !px-3 !py-2 !text-sm" onClick={() => setHandoff(null)}>
                  Cancel
                </button>
              </div>
              <p className="mt-3 text-xs text-muted">
                {handoff.why === "nocredit" ? (
                  <>
                    Prefer answers right here?{" "}
                    <a className="text-accent underline" href={BILLING[provider][1]} target="_blank" rel="noreferrer">
                      Add API credits
                    </a>
                  </>
                ) : (
                  <>
                    Prefer answers right here?{" "}
                    <a className="text-accent underline" href={`${BASE}/settings/`} target="_blank" rel="noreferrer">
                      {handoff.why === "badkey" ? "Update your API key" : "Add an API key"}
                    </a>
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">Opened in Claude</p>
              <p className="mt-1 text-muted">Send the message in Claude. When Claude has finished, come back to Litma and open the Assistant inbox to accept or dismiss its suggestion.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {onOpenInbox && (
                  <button className="btn btn-primary !px-3 !py-2 !text-sm" onClick={onOpenInbox}>
                    <Inbox size={15} /> Open Assistant inbox
                  </button>
                )}
                <button className="btn btn-outline !px-3 !py-2 !text-sm" onClick={openClaude}>
                  Open Claude again
                </button>
                <button className="btn btn-ghost !px-3 !py-2 !text-sm" onClick={() => setHandoff(null)}>
                  Close
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">The request is also on your clipboard, in case the Claude tab didn’t open.</p>
            </>
          )}
        </div>
      )}

      {!handoff && (out || busy || err) && (
        <div className="rounded-lg border border-line bg-paper">
          <div className="max-h-[46vh] overflow-y-auto whitespace-pre-wrap p-3 text-[14.5px] leading-relaxed" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
            {err ? (
              <span className="block text-[13px] leading-relaxed text-danger" style={{ fontFamily: "var(--font-ui)" }}>
                {err}
              </span>
            ) : (
              out
            )}
            {busy && !out && <InkDots className="py-1.5" />}
          </div>
          <div className="flex flex-wrap gap-1 border-t border-line p-1.5">
            {busy ? (
              <button className="btn btn-ghost !px-2 !py-1 !text-xs" onClick={() => abort.current?.abort()}>
                <Square size={13} /> Stop
              </button>
            ) : (
              out && (
                <>
                  <button className="btn btn-ghost !px-2 !py-1 !text-xs" onClick={() => insertText(editor, out.trim())}>
                    <CornerDownLeft size={13} /> Insert
                  </button>
                  {usedSelection && (
                    <button className="btn btn-ghost !px-2 !py-1 !text-xs" onClick={replace}>
                      <Check size={13} /> Replace selection
                    </button>
                  )}
                  <button className="btn btn-ghost !px-2 !py-1 !text-xs" onClick={() => navigator.clipboard.writeText(out)}>
                    <Copy size={13} /> Copy
                  </button>
                </>
              )
            )}
          </div>
        </div>
      )}
      <p className="text-[11.5px] leading-snug text-muted">
        {hasKey ? "Answers appear here, using your own API key." : cloud ? "No API key added: Litma hands the request to Claude and the answer comes back to the Assistant inbox." : "Add an API key in Settings → AI to use the companion."}
      </p>
    </div>
  );
}

// ─── MCP suggestions inbox ──────────────────────────────────────────────

export function InboxPanel({ editor, docId, onCount }: { editor: Editor; docId: string; onCount: (n: number) => void }) {
  const t = useT();
  const [items, setItems] = useState<Suggestion[]>([]);
  // Copy only copies: the suggestion stays until the writer applies or dismisses it
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (s: Suggestion) => {
    try {
      await navigator.clipboard.writeText(s.content);
      setCopied(s.id);
      setTimeout(() => setCopied((c) => (c === s.id ? null : c)), 1600);
    } catch {
      /* clipboard blocked: the text can still be selected and copied by hand */
    }
  };
  useEffect(() => {
    let alive = true;
    const load = () => store.listSuggestions(docId).then((s) => alive && (setItems(s), onCount(s.length)));
    load();
    const off = store.subscribeSuggestions(docId, load);
    return () => {
      alive = false;
      off();
    };
  }, [docId, onCount]);

  const act = async (s: Suggestion, accept: boolean) => {
    if (accept) {
      if (s.kind === "replace" && s.target_text) {
        let done = false;
        editor.state.doc.descendants((node, pos) => {
          if (done || !node.isText || !node.text) return;
          const i = node.text.indexOf(s.target_text!);
          if (i >= 0) {
            editor.chain().focus().insertContentAt({ from: pos + i, to: pos + i + s.target_text!.length }, s.content).run();
            done = true;
          }
        });
        if (!done) insertText(editor, s.content);
      } else if (s.kind !== "comment") insertText(editor, s.content);
    }
    await store.setSuggestionStatus(s.id, accept ? "accepted" : "dismissed");
    setItems((x) => {
      const next = x.filter((y) => y.id !== s.id);
      onCount(next.length);
      return next;
    });
  };

  if (!store.isCloud())
    return (
      <div>
        <p className="text-sm leading-relaxed text-muted">Connect Supabase to let any AI assistant read this work over MCP and send suggestions here.</p>
      </div>
    );

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          No suggestions yet. In Claude or another MCP client, ask: “Read my Litma document and suggest a stronger opening.” Suggestions arrive here live.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.id} className="rounded-lg border border-line bg-paper p-3">
              <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-muted">
                <span className="font-semibold text-highlight">{s.source}</span>
                <span>{s.kind === "replace" ? "Replace" : s.kind === "comment" ? "Note" : "Insert"}</span>
              </div>
              {s.target_text && <p className="mb-1 text-xs text-muted line-through">{s.target_text}</p>}
              <p className="select-text whitespace-pre-wrap text-[14px] leading-relaxed" style={{ fontFamily: "'Noto Serif Malayalam'" }}>
                {s.content}
              </p>
              {s.note && <p className="mt-1.5 text-xs text-muted">{s.note}</p>}
              <div className="mt-2 flex gap-1">
                {s.kind !== "comment" && (
                  <button className="btn btn-primary !px-2 !py-1 !text-xs" onClick={() => act(s, true)}>
                    <Check size={13} /> {s.kind === "replace" ? "Replace" : "Insert"}
                  </button>
                )}
                <button className="btn btn-ghost !px-2 !py-1 !text-xs" onClick={() => copy(s)} aria-live="polite">
                  {copied === s.id ? <Check size={13} /> : <Copy size={13} />} {copied === s.id ? t("app.inbox.copied") : t("app.inbox.copy")}
                </button>
                <button className="btn btn-ghost !px-2 !py-1 !text-xs" onClick={() => act(s, false)}>
                  <X size={13} /> {t("app.inbox.dismiss")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Notes & characters ────────────────────────────────────────────────

export function NotesPanel({ editor, settings, onChange, kind }: { editor: Editor; settings: DocSettings; onChange: (p: Partial<DocSettings>) => void; kind: string }) {
  const detected = kind === "screenplay" || kind === "drama" ? collectCharacters(editor.state.doc) : [];
  const chars = settings.characters ?? [];
  const names = new Set(chars.map((c) => c.name));
  const all = [...chars, ...detected.filter((d) => !names.has(d)).map((name) => ({ name, note: "" }))];
  const setChar = (name: string, note: string) => {
    const exists = chars.some((c) => c.name === name);
    onChange({ characters: exists ? chars.map((c) => (c.name === name ? { ...c, note } : c)) : [...chars, { name, note }] });
  };
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-5">
      <div>
        <H>Notes</H>
        <textarea
          className="field min-h-40 !text-[14px] leading-relaxed"
          placeholder="Plot points, research, reminders…"
          value={settings.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          style={{ fontFamily: "'Noto Sans Malayalam'" }}
        />
      </div>
      <div>
        <H>Characters</H>
        {all.length === 0 && <p className="mb-2 text-sm text-muted">Keep a short sketch for each character.</p>}
        <ul className="space-y-2">
          {all.map((c) => (
            <li key={c.name}>
              <div className="mb-0.5 flex items-center justify-between text-sm font-semibold">
                {c.name}
                <button className="text-muted hover:text-danger" aria-label={`Remove ${c.name}`} onClick={() => onChange({ characters: chars.filter((x) => x.name !== c.name) })}>
                  <X size={13} />
                </button>
              </div>
              <input className="field !py-1 !text-[13px]" placeholder="Age, temperament, arc…" value={c.note} onChange={(e) => setChar(c.name, e.target.value)} />
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const n = newName.trim();
            if (n && !names.has(n)) onChange({ characters: [...chars, { name: manglish(n), note: "" }] });
            setNewName("");
          }}
        >
          <input className="field !py-1 !text-[13px]" placeholder="Add a character (Manglish ok)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-outline !px-2 !py-1 !text-xs">Add</button>
        </form>
      </div>
    </div>
  );
}

// ─── Version history ───────────────────────────────────────────────────

export function HistoryPanel({ editor, doc, onSnapshot }: { editor: Editor; doc: LitmaDoc; onSnapshot: (label: string | null) => Promise<void> }) {
  const t = useT();
  const [confirmDialog, ask] = useConfirm();
  const [versions, setVersions] = useState<DocVersion[] | null>(null);
  const [label, setLabel] = useState("");
  const load = () => store.listVersions(doc.id).then(setVersions);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  return (
    <>
      {confirmDialog}
    <div>
      <form
        className="mb-4 flex gap-1.5"
        onSubmit={async (e) => {
          e.preventDefault();
          await onSnapshot(label.trim() || null);
          setLabel("");
          load();
        }}
      >
        <input className="field !py-1.5 !text-[13px]" placeholder="Name this version (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn btn-primary !px-2.5 !py-1.5 !text-xs">Save</button>
      </form>
      {!versions ? (
        <ListSkeleton rows={4} />
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted">Litma saves a version automatically every 10 minutes while you write. Press Ctrl+S to save one now.</p>
      ) : (
        <ul className="space-y-1">
          {versions.map((v) => (
            <li key={v.id} className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-subtle">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium">{v.label || new Date(v.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
                <div className="text-[11.5px] text-muted">
                  {v.label && new Date(v.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) + " · "}
                  {v.word_count} words
                </div>
              </div>
              <button
                className="btn btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Restore this version"
                aria-label="Restore this version"
                onClick={async () => {
                  if (!(await ask({ title: t("app.history.restoreTitle"), body: t("app.history.restoreBody"), confirm: t("common.restore") }))) return;
                  await onSnapshot("Before restore");
                  editor.commands.setContent(v.content, true);
                  load();
                }}
              >
                <RotateCcw size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-muted">
        <History size={12} /> {store.isCloud() ? "Stored in your Supabase project." : "Stored in this browser."}
      </p>
    </div>
    </>
  );
}

// ─── Akshara palette & Manglish guide ───────────────────────────────────

const PALETTE: [string, string[]][] = [
  ["സ്വരം", "അ ആ ഇ ഈ ഉ ഊ ഋ എ ഏ ഐ ഒ ഓ ഔ അം അഃ".split(" ")],
  ["ചിഹ്നം", "ാ ി ീ ു ൂ ൃ െ േ ൈ ൊ ോ ൌ ൗ ് ം ഃ".split(" ")],
  ["വ്യഞ്ജനം", "ക ഖ ഗ ഘ ങ ച ഛ ജ ഝ ഞ ട ഠ ഡ ഢ ണ ത ഥ ദ ധ ന പ ഫ ബ ഭ മ യ ര ല വ ശ ഷ സ ഹ ള ഴ റ".split(" ")],
  ["ചില്ല്", "ൺ ൻ ർ ൽ ൾ ൿ".split(" ")],
  ["കൂട്ടക്ഷരം", "ക്ക ങ്ങ ഞ്ഞ ട്ട ണ്ട ത്ത ന്ന ന്റ റ്റ മ്പ ല്ല ള്ള ക്ഷ ശ്ര സ്ത".split(" ")],
  ["അക്കം", "൦ ൧ ൨ ൩ ൪ ൫ ൬ ൭ ൮ ൯ ൰ ൱".split(" ")],
  ["ചിഹ്നങ്ങൾ", "‘ ’ “ ” — – … ॥ । ₹ ⁂ ©".split(" ")],
];

const GUIDE: [string, string][] = [
  ["a  aa / A", "അ  ആ"],
  ["i  ee / I", "ഇ  ഈ"],
  ["u  oo / U", "ഉ  ഊ"],
  ["e  E · o  O", "എ ഏ · ഒ ഓ"],
  ["t / T · th", "ട · ത"],
  ["d · D · dh", "ദ · ഡ · ധ"],
  ["n · N · nj · ng", "ന · ണ · ഞ · ങ്ങ"],
  ["l · L · zh", "ല · ള · ഴ"],
  ["r · R · rr", "ര · റ · റ"],
  ["s · S · sh", "സ · ശ · ഷ"],
  ["nt · nd · mp", "ന്റ · ണ്ട · മ്പ"],
  ["avan · avaL", "അവൻ · അവൾ"],
  ["~  _", "് (ചന്ദ്രക്കല) · break"],
];

export function KeysPanel({ editor }: { editor: Editor }) {
  return (
    <div className="space-y-4">
      <MalayalamKeyboardSettings editor={editor} />
      {PALETTE.map(([label, keys]) => (
        <div key={label}>
          <div className="mb-1 text-xs text-muted">{label}</div>
          <div className="flex flex-wrap gap-1">
            {keys.map((k) => (
              <button
                key={k}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().insertContent(k).run()}
                className="grid h-8 min-w-8 place-items-center rounded-md border border-line bg-paper px-1 text-[16px] hover:border-accent hover:text-accent"
                style={{ fontFamily: "'Noto Sans Malayalam'" }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <div className="mb-1.5 mt-2 text-sm font-semibold">Manglish guide</div>
        <table className="w-full text-[13px]">
          <tbody>
            {GUIDE.map(([a, b]) => (
              <tr key={a} className="border-b border-line/60">
                <td className="py-1 font-mono text-[12px] text-muted">{a}</td>
                <td className="py-1" style={{ fontFamily: "'Noto Sans Malayalam'" }}>
                  {b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11.5px] leading-snug text-muted">Google Input Tools predictions fix most spellings automatically, so “nammude” becomes നമ്മുടെ even without capitals.</p>
      </div>
    </div>
  );
}

// ─── Page setup ────────────────────────────────────────────────────────

export function PagePanel({ kind, settings, onChange, showMetreOption }: { kind: DocKind; settings: DocSettings; onChange: (p: Partial<DocSettings>) => void; showMetreOption: boolean }) {
  const t = useT();
  const m = settings.margins;
  const setM = (k: keyof typeof m, v: number) => onChange({ margins: { ...m, [k]: Math.max(5, Math.min(60, v || 0)) } });
  return (
    <div className="space-y-4 text-sm">
      <div>
        <Select
          label="Paper size"
          labelClassName="mb-1 block text-xs text-muted"
          className="w-full"
          value={settings.pageSize}
          onChange={(v) => onChange({ pageSize: v as PageSizeKey })}
          options={(Object.keys(PAGE_SIZES) as PageSizeKey[]).map((k) => ({ value: k, label: `${PAGE_SIZES[k].label}${k === "A4" ? " (default)" : ""}` }))}
        />
      </div>
      <fieldset>
        <legend className="mb-1 text-xs text-muted">Margins (mm)</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {(["top", "bottom", "left", "right"] as const).map((k) => (
            <label key={k} className="text-[11px] text-muted">
              {k}
              <input type="number" className="field !px-1.5 !py-1 !text-[13px]" value={m[k]} onChange={(e) => setM(k, Number(e.target.value))} />
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Select
          label="Document font"
          labelClassName="mb-1 block text-xs text-muted"
          className="w-full"
          value={settings.font}
          onChange={(v) => onChange({ font: v })}
          options={FONTS.map((f) => ({ value: f.name, label: f.name, text: f.name, hint: f.note, style: { fontFamily: `'${f.name}'` } }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-xs text-muted">Size (pt)</span>
          <input type="number" step={0.5} min={8} max={24} className="field !py-1.5" value={settings.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) || 12 })} />
        </label>
        <div>
          <Select
            label="Line spacing"
            labelClassName="mb-1 block text-xs text-muted"
            className="w-full"
            value={String(settings.lineHeight)}
            onChange={(v) => onChange({ lineHeight: Number(v) })}
            options={[...new Set([1.3, 1.5, 1.65, 1.75, 1.8, 1.9, 2, 2.4, settings.lineHeight])].sort((a, b) => a - b).map((v) => ({ value: String(v), label: String(v) }))}
          />
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Running header</span>
        <input className="field !py-1.5" placeholder="Shown at the top of pages 2 onwards" value={settings.header ?? ""} onChange={(e) => onChange({ header: e.target.value })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Word goal for this work</span>
        <input type="number" min={0} step={100} className="field !py-1.5" value={settings.goal ?? 0} onChange={(e) => onChange({ goal: Number(e.target.value) || 0 })} />
      </label>
      {showMetreOption && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!settings.showMetre} onChange={(e) => onChange({ showMetre: e.target.checked })} className="accent-[var(--accent)]" />
          Show akshara count and laghu (∪) / guru (–) marks
        </label>
      )}
      {(kind === "novel" || kind === "story") && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!settings.chapterNumbers} onChange={(e) => onChange({ chapterNumbers: e.target.checked })} className="accent-[var(--accent)]" />
          {t("editor.page.chapterNumbers")}
        </label>
      )}
      {(kind === "screenplay" || kind === "drama") && (
        <Select
          label={t("editor.page.headingLabels")}
          labelClassName="mb-1 block text-xs text-muted"
          className="w-full"
          value={settings.headingLabels ?? (kind === "screenplay" ? "legacy" : "ml")}
          onChange={(v) => onChange({ headingLabels: v === "legacy" ? undefined : (v as "ml" | "en") })}
          options={[
            { value: "ml", label: t(kind === "drama" ? "editor.page.labelsMlDrama" : "editor.page.labelsMl") },
            { value: "en", label: t(kind === "drama" ? "editor.page.labelsEnDrama" : "editor.page.labelsEn") },
            ...(kind === "screenplay" ? [{ value: "legacy", label: t("editor.page.labelsLegacy") }] : []),
          ]}
        />
      )}
      {(kind === "poem" || kind === "lyrics") && (
        <Select
          label={t("editor.page.verseAlign")}
          labelClassName="mb-1 block text-xs text-muted"
          className="w-full"
          value={settings.verseAlign ?? "start"}
          onChange={(v) => onChange({ verseAlign: v as "start" | "center" })}
          options={[
            { value: "start", label: t("editor.page.verseStart") },
            { value: "center", label: t("editor.page.verseCenter") },
          ]}
        />
      )}
    </div>
  );
}
