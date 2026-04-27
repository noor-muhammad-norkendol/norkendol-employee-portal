"use client";

import React from "react";
import { OnboardingStatus, STATUS_LABELS } from "@/types/onboarder-kpi";

interface PipelineHeaderProps {
  totalClients: number;
  completionRate: number | null;
  overdueCount: number;
  pipelineCounts: Record<string, number>;
  statusFilter: OnboardingStatus;
  view: string;
  onSelectStatus: (status: OnboardingStatus) => void;
  onAddClient: () => void;
  onPerformance: () => void;
}

const PIPELINE_STATUSES: OnboardingStatus[] = [
  "new", "step_2", "step_3", "final_step", "on_hold", "completed",
];

// Maps each stage to a semantic CSS variable. Renders correctly in all 6 cells.
const STATUS_TOKEN: Record<OnboardingStatus | string, string> = {
  new: "--info",
  step_2: "--amber",
  step_3: "--orange",
  final_step: "--red",
  on_hold: "--text-faint",
  completed: "--green",
};

// Short SVG icons per stage (Heroicons-ish, 24x24 strokes)
const STATUS_ICON: Record<string, React.ReactNode> = {
  new: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  step_2: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  step_3: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3 4v5h5" />
    </svg>
  ),
  final_step: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 11 19H1L12 2Z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  ),
  on_hold: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  completed: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
};

export default function PipelineHeader({
  totalClients, completionRate, overdueCount, pipelineCounts,
  statusFilter, view, onSelectStatus, onAddClient, onPerformance,
}: PipelineHeaderProps) {
  return (
    <div className="mb-6">
      {/* Title row */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
        <div>
          <h1
            className="page-title text-5xl leading-none tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span
              style={{
                color: "var(--accent)",
                textShadow: "var(--accent-text-shadow)",
                fontWeight: 800,
              }}
            >
              Onboarder
            </span>{" "}
            <span
              style={{
                color: "var(--text)",
                fontWeight: 500,
                opacity: 0.92,
              }}
            >
              KPI
            </span>
          </h1>
          <p className="mt-3 text-sm flex items-center gap-3" style={{ color: "var(--text-dim)" }}>
            <span>
              <strong style={{ color: "var(--text)" }}>{totalClients}</strong> client{totalClients !== 1 ? "s" : ""} total
            </span>
            {completionRate !== null && (
              <>
                <span style={{ color: "var(--text-faint)" }}>·</span>
                <span>
                  <strong style={{ color: "var(--green)" }}>{completionRate}%</strong> completion rate
                </span>
              </>
            )}
            {overdueCount > 0 && (
              <>
                <span style={{ color: "var(--text-faint)" }}>·</span>
                <span style={{ color: "var(--red)" }}>
                  <strong>{overdueCount}</strong> overdue
                </span>
              </>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onPerformance}
            className="px-7 py-3.5 text-[15px] font-bold uppercase cursor-pointer transition-all"
            style={{
              background: view === "performance"
                ? "color-mix(in srgb, var(--accent) 14%, var(--bg))"
                : "var(--bg)",
              color: "var(--accent)",
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: "var(--accent)",
              borderRadius: "8px",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.10em",
              textShadow: "var(--accent-text-shadow)",
              boxShadow:
                "0 0 16px color-mix(in srgb, var(--accent) 30%, transparent)",
              transitionProperty: "background, box-shadow, transform",
              transitionDuration: "var(--transition-base)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 14%, var(--bg))";
              e.currentTarget.style.boxShadow =
                "0 0 24px color-mix(in srgb, var(--accent) 50%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = view === "performance"
                ? "color-mix(in srgb, var(--accent) 14%, var(--bg))"
                : "var(--bg)";
              e.currentTarget.style.boxShadow =
                "0 0 16px color-mix(in srgb, var(--accent) 30%, transparent)";
            }}
          >
            My Performance
          </button>
          <button
            onClick={onAddClient}
            className="px-7 py-3.5 text-[15px] font-extrabold uppercase cursor-pointer transition-all"
            style={{
              background: "var(--cta-bg)",
              color: "var(--cta-text)",
              borderRadius: "8px",
              boxShadow:
                "0 0 22px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 50px color-mix(in srgb, var(--magenta) 28%, transparent), 0 4px 14px rgba(0,0,0,0.30)",
              border: "none",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.08em",
              transitionProperty: "filter, box-shadow, transform",
              transitionDuration: "var(--transition-base)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.08)";
              e.currentTarget.style.boxShadow =
                "0 0 32px color-mix(in srgb, var(--accent) 60%, transparent), 0 0 70px color-mix(in srgb, var(--magenta) 40%, transparent), 0 4px 16px rgba(0,0,0,0.30)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
              e.currentTarget.style.boxShadow =
                "0 0 22px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 50px color-mix(in srgb, var(--magenta) 28%, transparent), 0 4px 14px rgba(0,0,0,0.30)";
            }}
          >
            + Add Client
          </button>
        </div>
      </div>

      {/* Stat tiles bar — 6 stages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {PIPELINE_STATUSES.map((s) => {
          const count = pipelineCounts[s] || 0;
          const active = statusFilter === s && view === "pipeline";
          const token = STATUS_TOKEN[s] || "--text-dim";
          const tokenVar = `var(${token})`;
          const activeShadow =
            `0 0 0 1px ${tokenVar} inset, ` +
            `0 0 24px color-mix(in srgb, ${tokenVar} 55%, transparent), ` +
            `0 0 48px color-mix(in srgb, ${tokenVar} 22%, transparent)`;
          const hoverShadow =
            `0 0 18px color-mix(in srgb, ${tokenVar} 45%, transparent), ` +
            `0 0 36px color-mix(in srgb, ${tokenVar} 18%, transparent)`;
          return (
            <button
              key={s}
              onClick={() => onSelectStatus(s)}
              className="relative overflow-hidden p-4 text-left flex flex-col gap-2 cursor-pointer transition-all"
              style={{
                background: active
                  ? `color-mix(in srgb, ${tokenVar} 14%, var(--pad))`
                  : "var(--pad)",
                borderWidth: "1.5px",
                borderStyle: "solid",
                borderColor: active ? tokenVar : "var(--border)",
                borderRadius: "var(--radius-card)",
                boxShadow: active ? activeShadow : "var(--card-shadow)",
                transitionProperty: "background, border-color, box-shadow, transform",
                transitionDuration: "var(--transition-base)",
              }}
              onMouseEnter={(e) => {
                if (active) return;
                e.currentTarget.style.borderColor = tokenVar;
                e.currentTarget.style.boxShadow = hoverShadow;
                e.currentTarget.style.background = `color-mix(in srgb, ${tokenVar} 6%, var(--pad))`;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                if (active) return;
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "var(--card-shadow)";
                e.currentTarget.style.background = "var(--pad)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Stripe — semantic token, glows when active */}
              <span
                aria-hidden
                className="absolute left-0 right-0 top-0 h-[2px] pointer-events-none"
                style={{
                  background: active ? tokenVar : "var(--card-stripe-bg)",
                  boxShadow: active
                    ? `0 0 14px ${tokenVar}, 0 0 32px color-mix(in srgb, ${tokenVar} 55%, transparent)`
                    : "var(--card-stripe-shadow)",
                }}
              />
              <div className="flex items-start justify-between">
                <span
                  className="text-3xl font-extrabold leading-none"
                  style={{
                    color: tokenVar,
                    opacity: count > 0 ? 1 : 0.55,
                    textShadow: count > 0 && active
                      ? `0 0 6px ${tokenVar}, 0 0 18px color-mix(in srgb, ${tokenVar} 70%, transparent)`
                      : undefined,
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {count}
                </span>
                <span
                  className="shrink-0"
                  style={{
                    color: tokenVar,
                    opacity: count > 0 ? 1 : 0.55,
                    filter: active ? `drop-shadow(0 0 6px ${tokenVar})` : undefined,
                  }}
                >
                  {STATUS_ICON[s]}
                </span>
              </div>
              <span
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{
                  color: tokenVar,
                  opacity: active ? 1 : 0.78,
                  textShadow: active
                    ? `0 0 10px color-mix(in srgb, ${tokenVar} 70%, transparent)`
                    : undefined,
                  fontFamily: "var(--font-ui)",
                }}
              >
                {STATUS_LABELS[s]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
