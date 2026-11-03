"use client";
import { useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { LanguagePicker } from "@/components/LanguagePicker";
import { AboutLitma } from "@/components/UpdateNotice";
import { UsageSettings } from "@/components/UsageSettings";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/lib/auth";
import { MCP_DIRECT_URL, MCP_URL } from "@/lib/config";
import { store } from "@/lib/store";
import { getAIPrefs } from "@/components/editor/Panels";
import { deleteAiKey, listAiKeys, saveAiKey, type AIProvider, type StoredKey } from "@/lib/functions";

type Token = { id: string; name: string; created_at: string; last_used_at: string | null };

function Code({ children }: { children: string }) {
  return (
    <div className="group relative">
      <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-subtle p-3 text-[12px] leading-relaxed">{children}</pre>
      <button className="absolute right-2 top-2 rounded bg-paper p-1 opacity-0 shadow group-hover:opacity-100" onClick={() => navigator.clipboard.writeText(children)} aria-label="Copy">
        <Copy size={13} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokenName, setTokenName] = useState("Claude");
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cloud = store.isCloud();

  useEffect(() => {
    if (cloud) store.listTokens().then((t) => setTokens(t as Token[]));
  }, [cloud]);

  const url = MCP_URL;
  const tok = fresh ?? "litma_YOUR_TOKEN";

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-12 px-5 pb-24 pt-4">
        <h1 className="text-3xl font-bold">Settings</h1>

        <LanguagePicker />

        <AIKeys />

        <section>
          <h2 className="text-xl font-semibold">Connect AI assistants (MCP)</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Litma is an MCP server at {url}. Connect any AI assistant that supports MCP (Claude, ChatGPT, Cursor, VS Code and others) with your own account. It can then read and write your works, manage Story World, look words up in the dictionary, assemble books and prepare PDFs. Each writer creates their own token below; it only ever sees that writer’s work.
          </p>
          {!cloud ? (
            <p className="mt-4 rounded-lg border border-highlight/40 bg-highlight-soft px-4 py-3 text-sm">MCP needs Litma’s cloud sync. Sign in to create tokens.</p>
          ) : (
            <>
              <div className="mt-5 rounded-xl bg-paper p-5" style={{ boxShadow: "var(--sheet-shadow)" }}>
                <h3 className="font-semibold">Access tokens</h3>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setErr(null);
                    try {
                      const t = await store.createToken(tokenName || "Assistant");
                      setFresh(t);
                      setTokens((await store.listTokens()) as Token[]);
                    } catch (e2) {
                      setErr(e2 instanceof Error ? e2.message : "Couldn't create a token.");
                    }
                  }}
                >
                  <input className="field" value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Token name, e.g. Claude Desktop" />
                  <button className="btn btn-primary shrink-0">
                    <KeyRound size={15} /> Create token
                  </button>
                </form>
                {err && <p className="mt-2 text-sm text-danger">{err}</p>}
                {fresh && (
                  <div className="mt-3 rounded-lg border border-highlight/50 bg-highlight-soft p-3 text-sm">
                    Copy this token now. Litma stores only a hash, so it won’t be shown again.
                    <Code>{fresh}</Code>
                  </div>
                )}
                <ul className="mt-3 divide-y divide-line text-sm">
                  {tokens.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2">
                      <span>
                        <b className="font-medium">{t.name}</b>
                        <span className="ml-2 text-xs text-muted">{t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleString("en-IN")}` : "never used"}</span>
                      </span>
                      <button
                        className="rounded p-1 text-muted hover:text-danger"
                        aria-label={`Revoke ${t.name}`}
                        onClick={async () => {
                          await store.deleteToken(t.id);
                          setTokens((x) => x.filter((y) => y.id !== t.id));
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <div className="mt-6 space-y-5 text-sm">
            <div className="rounded-xl border border-accent/30 bg-accent-soft/60 p-4">
              <h3 className="font-semibold">Claude (web, desktop and mobile app): custom connector</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed">
                <li>Create a token above and copy it.</li>
                <li>
                  In Claude, open <b>Settings → Connectors → Add custom connector</b>.
                </li>
                <li>Name it “Litma” and paste this URL (it already includes your token):</li>
              </ol>
              <div className="mt-2">
                <Code>{`${MCP_DIRECT_URL}?key=${tok}`}</Code>
              </div>
              <p className="mt-2 text-xs text-muted">
                If Claude says it couldn’t work out how the server signs in, choose <b>Continue anyway</b>. The token in the URL is the sign-in. Treat this URL like a password; revoke the token above if it leaks.
              </p>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold">ChatGPT (developer mode connector)</h3>
              <Code>{`${MCP_DIRECT_URL}?key=${tok}`}</Code>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold">Claude Code</h3>
              <Code>{`claude mcp add --transport http litma ${url} --header "Authorization: Bearer ${tok}"`}</Code>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold">Claude Desktop (claude_desktop_config.json)</h3>
              <Code>{JSON.stringify({ mcpServers: { litma: { command: "npx", args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${tok}`] } } }, null, 2)}</Code>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold">Cursor, VS Code and other MCP clients (mcp.json)</h3>
              <Code>{JSON.stringify({ mcpServers: { litma: { type: "streamable-http", url, headers: { Authorization: `Bearer ${tok}` } } } }, null, 2)}</Code>
            </div>
            <p className="text-xs text-muted">
              Apps on your own computer can use {url}. If one can’t connect, use {MCP_DIRECT_URL} instead. It is the same server.
            </p>
          </div>
        </section>
        <UsageSettings />
        <AboutLitma />
      </main>
      <MobileNav />
    </div>
  );
}

const PROVIDERS: { id: AIProvider; name: string; placeholder: string; model: string; keyUrl: string; keyHost: string; billingUrl: string }[] = [
  { id: "anthropic", name: "Claude (Anthropic)", placeholder: "sk-ant-…", model: "claude-sonnet-5-5", keyUrl: "https://console.anthropic.com/settings/keys", keyHost: "Anthropic Console", billingUrl: "https://console.anthropic.com/settings/billing" },
  { id: "openai", name: "GPT (OpenAI)", placeholder: "sk-…", model: "gpt-4.1-mini", keyUrl: "https://platform.openai.com/api-keys", keyHost: "OpenAI Platform", billingUrl: "https://platform.openai.com/settings/organization/billing" },
  { id: "gemini", name: "Gemini (Google)", placeholder: "AIza…", model: "gemini-2.5-flash", keyUrl: "https://aistudio.google.com/app/apikey", keyHost: "Google AI Studio", billingUrl: "https://aistudio.google.com/usage" },
];

/** Each writer's own AI keys: stored encrypted on the server (cloud) or in this browser (local mode). */
function AIKeys() {
  const cloud = store.isCloud();
  const [keys, setKeys] = useState<StoredKey[] | null>(null);
  const [draft, setDraft] = useState<Record<string, { key: string; model: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [def, setDef] = useState<AIProvider>("anthropic");

  useEffect(() => {
    const pv = getAIPrefs().provider;
    setDef(pv && pv !== "claude-app" ? pv : "anthropic");
    if (cloud) listAiKeys().then(setKeys).catch((e) => setMsg({ kind: "error", text: e.message }));
    else setKeys([]);
  }, [cloud]);

  const saved = (p: AIProvider) => keys?.find((k) => k.provider === p);
  const setDefault = (p: AIProvider) => {
    setDef(p);
    try {
      localStorage.setItem("litma:ai", JSON.stringify({ ...getAIPrefs(), provider: p }));
    } catch {}
  };

  async function save(p: AIProvider) {
    const d = draft[p];
    if (!d?.key?.trim()) return;
    setBusy(p);
    setMsg(null);
    try {
      if (cloud) {
        await saveAiKey(p, d.key.trim(), d.model?.trim() || undefined);
        setKeys(await listAiKeys());
      } else {
        localStorage.setItem("litma:ai", JSON.stringify({ ...getAIPrefs(), [`${p}Key`]: d.key.trim() }));
      }
      setDraft((x) => ({ ...x, [p]: { key: "", model: "" } }));
      setMsg({ kind: "info", text: `${PROVIDERS.find((x) => x.id === p)!.name} key saved.` });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Couldn't save the key." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">Your AI keys</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        The writing companion uses your own account with the AI provider, so usage is billed to you and nobody else can use your key.
        {cloud ? " Keys are encrypted on the server and never shown again; only the last four characters are." : " In local mode, keys stay in this browser."}
      </p>
      {cloud && (
        <p className="mt-3 rounded-lg bg-accent-soft px-4 py-3 text-sm leading-relaxed">
          <b>Have Claude Pro or Max?</b> You don’t need an API key. Add the Litma connector to Claude (see <b>MCP</b> below). Without a key, the editor’s AI panel asks before opening Claude with a ready request; Claude reads your work and its answer comes back to the Assistant inbox, on your Claude plan.
        </p>
      )}
      {cloud && keys === null && (
        <div className="mt-5 rounded-xl bg-paper p-4" style={{ boxShadow: "var(--sheet-shadow)" }}>
          <ListSkeleton rows={3} />
        </div>
      )}
      <div className={`mt-5 space-y-4 ${cloud && keys === null ? "hidden" : "fade-in"}`}>
        {PROVIDERS.map((p) => {
          const s = saved(p.id);
          return (
            <div key={p.id} className="rounded-xl bg-paper p-4" style={{ boxShadow: "var(--sheet-shadow)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="radio" name="default-ai" className="accent-[var(--accent)]" checked={def === p.id} onChange={() => setDefault(p.id)} /> Default
                </label>
              </div>
              {s && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-sm">
                  <span>
                    Saved key ••••{s.last4}
                    {s.model ? ` · model ${s.model}` : ""}
                  </span>
                  <button
                    className="text-xs text-danger underline"
                    onClick={async () => {
                      await deleteAiKey(p.id);
                      setKeys(await listAiKeys());
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <form
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(p.id);
                }}
              >
                <input
                  className="field font-mono !text-[13px]"
                  type="password"
                  autoComplete="off"
                  placeholder={s ? "Replace with a new key" : p.placeholder}
                  value={draft[p.id]?.key ?? ""}
                  onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { model: x[p.id]?.model ?? "", key: e.target.value } }))}
                  aria-label={`${p.name} API key`}
                />
                <input
                  className="field font-mono !text-[13px]"
                  placeholder={p.model}
                  value={draft[p.id]?.model ?? ""}
                  onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { key: x[p.id]?.key ?? "", model: e.target.value } }))}
                  aria-label={`${p.name} model (optional)`}
                  title="Model (optional)"
                />
                <button className="btn btn-primary justify-center" disabled={busy === p.id || !draft[p.id]?.key}>
                  {busy === p.id ? <><span className="ink-spinner" aria-hidden /> Saving…</> : "Save key"}
                </button>
              </form>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <a href={p.keyUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
                  Get your {p.name.split(" ")[0]} API key at {p.keyHost} ↗
                </a>
                <a href={p.billingUrl} target="_blank" rel="noreferrer" className="text-muted underline underline-offset-2">
                  Usage &amp; billing ↗
                </a>
              </p>
            </div>
          );
        })}
      </div>
      {msg && <p className={`mt-3 text-sm ${msg.kind === "error" ? "text-danger" : "text-accent"}`}>{msg.text}</p>}
    </section>
  );
}
