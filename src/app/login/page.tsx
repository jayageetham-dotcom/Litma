"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, Field, GoogleButton, Notice } from "@/components/AuthShell";
import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authMessage, authRedirect, safeNext, useRedirectIfSignedIn } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  useRedirectIfSignedIn(next);
  const [magic, setMagic] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(params.get("reset") ? { kind: "info", text: "Password updated. Sign in with your new password." } : null);
  const sb = getSupabase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setMsg(null);
    try {
      if (magic) {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirect(next), shouldCreateUser: false } });
        if (error) throw error;
        setMsg({ kind: "info", text: `Sign-in link sent to ${email}. Open it on this device.` });
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
      }
    } catch (err) {
      setMsg({ kind: "error", text: authMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">You’re in local mode</h1>
        <p className="text-muted">No Supabase project is connected, so your writing is saved in this browser only.</p>
        <Link href="/desk/" className="btn btn-primary">
          Continue to your desk
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          New to Litma?{" "}
          <Link href={`/signup/?next=${encodeURIComponent(next)}`} className="font-medium text-kayal underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </div>
      <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {!magic && (
        <div>
          <Field label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Link href="/forgot-password/" className="mt-1.5 inline-block text-xs text-kayal underline underline-offset-2">
            Forgot your password?
          </Link>
        </div>
      )}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <button className="btn btn-primary w-full justify-center !py-2.5" disabled={busy || !email || (!magic && !password)}>
        {busy ? "Signing in…" : magic ? "Email me a sign-in link" : "Sign in"}
      </button>
      <button type="button" className="w-full text-center text-sm text-muted underline underline-offset-2 hover:text-ink" onClick={() => setMagic((m) => !m)}>
        {magic ? "Use my password instead" : "Sign in with an email link instead"}
      </button>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton onClick={() => sb?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: authRedirect(next) } })} />
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
