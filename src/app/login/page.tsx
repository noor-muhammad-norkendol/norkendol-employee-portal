"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [brand, setBrand] = useState<{ name: string; logo: string | null }>({
    name: "Norkendol",
    logo: null,
  });
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const name = localStorage.getItem("portal-company-name") || "Norkendol";
    const logo = localStorage.getItem("portal-logo");
    setBrand({ name, logo });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const inputBase: React.CSSProperties = {
    background: "var(--pad-input)",
    color: "var(--text)",
    borderRadius: "var(--radius-input)",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: "var(--border)",
    transition: "border-color var(--transition-base), box-shadow var(--transition-base)",
  };

  const inputFocus: React.CSSProperties = {
    borderColor: "var(--accent)",
    boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)",
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Brand mark above the card */}
        <div className="mb-8 flex flex-col items-center">
          {brand.logo ? (
            <Image
              src={brand.logo}
              alt={brand.name}
              width={120}
              height={120}
              className="mb-3 h-14 w-auto object-contain"
              style={{ maxHeight: 56 }}
              unoptimized
            />
          ) : null}
          <div
            className="text-2xl font-bold tracking-[0.18em] uppercase"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--text)",
            }}
          >
            {brand.name.split("").map((ch, i) => (
              <span
                key={i}
                style={
                  i === 0
                    ? {
                        color: "var(--accent)",
                        textShadow: "var(--accent-text-shadow)",
                      }
                    : undefined
                }
              >
                {ch}
              </span>
            ))}
          </div>
          <div
            className="mt-2 text-xs tracking-widest uppercase"
            style={{ color: "var(--text-faint)", letterSpacing: "0.25em" }}
          >
            Employee Portal
          </div>
        </div>

        {/* Card */}
        <div
          className="relative overflow-hidden"
          style={{
            background: "var(--pad)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          {/* Top accent stripe — visible only in cells where --card-stripe-bg is set */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-0 h-[2px]"
            style={{
              background: "var(--card-stripe-bg)",
              boxShadow: "var(--card-stripe-shadow)",
            }}
          />

          <div className="px-7 pt-7 pb-6">
            <h1
              className="text-2xl font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text)",
              }}
            >
              Sign{" "}
              <span
                style={{
                  color: "var(--accent)",
                  textShadow: "var(--accent-text-shadow)",
                }}
              >
                in
              </span>
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--text-dim)" }}
            >
              Enter your credentials to access the portal
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-md px-3 py-2 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--red) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)",
                  color: "var(--red)",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-dim)" }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  required
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputBase, ...(emailFocus ? inputFocus : {}) }}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-dim)" }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocus(true)}
                  onBlur={() => setPasswordFocus(false)}
                  required
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  style={{ ...inputBase, ...(passwordFocus ? inputFocus : {}) }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "var(--cta-bg)",
                  color: "var(--cta-text)",
                  borderRadius: "var(--radius-pill)",
                  boxShadow: "var(--cta-shadow)",
                  border: "none",
                  letterSpacing: "0.02em",
                  transition: "transform var(--transition-fast), filter var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  if (loading) return;
                  e.currentTarget.style.filter = "brightness(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "none";
                }}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p
              className="mt-5 text-center text-sm"
              style={{ color: "var(--text-faint)" }}
            >
              Don&apos;t have an account?{" "}
              <Link
                href="/apply"
                className="font-semibold"
                style={{
                  color: "var(--accent)",
                  textShadow: "var(--accent-text-shadow)",
                }}
              >
                Apply here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
