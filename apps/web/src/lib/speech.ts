"use client";
/**
 * Read aloud with the device's own voices (Web Speech API): free, no account, works offline where
 * the voice is installed on the device. Malayalam voices: Google's on Android, Microsoft's online
 * voices in Edge; most Macs, iPhones and Windows apps have none yet (the panel says so).
 * Voice, speed, pitch and volume are the writer's; the word being spoken is marked when the voice
 * sends word boundaries (many local voices do, Chrome's online Google voices don't).
 */
import type { Editor } from "@tiptap/core";
import { blockText, setReading } from "@/extensions/writing-aids";

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

export function malayalamVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => /^ml\b|^ml[-_]/i.test(v.lang) || /malayalam/i.test(v.name))
    .sort((a, b) => Number(b.localService === false) - Number(a.localService === false) || a.name.localeCompare(b.name));
}

/** Voices load late in Chrome: call back now and whenever the list changes. */
export function onVoices(cb: (v: SpeechSynthesisVoice[]) => void): () => void {
  if (!speechSupported()) {
    cb([]);
    return () => {};
  }
  const run = () => cb(malayalamVoices());
  run();
  speechSynthesis.addEventListener("voiceschanged", run);
  const late = setTimeout(run, 1200);
  return () => {
    speechSynthesis.removeEventListener("voiceschanged", run);
    clearTimeout(late);
  };
}

export type Platform = "android" | "ios" | "mac" | "windows" | "linux" | "other";
export function platform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Macintosh|Mac OS X/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua)) return "linux";
  return "other";
}

interface Piece {
  from: number;
  to: number;
  text: string;
}

/** The work as sentences (and verse lines), with their positions, so each can be shown while read. */
export function pieces(editor: Editor): Piece[] {
  const out: Piece[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = blockText(node);
    // sentence ends, line breaks (verse) and long clauses; Chrome cuts utterances off after ~15 s
    const re = /[^.!?।\n]+[.!?।]*\s*|\n/g;
    for (const m of text.matchAll(re)) {
      const raw = m[0];
      // inline leaves (footnotes, breaks) stay in as one character each so positions line up;
      // they are spoken as a space
      const clean = raw.trim();
      if (!clean.replace(/￼/g, "").trim()) continue;
      const start = (m.index ?? 0) + (raw.length - raw.trimStart().length);
      const chunks = clean.length > 220 ? clean.match(/.{1,200}(\s|$)|.{1,200}/g) ?? [clean] : [clean];
      let at = start;
      for (const c of chunks) {
        out.push({ from: pos + 1 + at, to: pos + 1 + at + c.length, text: c.replace(/￼/g, " ") });
        at += c.length;
      }
    }
    return false;
  });
  return out;
}

export interface Reading {
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export interface VoiceSettings {
  voice?: SpeechSynthesisVoice;
  /** 1 is the voice's normal speed */
  rate: number;
  /** 1 is the voice's normal pitch */
  pitch: number;
  /** 0 to 1 */
  volume: number;
}

/** Length of the word starting at `at` (for voices that send a boundary without its length). */
export function wordLength(text: string, at: number): number {
  return /^[^\s.,!?;:।"'“”‘’()[\]{}]+/u.exec(text.slice(at))?.[0].length ?? 0;
}

/**
 * Read the work from a position. `settings` is read before each sentence, so changes made while
 * reading apply from the next one. Calls onState as it goes; onEnd when it finishes or stops.
 */
export function readAloud(
  editor: Editor,
  opts: { from: number; settings: () => VoiceSettings; onState: (s: { index: number; total: number; paused: boolean }) => void; onEnd: () => void }
): Reading {
  const list = pieces(editor).filter((p) => p.to > opts.from);
  let i = 0;
  let stopped = false;
  let paused = false;
  const done = () => {
    if (stopped) return;
    stopped = true;
    speechSynthesis.cancel();
    setReading(editor, null);
    opts.onEnd();
  };
  const next = () => {
    if (stopped) return;
    if (i >= list.length) return done();
    const p = list[i];
    setReading(editor, { from: p.from, to: p.to });
    try {
      const dom = editor.view.domAtPos(p.from).node as HTMLElement;
      (dom.nodeType === 1 ? dom : dom.parentElement)?.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      /* position gone */
    }
    const s = opts.settings();
    const u = new SpeechSynthesisUtterance(p.text);
    u.lang = s.voice?.lang ?? "ml-IN";
    if (s.voice) u.voice = s.voice;
    u.rate = s.rate;
    u.pitch = s.pitch;
    u.volume = s.volume;
    u.onboundary = (e) => {
      if (stopped || (e.name && e.name !== "word")) return;
      const at = e.charIndex;
      const len = Math.min(e.charLength || wordLength(p.text, at), p.text.length - at);
      if (at < 0 || len <= 0 || !p.text.slice(at, at + len).trim()) return;
      setReading(editor, { from: p.from, to: p.to, word: { from: p.from + at, to: p.from + at + len } });
    };
    u.onend = () => {
      i++;
      if (!paused) next();
    };
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      i++;
      next();
    };
    opts.onState({ index: i, total: list.length, paused: false });
    speechSynthesis.speak(u);
  };
  speechSynthesis.cancel();
  next();
  return {
    stop: done,
    // pause()/resume() are unreliable on Android: stop the sentence and start it again on resume
    pause: () => {
      paused = true;
      speechSynthesis.cancel();
      opts.onState({ index: i, total: list.length, paused: true });
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      next();
    },
  };
}
