"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { useT } from "@/i18n/react";
import { Select } from "@/components/ui/Select";
import { onVoices, platform, readAloud, speechSupported, type Platform, type Reading } from "@/lib/speech";
import { track } from "@/lib/analytics";

const LS_RATE = "litma:read-rate";
const LS_VOICE = "litma:read-voice";

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage blocked */
  }
};

/** Read the work aloud with a Malayalam voice on this device, sentence by sentence, from the cursor or the start. */
export function ReadAloudPanel({ editor }: { editor: Editor }) {
  const t = useT();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
  const [voice, setVoice] = useState<string>(() => get(LS_VOICE) ?? "");
  const [rate, setRate] = useState(() => Number(get(LS_RATE)) || 1);
  const [state, setState] = useState<{ index: number; total: number; paused: boolean } | null>(null);
  const reading = useRef<Reading | null>(null);

  useEffect(() => onVoices(setVoices), []);
  useEffect(() => () => reading.current?.stop(), []);

  const chosen = voices?.find((v) => v.voiceURI === voice) ?? voices?.[0];
  const start = (fromStart: boolean) => {
    reading.current?.stop();
    const from = fromStart ? 0 : editor.state.selection.from;
    track("read_aloud");
    reading.current = readAloud(editor, {
      from,
      voice: chosen,
      rate,
      onState: setState,
      onEnd: () => {
        reading.current = null;
        setState(null);
      },
    });
  };

  if (!speechSupported() || (voices && voices.length === 0)) {
    const p = platform();
    const desktop = typeof window !== "undefined" && !!window.litmaDesktop;
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Volume2 size={16} className="text-tint-sky" aria-hidden /> {t("read.noVoice")}
        </p>
        <p className="text-muted">{t(`read.help.${(desktop && p !== "linux" ? (p === "mac" ? "desktop_mac" : "desktop_windows") : p) as Platform | "desktop_mac" | "desktop_windows"}`)}</p>
        <p className="text-xs text-muted">{t("read.helpFree")}</p>
      </div>
    );
  }
  if (!voices) return <p className="text-sm text-muted">{t("read.loading")}</p>;

  return (
    <div className="space-y-5 text-sm">
      {voices.length > 1 && (
        <Select
          label={t("read.voice")}
          value={chosen?.voiceURI ?? ""}
          onChange={(v) => {
            setVoice(v);
            set(LS_VOICE, v);
          }}
          options={voices.map((v) => ({ value: v.voiceURI, label: v.name.replace(/^Microsoft |\(Natural\)| - .*$/g, "").trim() || v.name }))}
          preventFocusSteal
        />
      )}
      <label className="block">
        <span className="mb-1 flex justify-between text-xs text-muted">
          <span>{t("read.speed")}</span> <span>{rate.toFixed(1)}×</span>
        </span>
        <input
          type="range"
          min={0.6}
          max={1.6}
          step={0.1}
          value={rate}
          onChange={(e) => {
            const r = Number(e.target.value);
            setRate(r);
            set(LS_RATE, String(r));
          }}
          className="w-full accent-[var(--accent)]"
        />
      </label>

      {state ? (
        <div className="rounded-xl border border-line bg-paper p-4">
          <p className="text-xs text-muted">{t("read.progress", { n: state.index + 1, total: state.total })}</p>
          <div className="mt-3 flex gap-2">
            {state.paused ? (
              <button type="button" className="btn btn-primary !py-1.5" onClick={() => reading.current?.resume()}>
                <Play size={15} /> {t("read.resume")}
              </button>
            ) : (
              <button type="button" className="btn btn-outline !py-1.5" onClick={() => reading.current?.pause()}>
                <Pause size={15} /> {t("read.pause")}
              </button>
            )}
            <button type="button" className="btn btn-ghost !py-1.5" onClick={() => reading.current?.stop()}>
              <Square size={14} /> {t("read.stop")}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <button type="button" className="btn btn-accent" onMouseDown={(e) => e.preventDefault()} onClick={() => start(false)}>
            <Play size={15} /> {t("read.fromCursor")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => start(true)}>
            {t("read.fromStart")}
          </button>
        </div>
      )}
      <p className="text-xs text-muted">{t("read.hint")}</p>
    </div>
  );
}
