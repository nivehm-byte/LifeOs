"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClientAction } from "@/lib/clients/actions";

interface Props {
  onClose: () => void;
}

export function AddClientModal({ onClose }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name,    setName]    = useState("");
  const [company, setCompany] = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [notes,   setNotes]   = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [isPending, start]    = useTransition();

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())  { setError("Name is required");  return; }
    if (!email.trim()) { setError("Email is required"); return; }
    setError(null);

    start(async () => {
      try {
        await createClientAction({
          name:    name.trim(),
          company: company.trim() || null,
          email:   email.trim(),
          phone:   phone.trim()   || null,
          notes:   notes.trim()   || null,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create client");
      }
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto rounded-t-2xl shadow-2xl"
        style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
        role="dialog"
        aria-modal
        aria-label="Add client"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-overlay" />
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-8 pt-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl text-text-primary">New Client</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="3" x2="13" y2="13"/>
                <line x1="13" y1="3" x2="3" y2="13"/>
              </svg>
            </button>
          </div>

          {/* Name */}
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client name *"
            className="w-full bg-transparent border-b-2 border-surface-raised focus:border-accent/60 outline-none text-text-primary placeholder-text-muted py-2 text-base transition-colors"
            maxLength={200}
            required
          />

          {/* Company */}
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company (optional)"
            className="w-full bg-transparent border-b border-surface-raised focus:border-accent/40 outline-none text-text-primary placeholder-text-muted py-2 text-sm transition-colors"
            maxLength={200}
          />

          {/* Email */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email *"
            className="w-full bg-transparent border-b border-surface-raised focus:border-accent/40 outline-none text-text-primary placeholder-text-muted py-2 text-sm transition-colors"
            required
          />

          {/* Phone */}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full bg-transparent border-b border-surface-raised focus:border-accent/40 outline-none text-text-primary placeholder-text-muted py-2 text-sm transition-colors"
          />

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full bg-surface-raised rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none resize-none focus:ring-1 ring-accent/30 transition-colors"
            maxLength={1000}
          />

          {error && <p className="text-xs text-status-urgent">{error}</p>}

          <button
            type="submit"
            disabled={isPending || !name.trim() || !email.trim()}
            className="w-full py-3.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: "#D4A96A", color: "#0F0C09" }}
          >
            {isPending ? "Adding…" : "Add Client"}
          </button>
        </form>
      </div>
    </>
  );
}
