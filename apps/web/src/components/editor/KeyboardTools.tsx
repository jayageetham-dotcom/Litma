"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { Keyboard, X } from "lucide-react";
import { KEY_ROWS, LAYOUTS, type MalayalamLayout } from "@litma/keyboards";
import { Select } from "@/components/ui/Select";
import { useT } from "@/i18n/react";

const layoutOf = (editor: Editor): MalayalamLayout => (editor.storage.manglish?.layout as MalayalamLayout) ?? "inscript";

/** Layout chooser shown next to the input switch while typing Malayalam. */
export function MalayalamLayoutPicker({ editor, size = "sm" }: { editor: Editor; size?: "sm" | "md" }) {
  const t = useT();
  const [layout, setLayout] = useState<MalayalamLayout>(() => layoutOf(editor));
  const [map, setMap] = useState(false);
  return (
    <>
      <Select
        size={size}
        preventFocusSteal
        className="min-w-36"
        aria-label={t("keyboard.layout")}
        title={t("keyboard.layout")}
        value={layout}
        onChange={(v) => {
          const l = v as MalayalamLayout;
          editor.commands.setMalayalamLayout(l);
          setLayout(l);
          if (l === "system") setMap(false);
        }}
        options={[
          { value: "inscript", label: t("keyboard.layouts.inscript"), hint: t("keyboard.layouts.inscriptHint") },
          { value: "system", label: t("keyboard.layouts.system"), hint: t("keyboard.layouts.systemHint") },
        ]}
      />
      {layout === "inscript" && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMap((m) => !m)}
          aria-pressed={map}
          title={map ? t("keyboard.hideMap") : t("keyboard.showMap")}
          aria-label={map ? t("keyboard.hideMap") : t("keyboard.showMap")}
          className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-md px-1.5 transition-colors ${map ? "bg-accent-soft text-accent" : "text-ink hover:bg-subtle"}`}
        >
          <Keyboard size={16} />
        </button>
      )}
      {map && <KeyboardMap editor={editor} onClose={() => setMap(false)} />}
    </>
  );
}

/**
 * The InScript layout drawn as a keyboard. It mirrors Shift / AltGr as you hold them,
 * and every key can be clicked or tapped to type it (handy while learning the layout).
 */
export function KeyboardMap({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const t = useT();
  const L = LAYOUTS.inscript;
  const [shift, setShift] = useState(false);
  const [alt, setAlt] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      setShift(e.shiftKey);
      setAlt(e.getModifierState?.("AltGraph") || (e.ctrlKey && e.altKey));
      setPressed(e.code);
    };
    const up = (e: KeyboardEvent) => {
      setShift(e.shiftKey);
      setAlt(e.getModifierState?.("AltGraph") || (e.ctrlKey && e.altKey));
      setPressed(null);
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, []);
  const layer = alt ? (shift ? L.altgrShift : L.altgr) : shift ? L.shift : L.base;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="sheet-up no-print fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-[760px] rounded-t-2xl border border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--pop-shadow)] sm:bottom-4 sm:rounded-2xl"
      role="dialog"
      aria-label={t("keyboard.layouts.inscript")}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <Keyboard size={15} className="text-accent" aria-hidden />
        <span className="text-sm font-semibold">{t("keyboard.layouts.inscript")}</span>
        <span className="hidden truncate text-xs text-muted sm:inline">{t("keyboard.chilluTip")}</span>
        <button type="button" className="ml-auto rounded-md p-1 text-muted hover:bg-subtle hover:text-ink" onClick={onClose} aria-label={t("common.close")}>
          <X size={16} />
        </button>
      </div>
      <div className="space-y-1" style={{ fontFamily: "'Noto Sans Malayalam', var(--font-ui)" }}>
        {KEY_ROWS.map((row, r) => (
          <div key={r} className="flex justify-center gap-1" style={{ paddingLeft: `${r * 1.1}%` }}>
            {row.map(([code, label]) => {
              // keys InScript leaves alone (digits, punctuation) type themselves on the base layer
              const ch = layer[code] ?? (!shift && !alt ? label.toLowerCase() : undefined);
              return (
                <button
                  key={code}
                  type="button"
                  disabled={!ch}
                  onClick={() => ch && editor.chain().focus().typeMalayalamKey(ch).run()}
                  className={`relative flex h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-lg border text-[17px] leading-none transition-[background-color,transform] duration-100 sm:h-12 ${
                    pressed === code ? "scale-95 border-accent bg-accent-soft text-accent" : "border-line bg-paper hover:bg-subtle active:scale-95"
                  } disabled:opacity-40`}
                >
                  <span>{ch ? (ch.startsWith("‍") ? "ZWJ" : ch.startsWith("‌") ? "ZWNJ" : /^[ാ-്ൗൢൣംഃഁഀ]/.test(ch) ? `◌${ch}` : ch) : ""}</span>
                  <span className="absolute left-1 top-0.5 font-mono text-[9px] text-muted">{label}</span>
                </button>
              );
            })}
          </div>
        ))}
        <div className="flex justify-center gap-1 pt-1">
          <button type="button" aria-pressed={shift} onClick={() => setShift((s) => !s)} className={`h-10 rounded-lg border px-4 text-xs font-semibold ${shift ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper hover:bg-subtle"}`}>
            ⇧ {t("keyboard.shift")}
          </button>
          <button type="button" aria-pressed={alt} onClick={() => setAlt((s) => !s)} className={`h-10 rounded-lg border px-4 text-xs font-semibold ${alt ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper hover:bg-subtle"}`}>
            AltGr
          </button>
          <button type="button" onClick={() => editor.chain().focus().insertContent(" ").run()} className="h-10 flex-1 rounded-lg border border-line bg-paper text-xs text-muted hover:bg-subtle">
            space
          </button>
        </div>
      </div>
      <p className="mt-2 px-1 text-xs text-muted">{t("keyboard.passThrough")}</p>
    </div>,
    document.body
  );
}

/** Keyboard panel: choose how Malayalam mode types, and open the layout map. */
export function MalayalamKeyboardSettings({ editor }: { editor: Editor }) {
  const t = useT();
  const [layout, setLayout] = useState<MalayalamLayout>(() => layoutOf(editor));
  const [map, setMap] = useState(false);
  const choose = (l: MalayalamLayout) => {
    editor.commands.setMalayalamLayout(l);
    setLayout(l);
  };
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <div className="text-sm font-semibold">{t("keyboard.layout")}</div>
      <div className="mt-2 space-y-1.5" role="radiogroup" aria-label={t("keyboard.layout")}>
        {(["inscript", "system"] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={layout === l}
            onClick={() => choose(l)}
            className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${layout === l ? "border-accent bg-accent-soft" : "border-line hover:bg-subtle"}`}
          >
            <span className={`block text-[13px] font-semibold ${layout === l ? "text-accent" : ""}`}>{t(`keyboard.layouts.${l}`)}</span>
            <span className="block text-xs text-muted">{t(`keyboard.layouts.${l}Hint`)}</span>
          </button>
        ))}
      </div>
      {layout === "inscript" && (
        <>
          <p className="mt-2 text-xs text-muted">{t("keyboard.chilluTip")}</p>
          <button type="button" className="btn btn-outline mt-2 w-full justify-center !py-1.5 !text-xs" onClick={() => setMap((m) => !m)}>
            <Keyboard size={14} /> {map ? t("keyboard.hideMap") : t("keyboard.showMap")}
          </button>
          {map && <KeyboardMap editor={editor} onClose={() => setMap(false)} />}
        </>
      )}
    </div>
  );
}
