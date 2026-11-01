"use client";
import { useState } from "react";
import Link from "next/link";
import { AuthShell, Field, Notice } from "@/components/AuthShell";
import { getSupabase } from "@/lib/supabase/client";
import { appUrl } from "@/lib/config";
import { authMessage } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  return (
    <AuthShell quote={false} switchTo={{ href: "/login/", label: "Sign in" }}>
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const sb = getSupabase();
          if (!sb) return;
          setBusy(true);
          setMsg(null);
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl("/auth/callback/?next=%2Freset-password%2F") });
          setBusy(false);
          setMsg(error ? { kind: "error", text: authMessage(error) } : { kind: "info", text: `If ${email} has a Litma account, a reset link is on its way.` });
        }}
      >
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-muted">Enter your email and we’ll send a link to choose a new password.</p>
        <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <button className="btn btn-primary w-full justify-center !py-3.5 !text-base" disabled={busy || !email}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <Link href="/login/" className="block text-center text-sm text-muted underline underline-offset-2 hover:text-ink">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
