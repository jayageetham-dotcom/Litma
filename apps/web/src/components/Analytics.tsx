"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { setAnalyticsToken, startAnalytics, track } from "@/lib/analytics";
import { getSupabase } from "@/lib/supabase/client";

/** Usage statistics (see lib/analytics.ts): a page view per route and clicks on Litma's own buttons. */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    const sb = getSupabase();
    const stop = startAnalytics(async () => (await sb?.auth.getSession())?.data.session?.access_token ?? null);
    const sub = sb?.auth.onAuthStateChange((_e, session) => setAnalyticsToken(session?.access_token ?? null));
    return () => {
      stop();
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    track("page_view");
  }, [pathname]);

  return null;
}
