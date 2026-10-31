"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  ArrowLeft,
  BookOpen,
  Download,
  Eye,
  FileText,
  Inbox,
  Keyboard,
  ListTree,
  Maximize2,
  Minimize2,
  Minus,
  NotebookPen,
  Plus,
  Settings2,
  Share2,
  Sparkles,
  History as HistoryIcon,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { buildExtensions } from "./extensions";
import { Toolbar } from "./Toolbar";
import { ManglishPopup } from "./ManglishPopup";
import { AIPanel, HistoryPanel, InboxPanel, KeysPanel, NotesPanel, OutlinePanel, PagePanel } from "./Panels";
import { ThemeToggle } from "@/components/ThemeToggle";
import { store } from "@/lib/store";
import { templateFor } from "@/lib/templates";
import type { DocSettings, LitmaDoc } from "@/lib/types";
import { countWords, readingMinutes, aksharas } from "@/shared/manglish";
import { MM, PAGE_GAP_PX, PAGE_SIZES, geometryFor, paginationKey, remeasurePages } from "@/extensions/pagination";
import { metreKey, searchKey } from "@/extensions/tools";
import type { InputMode } from "@/extensions/manglish";
import { exportDocx, exportHTML, exportMarkdown, exportText } from "@/lib/export";
import { BASE, appUrl } from "@/lib/config";
import { ShortcutsDialog } from "./ShortcutsDialog";

type PanelId = "ai" | "inbox" | "notes" | "history" | "keys" | "page";
const PANELS: { id: PanelId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "ai", label: "AI companion", icon: Sparkles },
  { id: "inbox", label: "Assistant inbox (MCP)", icon: Inbox },
  { id: "notes", label: "Notes & characters", icon: NotebookPen },
  { id: "history", label: "Version history", icon: HistoryIcon },
  { id: "keys", label: "Malayalam keyboard", icon: Keyboard },
  { id: "page", label: "Page & type", icon: Settings2 },
];

type SaveState = "saved" | "saving" | "dirty" | "error";

export function Workspace({ initial }: { initial: LitmaDoc }) {
  const template = templateFor(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [settings, setSettings] = useState<DocSettings>(initial.settings);
  const [save, setSave] = useState<SaveState>("saved");
  const [mode, setMode] = useState<InputMode>(initial.settings.inputMode ?? "manglish");
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [outline, setOutline] = useState(true);
  const [focus, setFocus] = useState(false);
  const [typewriter, setTypewriter] = useState(false);
  const [userZoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const deskRef = useRef<HTMLElement | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [isPublic, setIsPublic] = useState(!!initial.is_public);
  const [shareId, setShareId] = useState(initial.share_id ?? null);
  const [menu, setMenu] = useState<"export" | "share" | null>(null);
  const [stats, setStats] = useState({ words: initial.word_count, chars: 0, aksharas: 0, pages: 1 });

  const router = useRouter();
  const [showKeys, setShowKeys] = useState(false);
  const [backup, setBackup] = useState<{ content: LitmaDoc["content"]; at: string } | null>(null);
  /** New documents stay "pristine" until the writer types; pristine documents are discarded on close. */
  const pristine = useRef(!!initial.settings.pristine);
  const docRef = useRef<LitmaDoc>(initial);
  const lastSavedWords = useRef(initial.word_count);
  const lastSnapshot = useRef(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The extension set is fixed for the life of the document.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extensions = useMemo(() => buildExtensions(initial.kind, initial.settings, initial.settings.inputMode ?? "manglish"), []);

  const editor = useEditor({
    extensions,
    content: initial.content,
    immediatelyRender: false,
    autofocus: "end",
    editorProps: {
      attributes: { spellcheck: "false", "aria-label": `${template.en} manuscript`, lang: "ml" },
    },
  });

  // ── persistence ──
  const backupKey = `litma:backup:${initial.id}`;
  const persist = useCallback(
    async (patch: Partial<LitmaDoc>) => {
      setSave("saving");
      try {
        await store.updateDoc(docRef.current.id, patch);
        docRef.current = { ...docRef.current, ...patch };
        setSave("saved");
        if (patch.content) {
          try {
            localStorage.removeItem(backupKey);
          } catch {}
        }
        return true;
      } catch {
        setSave("error");
        // keep an offline copy so nothing is lost if the network drops
        if (patch.content) {
          try {
            localStorage.setItem(backupKey, JSON.stringify({ content: patch.content, at: new Date().toISOString() }));
          } catch {}
        }
        return false;
      }
    },
    [backupKey]
  );

  // Offer to restore an offline copy that never reached the server
  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) return;
      const b = JSON.parse(raw) as { content: LitmaDoc["content"]; at: string };
      if (new Date(b.at) > new Date(initial.updated_at)) setBackup(b);
      else localStorage.removeItem(backupKey);
    } catch {}
  }, [backupKey, initial.updated_at]);

  const saveContent = useCallback(
    async (ed: Editor, snapshotLabel?: string | null) => {
      const content = ed.getJSON();
      const words = countWords(ed.getText({ blockSeparator: "\n" }));
      const patch: Partial<LitmaDoc> = { content, word_count: words };
      if (docRef.current.settings?.pristine && !pristine.current) patch.settings = { ...docRef.current.settings, pristine: false };
      await persist(patch);
      const delta = words - lastSavedWords.current;
      lastSavedWords.current = words;
      if (delta > 0) store.addWordsToday(delta).catch(() => {});
      if (snapshotLabel !== undefined || Date.now() - lastSnapshot.current > 10 * 60 * 1000) {
        lastSnapshot.current = Date.now();
        await store.saveVersion(docRef.current.id, content, words, snapshotLabel ?? null);
      }
    },
    [persist]
  );

  useEffect(() => {
    if (!editor) return;
    let statTimer: ReturnType<typeof setTimeout>;
    const computeStats = () => {
      const text = editor.getText({ blockSeparator: "\n" });
      setStats((s) => ({ ...s, words: countWords(text), chars: text.replace(/\s/g, "").length, aksharas: aksharas(text).length }));
    };
    const onUpdate = () => {
      if (pristine.current) {
        pristine.current = false;
        setSettings((prev) => ({ ...prev, pristine: false }));
      }
      setSave("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveContent(editor), 1200);
      clearTimeout(statTimer);
      statTimer = setTimeout(computeStats, 250);
    };
    const onTx = () => {
      const pages = paginationKey.getState(editor.state)?.pages ?? 1;
      setStats((s) => (s.pages === pages ? s : { ...s, pages }));
    };
    editor.on("update", onUpdate);
    editor.on("transaction", onTx);
    computeStats();
    return () => {
      editor.off("update", onUpdate);
      editor.off("transaction", onTx);
      clearTimeout(statTimer);
    };
  }, [editor, saveContent]);

  // flush on leave — or discard the document if nothing was ever written in it
  const closed = useRef(false);
  const finish = useCallback(async () => {
    if (closed.current) return;
    closed.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (pristine.current) {
      await store.deleteDoc(docRef.current.id).catch(() => {});
    } else if (editor && saveTimer.current) {
      saveTimer.current = null;
      await saveContent(editor);
    }
  }, [editor, saveContent]);

  const goToDesk = useCallback(async () => {
    await finish();
    router.push("/desk/");
  }, [finish, router]);

  // Run `finish` only on real exits (tab close / unmount), never on re-renders.
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const flush = () => {
      finishRef.current();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", flush);
      // deferred so React StrictMode's dev-only remount doesn't count as leaving
      setTimeout(() => {
        if (!mounted.current) flush();
      }, 0);
    };
  }, []);

  // ── settings ──
  const updateSettings = useCallback(
    (patch: Partial<DocSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist({ settings: next });
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    if (!editor) return;
    editor.storage.pagination.geometry = geometryFor(settings.pageSize, settings.margins);
    const showMetre = !!settings.showMetre && !!template.metre;
    if (editor.storage.metre.enabled !== showMetre) {
      editor.storage.metre.enabled = showMetre;
      editor.view.dispatch(editor.state.tr.setMeta(metreKey, true));
    }
    const t = setTimeout(remeasurePages, 60);
    return () => clearTimeout(t);
  }, [editor, settings, template.metre]);

  useEffect(() => {
    if (editor) editor.storage.typewriter.enabled = typewriter;
  }, [editor, typewriter]);

  const changeMode = useCallback(
    (m: InputMode) => {
      setMode(m);
      editor?.commands.setInputMode(m);
      updateSettings({ inputMode: m });
    },
    [editor, updateSettings]
  );

  // keep React state in sync when the mode is toggled by keyboard shortcut
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const m = editor.storage.manglish.mode as InputMode;
      setMode((cur) => (cur === m ? cur : m));
    };
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor]);

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editor) saveContent(editor, "Saved with Ctrl+S");
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocus((f) => !f);
      } else if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
      } else if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      } else if (mod && e.key === "/") {
        e.preventDefault();
        setShowKeys((v) => !v);
      } else if (e.key === "Escape" && focus) {
        setFocus(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, saveContent, focus]);

  const pageSize = PAGE_SIZES[settings.pageSize] ?? PAGE_SIZES.A4;
  // shrink the page to fit narrow screens (phones, side panels open)
  useEffect(() => {
    const el = deskRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const avail = el.clientWidth - 32;
      setFit(Math.min(1, avail / (pageSize.w * MM)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageSize.w]);
  const zoom = +(userZoom * fit).toFixed(3);
  const pageH = pageSize.h * MM;
  const totalH = stats.pages * pageH + (stats.pages - 1) * PAGE_GAP_PX;

  const stackStyle = {
    "--page-w": `${pageSize.w}mm`,
    "--page-h": `${pageSize.h}mm`,
    "--m-top": `${settings.margins.top}mm`,
    "--m-right": `${settings.margins.right}mm`,
    "--m-bottom": `${settings.margins.bottom}mm`,
    "--m-left": `${settings.margins.left}mm`,
    "--doc-font": `'${settings.font}'`,
    "--doc-size": `${settings.fontSize}pt`,
    "--doc-lh": settings.lineHeight,
    height: totalH,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
  } as React.CSSProperties;

  const pageCss = `@page{size:${pageSize.w}mm ${pageSize.h}mm;margin:${settings.margins.top}mm ${settings.margins.right}mm ${settings.margins.bottom}mm ${settings.margins.left}mm}`;

  const goal = settings.goal ?? 0;
  const pct = goal ? Math.min(100, Math.round((stats.words / goal) * 100)) : 0;

  const currentDoc = (): LitmaDoc => ({ ...docRef.current, title, settings, content: editor?.getJSON() ?? docRef.current.content });

  return (
    <div className={`flex h-dvh flex-col ${focus ? "focus-shell" : ""}`}>
      <style>{pageCss}</style>

      {/* ── Top bar ── */}
      {!focus && (
        <header className="no-print flex items-center gap-2 border-b border-line bg-paper px-3 py-2">
          <button onClick={goToDesk} className="btn btn-ghost !p-2" title="Back to desk" aria-label="Back to desk">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title === docRef.current.title) return;
                if (pristine.current) {
                  pristine.current = false;
                  const next = { ...settings, pristine: false };
                  setSettings(next);
                  persist({ title, settings: next });
                } else persist({ title });
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full max-w-xl truncate rounded-md bg-transparent px-1.5 py-0.5 text-[1.05rem] font-semibold hover:bg-desk-2 focus:bg-desk-2 focus:outline-none"
              aria-label="Title"
            />
            <div className="flex items-center gap-2 px-1.5 text-[11.5px] text-muted">
              <span className="font-semibold text-kasavu">{template.ml}</span>
              <span>{settings.pageSize}</span>
              <span aria-live="polite">{settings.pristine ? "Empty pages are discarded when you leave" : save === "saving" ? "Saving…" : save === "dirty" ? "Editing" : save === "error" ? "Couldn't save — retrying on next change" : store.isCloud() ? "Saved to cloud" : "Saved in this browser"}</span>
            </div>
          </div>

          <div className="relative">
            <button className="btn btn-ghost !px-2.5" onClick={() => setMenu(menu === "export" ? null : "export")} aria-expanded={menu === "export"}>
              <Download size={16} /> <span className="hidden md:inline">Export</span>
            </button>
            {menu === "export" && (
              <Menu onClose={() => setMenu(null)}>
                <MenuItem onClick={() => window.print()} icon={<FileText size={15} />} label="PDF (print)" hint="Ctrl+P" />
                <MenuItem onClick={() => exportDocx(currentDoc())} icon={<FileText size={15} />} label="Word (.docx)" />
                <MenuItem onClick={() => exportMarkdown(currentDoc())} icon={<FileText size={15} />} label="Markdown (.md)" />
                <MenuItem onClick={() => exportText(currentDoc())} icon={<FileText size={15} />} label="Plain text (.txt)" />
                <MenuItem onClick={() => exportHTML(currentDoc(), editor?.getHTML() ?? "")} icon={<FileText size={15} />} label="Web page (.html)" />
              </Menu>
            )}
          </div>
          <div className="relative">
            <button className="btn btn-ghost !px-2.5" onClick={() => setMenu(menu === "share" ? null : "share")} aria-expanded={menu === "share"}>
              <Share2 size={16} /> <span className="hidden md:inline">Share</span>
            </button>
            {menu === "share" && (
              <Menu onClose={() => setMenu(null)} wide>
                {store.isCloud() ? (
                  <div className="space-y-2 p-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        className="accent-[var(--kayal)]"
                        onChange={async (e) => {
                          const id = await store.setPublic(docRef.current.id, e.target.checked);
                          setIsPublic(e.target.checked);
                          setShareId(id);
                        }}
                      />
                      Anyone with the link can read
                    </label>
                    {isPublic && shareId && (
                      <div className="flex gap-1">
                        <input readOnly className="field !py-1 !text-xs" value={`${appUrl(`/read/?s=${shareId}`)}`} onFocus={(e) => e.target.select()} />
                        <button className="btn btn-outline !px-2 !py-1 !text-xs" onClick={() => navigator.clipboard.writeText(`${appUrl(`/read/?s=${shareId}`)}`)}>
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="p-3 text-sm text-muted">Sharing needs a Supabase connection. Until then, export as PDF or Word to share.</p>
                )}
              </Menu>
            )}
          </div>
          <ThemeToggle />
          <button className="btn btn-ghost !p-2 text-sm font-semibold" onClick={() => setShowKeys(true)} title="Keyboard shortcuts (Ctrl+/)" aria-label="Keyboard shortcuts">
            ?
          </button>
          <button className="btn btn-ghost !p-2" onClick={() => setFocus(true)} title="Focus mode (Ctrl+Shift+F)" aria-label="Focus mode">
            <Maximize2 size={17} />
          </button>
        </header>
      )}

      {!focus && editor && <Toolbar editor={editor} template={template} mode={mode} onMode={changeMode} onFind={() => setFindOpen(true)} />}

      <div className="flex min-h-0 flex-1">
        {/* ── Outline ── */}
        {!focus && outline && editor && (
          <aside className="no-print scrollbar-thin hidden w-56 shrink-0 overflow-y-auto border-r border-line bg-desk px-3 py-4 lg:block">
            <OutlinePanel editor={editor} />
          </aside>
        )}

        {/* ── Desk with A4 pages ── */}
        <main ref={deskRef} className="desk-scroll scrollbar-thin relative min-w-0 flex-1 overflow-auto bg-desk px-4 py-8" onClick={(e) => e.target === e.currentTarget && editor?.commands.focus("end")}>
          {findOpen && editor && <FindBar editor={editor} onClose={() => setFindOpen(false)} />}
          {backup && editor && (
            <div className="no-print sticky top-0 z-30 mx-auto mb-4 flex w-fit max-w-full flex-wrap items-center gap-3 rounded-xl border border-kasavu/50 bg-kasavu-soft px-4 py-2.5 text-sm shadow-lg" role="status">
              <span>
                Found changes from {new Date(backup.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} that didn’t reach the server.
              </span>
              <button
                className="btn btn-primary !px-2.5 !py-1 !text-xs"
                onClick={() => {
                  editor.commands.setContent(backup.content, true);
                  setBackup(null);
                }}
              >
                Restore them
              </button>
              <button
                className="btn btn-ghost !px-2.5 !py-1 !text-xs"
                onClick={() => {
                  try {
                    localStorage.removeItem(backupKey);
                  } catch {}
                  setBackup(null);
                }}
              >
                Discard
              </button>
            </div>
          )}
          <div style={{ height: totalH * zoom + 4, width: `calc(${pageSize.w}mm * ${zoom})` }} className="mx-auto">
            <div
              className={`page-stack tpl-${initial.kind} ${settings.showMetre && template.metre ? "show-metre" : ""} ${focus ? "focus-mode" : ""}`}
              style={{ ...stackStyle, transformOrigin: "top left" }}
            >
              {Array.from({ length: stats.pages }, (_, i) => (
                <div key={i} className="sheet" style={{ top: i * (pageH + PAGE_GAP_PX), height: pageH }}>
                  {i > 0 && (settings.header || title) && (
                    <div className="sheet-head">
                      <span>{settings.header || title}</span>
                      <span>{template.ml}</span>
                    </div>
                  )}
                  <div className="sheet-foot">{i + 1}</div>
                </div>
              ))}
              <EditorContent editor={editor} className="page-content" />
            </div>
          </div>
          {editor && <ManglishPopup editor={editor} />}
        </main>

        {/* ── Side panels ── */}
        {!focus && (
          <>
            {panel && editor && (
              <aside className="no-print scrollbar-thin fixed inset-y-0 right-12 z-40 w-80 max-w-[85vw] shrink-0 overflow-y-auto border-l border-line bg-desk px-4 py-4 shadow-xl md:static md:shadow-none" aria-label={PANELS.find((p) => p.id === panel)?.label}>
                <div className="mb-2 flex justify-end">
                  <button className="btn btn-ghost !p-1" onClick={() => setPanel(null)} aria-label="Close panel">
                    <X size={15} />
                  </button>
                </div>
                {panel === "ai" && <AIPanel editor={editor} kind={initial.kind} />}
                {panel === "inbox" && <InboxPanel editor={editor} docId={initial.id} onCount={setInboxCount} />}
                {panel === "notes" && <NotesPanel editor={editor} settings={settings} onChange={updateSettings} kind={initial.kind} />}
                {panel === "history" && <HistoryPanel editor={editor} doc={docRef.current} onSnapshot={(l) => saveContent(editor, l)} />}
                {panel === "keys" && <KeysPanel editor={editor} />}
                {panel === "page" && <PagePanel settings={settings} onChange={updateSettings} showMetreOption={!!template.metre} />}
              </aside>
            )}
            <nav className="no-print flex w-12 shrink-0 flex-col items-center gap-1 border-l border-line bg-paper py-3" aria-label="Panels">
              <RailBtn active={outline} onClick={() => setOutline((o) => !o)} label="Outline" icon={ListTree} />
              <span className="my-1 h-px w-6 bg-line" />
              {PANELS.map((p) => (
                <RailBtn key={p.id} active={panel === p.id} onClick={() => setPanel(panel === p.id ? null : p.id)} label={p.label} icon={p.icon} badge={p.id === "inbox" ? inboxCount : 0} />
              ))}
              <span className="my-1 h-px w-6 bg-line" />
              <RailBtn active={typewriter} onClick={() => setTypewriter((t) => !t)} label="Typewriter scrolling" icon={BookOpen} />
              {store.isCloud() && shareId && isPublic && (
                <a href={`${BASE}/read/?s=${shareId}`} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-desk-2" title="Open reader view" aria-label="Open reader view">
                  <Eye size={17} />
                </a>
              )}
            </nav>
          </>
        )}
      </div>

      {showKeys && <ShortcutsDialog onClose={() => setShowKeys(false)} screenplay={!!template.screenplay} />}

      {/* ── Status bar ── */}
      <footer className="no-print flex items-center gap-4 border-t border-line bg-paper px-4 py-1.5 text-[12px] text-muted">
        {focus && (
          <button className="btn btn-ghost !px-2 !py-0.5 !text-xs" onClick={() => setFocus(false)}>
            <Minimize2 size={13} /> Exit focus
          </button>
        )}
        <span>
          <b className="font-semibold text-ink">{stats.words.toLocaleString("en-IN")}</b> words
        </span>
        <span className="hidden sm:inline">{stats.aksharas.toLocaleString("en-IN")} aksharas</span>
        <span className="hidden sm:inline">{stats.chars.toLocaleString("en-IN")} characters</span>
        <span>
          {stats.pages} {stats.pages === 1 ? "page" : "pages"}
        </span>
        <span className="hidden md:inline">{readingMinutes(stats.words)} min read</span>
        {goal > 0 && (
          <span className="flex items-center gap-2" title={`${stats.words} of ${goal} words`}>
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-desk-2">
              <span className="block h-full bg-kasavu" style={{ width: `${pct}%` }} />
            </span>
            {pct}%
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <span className="mr-2 rounded bg-kayal-soft px-1.5 py-0.5 font-semibold text-kayal" title="Ctrl/⌘ + M switches input">
            {mode === "manglish" ? "Manglish → മലയാളം" : mode === "malayalam" ? "മലയാളം" : "English"}
          </span>
          <button className="rounded p-1 hover:bg-desk-2" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
            <Minus size={13} />
          </button>
          <button className="w-11 rounded py-0.5 text-center hover:bg-desk-2" onClick={() => setZoom(1)} title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button className="rounded p-1 hover:bg-desk-2" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
            <Plus size={13} />
          </button>
        </span>
      </footer>
    </div>
  );
}

function RailBtn({ active, onClick, label, icon: Icon, badge = 0 }: { active: boolean; onClick: () => void; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`relative grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-kayal-soft text-kayal" : "text-muted hover:bg-desk-2 hover:text-ink"}`}
    >
      <Icon size={17} />
      {badge > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-kasavu px-1 text-[10px] font-bold text-white">{badge}</span>}
    </button>
  );
}

function Menu({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-menu]")) onClose();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    setTimeout(() => document.addEventListener("click", h));
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("click", h);
      document.removeEventListener("keydown", k);
    };
  }, [onClose]);
  return (
    <div data-menu className={`absolute right-0 top-10 z-50 rounded-lg border border-line bg-paper py-1 shadow-xl ${wide ? "w-80" : "w-56"}`} role="menu">
      {children}
    </div>
  );
}

function MenuItem({ onClick, icon, label, hint }: { onClick: () => void; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-desk-2">
      {icon}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </button>
  );
}

function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [term, setTerm] = useState("");
  const [rep, setRep] = useState("");
  const [cs, setCs] = useState(false);
  const st = searchKey.getState(editor.state);
  useEffect(() => {
    editor.commands.setSearch(term, cs);
  }, [term, cs, editor]);
  useEffect(() => () => void editor.commands.setSearch(""), [editor]);
  const n = st?.results.length ?? 0;
  return (
    <div className="no-print sticky top-0 z-30 mx-auto mb-4 flex w-fit flex-wrap items-center gap-1.5 rounded-xl border border-line bg-paper p-2 shadow-lg" role="search">
      <input
        autoFocus
        className="field !w-52 !py-1.5 !text-sm"
        placeholder="Find"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") editor.commands.searchStep(e.shiftKey ? -1 : 1);
          if (e.key === "Escape") onClose();
        }}
      />
      <span className="w-14 text-center text-xs text-muted">{term ? (n ? `${(st?.current ?? 0) + 1} / ${n}` : "0") : ""}</span>
      <button className="btn btn-ghost !p-1.5" onClick={() => editor.commands.searchStep(-1)} aria-label="Previous match">
        <ChevronUp size={15} />
      </button>
      <button className="btn btn-ghost !p-1.5" onClick={() => editor.commands.searchStep(1)} aria-label="Next match">
        <ChevronDown size={15} />
      </button>
      <input className="field !w-44 !py-1.5 !text-sm" placeholder="Replace with" value={rep} onChange={(e) => setRep(e.target.value)} />
      <button className="btn btn-outline !px-2 !py-1 !text-xs" onClick={() => editor.commands.replaceCurrent(rep)} disabled={!n}>
        Replace
      </button>
      <button className="btn btn-outline !px-2 !py-1 !text-xs" onClick={() => editor.commands.replaceAll(rep)} disabled={!n}>
        All
      </button>
      <label className="flex items-center gap-1 px-1 text-xs text-muted">
        <input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} /> Aa
      </label>
      <button className="btn btn-ghost !p-1.5" onClick={onClose} aria-label="Close find">
        <X size={15} />
      </button>
    </div>
  );
}
