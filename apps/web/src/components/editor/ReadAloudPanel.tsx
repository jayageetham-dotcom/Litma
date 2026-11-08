"use client";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { useT } from "@/i18n/react";
import { Select } from "@/components/ui/Select";
import { onVoices, platform, readAloud, speechSupported, type Platform, type Reading, type VoiceSettings } from "@/lib/speech";
import { track } from "@/lib/analytics";

const LS_RATE = "litma:read-rate";
const LS_VOICE = "litma:read-voice";
const LS_PITCH = "litma:read-pitch";
const LS_VOLUME = "litma:read-volume";

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

/** A stored number, or the fallback when missing or out of range. */
const num = (k: string, fallback: number, min: number, max: number) => {
  const raw = get(k);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
};

/**
 * Read the work aloud with a Malayalam voice on this device, sentence by sentence, from the cursor
 * or the start. Voice, speed, pitch and volume apply from the next sentence when changed while
 * reading; the word being spoken is underlined when the voice reports words.
 */
export function ReadAloudPanel({ editor }: { editor: Editor }) {
  const t = useT();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
  const [voice, setVoice] = useState<string>(() => get(LS_VOICE) ?? "");
  const [rate, setRate] = useState(() => num(LS_RATE, 1, 0.6, 1.6));
  const [pitch, setPitch] = useState(() => num(LS_PITCH, 1, 0.5, 1.5));
  const [volume, setVolume] = useState(() => num(LS_VOLUME, 1, 0.1, 1));
  const [state, setState] = useState<{ index: number; total: number; paused: boolean } | null>(null);
  const reading = useRef<Reading | null>(null);

  useEffect(() => onVoices(setVoices), []);
  useEffect(() => () => reading.current?.stop(), []);

  const chosen = voices?.find((v) => v.voiceURI === voice) ?? voices?.[0];
  const live = useRef<VoiceSettings>({ voice: chosen, rate, pitch, volume });
  useEffect(() => {
    live.current = { voice: chosen, rate, pitch, volume };
  }, [chosen, rate, pitch, volume]);
  const start = (fromStart: boolean) => {
    reading.current?.stop();
    const from = fromStart ? 0 : editor.state.selection.from;
    track("read_aloud");
    reading.current = readAloud(editor, {
      from,
      settings: () => live.current,
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
      <Slider label={t("read.speed")} shown={`${rate.toFixed(1)}×`} min={0.6} max={1.6} step={0.1} value={rate} onChange={(v) => { setRate(v); set(LS_RATE, String(v)); }} />
      <Slider label={t("read.pitch")} shown={pitch.toFixed(1)} min={0.5} max={1.5} step={0.1} value={pitch} onChange={(v) => { setPitch(v); set(LS_PITCH, String(v)); }} />
      <Slider label={t("read.volume")} shown={`${Math.round(volume * 100)}%`} min={0.1} max={1} step={0.1} value={volume} onChange={(v) => { setVolume(v); set(LS_VOLUME, String(v)); }} />

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

function Slider({ label, shown, min, max, step, value, onChange }: { label: string; shown: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span> <span>{shown}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </label>
  );
}
