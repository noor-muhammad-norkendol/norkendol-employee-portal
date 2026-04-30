"use client";

import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";

// ── Tunable knobs ────────────────────────────────────────────────────────

const AMBIENT_IDLE_MIN_MS = 0;
const AMBIENT_IDLE_MAX_MS = 45_000;
const SESSION_DURATION_MS = 240_000; // 4 minutes
const RACING_IDLE_START_MIN_MS = 8_000;
const RACING_IDLE_START_MAX_MS = 12_000;
const RACING_IDLE_END_MIN_MS = 1_000;
const RACING_IDLE_END_MAX_MS = 4_000;
const RACE_DURATION_MIN_MS = 7000;
const RACE_DURATION_MAX_MS = 10000;
const STAGGER_MS = 450;
const GRID_SIZE_PX = 56;
const BIKE_LENGTH_PX = 12;
const BIKE_WIDTH_PX = 6;
const TRAIL_LENGTH_PX = 240;
const OFFSCREEN_BUFFER_PX = 280;
const TURN_CHANCE = 0.45;

const DEREZ_CHANCE_RACING = 0.30;
const DEREZ_VOXEL_COUNT_MIN = 10;
const DEREZ_VOXEL_COUNT_MAX = 14;
const DEREZ_DURATION_MS = 600;

// Exactly 2 AI bikes per wave: one orange, one red. The player bike (cyan) makes 3 total.
const AI_ORANGE = "#FF7B2A";
const AI_RED = "#FF3D3D";
const TEAM_PROGRAM_COLORS = [AI_ORANGE, AI_RED];
const TEAM_CLU_COLORS = [AI_ORANGE, AI_RED];
const AMBIENT_PALETTE = [AI_ORANGE, AI_RED];

const PELOTON_CHANCE_AMBIENT = 0.70;
const PELOTON_LANE_OFFSETS_PX = [-112, -56, 0, 56, 112];

const PLAYER_BIKE_SPEED_PX_PER_SEC = 280;
const PLAYER_BIKE_TRAIL_MAX_LENGTH_PX = 600;
const PLAYER_BIKE_COLOR = "var(--accent)";

const DIRECTION_WEIGHTS: Record<Direction, number> = {
  ltr: 0.25,
  rtl: 0.35,
  ttb: 0.20,
  btt: 0.20,
};

// ── Types ────────────────────────────────────────────────────────────────

type Direction = "ltr" | "rtl" | "ttb" | "btt";
type Team = "program" | "clu";
type Mode = "ambient" | "racing" | "ended";

type Bike = {
  id: number;
  color: string;
  path: string;
  durationMs: number;
  delayMs: number;
  /** When (ms relative to bike's own start) to derez. Undefined = no derez, runs the full path. */
  derezAtMs?: number;
};

type Wave = {
  id: number;
  bikes: Bike[];
  longestEndsAtMs: number;
};

type Voxel = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot: number;
  color: string;
  size: number;
};

type Burst = {
  id: number;
  voxels: Voxel[];
};

type Point = { x: number; y: number };

type PlayerBikeState = {
  x: number;
  y: number;
  direction: Direction;
  trail: Point[];
  alive: boolean;
  /** True until the user presses an arrow. While true, the bike auto-turns at walls. */
  autoControlled: boolean;
};

// ── Module-level counters ────────────────────────────────────────────────

let nextWaveId = 1;
let nextBikeId = 1;
let nextBurstId = 1;
let nextVoxelId = 1;

// ── Helpers ──────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pickDirection(): Direction {
  const r = Math.random();
  let acc = 0;
  for (const dir of Object.keys(DIRECTION_WEIGHTS) as Direction[]) {
    acc += DIRECTION_WEIGHTS[dir];
    if (r < acc) return dir;
  }
  return "rtl";
}

function turnCandidates(d: Direction): Direction[] {
  if (d === "ltr" || d === "rtl") return ["ttb", "btt"];
  return ["ltr", "rtl"];
}

function snapToGrid(px: number): number {
  return Math.round(px / GRID_SIZE_PX) * GRID_SIZE_PX;
}

function isHorizontal(d: Direction): boolean {
  return d === "ltr" || d === "rtl";
}

function oppositeDirection(d: Direction): Direction {
  if (d === "ltr") return "rtl";
  if (d === "rtl") return "ltr";
  if (d === "ttb") return "btt";
  return "ttb";
}

/**
 * Build an SVG path for a bike's trajectory in main-relative coords.
 * Optional turn (TURN_CHANCE controls).
 */
function buildPath(direction: Direction, mw: number, mh: number, allowTurn: boolean = true): string {
  const buf = OFFSCREEN_BUFFER_PX;
  const middleMin = 0.30;
  const middleMax = 0.70;

  const horizLane = snapToGrid(rand(mh * 0.18, mh * 0.82));
  const vertLane = snapToGrid(rand(mw * 0.12, mw * 0.88));

  let startX: number, startY: number, endX: number, endY: number;
  switch (direction) {
    case "ltr":
      startX = -buf; startY = horizLane; endX = mw + buf; endY = horizLane;
      break;
    case "rtl":
      startX = mw + buf; startY = horizLane; endX = -buf; endY = horizLane;
      break;
    case "ttb":
      startX = vertLane; startY = -buf; endX = vertLane; endY = mh + buf;
      break;
    case "btt":
      startX = vertLane; startY = mh + buf; endX = vertLane; endY = -buf;
      break;
  }

  const willTurn = allowTurn && Math.random() < TURN_CHANCE;
  if (!willTurn) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const turnTo = turnCandidates(direction)[Math.random() < 0.5 ? 0 : 1];
  const t = rand(middleMin, middleMax);

  let turnX: number, turnY: number;
  if (isHorizontal(direction)) {
    turnX = snapToGrid(startX + (endX - startX) * t);
    turnY = startY;
    endY = turnTo === "ttb" ? mh + buf : -buf;
    endX = turnX;
  } else {
    turnX = startX;
    turnY = snapToGrid(startY + (endY - startY) * t);
    endX = turnTo === "ltr" ? mw + buf : -buf;
    endY = turnY;
  }

  return `M ${startX} ${startY} L ${turnX} ${turnY} L ${endX} ${endY}`;
}

/**
 * Build a straight path that STARTS at the player bike's current position
 * and races outward in the player's direction. So all bikes line up at the
 * same starting spot and race off together (Tron starting-line feel).
 */
function buildPathAlongside(
  anchor: { x: number; y: number; direction: Direction },
  mw: number,
  mh: number,
): string {
  const buf = OFFSCREEN_BUFFER_PX;
  const sx = snapToGrid(anchor.x);
  const sy = snapToGrid(anchor.y);
  switch (anchor.direction) {
    case "ltr":
      return `M ${sx} ${sy} L ${mw + buf} ${sy}`;
    case "rtl":
      return `M ${sx} ${sy} L ${-buf} ${sy}`;
    case "ttb":
      return `M ${sx} ${sy} L ${sx} ${mh + buf}`;
    case "btt":
      return `M ${sx} ${sy} L ${sx} ${-buf}`;
  }
}

/**
 * Take an SVG path and produce a parallel path shifted perpendicular by `offsetPx`.
 * For each L command, shifts the destination point by offsetPx along the perpendicular
 * to the previous segment's direction. Used for peloton offsets.
 */
function shiftPath(path: string, offsetPx: number): string {
  // Parse "M x y L x y L x y..." style
  const tokens = path.trim().split(/\s+/);
  const points: Point[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === "M" || cmd === "L") {
      points.push({ x: parseFloat(tokens[i + 1]), y: parseFloat(tokens[i + 2]) });
      i += 3;
    } else {
      i += 1;
    }
  }
  if (points.length < 2) return path;

  // For each segment determine its direction, then shift perpendicular.
  // For a multi-segment path we apply the SAME offset axis throughout based on the first segment.
  // (This keeps peloton bikes parallel for L-shaped paths — they share the same lane offset
  // before and after the turn, scaled so the turn point shifts uniformly.)
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector (rotate 90° clockwise: (x,y) → (y,-x)).
  const px = dy / len;
  const py = -dx / len;
  const ox = px * offsetPx;
  const oy = py * offsetPx;

  const shifted = points.map((p) => ({ x: p.x + ox, y: p.y + oy }));
  let result = `M ${shifted[0].x} ${shifted[0].y}`;
  for (let k = 1; k < shifted.length; k++) {
    result += ` L ${shifted[k].x} ${shifted[k].y}`;
  }
  return result;
}

/** Compute (x,y) at a given fraction (0..1) of an SVG path using a hidden <svg> + getPointAtLength. */
function pointAtFraction(pathStr: string, fraction: number): Point {
  if (typeof document === "undefined") return { x: 0, y: 0 };
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  const pathEl = document.createElementNS(svgNS, "path");
  pathEl.setAttribute("d", pathStr);
  svg.appendChild(pathEl);
  // Append to body briefly so getTotalLength works.
  document.body.appendChild(svg);
  const total = pathEl.getTotalLength();
  const pt = pathEl.getPointAtLength(total * fraction);
  document.body.removeChild(svg);
  return { x: pt.x, y: pt.y };
}

function teamColor(team: Team): string {
  const palette = team === "program" ? TEAM_PROGRAM_COLORS : TEAM_CLU_COLORS;
  return palette[Math.floor(Math.random() * palette.length)];
}

function ambientColor(): string {
  return AMBIENT_PALETTE[Math.floor(Math.random() * AMBIENT_PALETTE.length)];
}

/** Returns current racing idle range (ms) given how far into the session we are. */
function racingIdleRange(elapsedMs: number): { min: number; max: number } {
  const t = Math.min(1, Math.max(0, elapsedMs / SESSION_DURATION_MS));
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    min: lerp(RACING_IDLE_START_MIN_MS, RACING_IDLE_END_MIN_MS),
    max: lerp(RACING_IDLE_START_MAX_MS, RACING_IDLE_END_MAX_MS),
  };
}

// ── Wave generation ──────────────────────────────────────────────────────

type WaveOptions = {
  team?: Team;
  isPeloton: boolean;
  derezChance: number;
  mainW: number;
  mainH: number;
  /** When set, AI bikes spawn alongside this anchor (player position) racing the same direction. */
  alongside?: { x: number; y: number; direction: Direction };
};

function makeWave(opts: WaveOptions): Wave {
  const count = 2; // exactly one orange + one red, always

  // Build the base path. If alongside (racing the player), anchor to the player's position
  // and direction so the AI catches up to the player on a parallel lane.
  let baseDirection: Direction;
  let basePath: string;
  if (opts.alongside) {
    baseDirection = opts.alongside.direction;
    basePath = buildPathAlongside(opts.alongside, opts.mainW, opts.mainH);
  } else {
    baseDirection = pickDirection();
    basePath = buildPath(baseDirection, opts.mainW, opts.mainH);
  }

  // Always one orange, one red (random which goes first for stagger variation).
  const colors = Math.random() < 0.5 ? [AI_ORANGE, AI_RED] : [AI_RED, AI_ORANGE];

  const bikes: Bike[] = Array.from({ length: count }, (_, i) => {
    const durationMs = rand(RACE_DURATION_MIN_MS, RACE_DURATION_MAX_MS);
    let path: string;
    if (opts.isPeloton) {
      // All bikes share basePath but offset perpendicular to the leading direction.
      const offsetIndex = Math.floor((PELOTON_LANE_OFFSETS_PX.length - count) / 2) + i;
      const offsetPx = PELOTON_LANE_OFFSETS_PX[Math.max(0, Math.min(PELOTON_LANE_OFFSETS_PX.length - 1, offsetIndex))];
      path = shiftPath(basePath, offsetPx);
    } else {
      path = buildPath(baseDirection, opts.mainW, opts.mainH);
    }
    const willDerez = Math.random() < opts.derezChance;
    const derezAtMs = willDerez ? durationMs * rand(0.30, 0.80) : undefined;
    // When running alongside the player (starting-line race), all bikes leap off together — no stagger.
    // Otherwise (ambient peloton, scattered ambient) keep the visual stagger.
    const delayMs = opts.alongside ? 0 : i * STAGGER_MS;
    return {
      id: nextBikeId++,
      color: colors[i],
      path,
      durationMs,
      delayMs,
      derezAtMs,
    };
  });

  const longestEndsAtMs = Math.max(...bikes.map((b) => b.delayMs + b.durationMs));
  return { id: nextWaveId++, bikes, longestEndsAtMs };
}

// ── Voxel burst generator ────────────────────────────────────────────────

function makeBurst(at: Point, color: string): Burst {
  const count = Math.floor(rand(DEREZ_VOXEL_COUNT_MIN, DEREZ_VOXEL_COUNT_MAX + 1));
  const voxels: Voxel[] = Array.from({ length: count }, () => {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(30, 60);
    return {
      id: nextVoxelId++,
      x: at.x,
      y: at.y,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      rot: rand(-180, 180),
      color,
      size: Math.floor(rand(3, 6)),
    };
  });
  return { id: nextBurstId++, voxels };
}

// ── DerezBurst component ─────────────────────────────────────────────────

function DerezBurstView({ burst }: { burst: Burst }) {
  return (
    <>
      {burst.voxels.map((v) => {
        const style: CSSProperties = {
          position: "absolute",
          left: v.x,
          top: v.y,
          width: v.size,
          height: v.size,
          background: v.color,
          boxShadow: `0 0 6px ${v.color}, 0 0 12px ${v.color}`,
          borderRadius: "1px",
          animation: `tron-derez-${v.id} ${DEREZ_DURATION_MS}ms ease-out forwards`,
          willChange: "transform, opacity",
          ["--vx" as never]: `${v.dx}px`,
          ["--vy" as never]: `${v.dy}px`,
          ["--vr" as never]: `${v.rot}deg`,
        };
        return (
          <div key={v.id}>
            <style>{`
              @keyframes tron-derez-${v.id} {
                from {
                  transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
                  opacity: 1;
                }
                to {
                  transform: translate3d(${v.dx}px, ${v.dy}px, 0) scale(0.5) rotate(${v.rot}deg);
                  opacity: 0;
                }
              }
            `}</style>
            <div style={style} />
          </div>
        );
      })}
    </>
  );
}

// ── Player bike component ────────────────────────────────────────────────

function PlayerBikeView({
  state,
  mainSize,
}: {
  state: PlayerBikeState;
  mainSize: { width: number; height: number };
}) {
  if (!state.alive && state.trail.length === 0) return null;

  const trailPoints = [...state.trail, { x: state.x, y: state.y }]
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  return (
    <>
      {/* Trail polyline */}
      {state.trail.length > 0 && (
        <svg
          width={mainSize.width}
          height={mainSize.height}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <polyline
            points={trailPoints}
            stroke={PLAYER_BIKE_COLOR}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: `drop-shadow(0 0 4px ${PLAYER_BIKE_COLOR}) drop-shadow(0 0 10px ${PLAYER_BIKE_COLOR})`,
              opacity: state.alive ? 1 : 0.6,
              transition: state.alive ? undefined : "opacity 1.5s ease-out",
            }}
          />
        </svg>
      )}
      {/* Bike head */}
      {state.alive && (
        <div
          style={{
            position: "absolute",
            left: state.x - 5,
            top: state.y - 5,
            width: 10,
            height: 10,
            borderRadius: "2px",
            background: PLAYER_BIKE_COLOR,
            boxShadow: `0 0 12px ${PLAYER_BIKE_COLOR}, 0 0 24px ${PLAYER_BIKE_COLOR}, 0 0 40px ${PLAYER_BIKE_COLOR}`,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function TronTraffic() {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reducedMotion, setReducedMotionState] = useState(false);
  const [mode, setMode] = useState<Mode>("ambient");
  const [wave, setWave] = useState<Wave | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [playerBike, setPlayerBike] = useState<PlayerBikeState | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const mainSizeRef = useRef({ width: 1200, height: 800 });
  const [mainSize, setMainSize] = useState({ width: 1200, height: 800 });
  const sessionStartRef = useRef<number | null>(null);
  const teamFlipRef = useRef<Team>("program");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireWaveNowRef = useRef<() => void>(() => {});
  const playerBikeRef = useRef<PlayerBikeState | null>(null);
  const playerRafRef = useRef<number | null>(null);
  const playerLastFrameRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Theme + reduced-motion gate.
  useEffect(() => {
    const check = () => {
      const isThrowback = document.documentElement.dataset.style === "throwback";
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setReducedMotionState(reduced);
      setEnabled(isThrowback && !reduced);
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

  // ResizeObserver on parent (main element).
  useEffect(() => {
    if (!mounted) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const parent = overlay.parentElement;
    if (!parent) return;

    const update = () => {
      const rect = parent.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height };
      mainSizeRef.current = next;
      setMainSize(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [mounted]);

  // Broadcast session-state changes for the StartRaceButton.
  const broadcastSessionState = useCallback((nextMode: Mode, sessionStartMs: number | null) => {
    window.dispatchEvent(
      new CustomEvent("tron-session-state", {
        detail: { mode: nextMode, sessionStartMs, sessionDurationMs: SESSION_DURATION_MS },
      }),
    );
  }, []);

  // Schedule + fire waves. Mode-aware.
  useEffect(() => {
    if (!enabled) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (waveEndTimerRef.current) clearTimeout(waveEndTimerRef.current);
      if (sessionEndTimerRef.current) clearTimeout(sessionEndTimerRef.current);
      idleTimerRef.current = null;
      waveEndTimerRef.current = null;
      sessionEndTimerRef.current = null;
      setWave(null);
      setMode("ambient");
      sessionStartRef.current = null;
      fireWaveNowRef.current = () => {};
      broadcastSessionState("ambient", null);
      return;
    }

    let cancelled = false;

    // The currently active mode (ref so the closures see the latest).
    let currentMode: Mode = mode;

    const fireWave = () => {
      if (cancelled) return;
      const isRacing = currentMode === "racing";
      let team: Team | undefined;
      if (isRacing) {
        team = teamFlipRef.current;
        teamFlipRef.current = team === "program" ? "clu" : "program";
      }
      const isPeloton = isRacing ? true : Math.random() < PELOTON_CHANCE_AMBIENT;
      // In racing mode: AI bikes spawn ALONGSIDE the player bike, racing the same direction.
      // Player on a parallel track = the Tron Ares look.
      const player = playerBikeRef.current;
      const alongside =
        isRacing && player && player.alive
          ? { x: player.x, y: player.y, direction: player.direction }
          : undefined;
      const newWave = makeWave({
        team,
        isPeloton,
        derezChance: isRacing ? DEREZ_CHANCE_RACING : 0,
        mainW: mainSizeRef.current.width,
        mainH: mainSizeRef.current.height,
        alongside,
      });
      setWave(newWave);

      // Schedule derez bursts for any bikes that will derez.
      newWave.bikes.forEach((b) => {
        if (b.derezAtMs == null) return;
        const fireAt = b.delayMs + b.derezAtMs;
        setTimeout(() => {
          if (cancelled) return;
          const fraction = b.derezAtMs! / b.durationMs;
          const at = pointAtFraction(b.path, fraction);
          const burst = makeBurst(at, b.color);
          setBursts((prev) => [...prev, burst]);
          setTimeout(() => {
            setBursts((prev) => prev.filter((x) => x.id !== burst.id));
          }, DEREZ_DURATION_MS + 100);
        }, fireAt);
      });

      waveEndTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setWave(null);
        waveEndTimerRef.current = null;
        if (currentMode !== "ended") scheduleNext();
      }, newWave.longestEndsAtMs + 100);
    };

    const scheduleNext = () => {
      if (cancelled) return;
      let idleMin: number, idleMax: number;
      if (currentMode === "racing") {
        const elapsed = sessionStartRef.current != null ? Date.now() - sessionStartRef.current : 0;
        const r = racingIdleRange(elapsed);
        idleMin = r.min;
        idleMax = r.max;
      } else if (currentMode === "ambient") {
        idleMin = AMBIENT_IDLE_MIN_MS;
        idleMax = AMBIENT_IDLE_MAX_MS;
      } else {
        // ended — no scheduling
        return;
      }
      const idleMs = rand(idleMin, idleMax);
      idleTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        idleTimerRef.current = null;
        fireWave();
      }, idleMs);
    };

    const enterRacing = () => {
      if (cancelled) return;
      currentMode = "racing";
      setMode("racing");
      const startMs = Date.now();
      sessionStartRef.current = startMs;
      teamFlipRef.current = "program";
      broadcastSessionState("racing", startMs);

      // Spawn the player bike at center, auto-running in a random cardinal direction.
      const mw = mainSizeRef.current.width;
      const mh = mainSizeRef.current.height;
      const initialDirs: Direction[] = ["ltr", "rtl", "ttb", "btt"];
      const initialDir = initialDirs[Math.floor(Math.random() * 4)];
      const newPlayer: PlayerBikeState = {
        x: mw / 2,
        y: mh / 2,
        direction: initialDir,
        trail: [],
        alive: true,
        autoControlled: true,
      };
      setPlayerBike(newPlayer);
      playerBikeRef.current = newPlayer;

      // Start racing waves immediately (no idle delay for the first wave).
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (waveEndTimerRef.current) clearTimeout(waveEndTimerRef.current);
      fireWave();

      // Schedule the session end.
      if (sessionEndTimerRef.current) clearTimeout(sessionEndTimerRef.current);
      sessionEndTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        currentMode = "ended";
        setMode("ended");
        sessionStartRef.current = null;
        broadcastSessionState("ended", null);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }, SESSION_DURATION_MS);
    };

    fireWaveNowRef.current = () => {
      if (cancelled) return;
      // Click semantics: from any state (ambient/racing/ended), kick off a fresh racing session.
      enterRacing();
    };

    // Initial state: ambient mode running.
    currentMode = "ambient";
    setMode("ambient");
    broadcastSessionState("ambient", null);
    scheduleNext();

    const onExternalTrigger = () => fireWaveNowRef.current();
    window.addEventListener("tron-start-race", onExternalTrigger);

    return () => {
      cancelled = true;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (waveEndTimerRef.current) clearTimeout(waveEndTimerRef.current);
      if (sessionEndTimerRef.current) clearTimeout(sessionEndTimerRef.current);
      window.removeEventListener("tron-start-race", onExternalTrigger);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Player bike: keyboard + rAF ────────────────────────────────────────
  // NOTE: playerBikeRef is the source of truth for live position. Only the rAF tick,
  // the keydown handler, and the racing-mode spawn write to it. We do NOT sync from
  // React state — that would let stale committed state overwrite a freshly-mutated ref.

  // Arrow-key listener — only active during racing.
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Skip if typing in an input/textarea/contenteditable so search etc. still works.
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }

      const player = playerBikeRef.current;
      if (!player || !player.alive) return;
      if (mode !== "racing") return;

      let next: Direction | null = null;
      if (e.key === "ArrowRight") next = "ltr";
      else if (e.key === "ArrowLeft") next = "rtl";
      else if (e.key === "ArrowDown") next = "ttb";
      else if (e.key === "ArrowUp") next = "btt";
      else return;

      // 90°-only rule: cannot reverse 180°.
      if (oppositeDirection(player.direction) === next) return;

      e.preventDefault();
      // First arrow press takes manual control — autoControlled flips to false permanently for this race.
      const updated: PlayerBikeState = { ...player, direction: next, autoControlled: false };
      playerBikeRef.current = updated;
      setPlayerBike(updated);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, mode]);

  // rAF loop for player bike position.
  useEffect(() => {
    if (!enabled) return;

    const tick = (ts: number) => {
      const last = playerLastFrameRef.current || ts;
      const dtSec = Math.min(0.1, (ts - last) / 1000); // cap to 100ms to avoid jumps
      playerLastFrameRef.current = ts;

      const p = playerBikeRef.current;
      if (p && p.alive && p.direction) {
        const speed = PLAYER_BIKE_SPEED_PX_PER_SEC;
        const mw = mainSizeRef.current.width;
        const mh = mainSizeRef.current.height;

        // Auto-pilot: when about to hit a wall, pick a perpendicular that has more room.
        let dir: Direction = p.direction;
        if (p.autoControlled) {
          const lookAhead = 60; // px ahead to anticipate
          const ax = p.x + (dir === "ltr" ? lookAhead : dir === "rtl" ? -lookAhead : 0);
          const ay = p.y + (dir === "ttb" ? lookAhead : dir === "btt" ? -lookAhead : 0);
          if (ax < 0 || ax > mw || ay < 0 || ay > mh) {
            const perpendiculars: Direction[] = isHorizontal(dir) ? ["ttb", "btt"] : ["ltr", "rtl"];
            const room = (d: Direction) => {
              if (d === "ltr") return mw - p.x;
              if (d === "rtl") return p.x;
              if (d === "ttb") return mh - p.y;
              return p.y;
            };
            perpendiculars.sort((a, b) => room(b) - room(a));
            dir = perpendiculars[0];
          }
        }

        let nx = p.x;
        let ny = p.y;
        if (dir === "ltr") nx += speed * dtSec;
        else if (dir === "rtl") nx -= speed * dtSec;
        else if (dir === "ttb") ny += speed * dtSec;
        else if (dir === "btt") ny -= speed * dtSec;

        // Append to trail. Trim FIFO to max length.
        const newTrail = [...p.trail, { x: p.x, y: p.y }];
        let totalLen = 0;
        for (let i = newTrail.length - 1; i > 0; i--) {
          totalLen += Math.hypot(newTrail[i].x - newTrail[i - 1].x, newTrail[i].y - newTrail[i - 1].y);
          if (totalLen > PLAYER_BIKE_TRAIL_MAX_LENGTH_PX) {
            newTrail.splice(0, i);
            break;
          }
        }

        // Bounds check vs main size (mw/mh already declared above).
        if (nx < 0 || nx > mw || ny < 0 || ny > mh) {
          // Crash → derez at the boundary.
          const burstAt = { x: Math.max(0, Math.min(mw, nx)), y: Math.max(0, Math.min(mh, ny)) };
          const burst = makeBurst(burstAt, PLAYER_BIKE_COLOR);
          setBursts((prev) => [...prev, burst]);
          setTimeout(() => {
            setBursts((prev) => prev.filter((x) => x.id !== burst.id));
          }, DEREZ_DURATION_MS + 100);
          const dead: PlayerBikeState = { ...p, alive: false, trail: newTrail };
          playerBikeRef.current = dead;
          setPlayerBike(dead);
          // Clear trail after a delay so it lingers as a ghost.
          setTimeout(() => {
            const cur = playerBikeRef.current;
            if (cur && !cur.alive) {
              const cleared: PlayerBikeState = { ...cur, trail: [] };
              playerBikeRef.current = cleared;
              setPlayerBike(cleared);
            }
          }, 1500);
        } else {
          const updated: PlayerBikeState = { ...p, x: nx, y: ny, trail: newTrail, direction: dir };
          playerBikeRef.current = updated;
          setPlayerBike(updated);
        }
      }

      playerRafRef.current = requestAnimationFrame(tick);
    };

    playerRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (playerRafRef.current != null) cancelAnimationFrame(playerRafRef.current);
      playerRafRef.current = null;
      playerLastFrameRef.current = 0;
    };
  }, [enabled]);

  if (!mounted) return null;
  if (reducedMotion) return null;

  return (
    <>
      <style>{`
        @keyframes tron-traffic-along-path {
          from { offset-distance: 0%; }
          to   { offset-distance: 100%; }
        }
        .tron-bike {
          position: absolute;
          top: 0;
          left: 0;
          width: ${BIKE_LENGTH_PX}px;
          height: ${BIKE_WIDTH_PX}px;
          will-change: offset-distance;
          offset-rotate: auto 180deg;
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
          height: ${BIKE_WIDTH_PX - 2}px;
          width: ${TRAIL_LENGTH_PX}px;
          left: 100%;
          background: linear-gradient(to right, var(--bike-color) 0%, transparent 100%);
          box-shadow: 0 0 10px var(--bike-color), 0 0 18px var(--bike-color);
          pointer-events: none;
        }
      `}</style>
      <div
        ref={overlayRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {enabled && wave?.bikes.map((bike) => {
          const animationName = "tron-traffic-along-path";
          const style: CSSProperties = {
            animation: `${animationName} ${bike.durationMs}ms linear ${bike.delayMs}ms forwards`,
            offsetPath: `path('${bike.path}')`,
            ["--bike-color" as never]: bike.color,
            // If the bike will derez, hide it after the derez moment by stopping animation
            // then visibility hidden via animationFillMode. Simpler: use animation-iteration-count
            // and a wrapper that gets unmounted by the burst-spawn setTimeout.
          };
          // For derezzed bikes, hide via display: none after derezAtMs (handled by burst
          // setTimeout setting bursts state — but the bike DOM stays). Use a timed fade.
          if (bike.derezAtMs != null) {
            // Cut the animation short by trimming duration at derezAtMs and hiding.
            style.animation = `${animationName} ${bike.derezAtMs}ms linear ${bike.delayMs}ms forwards`;
            // After derezAt + delay, fade out.
            (style as Record<string, unknown>).animationName = animationName;
          }
          return (
            <div key={bike.id} className="tron-bike" style={style}>
              <div className="tron-bike-trail" />
              <div className="tron-bike-head" />
            </div>
          );
        })}
        {/* Derez bursts */}
        {enabled && bursts.map((b) => <DerezBurstView key={b.id} burst={b} />)}
        {/* Player bike */}
        {enabled && mode === "racing" && playerBike && (
          <PlayerBikeView state={playerBike} mainSize={mainSize} />
        )}
        {/* Arena boundary line during racing */}
        {enabled && mode === "racing" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "1px",
              background: "rgba(255, 179, 107, 0.35)",
              boxShadow: "0 0 8px rgba(255, 179, 107, 0.5)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </>
  );
}

// ── StartRaceButton ──────────────────────────────────────────────────────

type SessionStateDetail = {
  mode: Mode;
  sessionStartMs: number | null;
  sessionDurationMs: number;
};

function formatMMSS(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function StartRaceButton() {
  const [show, setShow] = useState(false);
  const [sessionState, setSessionState] = useState<SessionStateDetail>({
    mode: "ambient",
    sessionStartMs: null,
    sessionDurationMs: SESSION_DURATION_MS,
  });
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const check = () => {
      const isThrowback = document.documentElement.dataset.style === "throwback";
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setShow(isThrowback && !reduced);
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

  useEffect(() => {
    const onState = (e: Event) => {
      const ce = e as CustomEvent<SessionStateDetail>;
      if (ce.detail) setSessionState(ce.detail);
    };
    window.addEventListener("tron-session-state", onState as EventListener);
    return () => window.removeEventListener("tron-session-state", onState as EventListener);
  }, []);

  // Tick clock during racing for the countdown.
  useEffect(() => {
    if (sessionState.mode !== "racing") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sessionState.mode]);

  if (!show) return null;

  const { mode, sessionStartMs, sessionDurationMs } = sessionState;
  let label = "▶ Start Race";
  let style: CSSProperties = {};

  if (mode === "ambient") {
    label = "▶ Start Race";
    style = {
      border: "1px solid var(--accent)",
      background: "color-mix(in srgb, var(--accent) 10%, transparent)",
      color: "var(--accent)",
      textShadow: "var(--accent-text-shadow)",
      boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)",
      cursor: "pointer",
    };
  } else if (mode === "racing") {
    const remaining = sessionStartMs != null ? Math.max(0, sessionDurationMs - (now - sessionStartMs)) : sessionDurationMs;
    label = `● Racing ${formatMMSS(remaining)}`;
    style = {
      border: "1px solid #FF7B2A",
      background: "color-mix(in srgb, #FF7B2A 8%, transparent)",
      color: "#FFB36B",
      textShadow: "0 0 4px #FF7B2A",
      boxShadow: "0 0 10px rgba(255, 123, 42, 0.35)",
      cursor: "default",
      opacity: 0.85,
    };
  } else {
    // ended
    label = "▷ Race Ended";
    style = {
      border: "1px solid var(--text-faint)",
      background: "var(--pad-elev)",
      color: "var(--text-dim)",
      textShadow: undefined,
      boxShadow: "0 0 8px rgba(255, 255, 255, 0.08)",
      cursor: "pointer",
      animation: "tron-button-ended-pulse 2.4s ease-in-out infinite",
    };
  }

  return (
    <>
      <style>{`
        @keyframes tron-button-ended-pulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 0.95; }
        }
      `}</style>
      <button
        type="button"
        onClick={() => {
          if (mode === "racing") return; // no-op while racing
          window.dispatchEvent(new Event("tron-start-race"));
        }}
        title={
          mode === "racing"
            ? "Race in progress…"
            : mode === "ended"
              ? "Click to start another race"
              : "Start a lightcycle race"
        }
        style={{
          padding: "8px 16px",
          borderRadius: "999px",
          fontFamily: "var(--font-display, Audiowide, sans-serif)",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          minWidth: "150px",
          textAlign: "center",
          ...style,
        }}
      >
        {label}
      </button>
    </>
  );
}
