"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, Field, Notice } from "@/components/AuthShell";
import { getSupabase } from "@/lib/supabase/client";
import { authMessage, useUser } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const user = useUser();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthShell quote={false}>
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8) return setError("Use a password of at least 8 characters.");
          if (password !== confirm) return setError("The two passwords don't match.");
          setBusy(true);
          const { error } = await getSupabase()!.auth.updateUser({ password });
          setBusy(false);
          if (error) return setError(authMessage(error));
          router.replace("/desk/");
        }}
      >
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        {user === null && <Notice kind="error">This reset link has expired. Request a new one from the sign-in page.</Notice>}
        <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <Notice kind="error">{error}</Notice>}
        <button className="btn btn-primary w-full justify-center !py-3.5 !text-base" disabled={busy || !user}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}
