export default function AIPage() {
  return (
    <div className="space-y-4">
      <h1
        className="page-title"
        style={{
          fontSize: "3rem",
          lineHeight: 1,
          letterSpacing: "-0.01em",
          fontFamily: "var(--font-display)",
          margin: 0,
        }}
      >
        <span
          style={{
            color: "var(--accent)",
            textShadow: "var(--accent-text-shadow)",
            fontWeight: 800,
          }}
        >
          AI
        </span>
      </h1>
      <p style={{ color: "var(--text-dim)" }}>This page is coming soon.</p>
    </div>
  );
}
