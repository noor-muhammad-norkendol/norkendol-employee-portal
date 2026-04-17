"use client";
import { useState } from 'react';
import type { ClaimLookupMatch } from '@/hooks/useClaimLookup';

const SOURCE_LABELS: Record<string, string> = {
  onboarding_clients: 'Onboarding',
  estimates: 'Estimating',
  litigation_files: 'Settlement Tracker',
  claim_health_records: 'Claim Health',
};

interface ClaimMatchBannerProps {
  matches: ClaimLookupMatch[];
  searching: boolean;
  onAccept: (match: ClaimLookupMatch) => void;
  onDismiss: () => void;
}

export default function ClaimMatchBanner({ matches, searching, onAccept, onDismiss }: ClaimMatchBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (matches.length === 0 && !searching)) return null;

  if (searching) {
    return (
      <div style={{
        background: "rgba(251,191,36,0.08)", border: "1px solid #fbbf24", borderRadius: 8,
        padding: "10px 14px", marginBottom: 16, color: "#d97706", fontSize: 13,
      }}>
        Searching for existing claim data…
      </div>
    );
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  const handleAccept = (match: ClaimLookupMatch) => {
    setDismissed(true);
    onAccept(match);
  };

  const bannerStyle: React.CSSProperties = {
    background: "rgba(251,191,36,0.1)", border: "1px solid #fbbf24", borderRadius: 8,
    padding: "12px 14px", marginBottom: 16, color: "#92400e", fontSize: 13,
  };

  const btnAccept: React.CSSProperties = {
    background: "#fbbf24", color: "#78350f", border: "none", borderRadius: 6,
    padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600,
  };

  const btnDismiss: React.CSSProperties = {
    background: "none", border: "none", color: "#d97706", cursor: "pointer",
    fontSize: 12, textDecoration: "underline", marginLeft: 8,
  };

  // Single match — simple banner
  if (matches.length === 1) {
    const m = matches[0];
    const parts = [m.client_name, m.claim_number && `Claim: ${m.claim_number}`, m.file_number && `File: ${m.file_number}`, m.loss_address].filter(Boolean);
    return (
      <div style={{ ...bannerStyle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span>
          Found existing data from <strong>{SOURCE_LABELS[m.source_table] || m.source_table}</strong>: {parts.join(' — ')}
        </span>
        <span>
          <button style={btnAccept} onClick={() => handleAccept(m)}>Use This Data</button>
          <button style={btnDismiss} onClick={handleDismiss}>Dismiss</button>
        </span>
      </div>
    );
  }

  // Multiple matches — list with pick
  return (
    <div style={bannerStyle}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        Found {matches.length} matching records — pick one to use:
      </div>
      {matches.map((m, i) => {
        const parts = [m.client_name, m.claim_number && `Claim: ${m.claim_number}`, m.file_number && `File: ${m.file_number}`, m.loss_address].filter(Boolean);
        return (
          <div key={`${m.source_table}-${m.source_id}`} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "6px 0", borderTop: i > 0 ? "1px solid rgba(251,191,36,0.3)" : "none",
          }}>
            <span>
              <strong>{SOURCE_LABELS[m.source_table] || m.source_table}</strong>: {parts.join(' — ')}
            </span>
            <button style={btnAccept} onClick={() => handleAccept(m)}>Use</button>
          </div>
        );
      })}
      <div style={{ marginTop: 8 }}>
        <button style={btnDismiss} onClick={handleDismiss}>Dismiss all</button>
      </div>
    </div>
  );
}
