"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { authMessage, safeNext } from "@/lib/auth";

/** Landing page for email confirmation, magic links, password reset and Google sign-in. */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get("error_description"));
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || error) return;
    const next = safeNext(params.get("next"));
    const code = params.get("code");
    (async () => {
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        // The client may already have exchanged the code automatically.
        if (error && !(await sb.auth.getSession()).data.session) return setError(authMessage(error));
      }
      const { data } = await sb.auth.getSession();
      if (!data.session) return setError("This link has expired or was already used. Sign in again.");
      router.replace(next);
    })();
  }, [params, router, error]);
  return (
    <div className="grid h-dvh place-items-center px-5 text-center">
      {error ? (
        <div className="max-w-sm">
          <h1 className="text-xl font-bold">Couldn’t sign you in</h1>
          <p className="mt-2 text-muted">{error}</p>
          <Link href="/login/" className="btn btn-primary mt-6">
            Back to sign in
          </Link>
        </div>
      ) : (
        <span className="animate-pulse text-muted">Signing you in…</span>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
