"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode  = "password" | "code";
type Stage = "email" | "verify"; // only used in "code" mode

export default function LoginPage() {
  const router = useRouter();

  const [mode,      setMode]      = useState<Mode>("code");
  const [stage,     setStage]     = useState<Stage>("email");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [otp,       setOtp]       = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, start]        = useTransition();

  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === "verify") otpRef.current?.focus();
  }, [stage]);

  function switchMode(next: Mode) {
    setMode(next);
    setStage("email");
    setError(null);
    setOtp("");
  }

  // ── Password sign-in ─────────────────────────────────────────────
  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const { error } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setError(error.message);
      else       router.push("/today");
    });
  }

  // ── Code flow: request 6-digit OTP ──────────────────────────────
  function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const { error } = await createClient().auth.signInWithOtp({
        email:   email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) setError(error.message);
      else       setStage("verify");
    });
  }

  // ── Code flow: verify the 6-digit OTP ────────────────────────────
  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const { error } = await createClient().auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type:  "email",
      });
      if (error) setError(error.message);
      else       router.push("/today");
    });
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Wordmark */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-5xl text-text-primary tracking-tight">LifeOS</h1>
          <p className="mt-2 text-sm text-text-muted">Your personal operating system</p>
        </div>

        <div
          className="rounded-2xl px-6 py-8"
          style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
        >
          {/* Mode toggle */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              type="button"
              onClick={() => switchMode("code")}
              className="text-sm transition-colors"
              style={{ color: mode === "code" ? "#D4A96A" : "#6B5C4A" }}
            >
              Email code
            </button>
            <span style={{ color: "#3A3028" }}>·</span>
            <button
              type="button"
              onClick={() => switchMode("password")}
              className="text-sm transition-colors"
              style={{ color: mode === "password" ? "#D4A96A" : "#6B5C4A" }}
            >
              Password
            </button>
          </div>

          {/* ── Email code: step 1 — enter email ── */}
          {mode === "code" && stage === "email" && (
            <form onSubmit={handleRequestCode} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="w-full bg-surface-raised border border-surface-overlay rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/40 transition-colors"
              />
              {error && <p className="text-xs text-status-urgent">{error}</p>}
              <button
                type="submit"
                disabled={isPending || !email.trim()}
                className="w-full py-3.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: "#D4A96A", color: "#0F0C09" }}
              >
                {isPending ? "Sending…" : "Send code"}
              </button>
            </form>
          )}

          {/* ── Email code: step 2 — enter 6-digit code ── */}
          {mode === "code" && stage === "verify" && (
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <p className="text-sm text-text-muted text-center mb-4">
                A 6-digit code was sent to{" "}
                <span className="text-text-secondary">{email}</span>
              </p>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                className="w-full bg-surface-raised border border-surface-overlay rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/40 transition-colors text-center tracking-[0.4em] font-mono"
              />
              {error && <p className="text-xs text-status-urgent">{error}</p>}
              <button
                type="submit"
                disabled={isPending || otp.length < 6}
                className="w-full py-3.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: "#D4A96A", color: "#0F0C09" }}
              >
                {isPending ? "Verifying…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setStage("email"); setOtp(""); setError(null); }}
                className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors py-1"
              >
                Use a different email
              </button>
            </form>
          )}

          {/* ── Password ── */}
          {mode === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="w-full bg-surface-raised border border-surface-overlay rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/40 transition-colors"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full bg-surface-raised border border-surface-overlay rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/40 transition-colors"
              />
              {error && <p className="text-xs text-status-urgent">{error}</p>}
              <button
                type="submit"
                disabled={isPending || !email.trim() || !password}
                className="w-full py-3.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: "#D4A96A", color: "#0F0C09" }}
              >
                {isPending ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
