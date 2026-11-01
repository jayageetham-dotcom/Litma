"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  ArrowLeft,
  BookA,
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
  MoreHorizontal,
  Search,
  Type,
} from "lucide-react";
import { buildExtensions } from "./extensions";
import { MobileFormatStrip, MobileSelectionBar, Toolbar } from "./Toolbar";
import { keepSelectionNow } from "@/extensions/keep-selection";
import { TextSelection } from "@tiptap/pm/state";
import { Sheet } from "@/components/ui/Sheet";
import { useKeyboardInset, useScreen } from "@/lib/useLayout";
import { ManglishPopup } from "./ManglishPopup";
import { AIPanel, HistoryPanel, InboxPanel, KeysPanel, OutlinePanel, PagePanel } from "./Panels";
import { ThemeToggle } from "@/components/ThemeToggle";
import { store } from "@/lib/store";
import { templateFor } from "@/lib/templates";
import type { DocSettings, LitmaDoc } from "@/lib/types";
import { countWords, readingMinutes, aksharas } from "@/shared/manglish";
import { stripPageBreaks } from "@/extensions/blocks";
import { MM, PAGE_GAP_PX, PAGE_SIZES, geometryFor, paginationKey, remeasurePages } from "@/extensions/pagination";
import { metreKey, searchKey } from "@/extensions/tools";
import type { InputMode } from "@/extensions/manglish";
import { exportDocx, exportHTML, exportMarkdown, exportText } from "@/lib/export";
import { BASE, appUrl } from "@/lib/config";
import { DocSaver, clearJournal, readJournal, type SaveStatus } from "@/lib/autosave";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { DictionaryPanel } from "./DictionaryPanel";
import { StoryPanel } from "./StoryPanel";
import { CueSuggest } from "./CueSuggest";
import { StoryWorld } from "@/components/story/StoryWorld";
import { TypewriterIcon } from "@/components/icons/Typewriter";

type PanelId = "ai" | "dict" | "inbox" | "story" | "history" | "keys" | "page";
const PANELS: { id: PanelId; label: string; short: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "ai", short: "AI", label: "AI companion", icon: Sparkles },
  { id: "dict", short: "Dictionary", label: "Dictionary & thesaurus", icon: BookA },
  { id: "inbox", short: "Inbox", label: "Assistant inbox (MCP)", icon: Inbox },
  { id: "story", short: "Story", label: "Story World", icon: NotebookPen },
  { id: "history", short: "History", label: "Version history", icon: HistoryIcon },
  { id: "keys", short: "Keyboard", label: "Malayalam keyboard", icon: Keyboard },
  { id: "page", short: "Page", label: "Page & type", icon: Settings2 },
];

type SaveState = SaveStatus;

export function Workspace({ initial }: { initial: LitmaDoc }) {
  const template = templateFor(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [settings, setSettings] = useState<DocSettings>(initial.settings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [save, setSave] = useState<SaveState>("saved");
  const [mode, setMode] = useState<InputMode>(initial.settings.inputMode ?? "manglish");
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [outline, setOutline] = useState(true);
  const screen = useScreen();
  const phone = screen === "phone";
  const kb = useKeyboardInset();
  const [phoneSheet, setPhoneSheet] = useState<"format" | "outline" | "more" | null>(null);
  const [editing, setEditing] = useState(false);
  // Outline docks on laptops; on tablets and phones it opens on demand.
  useEffect(() => setOutline(screen === "desktop" || screen === "wide"), [screen]);
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
  const [storyOpen, setStoryOpen] = useState(false);
  const [castNames, setCastNames] = useState<string[]>([]);
  const usesCues = initial.kind === "screenplay" || initial.kind === "drama";
  useEffect(() => {
    if (!usesCues || storyOpen) return;
    store
      .listStory(initial.id)
      .then((items) => setCastNames(items.filter((i) => i.kind === "character" && i.name).map((i) => i.name)))
      .catch(() => {});
  }, [usesCues, storyOpen, initial.id]);
  /** New documents stay "pristine" until the writer types; pristine documents are discarded on close. */
  const pristine = useRef(!!initial.settings.pristine);
  const docRef = useRef<LitmaDoc>(initial);
  const titleRef = useRef(initial.title);
  const lastSavedWords = useRef(initial.word_count);
  const lastSnapshot = useRef(Date.now());

  // Crash recovery: a local journal newer than the cloud copy wins (the writer can switch back).
  const [recovered, setRecovered] = useState<{ at: string; server: LitmaDoc["content"] } | null>(null);
  const [startContent] = useState(() => {
    const j = readJournal(initial.id);
    if (j && new Date(j.at) > new Date(initial.updated_at) && JSON.stringify(j.content) !== JSON.stringify(initial.content)) {
      return { content: j.content, title: j.title, at: j.at };
    }
    if (j) clearJournal(initial.id);
    return null;
  });

  // The extension set is fixed for the life of the document.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extensions = useMemo(() => buildExtensions(initial.kind, initial.settings, initial.settings.inputMode ?? "manglish"), []);

  const editor = useEditor({
    extensions,
    content: stripPageBreaks(startContent?.content ?? initial.content),
    immediatelyRender: false,
    // phones: don't pop the keyboard (and hide the tab bar) just because a work opened
    autofocus: typeof window !== "undefined" && window.innerWidth < 768 ? false : "end",
    editorProps: {
      attributes: { spellcheck: "false", "aria-label": `${template.en} manuscript`, lang: "ml" },
    },
  });

  // ── persistence ──
  const persist = useCallback(async (patch: Partial<LitmaDoc>) => {
    await store.updateDoc(docRef.current.id, patch);
    docRef.current = { ...docRef.current, ...patch };
  }, []);

  /** Cloud save of the whole document (called by the autosaver). Throws on failure so it retries. */
  const saveToCloud = useCallback(
    async (ed: Editor, snapshotLabel?: string | null) => {
      const content = ed.getJSON();
      const words = countWords(ed.getText({ blockSeparator: "\n" }));
      const patch: Partial<LitmaDoc> = { content, word_count: words, title: titleRef.current };
      if (docRef.current.settings?.pristine && !pristine.current) patch.settings = { ...docRef.current.settings, pristine: false };
      await persist(patch);
      const delta = words - lastSavedWords.current;
      lastSavedWords.current = words;
      if (delta > 0) store.addWordsToday(delta).catch(() => {});
      if (snapshotLabel !== undefined || Date.now() - lastSnapshot.current > 10 * 60 * 1000) {
        lastSnapshot.current = Date.now();
        await store.saveVersion(docRef.current.id, content, words, snapshotLabel ?? null).catch(() => {});
      }
    },
    [persist]
  );

  const saver = useRef<DocSaver | null>(null);
  useEffect(() => {
    if (!editor) return;
    const sv = new DocSaver({
      id: initial.id,
      snapshot: () => (editor.isDestroyed ? null : { content: editor.getJSON(), title: titleRef.current }),
      save: () => saveToCloud(editor),
      onStatus: setSave,
    });
    saver.current = sv;
    if (startContent) {
      // restored from the device journal — push it to the cloud right away
      setRecovered({ at: startContent.at, server: initial.content });
      if (startContent.title) {
        titleRef.current = startContent.title;
        setTitle(startContent.title);
      }
      pristine.current = false;
      sv.touch();
    }
    return () => sv.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // warn before closing the tab while a save is still pending
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saver.current?.unsaved) {
        saver.current.writeJournal();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

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
      saver.current?.touch();
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
  }, [editor]);

  const saveContent = useCallback(
    async (ed: Editor, label?: string | null) => {
      await saver.current?.flush();
      await saveToCloud(ed, label ?? null);
    },
    [saveToCloud]
  );

  // flush on leave — or discard the document if nothing was ever written in it
  const closed = useRef(false);
  const finish = useCallback(async () => {
    if (closed.current) return;
    closed.current = true;
    if (pristine.current) {
      saver.current?.dispose();
      clearJournal(docRef.current.id);
      await store.deleteDoc(docRef.current.id).catch(() => {});
    } else {
      await saver.current?.flush();
    }
  }, []);

  const goToDesk = useCallback(async () => {
    await finish();
    router.push("/desk/");
  }, [finish, router]);

  // Run `finish` only on real exits (tab close / unmount), never on re-renders.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const flush = () => {
      finish();
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
  }, [finish]);

  // ── settings ──
  const updateSettings = useCallback(
    (patch: Partial<DocSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist({ settings: next }).catch(() => setSave("offline"));
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

  // phones: show the keyboard accessory while the page has focus, the tab bar otherwise
  useEffect(() => {
    if (!editor) return;
    const on = () => setEditing(true);
    const off = () => setEditing(false);
    editor.on("focus", on);
    editor.on("blur", off);
    setEditing(editor.isFocused);
    return () => {
      editor.off("focus", on);
      editor.off("blur", off);
    };
  }, [editor]);

  const metreToggle = template.metre ? { on: !!settings.showMetre, toggle: () => updateSettings({ showMetre: !settings.showMetre }) } : undefined;

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
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setPanel("dict");
      } else if (mod && e.altKey && e.code === "KeyV" && template.metre) {
        e.preventDefault();
        updateSettings({ showMetre: !settingsRef.current.showMetre });
      } else if (mod && e.key === "/") {
        e.preventDefault();
        setShowKeys((v) => !v);
      } else if (e.key === "Escape" && focus) {
        setFocus(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, saveContent, focus, template.metre, updateSettings]);

  const pageSize = PAGE_SIZES[settings.pageSize] ?? PAGE_SIZES.A4;
  // shrink the page to fit narrow screens (phones, side panels open)
  useEffect(() => {
    const el = deskRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const avail = el.clientWidth - (el.clientWidth < 768 ? 16 : 32);
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

  const exportItems: { label: string; hint?: string; run: () => void }[] = [
    {
      label: "PDF, print-ready pages",
      run: async () => {
        await saver.current?.flush();
        window.open(`${BASE}/print/?doc=${initial.id}&auto=1`, "_blank");
      },
    },
    { label: "Quick print", hint: "Ctrl+P", run: () => window.print() },
    { label: "Word (.docx)", run: () => exportDocx(currentDoc()) },
    { label: "Markdown (.md)", run: () => exportMarkdown(currentDoc()) },
    { label: "Plain text (.txt)", run: () => exportText(currentDoc()) },
    { label: "Web page (.html)", run: () => exportHTML(currentDoc(), editor?.getHTML() ?? "") },
  ];

  const shareBody = store.isCloud() ? (
    <div className="space-y-2 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isPublic}
          className="accent-[var(--accent)]"
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
    <p className="text-sm text-muted">Sharing needs a Supabase connection. Until then, export as PDF or Word to share.</p>
  );

  const saveText = settings.pristine
    ? phone
      ? "Empty, discarded if you leave"
      : "Empty pages are discarded when you leave"
    : save === "saving"
      ? "Saving…"
      : save === "dirty"
        ? phone
          ? "Saved on device · syncing"
          : "Saved on this device · syncing"
        : save === "offline"
          ? phone
            ? "Offline, safe on this device"
            : "Offline. Safe on this device, will sync when back online"
          : store.isCloud()
            ? phone
              ? "Saved"
              : "All changes saved"
            : "Saved in this browser";

  const panelBody = (id: PanelId) =>
    editor && (
      <>
        {id === "ai" && <AIPanel editor={editor} kind={initial.kind} docId={initial.id} title={title} onOpenInbox={() => openPanel("inbox")} />}
        {id === "inbox" && <InboxPanel editor={editor} docId={initial.id} onCount={setInboxCount} />}
        {id === "dict" && <DictionaryPanel editor={editor} />}
        {id === "story" && <StoryPanel editor={editor} doc={docRef.current} settings={settings} onChange={updateSettings} onOpen={() => setStoryOpen(true)} refresh={storyOpen ? 0 : 1} />}
        {id === "history" && <HistoryPanel editor={editor} doc={docRef.current} onSnapshot={(l) => saveContent(editor, l)} />}
        {id === "keys" && <KeysPanel editor={editor} />}
        {id === "page" && <PagePanel settings={settings} onChange={updateSettings} showMetreOption={!!template.metre} />}
      </>
    );
  const panelMode = phone ? "sheet" : screen === "wide" ? "dock" : "drawer";
  const openPanel = (id: PanelId | null) => {
    setPhoneSheet(null);
    setPanel(id);
  };
  const hideKeyboard = () => {
    // remember the selection first: phones collapse it when the keyboard goes away
    if (editor && !editor.state.selection.empty) keepSelectionNow(editor.view);
    (document.activeElement as HTMLElement | null)?.blur();
    editor?.commands.blur();
  };
  /** phones: open a tool on the current selection with the keyboard out of the way */
  const openWithSelection = (id: PanelId) => {
    hideKeyboard();
    openPanel(id);
  };
  const clearSelection = () => {
    if (!editor) return;
    const { to } = editor.state.selection;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, to)));
  };
  const showSelectionBar = phone && !focus && !!editor && !editor.state.selection.empty && !panel && !phoneSheet && !storyOpen;

  return (
    <div className={`flex h-dvh flex-col ${focus ? "focus-shell" : ""}`}>
      <style>{pageCss}</style>

      {/* ── Top bar ── */}
      {!focus && (
        <header className="no-print flex items-center gap-1 border-b border-line bg-header px-2 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] md:gap-2 md:px-3 md:py-2">
          <button onClick={goToDesk} className="btn btn-ghost !p-2" title="Back to desk" aria-label="Back to desk">
            <ArrowLeft size={phone ? 20 : 18} />
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                titleRef.current = e.target.value;
                if (pristine.current) {
                  pristine.current = false;
                  setSettings((prev) => ({ ...prev, pristine: false }));
                }
                saver.current?.touch();
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full max-w-xl truncate rounded-md bg-transparent px-1.5 py-0.5 text-[1rem] font-semibold hover:bg-subtle focus:bg-subtle focus:outline-none md:text-[1.05rem]"
              aria-label="Title"
            />
            <div className="flex items-center gap-2 truncate px-1.5 text-[11.5px] text-muted">
              <span className="font-semibold text-highlight">{template.ml}</span>
              {phone ? (
                <span>
                  {stats.words.toLocaleString("en-IN")} words · {stats.pages} {stats.pages === 1 ? "page" : "pages"}
                </span>
              ) : (
                <span>{settings.pageSize}</span>
              )}
              <span aria-live="polite" className={`truncate ${save === "offline" ? "font-semibold text-danger" : ""}`}>
                {saveText}
              </span>
            </div>
          </div>

          {phone ? (
            <button className={`btn btn-ghost !p-2 ${panel === "ai" ? "text-accent" : ""}`} onClick={() => openPanel(panel === "ai" ? null : "ai")} aria-label="AI companion">
              <Sparkles size={20} />
            </button>
          ) : (
            <>
              <div className="relative">
                <button className="btn btn-ghost !px-2.5" onClick={() => setMenu(menu === "export" ? null : "export")} aria-expanded={menu === "export"}>
                  <Download size={16} /> <span className="hidden lg:inline">Export</span>
                </button>
                {menu === "export" && (
                  <Menu onClose={() => setMenu(null)}>
                    {exportItems.map((x) => (
                      <MenuItem key={x.label} onClick={x.run} icon={<FileText size={15} />} label={x.label} hint={x.hint} />
                    ))}
                  </Menu>
                )}
              </div>
              <div className="relative">
                <button className="btn btn-ghost !px-2.5" onClick={() => setMenu(menu === "share" ? null : "share")} aria-expanded={menu === "share"}>
                  <Share2 size={16} /> <span className="hidden lg:inline">Share</span>
                </button>
                {menu === "share" && (
                  <Menu onClose={() => setMenu(null)} wide>
                    <div className="p-3">{shareBody}</div>
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
            </>
          )}
        </header>
      )}

      {!focus && !phone && editor && <Toolbar editor={editor} template={template} mode={mode} onMode={changeMode} onFind={() => setFindOpen(true)} metre={metreToggle} />}

      <div className="flex min-h-0 flex-1">
        {/* ── Outline: docked on laptops and up ── */}
        {!focus && outline && editor && (screen === "desktop" || screen === "wide") && (
          <aside className="no-print scrollbar-thin w-56 shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-4">
            <OutlinePanel editor={editor} />
          </aside>
        )}

        {/* The page keeps its full width: on tablets and laptops panels slide over it instead of squeezing it. */}
        <div className="relative flex min-w-0 flex-1">
          {/* ── Desk with A4 pages ── */}
          <main
            ref={deskRef}
            className={`desk-scroll scrollbar-thin relative min-w-0 flex-1 overflow-auto bg-canvas ${phone ? "px-2 pb-6 pt-3" : "px-4 py-8"}`}
            onClick={(e) => e.target === e.currentTarget && editor?.commands.focus("end")}
          >
            {findOpen && editor && <FindBar editor={editor} onClose={() => setFindOpen(false)} />}
            {recovered && editor && (
              <div className="no-print sticky top-0 z-30 mx-auto mb-4 flex w-fit max-w-full flex-wrap items-center gap-3 rounded-xl border border-highlight/50 bg-highlight-soft px-4 py-2.5 text-sm shadow-lg" role="status">
                <span>
                  Recovered your unsaved writing from {new Date(recovered.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
                </span>
                <button className="btn btn-primary !px-2.5 !py-1 !text-xs" onClick={() => setRecovered(null)}>
                  Keep it
                </button>
                <button
                  className="btn btn-ghost !px-2.5 !py-1 !text-xs"
                  onClick={() => {
                    editor.commands.setContent(recovered.server, true);
                    setRecovered(null);
                  }}
                >
                  Use the older cloud copy
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
            {editor && usesCues && <CueSuggest editor={editor} names={castNames} />}
          </main>

          {!focus && screen === "tablet" && outline && editor && (
            <Sheet mode="drawer" side="left" title="Contents" onClose={() => setOutline(false)}>
              <OutlinePanel editor={editor} title={false} />
            </Sheet>
          )}
          {!focus && panel && editor && panelMode === "drawer" && (
            <Sheet mode="drawer" title={PANELS.find((p) => p.id === panel)!.label} onClose={() => setPanel(null)}>
              {panelBody(panel)}
            </Sheet>
          )}
        </div>

        {!focus && panel && editor && panelMode === "dock" && (
          <Sheet mode="dock" title={PANELS.find((p) => p.id === panel)!.label} onClose={() => setPanel(null)}>
            {panelBody(panel)}
          </Sheet>
        )}

        {/* ── Side rail (tablet and up) ── */}
        {!focus && !phone && (
          // Collapsed it's a thin icon rail; hovering (or tabbing into) it slides out labels over the page.
          <nav className="group/rail no-print relative w-12 shrink-0" aria-label="Panels">
            <div className="absolute inset-y-0 right-0 z-40 flex w-12 flex-col gap-0.5 overflow-hidden border-l border-line bg-surface px-1.5 py-3 transition-[width,box-shadow] duration-200 ease-out group-hover/rail:w-56 group-hover/rail:shadow-[var(--pop-shadow)] group-hover/rail:delay-150 group-has-[:focus-visible]/rail:w-56 group-has-[:focus-visible]/rail:shadow-[var(--pop-shadow)]">
              <RailBtn active={outline} onClick={() => setOutline((o) => !o)} label="Outline" hint="Chapters and headings" icon={ListTree} />
              <span className="mx-1.5 my-1 h-px shrink-0 bg-line" />
              {PANELS.map((p) => (
                <RailBtn key={p.id} active={panel === p.id} onClick={() => setPanel(panel === p.id ? null : p.id)} label={p.label} icon={p.icon} badge={p.id === "inbox" ? inboxCount : 0} />
              ))}
              <span className="mx-1.5 my-1 h-px shrink-0 bg-line" />
              <RailBtn active={typewriter} onClick={() => setTypewriter((t) => !t)} label="Typewriter scrolling" hint="While you type, keep the line you are writing in the middle of the screen" icon={TypewriterIcon} />
              {store.isCloud() && shareId && isPublic && (
                <a href={`${BASE}/read/?s=${shareId}`} target="_blank" rel="noreferrer" className="flex h-9 shrink-0 items-center gap-3 rounded-lg px-[9px] text-muted hover:bg-subtle hover:text-ink" aria-label="Open reader view">
                  <Eye size={17} className="shrink-0" />
                  <span className="whitespace-nowrap text-[13px] opacity-0 transition-opacity group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100">Reader view</span>
                </a>
              )}
            </div>
          </nav>
        )}
      </div>

      {/* ── Phone: bottom sheets ── */}
      {phone && panel && editor && (
        <Sheet mode="sheet" bottomOffset={kb} title={PANELS.find((p) => p.id === panel)!.label} onClose={() => setPanel(null)}>
          {panelBody(panel)}
        </Sheet>
      )}
      {phone && phoneSheet === "format" && editor && (
        <Sheet mode="sheet" bottomOffset={kb} title="Format" onClose={() => setPhoneSheet(null)}>
          <Toolbar editor={editor} template={template} mode={mode} onMode={changeMode} onFind={() => { setPhoneSheet(null); setFindOpen(true); }} variant="sheet" metre={metreToggle} />
        </Sheet>
      )}
      {phone && phoneSheet === "outline" && editor && (
        <Sheet mode="sheet" bottomOffset={kb} title="Contents" onClose={() => setPhoneSheet(null)}>
          <div onClickCapture={(e) => (e.target as HTMLElement).closest("button") && setTimeout(() => setPhoneSheet(null), 120)}>
            <OutlinePanel editor={editor} title={false} />
          </div>
        </Sheet>
      )}
      {phone && phoneSheet === "more" && (
        <Sheet mode="sheet" bottomOffset={kb} title="More" onClose={() => setPhoneSheet(null)}>
          <div className="grid grid-cols-4 gap-1.5">
            {PANELS.filter((p) => !["story", "dict"].includes(p.id)).map((p) => (
              <Tile key={p.id} icon={p.icon} label={p.short} badge={p.id === "inbox" ? inboxCount : 0} onClick={() => openPanel(p.id)} />
            ))}
            <Tile icon={Search} label="Find" onClick={() => { setPhoneSheet(null); setFindOpen(true); }} />
            <Tile icon={TypewriterIcon} label="Typewriter" active={typewriter} onClick={() => setTypewriter((t) => !t)} />
            <Tile icon={Maximize2} label="Focus" onClick={() => { setPhoneSheet(null); setFocus(true); }} />
            {store.isCloud() && shareId && isPublic && <Tile icon={Eye} label="Reader" onClick={() => window.open(`${BASE}/read/?s=${shareId}`, "_blank")} />}
          </div>
          <h3 className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Export</h3>
          <div className="overflow-hidden rounded-xl border border-line bg-paper">
            {exportItems.filter((x) => x.label !== "Quick print").map((x) => (
              <button key={x.label} onClick={x.run} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left text-sm last:border-0 active:bg-subtle">
                <FileText size={16} className="text-muted" /> {x.label}
              </button>
            ))}
          </div>
          <h3 className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Share</h3>
          <div className="rounded-xl border border-line bg-paper p-3">{shareBody}</div>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-2 text-sm">
            <span>Theme</span>
            <ThemeToggle />
          </div>
        </Sheet>
      )}

      {storyOpen && <StoryWorld doc={docRef.current} editor={editor} columns={settings.beatColumns} onColumns={(beatColumns) => updateSettings({ beatColumns })} onClose={() => setStoryOpen(false)} />}
      {showKeys && <ShortcutsDialog onClose={() => setShowKeys(false)} screenplay={!!template.screenplay} />}

      {/* ── Phone: keyboard accessory while writing, tab bar otherwise ── */}
      {phone && !focus && editor && (editing ? (
        <div className={kb ? "fixed inset-x-0 z-40" : ""} style={kb ? { bottom: kb } : undefined}>
          {showSelectionBar && <MobileSelectionBar editor={editor} onLookUp={() => openWithSelection("dict")} onAskAI={() => openWithSelection("ai")} onClear={clearSelection} />}
          <MobileFormatStrip
            editor={editor}
            template={template}
            mode={mode}
            onMode={changeMode}
            onMore={() => { hideKeyboard(); setPhoneSheet("format"); }}
            onDone={hideKeyboard}
            onLookUp={() => openWithSelection("dict")}
            onAskAI={() => openWithSelection("ai")}
          />
        </div>
      ) : (
        <div className="relative">
        {showSelectionBar && (
          <div className="absolute inset-x-0 bottom-full">
            <MobileSelectionBar editor={editor} onLookUp={() => openWithSelection("dict")} onAskAI={() => openWithSelection("ai")} onClear={clearSelection} />
          </div>
        )}
        <nav className="no-print safe-bottom grid grid-cols-5 border-t border-line bg-paper" aria-label="Writing tools">
          <TabBtn icon={Type} label="Format" active={phoneSheet === "format"} onClick={() => { setPanel(null); setPhoneSheet(phoneSheet === "format" ? null : "format"); }} />
          <TabBtn icon={ListTree} label="Contents" active={phoneSheet === "outline"} onClick={() => { setPanel(null); setPhoneSheet(phoneSheet === "outline" ? null : "outline"); }} />
          <TabBtn icon={NotebookPen} label="Story" active={panel === "story"} onClick={() => openPanel(panel === "story" ? null : "story")} />
          <TabBtn icon={BookA} label="Dictionary" active={panel === "dict"} onClick={() => openPanel(panel === "dict" ? null : "dict")} />
          <TabBtn icon={MoreHorizontal} label="More" active={phoneSheet === "more"} badge={inboxCount} onClick={() => { setPanel(null); setPhoneSheet(phoneSheet === "more" ? null : "more"); }} />
        </nav>
        </div>
      ))}

      {/* ── Status bar ── */}
      {(!phone || focus) && (
        <footer className="no-print flex items-center gap-4 border-t border-line bg-paper px-4 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-[12px] text-muted">
          {focus && (
            <button className="btn btn-ghost !px-2 !py-0.5 !text-xs" onClick={() => setFocus(false)}>
              <Minimize2 size={13} /> Exit focus
            </button>
          )}
          <span>
            <b className="font-semibold text-ink">{stats.words.toLocaleString("en-IN")}</b> words
          </span>
          <span className="hidden lg:inline">{stats.chars.toLocaleString("en-IN")} characters</span>
          <span>
            {stats.pages} {stats.pages === 1 ? "page" : "pages"}
          </span>
          <span className="hidden md:inline">{readingMinutes(stats.words)} min read</span>
          {goal > 0 && (
            <span className="flex items-center gap-2" title={`${stats.words} of ${goal} words`}>
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-subtle">
                <span className="block h-full bg-highlight" style={{ width: `${pct}%` }} />
              </span>
              {pct}%
            </span>
          )}
          {!phone && (
            <span className="ml-auto flex items-center gap-1">
              <span className="mr-2 rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-accent" title="Ctrl/⌘ + M switches input">
                {mode === "manglish" ? "Manglish → മലയാളം" : mode === "malayalam" ? "മലയാളം" : "English"}
              </span>
              <button className="rounded p-1 hover:bg-subtle" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
                <Minus size={13} />
              </button>
              <button className="w-11 rounded py-0.5 text-center hover:bg-subtle" onClick={() => setZoom(1)} title="Reset zoom">
                {Math.round(zoom * 100)}%
              </button>
              <button className="rounded p-1 hover:bg-subtle" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
                <Plus size={13} />
              </button>
            </span>
          )}
        </footer>
      )}
    </div>
  );
}

function TabBtn({ icon: Icon, label, active, onClick, badge = 0 }: { icon: React.ComponentType<{ size?: number }>; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`relative flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium ${active ? "text-accent" : "text-muted"}`}>
      <span className={`grid h-7 w-12 place-items-center rounded-full ${active ? "bg-accent-soft" : ""}`}>
        <Icon size={19} />
      </span>
      {label}
      {badge > 0 && <span className="absolute right-[calc(50%-1.4rem)] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] font-bold text-white">{badge}</span>}
    </button>
  );
}

function Tile({ icon: Icon, label, onClick, active, badge = 0 }: { icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; active?: boolean; badge?: number }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`relative flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-[11.5px] leading-tight ${active ? "bg-accent-soft text-accent" : "bg-paper text-ink active:bg-subtle"}`}>
      <Icon size={20} />
      <span className="text-center">{label}</span>
      {badge > 0 && <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] font-bold text-white">{badge}</span>}
    </button>
  );
}

function RailBtn({ active, onClick, label, hint, icon: Icon, badge = 0 }: { active: boolean; onClick: () => void; label: string; hint?: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: number }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={hint}
      className={`relative flex h-9 w-full shrink-0 items-center gap-3 rounded-lg px-[9px] text-left ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-subtle hover:text-ink"}`}
    >
      <Icon size={17} className="shrink-0" />
      <span className="whitespace-nowrap text-[13px] font-medium opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-hover/rail:delay-150 group-has-[:focus-visible]/rail:opacity-100">{label}</span>
      {badge > 0 && <span className="absolute left-5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] font-bold text-white">{badge}</span>}
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
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-subtle">
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
    <div className="no-print sticky top-0 z-30 mx-auto mb-4 flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-line bg-paper p-2 shadow-lg" role="search">
      <input
        autoFocus
        className="field min-w-0 flex-1 !py-1.5 !text-sm sm:!w-52 sm:flex-none"
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
      <input className="field min-w-0 flex-1 !py-1.5 !text-sm sm:!w-44 sm:flex-none" placeholder="Replace with" value={rep} onChange={(e) => setRep(e.target.value)} />
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
