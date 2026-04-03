"use client";

export default function LoginPage() {
  return (
    <div
      className="flex h-full items-center justify-center"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-sm rounded-lg border p-8"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}
      >
        <h1 className="text-xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Enter your credentials to access the portal
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = "/dashboard";
          }}
        >
          <label
            className="block text-sm mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Email
          </label>
          <input
            type="email"
            placeholder="you@company.com"
            className="w-full rounded-md border px-3 py-2 text-sm mb-4 outline-none focus:border-[var(--accent)]"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
            }}
          />

          <label
            className="block text-sm mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full rounded-md border px-3 py-2 text-sm mb-6 outline-none focus:border-[var(--accent)]"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
            }}
          />

          <button
            type="submit"
            className="w-full rounded-md py-2 text-sm font-medium transition-colors cursor-pointer"
            style={{
              background: "var(--accent)",
              color: "var(--bg-primary)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--accent-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--accent)")
            }
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
