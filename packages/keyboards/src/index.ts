/**
 * Built-in Malayalam keyboard layouts. Layout data is plain JSON (shared with the desktop and
 * native apps); this file turns a physical key press into the text to insert.
 */
import inscript from "../layouts/ml-inscript.json";

export type KeyLayer = Record<string, string>;
export interface KeyboardLayout {
  id: string;
  name: string;
  base: KeyLayer;
  shift: KeyLayer;
  altgr: KeyLayer;
  altgrShift: KeyLayer;
  chillu: Record<string, string>;
}

export const LAYOUTS = { inscript: inscript as KeyboardLayout } as const;
/** "inscript": Litma maps keys itself · "system": leave typing to the device's own Malayalam keyboard */
export type MalayalamLayout = keyof typeof LAYOUTS | "system";

const STORAGE_KEY = "litma:mlLayout";
export function readLayout(): MalayalamLayout {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "system" || v === "inscript") return v;
  } catch {
    /* storage may be unavailable */
  }
  // phones and tablets type through their own keyboard apps
  if (typeof window !== "undefined" && window.matchMedia?.("(hover: none) and (pointer: coarse)").matches) return "system";
  return "inscript";
}
export function storeLayout(l: MalayalamLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
}

type KeyInfo = Pick<KeyboardEvent, "code" | "key" | "shiftKey" | "altKey" | "ctrlKey" | "metaKey"> & { getModifierState?: (k: string) => boolean };

/**
 * The text a key press should insert, or null to let the browser handle it.
 * Only plain ASCII key output is translated: if the system layout already produces Malayalam
 * (a phone keyboard, macOS Malayalam input) the key passes through untouched.
 */
export function keyToText(layout: KeyboardLayout, e: KeyInfo): string | null {
  if (e.metaKey) return null;
  const altgr = e.getModifierState?.("AltGraph") || (e.ctrlKey && e.altKey);
  if (!altgr && (e.ctrlKey || e.altKey)) return null;
  if (!e.code || e.key.length !== 1 || e.key.charCodeAt(0) > 0x7e) return null;
  const layer = altgr ? (e.shiftKey ? layout.altgrShift : layout.altgr) : e.shiftKey ? layout.shift : layout.base;
  return layer[e.code] ?? null;
}

/** Rows for the on-screen keyboard map: [code, label shown when no character] */
export const KEY_ROWS: [string, string][][] = [
  [["Backquote", "`"], ["Digit1", "1"], ["Digit2", "2"], ["Digit3", "3"], ["Digit4", "4"], ["Digit5", "5"], ["Digit6", "6"], ["Digit7", "7"], ["Digit8", "8"], ["Digit9", "9"], ["Digit0", "0"], ["Minus", "-"], ["Equal", "="]],
  [["KeyQ", "Q"], ["KeyW", "W"], ["KeyE", "E"], ["KeyR", "R"], ["KeyT", "T"], ["KeyY", "Y"], ["KeyU", "U"], ["KeyI", "I"], ["KeyO", "O"], ["KeyP", "P"], ["BracketLeft", "["], ["BracketRight", "]"]],
  [["KeyA", "A"], ["KeyS", "S"], ["KeyD", "D"], ["KeyF", "F"], ["KeyG", "G"], ["KeyH", "H"], ["KeyJ", "J"], ["KeyK", "K"], ["KeyL", "L"], ["Semicolon", ";"], ["Quote", "'"]],
  [["KeyZ", "Z"], ["KeyX", "X"], ["KeyC", "C"], ["KeyV", "V"], ["KeyB", "B"], ["KeyN", "N"], ["KeyM", "M"], ["Comma", ","], ["Period", "."], ["Slash", "/"]],
];
