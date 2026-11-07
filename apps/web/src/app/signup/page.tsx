"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, Field, GoogleButton, Notice } from "@/components/AuthShell";
import { getSupabase } from "@/lib/supabase/client";
import { authMessage, authRedirect, safeNext, useRedirectIfSignedIn } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { useT } from "@/i18n/react";

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}
const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];

function SignupForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  useRedirectIfSignedIn(next);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sb = getSupabase();
  const st = strength(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sb) return;
    // Read the fields from the form: browser autofill fills them without telling React until the page is touched.
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    setName(name);
    setEmail(email);
    setPassword(password);
    setConfirm(confirm);
    if (!email) return setError("Enter your email address.");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name.trim() }, emailRedirectTo: authRedirect(next) } });
      if (error) throw error;
      track("sign_up", { method: "password" });
      if (data.session) router.replace(next);
      else setSent(true);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-muted">
          We sent a confirmation link to <b className="text-ink">{email}</b>. Open it to finish creating your account. It takes you straight to your desk.
        </p>
        <p className="text-sm text-muted">No email after a few minutes? Check spam, or go back and check the address.</p>
        <button className="btn btn-outline" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Already have one?{" "}
          <Link href={`/login/?next=${encodeURIComponent(next)}`} className="font-medium text-accent underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
      <Field label="Name or pen name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ഉദാ: ജഗത്ത്" />
      <Field label="Email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div>
        <Field label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {password && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
            <span className="flex h-1.5 flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`flex-1 rounded-full ${i < st ? (st < 2 ? "bg-danger" : st < 3 ? "bg-highlight" : "bg-accent") : "bg-subtle"}`} />
              ))}
            </span>
            {LABELS[password.length < 8 ? 0 : st]}
          </div>
        )}
      </div>
      <Field label="Confirm password" name="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} hint={mismatch ? "Doesn't match yet." : undefined} />
      {error && <Notice kind="error">{error}</Notice>}
      <button className="btn btn-primary w-full justify-center !py-3.5 !text-base" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton onClick={() => (track("sign_up", { method: "google" }), sb?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: authRedirect(next) } }))} />
      <p className="text-xs leading-relaxed text-muted">Your writing stays private unless you share a link to it.</p>
      <p className="text-xs leading-relaxed text-muted">
        {t("legal.agree")}{" "}
        <Link href="/terms/" className="font-medium text-accent underline underline-offset-2">
          {t("legal.terms")}
        </Link>
        {" · "}
        <Link href="/privacy/" className="font-medium text-accent underline underline-offset-2">
          {t("legal.privacy")}
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <AuthShell line={1} switchTo={{ href: "/login/", label: "Sign in" }}>
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
