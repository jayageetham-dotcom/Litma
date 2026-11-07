"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { InkDots } from "@/components/ui/Skeleton";
import { authMessage, safeNext } from "@/lib/auth";

const EMAIL_TYPES = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

/**
 * Landing page for email confirmation, magic links, password reset and Google sign-in.
 * Emails from Litma's send-email hook carry `token_hash` and `type`: verified here, so the link works
 * in any browser or device (a `code` link only works in the browser that asked for it, because of
 * the PKCE code verifier it keeps). Google sign-in and older emails still arrive with `code`.
 */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get("error_description"));
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || error) return;
    const next = safeNext(params.get("next"));
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    (async () => {
      if (tokenHash && type && EMAIL_TYPES.has(type)) {
        const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
        if (error) return setError(authMessage(error));
      } else if (code) {
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
    <AuthShell quote={false}>
      {error ? (
        <div className="space-y-3">
          <h1>Couldn’t sign you in</h1>
          <p className="text-muted">{error}</p>
          <Link href="/login/" className="btn btn-primary mt-3 !px-6 !py-3">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="space-y-3 py-4 text-center" role="status">
          <InkDots />
          <h1>സ്വാഗതം.</h1>
          <p className="text-muted">Signing you in…</p>
        </div>
      )}
    </AuthShell>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
