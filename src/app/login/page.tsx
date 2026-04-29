"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email,     setEmail]     = useState("");
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, start]        = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);

    start(async () => {
      const supabase  = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    });
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / wordmark */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-5xl text-text-primary tracking-tight">
            LifeOS
          </h1>
          <p className="mt-2 text-sm text-text-muted">Your personal operating system</p>
        </div>

        {sent ? (
          /* Success state */
          <div
            className="rounded-2xl px-6 py-8 text-center"
            style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "#D4A96A26" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4A96A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-text-primary font-medium mb-1">Check your email</p>
            <p className="text-sm text-text-muted">
              A sign-in link was sent to <span className="text-text-secondary">{email}</span>.
              Click it to access LifeOS.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-6 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* Login form */
          <div
            className="rounded-2xl px-6 py-8"
            style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
          >
            <p className="text-sm text-text-secondary mb-6 text-center">
              Enter your email to receive a sign-in link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="w-full bg-surface-raised border border-surface-overlay rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/40 transition-colors"
              />

              {error && (
                <p className="text-xs text-status-urgent">{error}</p>
              )}

              <button
                type="submit"
                disabled={isPending || !email.trim()}
                className="w-full py-3.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: "#D4A96A", color: "#0F0C09" }}
              >
                {isPending ? "Sending…" : "Send sign-in link"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
