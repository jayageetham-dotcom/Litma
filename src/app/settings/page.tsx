"use client";
import { useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/lib/auth";
import { MCP_URL } from "@/lib/config";
import { store } from "@/lib/store";
import { getAIPrefs } from "@/components/editor/Panels";

type Token = { id: string; name: string; created_at: string; last_used_at: string | null };

function Code({ children }: { children: string }) {
  return (
    <div className="group relative">
      <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-desk-2 p-3 text-[12px] leading-relaxed">{children}</pre>
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
  const [ai, setAi] = useState(getAIPrefs);
  const [savedAi, setSavedAi] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokenName, setTokenName] = useState("Claude");
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cloud = store.isCloud();

  useEffect(() => {
    setAi(getAIPrefs());
    if (cloud) store.listTokens().then((t) => setTokens(t as Token[]));
  }, [cloud]);

  const saveAi = () => {
    try {
      localStorage.setItem("litma:ai", JSON.stringify(ai));
      setSavedAi(true);
      setTimeout(() => setSavedAi(false), 1600);
    } catch {}
  };

  const url = MCP_URL;
  const tok = fresh ?? "litma_YOUR_TOKEN";

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-12 px-5 pb-24 pt-4">
        <h1 className="text-3xl font-bold">Settings</h1>

        <section>
          <h2 className="text-xl font-semibold">AI writing companion</h2>
          <p className="mt-1 text-sm text-muted">Keys are kept in this browser and sent only with your own requests. Leave empty to use keys configured on the server.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm">Default assistant</span>
              <select className="field" value={ai.provider ?? "anthropic"} onChange={(e) => setAi({ ...ai, provider: e.target.value as "anthropic" | "openai" })}>
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="openai">GPT (OpenAI)</option>
              </select>
            </label>
            <div />
            <label className="block">
              <span className="mb-1 block text-sm">Anthropic API key</span>
              <input className="field font-mono !text-[13px]" type="password" placeholder="sk-ant-…" value={ai.anthropicKey ?? ""} onChange={(e) => setAi({ ...ai, anthropicKey: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Claude model</span>
              <input className="field font-mono !text-[13px]" placeholder="claude-sonnet-5-5" value={ai.anthropicModel ?? ""} onChange={(e) => setAi({ ...ai, anthropicModel: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">OpenAI API key</span>
              <input className="field font-mono !text-[13px]" type="password" placeholder="sk-…" value={ai.openaiKey ?? ""} onChange={(e) => setAi({ ...ai, openaiKey: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">GPT model</span>
              <input className="field font-mono !text-[13px]" placeholder="gpt-4.1-mini" value={ai.openaiModel ?? ""} onChange={(e) => setAi({ ...ai, openaiModel: e.target.value })} />
            </label>
          </div>
          <button className="btn btn-primary mt-4" onClick={saveAi}>
            {savedAi ? "Saved" : "Save AI settings"}
          </button>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Connect AI assistants (MCP)</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Litma is an MCP server at {url}. Claude, ChatGPT, IBM Bob, Cursor or any MCP client can list and read your works, send suggestions to your inbox, append text and transliterate Manglish.
          </p>
          {!cloud ? (
            <p className="mt-4 rounded-lg border border-kasavu/40 bg-kasavu-soft px-4 py-3 text-sm">MCP needs Litma’s cloud sync. Sign in to create tokens.</p>
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
                  <div className="mt-3 rounded-lg border border-kasavu/50 bg-kasavu-soft p-3 text-sm">
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
            <div>
              <h3 className="mb-1.5 font-semibold">Claude Code</h3>
              <Code>{`claude mcp add --transport http litma ${url} --header "Authorization: Bearer ${tok}"`}</Code>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold">Claude Desktop (claude_desktop_config.json)</h3>
              <Code>{JSON.stringify({ mcpServers: { litma: { command: "npx", args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${tok}`] } } }, null, 2)}</Code>
              <p className="mt-1 text-xs text-muted">Or in Claude (web, desktop or mobile): Settings → Connectors → Add custom connector, URL {`${url}?key=${tok}`}</p>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold">ChatGPT (developer mode connector)</h3>
              <Code>{`${url}?key=${tok}`}</Code>
            </div>
            <div>
              <h3 className="mb-1.5 font-semibold">IBM Bob, Cursor, VS Code and other MCP clients (mcp.json)</h3>
              <Code>{JSON.stringify({ mcpServers: { litma: { type: "streamable-http", url, headers: { Authorization: `Bearer ${tok}` } } } }, null, 2)}</Code>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
