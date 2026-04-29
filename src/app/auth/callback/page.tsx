"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Handles both Supabase auth flows:
//   PKCE flow   → ?code=<code> in the URL search params (server-generated)
//   Implicit    → #access_token=... in the URL hash (Supabase sets session from hash)
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Listen for the auth state change that fires once the session is established.
    // This covers the implicit flow where Supabase parses the hash automatically.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          router.replace("/today");
        }
      }
    );

    // Also handle the PKCE code flow (code in the query string).
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) router.replace("/login?error=auth");
        // On success the onAuthStateChange listener above handles the redirect.
      });
    }

    // Safety fallback: if no auth event fires within 5 s, check for an
    // existing session (user may have already been signed in).
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/today");
      } else {
        router.replace("/login?error=auth");
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="text-center space-y-3">
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto"
          style={{ borderColor: "#D4A96A", borderTopColor: "transparent" }}
        />
        <p className="text-text-muted text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
