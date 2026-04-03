"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function ApplyPage() {
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const ORG_ID = "00000000-0000-0000-0000-000000000001";

  async function handleGoogleSignup() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?pending=true`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setError(error.message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    // Split name
    const parts = fullName.trim().split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || null;

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Create public.users row as pending
    const { error: insertError } = await supabase.from("users").insert({
      id: authData.user.id,
      org_id: ORG_ID,
      email: email.trim(),
      full_name: fullName.trim(),
      first_name: firstName,
      last_name: lastName,
      role: "user",
      status: "pending",
      user_type: "internal",
      primary_phone: phone.trim() || null,
      onboarding_status: "signup",
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      // Auth user was created but public row failed — still show success
      // Admin can fix in user management
    }

    setLoading(false);
    setSubmitted(true);
  }

  /* ── styles ──────────────────────────────────────── */

  const inputClass = "w-full rounded-md border px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] transition-colors";
  const inputStyle = {
    background: "var(--bg-surface)",
    borderColor: "var(--border-color)",
    color: "var(--text-primary)",
  };

  /* ── submitted state ─────────────────────────────── */

  if (submitted) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div
          className="w-full max-w-sm rounded-lg border p-8 text-center"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "#1a3a2a" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">Application Submitted</h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Thanks for applying! Your account is pending review. You'll receive an email once an administrator has approved your access.
          </p>
          <Link
            href="/login"
            className="text-sm font-medium"
            style={{ color: "var(--accent)" }}
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  /* ── form ────────────────────────────────────────── */

  return (
    <div className="flex h-full items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div
        className="w-full max-w-sm rounded-lg border p-8"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <h1 className="text-xl font-semibold mb-1">Employee Portal</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Create your account
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Google Sign Up */}
        <button
          type="button"
          onClick={handleGoogleSignup}
          className="w-full rounded-md border px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-3 cursor-pointer transition-colors mb-4"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
            Full Name
          </label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className={inputClass}
            style={inputStyle}
          />

          <label className="block text-sm mb-1 mt-4" style={{ color: "var(--text-secondary)" }}>
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="Enter your phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />

          <label className="block text-sm mb-1 mt-4" style={{ color: "var(--text-secondary)" }}>
            Email Address
          </label>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
            style={inputStyle}
          />

          <label className="block text-sm mb-1 mt-4" style={{ color: "var(--text-secondary)" }}>
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={inputClass}
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md py-2.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 mt-6"
            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm mt-4" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--accent)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
