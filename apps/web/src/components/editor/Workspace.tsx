"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  ArrowLeft,
  BookA,
  ChevronLeft,
  ChevronRight,
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
  Bookmark,
  Files,
  Repeat2,
  AudioLines,
  SpellCheck,
  Target,
  Volume2,
} from "lucide-react";
import { RhymePanel } from "./RhymePanel";
import { MetrePanel } from "./MetrePanel";
import { GoalPanel } from "./GoalPanel";
import { TimerChip } from "./TimerChip";
import { CheckPanel } from "./CheckPanel";
import { ReadAloudPanel } from "./ReadAloudPanel";
import { recheckSpelling } from "@/extensions/writing-aids";
import { SPELL_EVENT, blockChecker, setStoryWords, setWorkIgnored, spellPrefs } from "@/lib/spell";
import { setStoryNames } from "@/lib/manglish-words";
import { ownWordsFrom } from "@litma/shared/manglish-rank";
import { timerWords } from "@/lib/timer";
import { buildExtensions } from "./extensions";
import { MobileFormatStrip, MobileSelectionBar, Toolbar } from "./Toolbar";
import { keepSelectionNow } from "@/extensions/keep-selection";
import { useT, type MessageKey } from "@/i18n/react";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import { Sheet } from "@/components/ui/Sheet";
import { useKeyboardInset, useScreen } from "@/lib/useLayout";
import { ManglishPopup } from "./ManglishPopup";
import { SpellSuggest } from "./SpellSuggest";
import { toMalayalam } from "@/components/ScriptField";
import { AIPanel, HistoryPanel, InboxPanel, KeysPanel, OutlinePanel, PagePanel } from "./Panels";
import { ThemeToggle } from "@/components/ThemeToggle";
import { store } from "@/lib/store";
import { docClasses, templateFor } from "@/lib/templates";
import { currentTitle, keepOnClose, sameDay, shortDate } from "@litma/shared/forms";
import { JournalExport } from "./JournalExport";
import { listJournals } from "@/lib/journals";
import { fillCastList } from "@/extensions/drama";
import { FootnoteDialog } from "./FootnoteDialog";
import type { DocSettings, LitmaDoc } from "@/lib/types";
import { countWords, readingMinutes, aksharas } from "@litma/shared/manglish";
import { manglishMatches } from "@litma/shared/search";
import { MM, PAGE_GAP_PX, PAGE_SIZES, geometryFor, paginationKey, remeasurePages } from "@/extensions/pagination";
import { metreKey, searchKey } from "@/extensions/tools";
import type { InputMode } from "@/extensions/manglish";
import { exportDocx, exportHTML, exportMarkdown, exportText } from "@/lib/export";
import { BASE, appUrl } from "@/lib/config";
import { DocSaver, clearJournal, readJournal, type SaveStatus } from "@/lib/autosave";
import { SYNC_EVENT, hasPending, type SyncState } from "@/lib/offline";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { EditorContextMenu } from "./EditorContextMenu";
import { SavedWordsPanel } from "./SavedWordsPanel";
import { DictionaryPanel } from "./DictionaryPanel";
import { StoryPanel } from "./StoryPanel";
import { CueSuggest } from "./CueSuggest";
import { StoryWorld } from "@/components/story/StoryWorld";
import { TypewriterIcon } from "@/components/icons/Typewriter";

type PanelId = "ai" | "dict" | "saved" | "rhyme" | "metre" | "check" | "read" | "goals" | "inbox" | "story" | "history" | "keys" | "page";
/** `tint`: the soft home-page colour of each tool's icon in the rail (icons only; labels stay neutral). */
/** `labelKey` / `shortKey`: the name from the strings files (newer panels); the rest are still inline. */
const PANELS: { id: PanelId; label: string; short: string; labelKey?: MessageKey; shortKey?: MessageKey; icon: React.ComponentType<{ size?: number }>; tint: string }[] = [
  { id: "ai", short: "AI", label: "AI companion", icon: Sparkles, tint: "text-tint-violet" },
  { id: "dict", short: "Dictionary", label: "Dictionary & thesaurus", icon: BookA, tint: "text-tint-tangerine" },
  { id: "saved", short: "Saved", label: "Saved words", icon: Bookmark, tint: "text-tint-coral" },
  { id: "rhyme", short: "Rhymes", label: "Rhymes (പ്രാസം)", icon: Repeat2, tint: "text-tint-sky" },
  { id: "metre", short: "Metre", label: "Metre (വൃത്തം)", labelKey: "metre.panel", shortKey: "metre.tile", icon: AudioLines, tint: "text-tint-violet" },
  { id: "check", short: "Check", label: "Spelling and grammar", icon: SpellCheck, tint: "text-tint-coral" },
  { id: "read", short: "Listen", label: "Read aloud", icon: Volume2, tint: "text-tint-lime" },
  { id: "goals", short: "Goals", label: "Goal and timer", icon: Target, tint: "text-tint-tangerine" },
  { id: "inbox", short: "Inbox", label: "Assistant inbox (MCP)", icon: Inbox, tint: "text-tint-violet" },
  { id: "story", short: "Story", label: "Story World", icon: NotebookPen, tint: "text-tint-lime" },
  { id: "history", short: "History", label: "Version history", icon: HistoryIcon, tint: "text-tint-sky" },
  { id: "keys", short: "Keyboard", label: "Malayalam keyboard", icon: Keyboard, tint: "text-tint-tangerine" },
  { id: "page", short: "Page", label: "Page & type", icon: Settings2, tint: "text-tint-coral" },
];

type SaveState = SaveStatus;

export function Workspace({ initial }: { initial: LitmaDoc }) {
  const t = useT();
  const template = templateFor(initial.kind);
  const [title, setTitle] = useState(() => currentTitle(initial.title, initial.kind));
  const [settings, setSettings] = useState<DocSettings>(initial.settings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [save, setSave] = useState<SaveState>("saved");
  const [mode, setMode] = useState<InputMode>(initial.settings.inputMode ?? "manglish");
  const [panel, setPanel] = useState<PanelId | null>(null);
  /** the AI action to run when the AI panel opens (the Check panel's grammar check) */
  const [aiStart, setAiStart] = useState<"grammar" | null>(null);
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
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [menu, setMenu] = useState<"export" | "share" | null>(null);
  // journals: ‹ › open the journal started before / after this one; Export opens the journal export
  const journal = initial.kind === "diary";
  const [journalExport, setJournalExport] = useState(false);
  const [neighbours, setNeighbours] = useState<{ prev: LitmaDoc | null; next: LitmaDoc | null } | null>(null);
  const [editedAt, setEditedAt] = useState(initial.updated_at);
  const [tiny, setTiny] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 359px)");
    const on = () => setTiny(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (!journal) return;
    let live = true;
    listJournals()
      .then((list) => {
        const at = list.findIndex((d) => d.id === initial.id);
        if (live) setNeighbours({ prev: at > 0 ? list[at - 1] : null, next: at >= 0 ? (list[at + 1] ?? null) : null });
      })
      .catch(() => live && setNeighbours({ prev: null, next: null }));
    return () => {
      live = false;
    };
  }, [journal, initial.id]);
  const [stats, setStats] = useState({ words: initial.word_count, chars: 0, aksharas: 0, pages: 1 });
  // the writing timer counts the words written while it runs
  useEffect(() => timerWords(initial.id, stats.words), [initial.id, stats.words]);
  // Phones show the writing at full size on one continuous sheet; "Pages" (More) brings the printed pages back.
  const [phonePages, setPhonePages] = useState(false);
  useEffect(() => {
    try {
      setPhonePages(localStorage.getItem("litma:phone-pages") === "on");
    } catch {
      /* storage may be unavailable */
    }
  }, []);
  const togglePhonePages = () =>
    setPhonePages((v) => {
      try {
        localStorage.setItem("litma:phone-pages", v ? "off" : "on");
      } catch {
        /* ignore */
      }
      return !v;
    });
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);

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
  // the work's Story World names become the writer's own words: first in Manglish suggestions when
  // they fit, never marked by the spelling check (refreshed when Story World closes)
  useEffect(() => {
    if (storyOpen) return;
    let live = true;
    store
      .listStory(initial.id)
      .then((items) => {
        if (!live) return;
        const names = items.map((i) => i.name).filter(Boolean);
        setStoryNames(names);
        setStoryWords(ownWordsFrom(names));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [storyOpen, initial.id]);
  useEffect(
    () => () => {
      setStoryNames([]);
      setStoryWords([]);
    },
    [initial.id]
  );
  // "Ignore" on a spelling is kept with this work, so a refresh or another device keeps it
  useEffect(() => {
    setWorkIgnored(settingsRef.current.spellIgnored ?? [], (words) => updateSettingsRef.current({ spellIgnored: words }));
    return () => setWorkIgnored([], null);
  }, [initial.id]);
  /** A new work stays "pristine" until it has its own title or any text (shared `keepOnClose`); pristine works are discarded on close. */
  const pristine = useRef(!!initial.settings.pristine);
  // opened as a new, untouched work: only such a work can be discarded (an older work never is)
  const createdPristine = useRef(!!initial.settings.pristine);
  const docRef = useRef<LitmaDoc>(initial);
  const titleRef = useRef(currentTitle(initial.title, initial.kind));
  // the title was typed in this visit (only then is it converted from Manglish on leaving it)
  const titleDirty = useRef(false);
  // the title when the writer clicked into it, so Esc can put it back
  const titleBefore = useRef<string | null>(null);
  const lastSavedWords = useRef(initial.word_count);
  /** minutes (Date.now() / 60 000) in which the writer changed the text since the last save */
  const activeMinutes = useRef(new Set<number>());
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
    content: startContent?.content ?? initial.content,
    immediatelyRender: false,
    // phones: don't pop the keyboard (and hide the tab bar) just because a work opened
    autofocus: typeof window !== "undefined" && window.innerWidth < 768 ? false : "end",
    editorProps: {
      attributes: { spellcheck: "false", "aria-label": `${template.en} manuscript`, lang: "ml" },
    },
    // Re-rendering this whole shell (toolbar, rail, panels) on every keystroke made typing lag
    // on slower computers; `useToolbarRefresh` below refreshes it at the right moments instead.
    shouldRerenderOnTransaction: false,
  });
  useToolbarRefresh(editor);

  // Phone keyboards capitalise the start of a sentence and autocorrect Latin words. In Manglish a
  // capital has its own meaning (A is ആ, M is ം), so "amma" came out as ആമ്മ. Off while typing Manglish.
  useEffect(() => {
    const dom = editor?.view?.dom;
    if (!dom) return;
    const latin = mode === "manglish";
    dom.setAttribute("autocapitalize", latin ? "off" : "sentences");
    dom.setAttribute("autocorrect", latin ? "off" : "on");
  }, [editor, mode]);

  // spelling marks: on or off per device (Check panel), redone when the writer keeps a word
  useEffect(() => {
    if (!editor) return;
    const apply = () => {
      const storage = (editor.storage as unknown as { writingAids: { check: ((t: string) => Promise<unknown[]>) | null } }).writingAids;
      storage.check = spellPrefs().on ? blockChecker() : null;
      recheckSpelling(editor);
    };
    apply();
    window.addEventListener(SPELL_EVENT, apply);
    return () => window.removeEventListener(SPELL_EVENT, apply);
  }, [editor]);

  // ── persistence ──
  const editorRef = useRef(editor);
  editorRef.current = editor;
  /**
   * The keep rule (shared `keepOnClose`), same in every app: a new work is kept once the writer
   * changed its title or wrote any text. Without a live editor it changes nothing (closing must
   * never drop text typed since the last save).
   */
  const recheckPristine = useCallback(() => {
    if (!createdPristine.current) return;
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return;
    const p = !keepOnClose({ title: titleRef.current, kind: initial.kind, content: ed.getJSON(), createdAt: initial.created_at });
    if (p === pristine.current) return;
    pristine.current = p;
    setSettings((prev) => ({ ...prev, pristine: p }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(async (patch: Partial<LitmaDoc>) => {
    // known at once, so a save that starts meanwhile builds on these settings, not older ones
    // (an Ignore pressed before a new work's first save stayed lost otherwise)
    if (patch.settings) docRef.current = { ...docRef.current, settings: patch.settings };
    const queued = await store.updateDoc(docRef.current.id, patch);
    docRef.current = { ...docRef.current, ...patch };
    return queued;
  }, []);

  /** Cloud save of the whole document (called by the autosaver). Throws on failure so it retries. */
  const saveToCloud = useCallback(
    async (ed: Editor, snapshotLabel?: string | null) => {
      const content = ed.getJSON();
      const words = countWords(ed.getText({ blockSeparator: "\n" }));
      const patch: Partial<LitmaDoc> = { content, word_count: words, title: titleRef.current };
      // the keep rule, on what is being saved: a new work stays pristine until it has its own title or text
      const p = createdPristine.current && !keepOnClose({ title: titleRef.current, kind: initial.kind, content, createdAt: initial.created_at });
      if (!!docRef.current.settings?.pristine !== p) patch.settings = { ...docRef.current.settings, pristine: p };
      const queued = await persist(patch);
      const delta = words - lastSavedWords.current;
      lastSavedWords.current = words;
      const minutes = activeMinutes.current.size;
      activeMinutes.current = new Set();
      if (delta > 0 || minutes > 0) store.logWriting({ words: Math.max(0, delta), minutes, docId: docRef.current.id }).catch(() => {});
      if (snapshotLabel !== undefined || Date.now() - lastSnapshot.current > 10 * 60 * 1000) {
        lastSnapshot.current = Date.now();
        await store.saveVersion(docRef.current.id, content, words, snapshotLabel ?? null).catch(() => {});
      }
      return queued;
    },
    [persist]
  );

  const saver = useRef<DocSaver | null>(null);
  // reopened with changes still waiting to sync (made offline): say so until they reach the server
  useEffect(() => {
    let live = true;
    hasPending("documents", initial.id)
      .then((waiting) => live && waiting && setSave((s) => (s === "saved" ? "local" : s)))
      .catch(() => {});
    const onSync = (e: Event) => {
      if ((e as CustomEvent<SyncState>).detail.pending === 0) setSave((s) => (s === "local" ? "saved" : s));
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => {
      live = false;
      window.removeEventListener(SYNC_EVENT, onSync);
    };
  }, [initial.id]);
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
      recheckPristine();
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
      // after a pause: a new work whose text was all deleted again is empty once more
      if (!pristine.current) recheckPristine();
    };
    const onUpdate = () => {
      // at once while it would still be discarded, so a letter typed just before leaving is kept
      if (pristine.current) recheckPristine();
      saver.current?.touch();
      activeMinutes.current.add(Math.floor(Date.now() / 60000));
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

  useEffect(() => {
    if (save === "dirty" || save === "saving") setEditedAt(new Date().toISOString());
  }, [save]);

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
    recheckPristine();
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
    router.push(journal ? "/desk/?view=journals" : "/desk/");
  }, [finish, router, journal]);

  /** Another journal: save this one first (or discard it under the keep rule), then open the other. */
  const openJournal = useCallback(
    async (id: string) => {
      await finish();
      router.replace(`/write/?id=${id}`);
    },
    [finish, router]
  );

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
  const updateSettingsRef = useRef(updateSettings);
  updateSettingsRef.current = updateSettings;

  useEffect(() => {
    if (!editor) return;
    editor.storage.pagination.geometry = geometryFor(settings.pageSize, settings.margins);
    const showMetre = !!settings.showMetre && !!template.metre;
    if (editor.storage.metre.enabled !== showMetre) {
      editor.storage.metre.enabled = showMetre;
      editor.view.dispatch(editor.state.tr.setMeta(metreKey, true));
    }
    const timer = setTimeout(remeasurePages, 60);
    return () => clearTimeout(timer);
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

  const pageless = phone && !phonePages;
  useEffect(() => {
    if (!editor) return;
    if (editor.storage.pagination.paged === !pageless) return;
    editor.storage.pagination.paged = !pageless;
    remeasurePages();
  }, [editor, pageless]);

  /** Plays: put the Story World characters into the cast list. */
  const fillCast = useCallback(async () => {
    if (!editor) return;
    const items = await store.listStory(initial.id).catch(() => []);
    const people = items.filter((i) => i.kind === "character" && i.name.trim()).sort((a, b) => a.position - b.position).map((i) => ({ name: i.name, role: i.summary }));
    const added = fillCastList(editor, people);
    setNotice(added ? t("editor.drama.fillCastDone", { count: added }) : people.length ? t("editor.drama.fillCastNone") : t("editor.drama.fillCastEmpty"));
  }, [editor, initial.id, t]);

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

  const metreOn = !!settings.showMetre && !!template.metre;
  const stackStyle = (
    pageless
      ? {
          "--page-w": "100%",
          "--page-h": "auto",
          "--m-top": "22px",
          // room for the akshara counts in the left margin when metre marks are on
          "--m-left": metreOn ? "34px" : "18px",
          "--m-right": "18px",
          "--m-bottom": "22px",
          "--doc-font": `'${settings.font}'`,
          "--doc-size": `${settings.fontSize}pt`,
          "--doc-lh": settings.lineHeight,
        }
      : {
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
        }
  ) as unknown as React.CSSProperties;

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
    { label: "Web page (.html)", run: () => exportHTML(currentDoc()) },
  ];

  /** ‹ and › beside a journal's title; disabled (in place) at either end and until the neighbours are known. */
  const journalNav = (dir: "prev" | "next") => {
    const other = neighbours ? neighbours[dir] : null;
    const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
    const label = other ? t(dir === "prev" ? "journals.prev" : "journals.next", { date: shortDate(other.created_at) }) : neighbours ? t(dir === "prev" ? "journals.first" : "journals.latest") : "";
    return (
      // the tooltip sits on a wrapper, since a disabled button gets no hover
      <span title={label} className="inline-flex shrink-0">
        <button
          type="button"
          className={`btn btn-ghost shrink-0 !p-0 ${phone ? "size-11" : "size-8"} justify-center disabled:!bg-transparent disabled:text-[var(--disabled-ink)] disabled:opacity-55`}
          disabled={!other}
          aria-disabled={!other}
          aria-label={label || (dir === "prev" ? t("journals.first") : t("journals.latest"))}
          onClick={() => other && openJournal(other.id)}
        >
          <Icon size={phone ? 22 : 18} aria-hidden />
        </button>
      </span>
    );
  };

  const shareBody = store.isCloud() ? (
    <div className="space-y-2 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isPublic}
          className="accent-[var(--accent)]"
          disabled={sharing}
          onChange={async (e) => {
            // read the choice now: after the await, React has already put the controlled box back
            const on = e.target.checked;
            const before = { isPublic, shareId };
            setIsPublic(on);
            setShareError(false);
            setSharing(true);
            try {
              setShareId(await store.setPublic(docRef.current.id, on));
            } catch {
              setIsPublic(before.isPublic);
              setShareId(before.shareId);
              setShareError(true);
            } finally {
              setSharing(false);
            }
          }}
        />
        Anyone with the link can read
      </label>
      {shareError && <p className="text-xs font-semibold text-danger">Couldn’t change sharing. Check your connection and try again.</p>}
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
        : save === "offline" || save === "local"
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
        {id === "ai" && <AIPanel key={aiStart ?? "ai"} editor={editor} kind={initial.kind} docId={initial.id} title={title} onOpenInbox={() => openPanel("inbox")} start={aiStart ?? undefined} onStarted={() => setAiStart(null)} />}
        {id === "rhyme" && <RhymePanel editor={editor} />}
        {id === "metre" && <MetrePanel editor={editor} marks={!!settings.showMetre} onMarks={(on) => updateSettings({ showMetre: on })} />}
        {id === "check" && <CheckPanel editor={editor} kind={initial.kind} docId={initial.id} title={title} onOpenInbox={() => openPanel("inbox")} />}
        {id === "read" && <ReadAloudPanel editor={editor} />}
        {id === "goals" && <GoalPanel docId={initial.id} words={stats.words} settings={settings} onChange={updateSettings} />}
        {id === "inbox" && <InboxPanel editor={editor} docId={initial.id} onCount={setInboxCount} />}
        {id === "dict" && <DictionaryPanel editor={editor} onSaved={() => openPanel("saved")} />}
        {id === "saved" && <SavedWordsPanel editor={editor} />}
        {id === "story" && <StoryPanel editor={editor} doc={docRef.current} settings={settings} onChange={updateSettings} onOpen={() => setStoryOpen(true)} refresh={storyOpen ? 0 : 1} />}
        {id === "history" && <HistoryPanel editor={editor} doc={docRef.current} onSnapshot={(l) => saveContent(editor, l)} />}
        {id === "keys" && <KeysPanel editor={editor} />}
        {id === "page" && <PagePanel kind={initial.kind} settings={settings} onChange={updateSettings} showMetreOption={!!template.metre} />}
      </>
    );
  const panelMode = phone ? "sheet" : screen === "wide" ? "dock" : "drawer";
  const panelLabel = (id: PanelId) => {
    const p = PANELS.find((x) => x.id === id)!;
    return p.labelKey ? t(p.labelKey) : p.label;
  };
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
  // phones while writing: the keyboard accessory strip is on screen and carries the Manglish suggestions
  const keyboardStrip = phone && !focus && editing;
  const showSelectionBar = phone && !focus && !!editor && !editor.state.selection.empty && !panel && !phoneSheet && !storyOpen;

  return (
    <div className={`flex h-dvh flex-col ${focus ? "focus-shell" : ""}`}>
      <style>{pageCss}</style>

      {/* ── Top bar ── */}
      {!focus && (
        <header className="no-print relative z-50 flex items-center gap-1 border-b border-line bg-header px-2 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] md:gap-2 md:px-3 md:py-2">
          <button onClick={goToDesk} className="btn btn-ghost !p-2" title="Back to desk" aria-label="Back to desk">
            <ArrowLeft size={phone ? 20 : 18} />
          </button>
          {journal && journalNav("prev")}
          <div className={journal && !phone ? "min-w-0 shrink" : "min-w-0 flex-1"}>
            <div className="group/title relative max-w-xl">
            <input
              value={title}
              autoCapitalize={mode === "manglish" ? "off" : "sentences"}
              autoCorrect={mode === "manglish" ? "off" : "on"}
              onFocus={() => {
                titleBefore.current = titleRef.current;
              }}
              onChange={(e) => {
                // In Manglish mode a finished word turns into Malayalam, as in the text (and in the phone app's rename box)
                let v = e.target.value;
                const el = e.target;
                const at = el.selectionStart ?? v.length;
                const done = mode === "manglish" && !(e.nativeEvent as InputEvent).isComposing ? /([A-Za-z~_^]+)([^A-Za-z~_^])$/.exec(v.slice(0, at)) : null;
                if (done) {
                  const ml = toMalayalam(done[1]);
                  const start = at - done[0].length;
                  v = v.slice(0, start) + ml + done[2] + v.slice(at);
                  const caret = start + ml.length + done[2].length;
                  requestAnimationFrame(() => el.setSelectionRange(caret, caret));
                }
                titleDirty.current = true;
                setTitle(v);
                titleRef.current = v;
                recheckPristine();
                saver.current?.touch();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape" && titleBefore.current !== null) {
                  // Esc cancels: the title goes back to what it was, and the cursor leaves it
                  e.preventDefault();
                  e.stopPropagation();
                  const v = titleBefore.current;
                  titleDirty.current = false;
                  if (v !== titleRef.current) {
                    setTitle(v);
                    titleRef.current = v;
                    recheckPristine();
                    saver.current?.touch();
                  }
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={() => {
                const before = titleBefore.current;
                titleBefore.current = null;
                // a title left empty gets its earlier name back, so a work is never nameless
                if (!titleRef.current.trim() && before?.trim()) {
                  titleDirty.current = false;
                  setTitle(before);
                  titleRef.current = before;
                  recheckPristine();
                  saver.current?.touch();
                  return;
                }
                // the last word, typed in Manglish, when leaving the title
                if (!titleDirty.current || mode !== "manglish" || !/[A-Za-z]/.test(titleRef.current)) return;
                titleDirty.current = false;
                const v = toMalayalam(titleRef.current);
                setTitle(v);
                titleRef.current = v;
                recheckPristine();
                saver.current?.touch();
              }}
              className={`${journal && !phone ? "min-w-24 [field-sizing:content]" : "w-full"} max-w-xl truncate rounded-md bg-transparent px-1.5 py-0.5 text-[1rem] font-semibold hover:bg-subtle focus:bg-subtle focus:outline-none md:text-[1.05rem] ${title ? "focus:pr-8" : ""}`}
              aria-label="Title"
            />
            {title && (
              <button
                type="button"
                // shown while the title is being edited (always reachable on touch screens)
                className="absolute right-1 top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink group-focus-within/title:grid"
                aria-label={t("field.clear")}
                title={t("field.clear")}
                // keep the title focused, so Esc can still bring the old title back
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement | null);
                  if (titleBefore.current === null) titleBefore.current = titleRef.current;
                  titleDirty.current = false;
                  setTitle("");
                  titleRef.current = "";
                  recheckPristine();
                  saver.current?.touch();
                  input?.focus();
                }}
              >
                <X size={14} aria-hidden />
              </button>
            )}
            </div>
            {journal ? (
              <div className={`flex items-center gap-2 truncate px-1.5 text-muted ${phone ? (tiny ? "text-[11.5px]" : "text-xs") : "text-[11.5px]"}`}>
                {phone ? (
                  save === "saving" || save === "offline" || save === "local" ? (
                    <span aria-live="polite" className={`truncate ${save === "offline" ? "font-semibold text-danger" : ""}`}>{saveText}</span>
                  ) : (
                    <span className="truncate">
                      {shortDate(initial.created_at)}
                      {!sameDay(initial.created_at, editedAt) && ` · ${t("journals.edited", { date: shortDate(editedAt) })}`}
                    </span>
                  )
                ) : (
                  <>
                    <span className="font-semibold text-highlight">{template.ml}</span>
                    <span className="shrink-0">
                      {t("journals.started", { date: shortDate(initial.created_at) })}
                      {!sameDay(initial.created_at, editedAt) && ` · ${t("journals.edited", { date: shortDate(editedAt) })}`}
                    </span>
                    <span aria-live="polite" className={`truncate ${save === "offline" ? "font-semibold text-danger" : ""}`}>{saveText}</span>
                  </>
                )}
              </div>
            ) : (
            <div className="flex items-center gap-2 truncate px-1.5 text-[11.5px] text-muted">
              <span className="font-semibold text-highlight">{template.ml}</span>
              {phone ? (
                <span>
                  {stats.words.toLocaleString("en-IN")} {stats.words === 1 ? "word" : "words"}
                  {!pageless && ` · ${stats.pages} ${stats.pages === 1 ? "page" : "pages"}`}
                </span>
              ) : (
                <span>{settings.pageSize}</span>
              )}
              <span aria-live="polite" className={`truncate ${save === "offline" ? "font-semibold text-danger" : ""}`}>
                {saveText}
              </span>
            </div>
            )}
          </div>
          {journal && journalNav("next")}
          {journal && !phone && <div className="flex-1" />}

          <TimerChip onOpen={() => openPanel("goals")} />
          {phone ? (
            journal && tiny ? null : <button className={`btn btn-ghost !p-2 ${panel === "ai" ? "text-accent" : ""}`} onClick={() => openPanel(panel === "ai" ? null : "ai")} aria-label="AI companion">
              <Sparkles size={20} />
            </button>
          ) : (
            <>
              <div className="relative">
                <button
                  className="btn btn-ghost !px-2.5"
                  data-menu-button
                  onClick={() => (journal ? setJournalExport(true) : setMenu(menu === "export" ? null : "export"))}
                  aria-expanded={journal ? journalExport : menu === "export"}
                  aria-haspopup={journal ? "dialog" : "menu"}
                >
                  <Download size={16} /> <span className="hidden lg:inline">Export</span>
                </button>
                {menu === "export" && !journal && (
                  <Menu onClose={() => setMenu(null)}>
                    {exportItems.map((x) => (
                      <MenuItem key={x.label} onClick={x.run} icon={<FileText size={15} />} label={x.label} hint={x.hint} />
                    ))}
                  </Menu>
                )}
              </div>
              {/* journals are never shared by link */}
              {!journal && <div className="relative">
                <button className="btn btn-ghost !px-2.5" data-menu-button onClick={() => setMenu(menu === "share" ? null : "share")} aria-expanded={menu === "share"}>
                  <Share2 size={16} /> <span className="hidden lg:inline">Share</span>
                </button>
                {menu === "share" && (
                  <Menu onClose={() => setMenu(null)} wide>
                    <div className="p-3">{shareBody}</div>
                  </Menu>
                )}
              </div>}
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

      {!focus && !phone && editor && <Toolbar editor={editor} template={template} mode={mode} onMode={changeMode} onFind={() => setFindOpen(true)} metre={metreToggle} onFillCast={initial.kind === "drama" ? fillCast : undefined} />}

      <div className="flex min-h-0 flex-1">
        {/* ── Outline: docked on laptops and up ── */}
        {!focus && outline && editor && (screen === "desktop" || screen === "wide") && (
          <aside className="no-print scrollbar-thin w-56 shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-4">
            <OutlinePanel editor={editor} labelsEn={settings.headingLabels === "en"} />
          </aside>
        )}

        {/* The page keeps its full width: on tablets and laptops panels slide over it instead of squeezing it. */}
        <div className="relative flex min-w-0 flex-1">
          {/* ── Desk with A4 pages ── */}
          <main
            ref={deskRef}
            className={`desk-scroll scrollbar-thin relative min-w-0 flex-1 overflow-auto bg-canvas ${phone ? "px-2 pb-6 pt-3" : "px-4 py-8"}`}
            // A click beside the page or in its margins puts the cursor on that line (like Google Docs),
            // instead of throwing it to the end of the work.
            onMouseDown={(e) => {
              const el = e.target as HTMLElement;
              if (!editor || e.button !== 0 || editor.view.dom.contains(el)) return;
              if (el !== e.currentTarget && !el.classList.contains("page-wrap") && !el.closest(".page-stack")) return;
              if (el.closest("button, a, input, textarea")) return;
              e.preventDefault();
              caretNear(editor, e.clientX, e.clientY);
            }}
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
            <div style={pageless ? undefined : { height: totalH * zoom + 4, width: `calc(${pageSize.w}mm * ${zoom})` }} className="page-wrap mx-auto">
              <div
                className={`page-stack ${docClasses(initial.kind, settings)} ${metreOn ? "show-metre" : ""} ${focus ? "focus-mode" : ""} ${pageless ? "pageless" : ""}`}
                style={{ ...stackStyle, transformOrigin: "top left" }}
              >
                {!pageless && Array.from({ length: stats.pages }, (_, i) => (
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
                {/* the gap between two sheets: "Insert page" adds a blank page there (Backspace on it removes it again) */}
                {!focus &&
                  !pageless &&
                  editor &&
                  Array.from({ length: stats.pages - 1 }, (_, i) => (
                    <div
                      key={`gap-${i}`}
                      className="page-gap no-print group/gap absolute inset-x-0 z-10 flex items-center justify-center"
                      style={{ top: (i + 1) * (pageH + PAGE_GAP_PX) - PAGE_GAP_PX, height: PAGE_GAP_PX }}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const at = paginationKey.getState(editor.state)?.breaks[i]?.pos;
                          if (at != null) editor.chain().focus().insertPageAt(at).run();
                        }}
                        className="flex items-center gap-1 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-ink opacity-0 shadow-sm transition-[opacity,color,border-color] hover:border-accent hover:text-accent focus-visible:opacity-100 group-hover/gap:opacity-100 [@media(hover:none)]:opacity-100"
                        aria-label={t("editor.insertPageAria", { a: i + 1, b: i + 2 })}
                      >
                        <Plus size={13} aria-hidden /> {t("editor.insertPage")}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
            {/* phones show the suggestions on the keyboard strip instead (below) */}
            {editor && !keyboardStrip && <ManglishPopup editor={editor} />}
            {editor && !keyboardStrip && <SpellSuggest editor={editor} />}
            {editor && !phone && (
              <EditorContextMenu
                editor={editor}
                onLookUp={() => openPanel("dict")}
                onRhymes={() => openPanel("rhyme")}
                onAskAI={() => openPanel("ai")}
                onShortcuts={() => setShowKeys(true)}
              />
            )}
            {editor && usesCues && <CueSuggest editor={editor} names={castNames} />}
            {editor && template.footnotes && <FootnoteDialog editor={editor} bottomOffset={phone ? kb : 0} />}
            {notice && (
              <div className="no-print pop-in fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm text-primary-ink shadow-lg" role="status">
                {notice}
              </div>
            )}
          </main>

          {!focus && screen === "tablet" && outline && editor && (
            <Sheet mode="drawer" side="left" title="Contents" onClose={() => setOutline(false)}>
              <OutlinePanel editor={editor} title={false} labelsEn={settings.headingLabels === "en"} />
            </Sheet>
          )}
          {!focus && panel && editor && panelMode === "drawer" && (
            <Sheet mode="drawer" title={panelLabel(panel)} onClose={() => setPanel(null)}>
              {panelBody(panel)}
            </Sheet>
          )}
        </div>

        {!focus && panel && editor && panelMode === "dock" && (
          <Sheet mode="dock" title={panelLabel(panel)} onClose={() => setPanel(null)}>
            {panelBody(panel)}
          </Sheet>
        )}

        {/* ── Side rail (tablet and up) ── */}
        {!focus && !phone && (
          // Collapsed it's a thin icon rail; hovering (or tabbing into) it slides out labels over the page.
          <nav className="group/rail no-print relative w-12 shrink-0" aria-label="Panels">
            <div className="scrollbar-none absolute inset-y-0 right-0 z-40 flex w-12 flex-col gap-0.5 overflow-y-auto overflow-x-hidden border-l border-line bg-surface px-1.5 py-2 transition-[width,box-shadow] duration-200 ease-out group-hover/rail:w-56 group-hover/rail:shadow-[var(--pop-shadow)] group-hover/rail:delay-150 group-has-[:focus-visible]/rail:w-56 group-has-[:focus-visible]/rail:shadow-[var(--pop-shadow)]">
              {/* grouped like the phone's More sheet: write, words, plan and assist, page, review and share */}
              {(() => {
                const tool = (id: PanelId) => {
                  const p = PANELS.find((x) => x.id === id)!;
                  return <RailBtn key={p.id} active={panel === p.id} onClick={() => setPanel(panel === p.id ? null : p.id)} label={panelLabel(p.id)} icon={p.icon} tint={p.tint} badge={p.id === "inbox" ? inboxCount : 0} />;
                };
                const groups: [string, React.ReactNode[]][] = [
                  [t("app.tools.groupWrite"), [<RailBtn key="outline" active={outline} onClick={() => setOutline((o) => !o)} label="Outline" hint="Chapters and headings" icon={ListTree} tint="text-tint-sky" />, tool("story"), tool("dict")]],
                  [t("app.tools.groupWords"), [tool("saved"), tool("rhyme"), ...(template.metre ? [tool("metre")] : []), tool("check"), tool("keys")]],
                  [t("app.tools.groupPlan"), [tool("ai"), tool("inbox"), tool("goals")]],
                  [t("app.tools.groupPage"), [tool("page"), <RailBtn key="typewriter" active={typewriter} onClick={() => setTypewriter((tw) => !tw)} label="Typewriter scrolling" hint="While you type, keep the line you are writing in the middle of the screen" icon={TypewriterIcon} tint="text-tint-lime" />]],
                  [
                    t("app.tools.groupShare"),
                    [
                      tool("read"),
                      tool("history"),
                      ...(store.isCloud() && shareId && isPublic && !journal
                        ? [
                            <a key="reader" href={`${BASE}/read/?s=${shareId}`} target="_blank" rel="noreferrer" className="flex h-9 shrink-0 items-center gap-3 rounded-lg px-[9px] text-muted hover:bg-subtle hover:text-ink" aria-label="Open reader view">
                              <Eye size={17} className="shrink-0" />
                              <span className="whitespace-nowrap text-[13px] opacity-0 transition-opacity group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100">Reader view</span>
                            </a>,
                          ]
                        : []),
                    ],
                  ],
                ];
                return groups.map(([label, items], i) => (
                  <div key={label} role="group" aria-label={label} className="flex shrink-0 flex-col gap-0.5">
                    {/* closed rail: a thin line between groups; open rail: the group's name */}
                    <div className={`relative h-6 shrink-0 ${i ? "mt-1" : ""}`}>
                      {i > 0 && <span aria-hidden className="absolute inset-x-1.5 top-1/2 h-px bg-line transition-opacity group-hover/rail:opacity-0 group-hover/rail:delay-150 group-has-[:focus-visible]/rail:opacity-0" />}
                      <span aria-hidden className="absolute inset-x-[9px] top-1/2 -translate-y-1/2 whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted opacity-0 transition-opacity group-hover/rail:opacity-100 group-hover/rail:delay-150 group-has-[:focus-visible]/rail:opacity-100">
                        {label}
                      </span>
                    </div>
                    {items}
                  </div>
                ));
              })()}
            </div>
          </nav>
        )}
      </div>

      {/* ── Phone: bottom sheets ── */}
      {phone && panel && editor && (
        <Sheet mode="sheet" bottomOffset={kb} title={panelLabel(panel)} onClose={() => setPanel(null)}>
          {panelBody(panel)}
        </Sheet>
      )}
      {phone && phoneSheet === "format" && editor && (
        <Sheet mode="sheet" bottomOffset={kb} title="Format" onClose={() => setPhoneSheet(null)}>
          <Toolbar editor={editor} template={template} mode={mode} onMode={changeMode} onFind={() => { setPhoneSheet(null); setFindOpen(true); }} variant="sheet" metre={metreToggle} onFillCast={initial.kind === "drama" ? () => { setPhoneSheet(null); fillCast(); } : undefined} />
        </Sheet>
      )}
      {phone && phoneSheet === "outline" && editor && (
        <Sheet mode="sheet" bottomOffset={kb} title="Contents" onClose={() => setPhoneSheet(null)}>
          <div onClickCapture={(e) => (e.target as HTMLElement).closest("button") && setTimeout(() => setPhoneSheet(null), 120)}>
            <OutlinePanel editor={editor} title={false} labelsEn={settings.headingLabels === "en"} />
          </div>
        </Sheet>
      )}
      {phone && phoneSheet === "more" && (
        <Sheet mode="sheet" bottomOffset={kb} title="More" onClose={() => setPhoneSheet(null)}>
          {/* grouped like the phone app's tools sheet: words, planning, the page, then review */}
          {(() => {
            const panel = (id: PanelId) => {
              const p = PANELS.find((x) => x.id === id)!;
              return <Tile key={p.id} icon={p.icon} label={p.shortKey ? t(p.shortKey) : p.short} tint={p.tint} badge={p.id === "inbox" ? inboxCount : 0} onClick={() => openPanel(p.id)} />;
            };
            const groups: [string, React.ReactNode[]][] = [
              [t("app.tools.groupWords"), [panel("saved"), panel("rhyme"), ...(template.metre ? [panel("metre")] : []), panel("check"), panel("keys")]],
              [t("app.tools.groupPlan"), [panel("ai"), panel("inbox"), panel("goals")]],
              [t("app.tools.groupPage"), [
                panel("page"),
                <Tile key="pages" icon={Files} label={t("editor.pages.tile")} tint="text-tint-sky" active={phonePages} onClick={() => { togglePhonePages(); setPhoneSheet(null); }} />,
                <Tile key="find" icon={Search} label="Find" tint="text-tint-tangerine" onClick={() => { setPhoneSheet(null); setFindOpen(true); }} />,
                <Tile key="typewriter" icon={TypewriterIcon} label="Typewriter" tint="text-tint-lime" active={typewriter} onClick={() => setTypewriter((t) => !t)} />,
                <Tile key="focus" icon={Maximize2} label="Focus" onClick={() => { setPhoneSheet(null); setFocus(true); }} />,
              ]],
              [t("app.tools.groupShare"), [
                panel("read"),
                panel("history"),
                ...(store.isCloud() && shareId && isPublic && !journal ? [<Tile key="reader" icon={Eye} label="Reader" onClick={() => window.open(`${BASE}/read/?s=${shareId}`, "_blank")} />] : []),
              ]],
            ];
            return groups.map(([label, tiles], i) => (
              <div key={label}>
                <h3 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted ${i ? "mt-4" : ""}`}>{label}</h3>
                <div className="grid grid-cols-4 gap-1.5">{tiles}</div>
              </div>
            ));
          })()}
          <h3 className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Export</h3>
          {journal ? (
            <div className="overflow-hidden rounded-xl border border-line bg-paper">
              <button onClick={() => { setPhoneSheet(null); setJournalExport(true); }} className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-sm active:bg-subtle">
                <Download size={16} className="text-muted" /> {t("journals.exportDialog.title")}
              </button>
            </div>
          ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-paper">
            {exportItems.filter((x) => x.label !== "Quick print").map((x) => (
              <button key={x.label} onClick={x.run} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left text-sm last:border-0 active:bg-subtle">
                <FileText size={16} className="text-muted" /> {x.label}
              </button>
            ))}
          </div>
          )}
          {!journal && (
            <>
              <h3 className="mb-1.5 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Share</h3>
              <div className="rounded-xl border border-line bg-paper p-3">{shareBody}</div>
            </>
          )}
          <div className="mt-5 flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-2 text-sm">
            <span>Theme</span>
            <ThemeToggle />
          </div>
        </Sheet>
      )}

      {storyOpen && <StoryWorld doc={docRef.current} editor={editor} columns={settings.beatColumns} onColumns={(beatColumns) => updateSettings({ beatColumns })} onClose={() => setStoryOpen(false)} />}
      {journalExport && <JournalExport current={currentDoc()} beforeExport={() => saver.current?.flush() ?? Promise.resolve()} onClose={() => setJournalExport(false)} />}
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
            onInbox={store.isCloud() ? () => { hideKeyboard(); openPanel("inbox"); } : undefined}
            inboxCount={inboxCount}
          />
          {/* right on top of the keyboard, where a phone keyboard shows its own suggestions */}
          <ManglishPopup editor={editor} docked />
        </div>
      ) : (
        // z-20: the selection bar above it must stay over the page text, also after a sheet closes (audit, 26 Nov)
        <div className="relative z-20">
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

/** Put the cursor at the text nearest to a point beside or around the page, without scrolling. */
function caretNear(editor: Editor, x: number, y: number) {
  const { view } = editor;
  const box = view.dom.getBoundingClientRect();
  const left = Math.min(Math.max(x, box.left + 1), box.right - 1);
  const top = Math.min(Math.max(y, box.top + 1), box.bottom - 1);
  const hit = view.posAtCoords({ left, top });
  const doc = view.state.doc;
  const sel = hit ? TextSelection.near(doc.resolve(Math.min(hit.pos, doc.content.size))) : TextSelection.atEnd(doc);
  if (!view.state.selection.eq(sel)) view.dispatch(view.state.tr.setSelection(sel));
  view.focus();
}

/**
 * Re-render the editor shell so the toolbar shows the current marks, block type and undo state.
 * Clicks, arrow keys and formatting refresh on the next frame; plain typing waits for a short
 * pause, so a keystroke only costs ProseMirror's own work.
 */
function useToolbarRefresh(editor: Editor | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const now = () => {
      clearTimeout(idle);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTick((n) => n + 1));
    };
    const onTx = ({ transaction: tr }: { transaction: Transaction }) => {
      // typing, Enter and Backspace only replace text; marks, block types and attributes use other steps
      const typing = tr.docChanged && tr.selection.empty && tr.steps.every((s) => s instanceof ReplaceStep);
      if (!typing) return now();
      clearTimeout(idle);
      idle = setTimeout(now, 180);
    };
    editor.on("transaction", onTx);
    editor.on("focus", now);
    editor.on("blur", now);
    return () => {
      editor.off("transaction", onTx);
      editor.off("focus", now);
      editor.off("blur", now);
      clearTimeout(idle);
      cancelAnimationFrame(frame);
    };
  }, [editor]);
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

function Tile({ icon: Icon, label, onClick, active, badge = 0, tint = "" }: { icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; active?: boolean; badge?: number; tint?: string }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`relative flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-[11.5px] leading-tight ${active ? "bg-accent-soft text-accent" : "bg-paper text-ink active:bg-subtle"}`}>
      <span className={active ? "" : tint}>
        <Icon size={20} />
      </span>
      <span className="text-center">{label}</span>
      {badge > 0 && <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] font-bold text-white">{badge}</span>}
    </button>
  );
}

function RailBtn({ active, onClick, label, hint, icon: Icon, badge = 0, tint = "" }: { active: boolean; onClick: () => void; label: string; hint?: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: number; tint?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={hint}
      className={`relative flex h-9 w-full shrink-0 items-center gap-3 rounded-lg px-[9px] text-left ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-subtle hover:text-ink"}`}
    >
      <Icon size={17} className={`shrink-0 ${active ? "" : tint}`} />
      <span className="whitespace-nowrap text-[13px] font-medium opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-hover/rail:delay-150 group-has-[:focus-visible]/rail:opacity-100">{label}</span>
      {badge > 0 && <span className="absolute left-5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] font-bold text-white">{badge}</span>}
    </button>
  );
}

function Menu({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  // the editor re-renders often, so keep the latest onClose in a ref and add the listeners once:
  // re-adding them on every render (through a timer) left stray listeners that closed the next menu at once
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-menu], [data-menu-button]")) close.current();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    const timer = setTimeout(() => document.addEventListener("click", h));
    document.addEventListener("keydown", k);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", h);
      document.removeEventListener("keydown", k);
    };
  }, []);
  return (
    <div data-menu className={`absolute right-0 top-10 z-50 rounded-xl border border-line bg-paper p-1.5 shadow-xl [&>button+button]:mt-0.5 ${wide ? "w-80" : "w-56"}`} role="menu">
      {children}
    </div>
  );
}

function MenuItem({ onClick, icon, label, hint }: { onClick: () => void; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-sm hover:bg-subtle">
      {icon}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </button>
  );
}

function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const t = useT();
  const [term, setTerm] = useState("");
  const [rep, setRep] = useState("");
  const [cs, setCs] = useState(false);
  const st = searchKey.getState(editor.state);
  useEffect(() => {
    editor.commands.setSearch(term, cs);
  }, [term, cs, editor]);
  useEffect(() => () => void editor.commands.setSearch(""), [editor]);
  const n = st?.results.length ?? 0;
  // Esc or Close: back to the text with the match it was showing selected, never to the page body (audit, 26 Nov)
  const close = () => {
    const s2 = searchKey.getState(editor.state);
    const hit = s2?.results[s2.current ?? 0];
    onClose();
    if (hit) editor.chain().focus().setTextSelection(hit).scrollIntoView().run();
    else editor.commands.focus();
  };
  // Manglish typed in the box: the Malayalam words of this work that sound like it; Malayalam typed:
  // other spellings of the same sound (കത → കഥ) and near misses
  const latinTerm = /[a-z]/i.test(term);
  const sounds = useMemo(() => (term.trim() ? manglishMatches(editor.state.doc.textBetween(0, editor.state.doc.content.size, " ", " "), term) : []), [term, editor]);
  return (
    <div className="no-print sticky top-0 z-30 mx-auto mb-4 flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-line bg-paper p-2 shadow-lg" role="search">
      <input
        autoFocus
        className="field min-w-[7.5rem] flex-1 !py-1.5 !text-sm sm:!w-52 sm:flex-none"
        placeholder={t("app.find.hint")}
        aria-label={t("app.find.hint")}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") editor.commands.searchStep(e.shiftKey ? -1 : 1);
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
      />
      <span className="w-14 text-center text-xs text-muted">{term ? (n ? `${(st?.current ?? 0) + 1} / ${n}` : "0") : ""}</span>
      <button className="btn btn-ghost !p-1.5" onClick={() => editor.commands.searchStep(-1)} aria-label={t("app.find.previous")}>
        <ChevronUp size={15} />
      </button>
      <button className="btn btn-ghost !p-1.5" onClick={() => editor.commands.searchStep(1)} aria-label={t("app.find.next")}>
        <ChevronDown size={15} />
      </button>
      <input className="field min-w-[7.5rem] flex-1 !py-1.5 !text-sm sm:!w-44 sm:flex-none" placeholder={t("app.find.replace")} aria-label={t("app.find.replace")} value={rep} onChange={(e) => setRep(e.target.value)} />
      <button className="btn btn-outline !px-2 !py-1 !text-xs" onClick={() => editor.commands.replaceCurrent(rep)} disabled={!n}>
        {t("app.find.replaceOne")}
      </button>
      <button className="btn btn-outline !px-2 !py-1 !text-xs" onClick={() => editor.commands.replaceAll(rep)} disabled={!n} aria-label={t("app.find.replaceAll")}>
        {t("app.find.all")}
      </button>
      <label className="flex items-center gap-1 px-1 text-xs text-muted" title={t("app.find.matchCase")} aria-label={t("app.find.matchCase")}>
        <input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} /> Aa
      </label>
      <button className="btn btn-ghost !p-1.5" onClick={close} aria-label={t("app.find.close")}>
        <X size={15} />
      </button>
      {sounds.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5 px-1 pt-1 text-xs text-muted" title={t(latinTerm ? "search.inMalayalamHint" : "search.soundsLikeHint")}>
          {t(latinTerm ? "search.inMalayalam" : "search.soundsLike")}:
          {sounds.map((w) => (
            <button key={w} type="button" data-private className="rounded-[6px] border border-line-strong bg-surface px-2 py-0.5 text-sm text-ink hover:border-accent hover:text-accent" style={{ fontFamily: "'Anek Malayalam'" }} onClick={() => setTerm(w)}>
              {w}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
