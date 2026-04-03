"use client";

import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div
        className="w-full max-w-sm rounded-lg border p-8 text-center"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "#3a3520" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2">Account Pending Review</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Your application has been received and is being reviewed by an administrator. You'll receive access once approved.
        </p>
        <button
          onClick={handleSignOut}
          className="text-sm font-medium cursor-pointer"
          style={{ color: "var(--accent)" }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
