import PortalShell from "@/components/PortalShell";

export default function DashboardPage() {
  return (
    <PortalShell>
      <div>
        <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Welcome back. This is your portal home.
        </p>
      </div>
    </PortalShell>
  );
}
