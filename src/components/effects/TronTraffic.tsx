"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Tunable knobs — bump these if Frank wants more/less traffic.
const IDLE_MIN_MS = 30_000;
const IDLE_MAX_MS = 90_000;
const RACE_DURATION_MIN_MS = 7000;
const RACE_DURATION_MAX_MS = 10000;
const STAGGER_MS = 450;
const RTL_CHANCE = 0.25;
const GRID_SIZE_PX = 56;
const BIKE_WIDTH_PX = 12;
const BIKE_HEIGHT_PX = 6;
const TRAIL_LENGTH_PX = 220;

const PALETTE = [
  "var(--accent)",
  "var(--magenta)",
  "var(--violet)",
  "#FFB36B",
];

type Direction = "ltr" | "rtl";

type Bike = {
  id: number;
  color: string;
  topPx: number;
  durationMs: number;
  delayMs: number;
  direction: Direction;
};

type Wave = { id: number; bikes: Bike[]; longestEndsAtMs: number };

let nextWaveId = 1;
let nextBikeId = 1;

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function makeWave(): Wave {
  const direction: Direction = Math.random() < RTL_CHANCE ? "rtl" : "ltr";
  const count = Math.random() < 0.5 ? 2 : 3;

  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const minLane = Math.floor((viewportHeight * 0.2) / GRID_SIZE_PX);
  const maxLane = Math.max(minLane + 1, Math.floor((viewportHeight * 0.75) / GRID_SIZE_PX) - count);
  const baseLane = Math.floor(rand(minLane, maxLane + 1));

  const colors = [...PALETTE].sort(() => Math.random() - 0.5).slice(0, count);

  const bikes: Bike[] = Array.from({ length: count }, (_, i) => ({
    id: nextBikeId++,
    color: colors[i],
    topPx: (baseLane + i) * GRID_SIZE_PX,
    durationMs: rand(RACE_DURATION_MIN_MS, RACE_DURATION_MAX_MS),
    delayMs: i * STAGGER_MS,
    direction,
  }));

  const longestEndsAtMs = Math.max(...bikes.map((b) => b.delayMs + b.durationMs));
  return { id: nextWaveId++, bikes, longestEndsAtMs };
}

export default function TronTraffic() {
  // Mounted gate: SSR renders null. Client renders post-hydration. Avoids any hydration drift.
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wave, setWave] = useState<Wave | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Theme + reduced-motion gate. Live-updates via MutationObserver and matchMedia.
  useEffect(() => {
    const check = () => {
      const isThrowback = document.documentElement.dataset.style === "throwback";
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setReducedMotion(reduced);
      setEnabled(isThrowback && !reduced);
    };

    check();

    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-style"],
    });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", check);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", check);
    };
  }, []);

  // Imperative trigger for the manual "Start Race" button. Stable across renders via ref.
  const fireWaveNowRef = useRef<() => void>(() => {});

  // Wave scheduler. Idle → race → idle. Only runs when enabled.
  useEffect(() => {
    if (!enabled) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (waveEndTimerRef.current) clearTimeout(waveEndTimerRef.current);
      idleTimerRef.current = null;
      waveEndTimerRef.current = null;
      setWave(null);
      fireWaveNowRef.current = () => {};
      return;
    }

    let cancelled = false;

    const fireWave = () => {
      const newWave = makeWave();
      setWave(newWave);
      waveEndTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setWave(null);
        waveEndTimerRef.current = null;
        scheduleNext();
      }, newWave.longestEndsAtMs + 100);
    };

    const scheduleNext = () => {
      const idleMs = rand(IDLE_MIN_MS, IDLE_MAX_MS);
      idleTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        idleTimerRef.current = null;
        fireWave();
      }, idleMs);
    };

    // Manual trigger: cancel idle, fire now (no-op if a wave is already on screen).
    fireWaveNowRef.current = () => {
      if (cancelled) return;
      if (waveEndTimerRef.current) return;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      fireWave();
    };

    scheduleNext();

    // Listen for manual triggers from a <StartRaceButton /> mounted anywhere in the app.
    const onExternalTrigger = () => fireWaveNowRef.current();
    window.addEventListener("tron-start-race", onExternalTrigger);

    return () => {
      cancelled = true;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (waveEndTimerRef.current) clearTimeout(waveEndTimerRef.current);
      window.removeEventListener("tron-start-race", onExternalTrigger);
    };
  }, [enabled]);

  // Server and pre-hydration: render nothing. Stops any hydration drift from this component.
  if (!mounted) return null;
  // If user prefers reduced motion, render nothing at all (no button either).
  if (reducedMotion) return null;

  return (
    <>
      <style>{`
        @keyframes tron-traffic-ltr {
          from { transform: translate3d(-220px, 0, 0); }
          to   { transform: translate3d(calc(100vw + 220px), 0, 0); }
        }
        @keyframes tron-traffic-rtl {
          from { transform: translate3d(calc(100vw + 220px), 0, 0); }
          to   { transform: translate3d(-220px, 0, 0); }
        }
        @keyframes tron-button-pulse {
          0%, 100% {
            box-shadow:
              0 0 18px rgba(93, 236, 247, 0.7),
              0 0 36px rgba(93, 236, 247, 0.4),
              inset 0 0 12px rgba(93, 236, 247, 0.25);
          }
          50% {
            box-shadow:
              0 0 28px rgba(93, 236, 247, 0.95),
              0 0 56px rgba(93, 236, 247, 0.6),
              inset 0 0 20px rgba(93, 236, 247, 0.4);
          }
        }
        .tron-bike {
          position: absolute;
          width: ${BIKE_WIDTH_PX}px;
          height: ${BIKE_HEIGHT_PX}px;
          will-change: transform;
        }
        .tron-bike-head {
          position: absolute;
          inset: 0;
          border-radius: 3px;
          background: var(--bike-color);
          box-shadow:
            0 0 10px var(--bike-color),
            0 0 22px var(--bike-color),
            0 0 36px var(--bike-color);
        }
        .tron-bike-trail {
          position: absolute;
          top: 1px;
          height: ${BIKE_HEIGHT_PX - 2}px;
          width: ${TRAIL_LENGTH_PX}px;
          pointer-events: none;
        }
        .tron-bike[data-direction="ltr"] .tron-bike-trail {
          right: 100%;
          background: linear-gradient(to left, var(--bike-color) 0%, transparent 100%);
          box-shadow: 0 0 10px var(--bike-color), 0 0 18px var(--bike-color);
        }
        .tron-bike[data-direction="rtl"] .tron-bike-trail {
          left: 100%;
          background: linear-gradient(to right, var(--bike-color) 0%, transparent 100%);
          box-shadow: 0 0 10px var(--bike-color), 0 0 18px var(--bike-color);
        }
      `}</style>
      {enabled && (
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {wave?.bikes.map((bike) => {
          const animName = bike.direction === "ltr" ? "tron-traffic-ltr" : "tron-traffic-rtl";
          const style: CSSProperties = {
            top: bike.topPx,
            left: 0,
            animation: `${animName} ${bike.durationMs}ms linear ${bike.delayMs}ms forwards`,
            ["--bike-color" as never]: bike.color,
          };
          return (
            <div
              key={bike.id}
              className="tron-bike"
              data-direction={bike.direction}
              style={style}
            >
              <div className="tron-bike-trail" />
              <div className="tron-bike-head" />
            </div>
          );
        })}
      </div>
      )}
    </>
  );
}

// Drop-in button anyone can place anywhere in the app to manually start a wave.
// Renders nothing on Modern theme or when reduced-motion is set. Dispatches a custom
// event that the singleton TronTraffic component listens for.
export function StartRaceButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      const isThrowback = document.documentElement.dataset.style === "throwback";
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setShow(isThrowback && !reducedMotion);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-style"] });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", check);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", check);
    };
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("tron-start-race"))}
      title="Start a lightcycle race"
      style={{
        padding: "8px 16px",
        borderRadius: "999px",
        border: "1px solid var(--accent)",
        background: "color-mix(in srgb, var(--accent) 10%, transparent)",
        color: "var(--accent)",
        fontFamily: "var(--font-display, Audiowide, sans-serif)",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        cursor: "pointer",
        textShadow: "var(--accent-text-shadow)",
        boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 22%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 10%, transparent)";
      }}
    >
      ▶ Start Race
    </button>
  );
}
