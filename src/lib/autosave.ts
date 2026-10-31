"use client";
/**
 * Litma autosave — designed so an interruption (tab crash, power cut, lost Wi-Fi,
 * closed laptop) never loses more than a fraction of a second of writing.
 *
 *  1. Every change is written to a local journal on this device immediately (≤200 ms apart).
 *  2. The cloud copy is saved 0.9 s after typing pauses, and at least every 5 s while
 *     typing continues.
 *  3. Failed saves retry with back-off (2 s → 60 s) and immediately when the browser
 *     comes back online or the tab is hidden.
 *  4. When the document is reopened, a journal newer than the cloud copy is restored.
 */
import type { JSONContent } from "@tiptap/core";

export type SaveStatus = "saved" | "dirty" | "saving" | "offline";

export interface Journal {
  content: JSONContent;
  title?: string;
  at: string;
}

const key = (id: string) => `litma:journal:${id}`;

export function readJournal(id: string): Journal | null {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as Journal) : null;
  } catch {
    return null;
  }
}

export function clearJournal(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {}
}

interface Options {
  id: string;
  /** Snapshot of the current document to journal and save. */
  snapshot: () => { content: JSONContent; title?: string } | null;
  /** Persist to the cloud; throw on failure. */
  save: (snap: { content: JSONContent; title?: string }) => Promise<void>;
  onStatus: (s: SaveStatus) => void;
}

export class DocSaver {
  private version = 0;
  private savedVersion = 0;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private maxWait: ReturnType<typeof setTimeout> | null = null;
  private journalTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 0;
  private inflight: Promise<void> | null = null;
  private again = false;
  private disposed = false;

  constructor(private o: Options) {
    window.addEventListener("online", this.onOnline);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onHide);
  }

  get unsaved() {
    return this.savedVersion !== this.version;
  }

  /** Call on every edit. */
  touch() {
    this.version++;
    this.o.onStatus("dirty");
    // journal: write now, then at most every 200 ms while typing continues
    if (!this.journalTimer) {
      this.writeJournal();
      this.journalTimer = setTimeout(() => {
        this.journalTimer = null;
        if (this.unsaved) this.writeJournal();
      }, 200);
    }
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.flush(), 900);
    if (!this.maxWait) this.maxWait = setTimeout(() => this.flush(), 5000);
  }

  writeJournal() {
    const snap = this.o.snapshot();
    if (!snap) return;
    try {
      localStorage.setItem(key(this.o.id), JSON.stringify({ ...snap, at: new Date().toISOString() } satisfies Journal));
    } catch {
      /* storage full: the cloud save still runs */
    }
  }

  /** Save now (no-op when nothing changed). Resolves when the save attempt finishes. */
  async flush(): Promise<void> {
    if (this.disposed && !this.unsaved) return;
    if (this.debounce) clearTimeout(this.debounce);
    if (this.maxWait) clearTimeout(this.maxWait);
    this.debounce = this.maxWait = null;
    if (this.inflight) {
      this.again = true;
      return this.inflight;
    }
    if (!this.unsaved) return;
    const target = this.version;
    const snap = this.o.snapshot();
    if (!snap) return;
    this.o.onStatus("saving");
    this.inflight = (async () => {
      try {
        await this.o.save(snap);
        this.savedVersion = Math.max(this.savedVersion, target);
        this.retryDelay = 0;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        if (!this.unsaved) {
          clearJournal(this.o.id);
          this.o.onStatus("saved");
        }
      } catch {
        this.writeJournal();
        this.o.onStatus("offline");
        this.retryDelay = Math.min(60_000, Math.max(2000, this.retryDelay * 2));
        if (this.retryTimer) clearTimeout(this.retryTimer);
        if (!this.disposed) this.retryTimer = setTimeout(() => this.flush(), this.retryDelay);
      }
    })();
    try {
      await this.inflight;
    } finally {
      this.inflight = null;
      if (this.again) {
        this.again = false;
        if (this.unsaved) await this.flush();
      }
    }
  }

  private onOnline = () => {
    if (this.unsaved) this.flush();
  };
  private onVisibility = () => {
    if (document.visibilityState === "hidden" && this.unsaved) {
      this.writeJournal();
      this.flush();
    }
  };
  private onHide = () => {
    if (this.unsaved) this.writeJournal();
  };

  dispose() {
    this.disposed = true;
    window.removeEventListener("online", this.onOnline);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onHide);
    if (this.journalTimer) clearTimeout(this.journalTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
}
