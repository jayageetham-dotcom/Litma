"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { AppHeader, Avatar } from "@/components/AppHeader";
import { Field, Notice } from "@/components/AuthShell";
import { RequireAuth, authMessage } from "@/lib/auth";
import { store } from "@/lib/store";
import { getSupabase } from "@/lib/supabase/client";
import { templateFor } from "@/lib/templates";
import type { LitmaDoc, Profile } from "@/lib/types";

/** Centre-crop to a square and re-encode as a 512px WebP before upload. */
async function squareWebp(file: File, size = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that image."))), "image/webp", 0.88));
}

type Days = { day: string; words: number }[];

function Heatmap({ days }: { days: Days }) {
  const weeks = 20;
  const map = new Map(days.map((d) => [d.day, d.words]));
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (weeks * 7 - 1) - end.getDay());
  const cells: { date: string; words: number }[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    cells.push({ date: k, words: map.get(k) ?? 0 });
  }
  const max = Math.max(1, ...cells.map((c) => c.words));
  const level = (w: number) => (w === 0 ? 0 : Math.min(4, Math.ceil((w / max) * 4)));
  const shades = ["var(--desk-2)", "color-mix(in srgb, var(--kayal) 30%, var(--paper))", "color-mix(in srgb, var(--kayal) 55%, var(--paper))", "color-mix(in srgb, var(--kayal) 78%, var(--paper))", "var(--kayal)"];
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`Words written per day over the last ${weeks} weeks`}>
        {cells.map((c) => (
          <span key={c.date} className="h-3 w-3 rounded-[3px]" style={{ background: shades[level(c.words)] }} title={`${c.date}: ${c.words} words`} />
        ))}
      </div>
    </div>
  );
}

function ProfileView() {
  const [p, setP] = useState<(Profile & { email?: string }) | null>(null);
  const [docs, setDocs] = useState<LitmaDoc[]>([]);
  const [days, setDays] = useState<Days>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    store.getProfile().then(setP);
    store.listDocs().then(setDocs).catch(() => {});
    store.wordsByDay().then(setDays).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const words = docs.reduce((n, d) => n + d.word_count, 0);
    const byKind = new Map<string, number>();
    docs.forEach((d) => byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1));
    const key = (d: Date) => d.toISOString().slice(0, 10);
    const map = new Map(days.map((x) => [x.day, x.words]));
    const d = new Date();
    if (!map.get(key(d))) d.setDate(d.getDate() - 1);
    let streak = 0;
    while ((map.get(key(d)) ?? 0) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    const best = Math.max(0, ...days.map((x) => x.words));
    return { words, byKind: [...byKind.entries()].sort((a, b) => b[1] - a[1]), streak, best, today: map.get(key(new Date())) ?? 0 };
  }, [docs, days]);

  if (!p)
    return (
      <div className="grid h-60 place-items-center text-muted">
        <Loader2 className="animate-spin" />
      </div>
    );

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    setSaving(true);
    setMsg(null);
    try {
      const username = p.username?.trim().toLowerCase() || null;
      if (username && !/^[a-z0-9_]{3,30}$/.test(username)) throw new Error("Usernames use 3–30 lowercase letters, numbers or underscores.");
      await store.updateProfile({
        display_name: p.display_name?.trim() || null,
        pen_name: p.pen_name?.trim() || null,
        username,
        bio: p.bio?.trim() || null,
        location: p.location?.trim() || null,
        website: p.website?.trim() || null,
        daily_goal: Number(p.daily_goal) || 0,
        preferences: p.preferences,
      });
      setMsg({ kind: "info", text: "Profile saved." });
      window.dispatchEvent(new Event("litma:profile"));
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setMsg({ kind: "error", text: /duplicate key|unique/i.test(m) ? "That username is taken. Try another." : m || "Couldn't save your profile." });
    } finally {
      setSaving(false);
    }
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMsg({ kind: "error", text: "Choose an image file (JPG, PNG, WebP or GIF)." });
    if (file.size > 15 * 1024 * 1024) return setMsg({ kind: "error", text: "That image is over 15 MB. Choose a smaller one." });
    setUploading(true);
    setMsg(null);
    try {
      const url = await store.uploadAvatar(await squareWebp(file));
      setP((x) => (x ? { ...x, avatar_url: url } : x));
      window.dispatchEvent(new Event("litma:profile"));
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "Upload failed. Try again." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-4">
      <h1 className="text-3xl font-bold">Profile</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={save} className="space-y-8">
          <section className="flex flex-wrap items-center gap-6">
            <div className="relative">
              <Avatar profile={p} size={112} />
              {uploading && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white">
                  <Loader2 className="animate-spin" />
                </span>
              )}
            </div>
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Camera size={16} /> {p.avatar_url ? "Change picture" : "Upload picture"}
                </button>
                {p.avatar_url && (
                  <button
                    type="button"
                    className="btn btn-ghost hover:!text-danger"
                    disabled={uploading}
                    onClick={async () => {
                      await store.removeAvatar();
                      setP({ ...p, avatar_url: null });
                      window.dispatchEvent(new Event("litma:profile"));
                    }}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-muted">Square crop, saved at 512 px. JPG, PNG, WebP or GIF.</p>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={p.display_name ?? ""} onChange={set("display_name")} autoComplete="name" />
            <Field label="Pen name" value={p.pen_name ?? ""} onChange={set("pen_name")} hint="Shown on your works instead of your name." />
            <Field label="Username" value={p.username ?? ""} onChange={set("username")} hint="Lowercase letters, numbers, underscore." />
            <Field label="Location" value={p.location ?? ""} onChange={set("location")} placeholder="ഉദാ: തൃശ്ശൂർ" />
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm">About you</span>
              <textarea className="field min-h-28" maxLength={600} value={p.bio ?? ""} onChange={set("bio")} placeholder="What you write, what you read…" style={{ fontFamily: "'Noto Sans Malayalam'" }} />
              <span className="mt-1 block text-right text-xs text-muted">{(p.bio ?? "").length}/600</span>
            </label>
            <Field label="Website" type="url" value={p.website ?? ""} onChange={set("website")} placeholder="https://" />
            <Field label="Daily word goal" type="number" min={0} step={50} value={String(p.daily_goal ?? 0)} onChange={set("daily_goal")} />
            <label className="block">
              <span className="mb-1 block text-sm">Default typing for new works</span>
              <select className="field" value={(p.preferences?.inputMode as string) ?? "manglish"} onChange={(e) => setP({ ...p, preferences: { ...p.preferences, inputMode: e.target.value } })}>
                <option value="manglish">Manglish → മലയാളം</option>
                <option value="malayalam">മലയാളം keyboard</option>
                <option value="english">English</option>
              </select>
            </label>
          </section>

          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
          <button className="btn btn-primary !px-5 !py-2.5" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>

          <section className="border-t border-line pt-8">
            <h2 className="text-lg font-semibold">Account</h2>
            <p className="mt-1 text-sm text-muted">
              Signed in as <b className="text-ink">{p.email}</b>
            </p>
            <div className="mt-4 flex max-w-md items-end gap-2">
              <Field label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button
                type="button"
                className="btn btn-outline shrink-0"
                disabled={pw.length < 8}
                onClick={async () => {
                  const { error } = await getSupabase()!.auth.updateUser({ password: pw });
                  setPwMsg(error ? { kind: "error", text: authMessage(error) } : { kind: "info", text: "Password changed." });
                  if (!error) setPw("");
                }}
              >
                Change password
              </button>
            </div>
            {pwMsg && (
              <div className="mt-2 max-w-md">
                <Notice kind={pwMsg.kind}>{pwMsg.text}</Notice>
              </div>
            )}
          </section>
        </form>

        <aside className="space-y-6">
          <div className="rounded-xl bg-paper p-5" style={{ boxShadow: "var(--sheet-shadow)" }}>
            <h2 className="font-semibold">Your writing</h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted">Works</dt>
              <dd className="text-right font-semibold">{docs.length}</dd>
              <dt className="text-muted">Words</dt>
              <dd className="text-right font-semibold">{stats.words.toLocaleString("en-IN")}</dd>
              <dt className="text-muted">Today</dt>
              <dd className="text-right font-semibold">
                {stats.today.toLocaleString("en-IN")}
                {p.daily_goal ? <span className="font-normal text-muted"> / {p.daily_goal}</span> : null}
              </dd>
              <dt className="text-muted">Streak</dt>
              <dd className="text-right font-semibold">{stats.streak} days</dd>
              <dt className="text-muted">Best day</dt>
              <dd className="text-right font-semibold">{stats.best.toLocaleString("en-IN")}</dd>
            </dl>
            {p.daily_goal > 0 && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-desk-2" title="Today's goal">
                <div className="h-full bg-kasavu" style={{ width: `${Math.min(100, (stats.today / p.daily_goal) * 100)}%` }} />
              </div>
            )}
          </div>
          <div className="rounded-xl bg-paper p-5" style={{ boxShadow: "var(--sheet-shadow)" }}>
            <h2 className="mb-3 font-semibold">Last 20 weeks</h2>
            <Heatmap days={days} />
          </div>
          {stats.byKind.length > 0 && (
            <div className="rounded-xl bg-paper p-5" style={{ boxShadow: "var(--sheet-shadow)" }}>
              <h2 className="mb-2 font-semibold">By form</h2>
              <ul className="space-y-1 text-sm">
                {stats.byKind.map(([k, n]) => (
                  <li key={k} className="flex justify-between">
                    <span>{templateFor(k as LitmaDoc["kind"]).ml}</span>
                    <span className="text-muted">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <div className="min-h-dvh">
        <AppHeader />
        <ProfileView />
      </div>
    </RequireAuth>
  );
}
