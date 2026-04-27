"use client";

import React, { useState } from "react";
import type { OnboardingClient, OnboardingStatus } from "@/types/onboarder-kpi";
import { STATUS_LABELS, STAGE_TARGET_HOURS } from "@/types/onboarder-kpi";
import { HOUR_MS } from "./styles";

interface Props {
  allClients: OnboardingClient[];
  onClickClient?: (client: OnboardingClient) => void;
}

const ACTIVE_STAGES: OnboardingStatus[] = ["new", "step_2", "step_3", "final_step", "on_hold"];

export default function UrgencyBanner({ allClients, onClickClient }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const overdueClients = allClients
    .filter((c) => {
      if (!ACTIVE_STAGES.includes(c.status)) return false;
      const hours = (Date.now() - new Date(c.status_entered_at).getTime()) / HOUR_MS;
      const target = STAGE_TARGET_HOURS[c.status as keyof typeof STAGE_TARGET_HOURS];
      return target ? hours > target : false;
    })
    .sort((a, b) => {
      // Worst (longest in stage) first
      const aHrs = (Date.now() - new Date(a.status_entered_at).getTime()) / HOUR_MS;
      const bHrs = (Date.now() - new Date(b.status_entered_at).getTime()) / HOUR_MS;
      return bHrs - aHrs;
    });

  if (overdueClients.length === 0 || dismissed) return null;

  const lead = overdueClients[0];
  const leadHours = (Date.now() - new Date(lead.status_entered_at).getTime()) / HOUR_MS;
  const leadLabel = leadHours < 24 ? `${Math.round(leadHours)}h` : `${(leadHours / 24).toFixed(1)}d`;
  const more = overdueClients.length - 1;

  return (
    <div
      onClick={() => onClickClient?.(lead)}
      className="relative overflow-hidden mb-5 cursor-pointer transition-all"
      style={{
        background: "var(--pad)",
        backgroundImage:
          "linear-gradient(180deg, color-mix(in srgb, var(--red) 14%, var(--pad)) 0%, var(--pad) 100%)",
        border: "1.5px solid var(--red)",
        borderRadius: "var(--radius-card)",
        boxShadow:
          "0 0 24px color-mix(in srgb, var(--red) 30%, transparent), var(--card-shadow)",
        transitionProperty: "box-shadow, transform",
        transitionDuration: "var(--transition-base)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          "0 0 32px color-mix(in srgb, var(--red) 45%, transparent), var(--card-shadow)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow =
          "0 0 24px color-mix(in srgb, var(--red) 30%, transparent), var(--card-shadow)";
      }}
    >
      {/* Top stripe — red glow */}
      <span
        aria-hidden
        className="absolute left-0 right-0 top-0 h-[2px] pointer-events-none"
        style={{
          background: "var(--red)",
          boxShadow: "0 0 14px var(--red), 0 0 32px color-mix(in srgb, var(--red) 55%, transparent)",
        }}
      />

      <div className="flex items-center gap-3 pl-4 pr-12" style={{ paddingTop: 16, paddingBottom: 16 }}>
        {/* Alert icon */}
        <span
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-md"
          style={{
            background: "color-mix(in srgb, var(--red) 14%, var(--pad))",
            border: "1px solid var(--red)",
            color: "var(--red)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 2 11 19H1L12 2Z" />
            <path d="M12 9v5M12 17h.01" />
          </svg>
        </span>

        {/* Two-line summary, both lines compact and inline */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div
            className="text-[14px] font-bold uppercase tracking-wider flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span
              style={{
                color: "var(--red)",
                textShadow: "0 0 10px color-mix(in srgb, var(--red) 60%, transparent)",
              }}
            >
              {overdueClients.length}
            </span>
            <span style={{ color: "var(--text-dim)" }}>
              client{overdueClients.length !== 1 ? "s" : ""}
            </span>
            <span
              style={{
                color: "var(--red)",
                textShadow: "0 0 10px color-mix(in srgb, var(--red) 60%, transparent)",
              }}
            >
              overdue
            </span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span style={{ color: "var(--amber)" }}>
              Action Required
            </span>
          </div>
          <div className="text-[13px] flex items-center gap-2 flex-wrap">
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{lead.client_name}</span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span style={{ color: "var(--amber)" }}>{STATUS_LABELS[lead.status]}</span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span
              style={{
                color: "var(--red)",
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
              }}
            >
              {leadLabel} in stage
            </span>
            {more > 0 && (
              <>
                <span style={{ color: "var(--text-faint)" }}>·</span>
                <span style={{ color: "var(--text-dim)" }}>
                  +{more} more
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="absolute top-1/2 right-3 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors"
        style={{
          color: "var(--red)",
          background: "transparent",
          border: "1px solid color-mix(in srgb, var(--red) 50%, transparent)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "color-mix(in srgb, var(--red) 14%, transparent)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
