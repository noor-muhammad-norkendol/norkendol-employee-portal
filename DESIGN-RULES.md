# Norkendol Portal — Design Rules

**Status:** Active spec. Updated 2026-04-27. Lives with the project repo.
**Reference mocks (Frank's desktop):**
- `NORKENDOL-fintech-glassmorphism-comparison.html` — Modern (CryptoVault) Dark/Med/Light
- `NORKENDOL-light-mode-comparison.html` — Throwback (NEXUS) Dark/Med/Light
- `NORKENDOL-onboarder-kpi-uiux.html` — full Onboarder KPI in Throwback Dark

## Visual identity — two style families

The portal ships **two style families**, each with three brightness modes. Same layout, same components, only tokens swap.

| | Modern (default) | Throwback (opt-in) |
|---|---|---|
| Reference | `uupm.cc/demo/fintech-crypto` (CryptoVault) | NEXUS DeFi reference (`winner.png`) |
| Identity | Clean modern fintech — Coinbase / Stripe / Robinhood | Cyberpunk neon — Tron / 80s / DeFi yield farming |
| Vibe | Trustworthy, carrier-credible, "modern claims platform" | Personality, energy, power-user |
| Primary accent | Green `#22C55E` | Cyan `#5DECF7` |
| Headline gradient | Cyan → teal (one accent word per page) | Cyan → violet → magenta (CTA + page title accent) |
| Fonts | Plus Jakarta Sans + JetBrains Mono | Orbitron + Audiowide + JetBrains Mono |
| Glow effects | None — drop shadows only | Heavy multi-layer text-shadow on accent words |
| Cards | Solid, thin neutral border, 16-18px radius | Solid, thin cyan border, 10-12px radius, optional top accent stripe |
| CTA button | Solid green pill, white text, rounded-full | Cyan→violet→magenta gradient pill, **black text** (`#050510`) |

**Default for new users/orgs: Modern Med.** Throwback is an opt-in toggle in Settings → Appearance. User-facing labels are "Modern" and "Throwback" — `NEXUS` and `CryptoVault` are internal codenames only.

## Theme architecture — HYBRID (not pure-layered)

Three CSS layers compose. Pure-layered would push 80% of the work into a giant `:root` override stack. Hybrid keeps each layer honest:

### Layer 1 — Universal (`:root`)
Non-color tokens that never vary by style or mode:
- Spacing: `--space-1` … `--space-8`
- Radii: `--radius-pill` (999px), `--radius-card` (16px), `--radius-input` (8px)
- Transitions: `--transition-fast` (160ms), `--transition-base` (200ms), `--transition-slow` (300ms)
- Z-index scale: 10 / 20 / 30 / 50 / 100
- Font weights, line heights

### Layer 2 — Style only (`[data-style="modern"]` / `[data-style="throwback"]`)
Tokens that depend on style identity but **not** on brightness:
- `--font-display`, `--font-ui`, `--font-body`, `--font-mono`
- (Most "personality" tokens turn out to also depend on mode and live in Layer 3.)

### Layer 3 — Combo cells (`[data-style="X"][data-mode="Y"]`)
All color tokens, all glow tokens, all shadows. **Six explicit blocks.** Each pre-bakes derived tokens (text-shadow strings, gradient definitions, full box-shadows) so components consume one variable instead of doing math at the call site:

```css
[data-style="throwback"][data-mode="dark"] {
  --bg: #000000;
  --pad: #07080D;
  --accent: #5DECF7;
  /* …base tokens… */

  /* Pre-baked derived tokens — components use these directly */
  --accent-text-shadow:
    0 0 4px rgba(165,243,252,0.95),
    0 0 18px rgba(93,236,247,0.85),
    0 0 40px rgba(93,236,247,0.55),
    0 0 80px rgba(93,236,247,0.30);
  --card-border-glow: inset 0 0 16px rgba(93,236,247,0.18);
  --card-shadow: 0 0 30px rgba(93,236,247,0.06);
  --cta-shadow: 0 0 22px rgba(167,139,250,0.32), 0 0 50px rgba(232,121,249,0.18);
}
```

A component renders an accent word with `text-shadow: var(--accent-text-shadow)` — agnostic to which combo is active, and Modern's Light cell sets that token to `none`.

## Token taxonomy (~30 tokens)

**Surface:** `--bg`, `--pad`, `--pad-elev`, `--pad-input`
**Text:** `--text`, `--text-dim`, `--text-faint`
**Accent (style-defining):** `--accent`, `--accent-hover`, `--accent-soft`
**Border:** `--border`, `--border-active`
**Semantic:** `--green`, `--red`, `--amber`, `--violet`, `--magenta`, `--orange`, `--info`
**CTA:** `--cta-bg`, `--cta-text`, `--cta-hover-bg`
**Derived (pre-baked):** `--accent-text-shadow`, `--card-border-glow`, `--card-shadow`, `--cta-shadow`, `--gradient-cta`
**Style-only:** `--font-display`, `--font-ui`, `--font-body`, `--font-mono`

## 6-cell matrix

### Modern (default)

| Token | Modern Dark | Modern Med (recommended) | Modern Light |
|---|---|---|---|
| `--bg` | `#0A0E1F` midnight navy | `#1A2235` slate-800 | `#FFFFFF` |
| `--pad` | `#11182E` | `#232C42` | `#FFFFFF` (with shadow) |
| `--pad-input` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.05)` | `#F8FAFC` |
| `--text` | `#FFFFFF` | `#F1F5F9` | `#0F172A` |
| `--text-dim` | `#94A3B8` | `#94A3B8` | `#475569` |
| `--accent` (green) | `#22C55E` | `#22C55E` | `#16A34A` |
| `--border` | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.09)` | `#E2E8F0` |
| `--red` | `#EF4444` | `#EF4444` | `#DC2626` |
| `--amber` | `#F59E0B` | `#F59E0B` | `#D97706` |
| `--violet` | `#8B5CF6` | `#8B5CF6` | `#7C3AED` |
| `--info` (cyan) | `#22D3EE` | `#22D3EE` | `#0891B2` |
| `--cta-bg` | `#22C55E` | `#22C55E` | `#16A34A` |
| `--cta-text` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| `--cta-shadow` (derived) | `0 8px 24px rgba(34,197,94,0.30)` | `0 8px 22px rgba(34,197,94,0.28)` | `0 6px 16px rgba(22,163,74,0.25)` |
| `--card-shadow` (derived) | `0 1px 3px rgba(0,0,0,0.30)` | `0 1px 3px rgba(0,0,0,0.25)` | `0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)` |
| `--accent-text-shadow` | `none` | `none` | `none` |
| `--gradient-cta` | `none` (solid green CTA) | `none` | `none` |

### Throwback (opt-in)

| Token | Throwback Dark | Throwback Med | Throwback Light |
|---|---|---|---|
| `--bg` | `#000000` pure black | `#0E1420` slate-black | `#FFFFFF` |
| `--pad` | `#07080D` | `#131A28` | `#FFFFFF` (with shadow) |
| `--pad-input` | `#050609` | `#0B1220` | `#F8FAFC` |
| `--text` | `#D8E9EE` | `#D8E9EE` | `#0F172A` |
| `--text-dim` | `#7A8A92` | `#8294A0` | `#475569` |
| `--accent` (cyan→teal) | `#5DECF7` | `#5DECF7` | `#0891B2` |
| `--border` | `rgba(93,236,247,0.25)` | `rgba(93,236,247,0.22)` | `#E2E8F0` |
| `--border-active` | `rgba(93,236,247,0.85)` | `rgba(93,236,247,0.65)` | `#0891B2` |
| `--red` | `#F87171` + glow | `#F87171` + soft glow | `#DC2626` flat |
| `--amber` | `#FBBF24` + glow | `#FBBF24` + soft glow | `#D97706` flat |
| `--violet` | `#A78BFA` | `#A78BFA` | `#7C3AED` |
| `--magenta` | `#E879F9` | `#E879F9` | `#C026D3` |
| `--cta-bg` (gradient) | `linear-gradient(90deg, #5DECF7, #67E8F9, #A78BFA, #E879F9, #F0ABFC)` | same | same |
| `--cta-text` | `#050510` (black — non-negotiable) | `#050510` | `#050510` |
| `--cta-shadow` (derived) | `0 0 22px rgba(167,139,250,0.32), 0 0 50px rgba(232,121,249,0.18)` | `0 0 16px rgba(167,139,250,0.22), 0 0 32px rgba(232,121,249,0.10)` | `0 4px 14px rgba(167,139,250,0.22), 0 1px 3px rgba(15,23,42,0.08)` |
| `--accent-text-shadow` (derived) | `0 0 4px rgba(165,243,252,0.95), 0 0 18px rgba(93,236,247,0.85), 0 0 40px rgba(93,236,247,0.55), 0 0 80px rgba(93,236,247,0.30)` | `0 0 3px rgba(165,243,252,0.55), 0 0 12px rgba(93,236,247,0.45), 0 0 28px rgba(93,236,247,0.20)` | `none` |
| `--card-shadow` (derived) | `0 0 30px rgba(93,236,247,0.06)` | `0 0 22px rgba(93,236,247,0.05)` | `0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)` |

### Cross-style invariants
- **Cards must be SOLID in every cell.** Never translucent. (Frosted-glass experiment was rejected — Frank caught grid bleed-through three times.)
- **CTA gradient text is `#050510` BLACK in Throwback** — non-negotiable, never white.
- **Magenta `#E879F9`** is the announcement color in Throwback only; Modern uses violet `#8B5CF6` instead.
- **Semantic colors darken in Light mode** for AA contrast (red `#F87171→#DC2626`, green `#22C55E→#16A34A` in Modern, etc.).

## Style-only fonts

```css
[data-style="modern"] {
  --font-display: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-ui:      'Plus Jakarta Sans', system-ui, sans-serif;
  --font-body:    'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;
}
[data-style="throwback"] {
  --font-display: 'Orbitron', sans-serif;
  --font-ui:      'Audiowide', cursive;
  --font-body:    'JetBrains Mono', ui-monospace, monospace;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;
}
```

## DOM contract

Theme is applied via two attributes on `documentElement`:
```html
<html data-style="modern" data-mode="med">
```
Components never query the active theme — they read CSS variables only.

## theme.ts API

```typescript
export type ThemeStyle = "modern" | "throwback";
export type ThemeMode  = "dark" | "med" | "light";
export interface Theme { style: ThemeStyle; mode: ThemeMode; }

export function applyTheme(t: Theme): void;             // sets data-style + data-mode + persists + lazy fonts
export function resolveTheme(): Theme;                  // resolution chain → active theme
export function loadStyleFonts(s: ThemeStyle): Promise<void>;  // lazy font CSS injection
```

Phase 2B will add `setUserOverride()` and `getOrgDefault()` when DB persistence ships.

**Toggle behavior:**
- User flips style → mode persists (Dark stays Dark, etc.)
- User flips mode within style → style persists
- First-time Throwback activation → defaults mode to **Med** (best entry point)

## Resolution priority

1. URL param (dev only): `?theme=throwback_dark`
2. `localStorage["portal-theme-style"]` + `localStorage["portal-theme-mode"]` (user override)
3. `user_preferences.theme_style` + `theme_mode` (DB — Phase 2B only)
4. `organizations.default_theme_style` + `default_theme_mode` (DB — Phase 2B only)
5. Hardcoded fallback: `{ style: "modern", mode: "med" }`

## Lazy font loading

On boot, only the active style's font CSS is loaded:
```html
<!-- Modern boot (default) -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
```

When the user first toggles to Throwback, `loadStyleFonts("throwback")` dynamically injects:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Audiowide&display=swap">
```

Cost on first switch: ~50KB. Cached forever after. Initial boot avoids loading fonts the user may never see.

## Multi-tenant: phased

**Phase 2A (ship with theme system):**
- localStorage user override
- Hardcoded fallback Modern/Med
- No DB writes

**Phase 2B (when first customer asks for white-label default):**
- Add `organizations.default_theme_style varchar NOT NULL DEFAULT 'modern'`
- Add `organizations.default_theme_mode varchar NOT NULL DEFAULT 'med'`
- Add `user_preferences.theme_style varchar NULL` (NULL = inherit org)
- Add `user_preferences.theme_mode varchar NULL`
- Admin UI in System Settings → Appearance for org admins to set org default
- Resolution chain reads DB layers between localStorage and hardcoded fallback

Avoids over-engineering before there's demand.

## Migration from existing single-axis system

`src/lib/theme.ts` currently defines `ThemeMode = "dark" | "light"` and writes `localStorage["portal-theme"]`. On first boot under the new system:

```typescript
const legacy = localStorage.getItem("portal-theme");
if (legacy === "dark") applyTheme({ style: "modern", mode: "dark" });
else if (legacy === "light") applyTheme({ style: "modern", mode: "light" });
else applyTheme({ style: "modern", mode: "med" });
localStorage.removeItem("portal-theme");
```

**Theme is locked to the 6 preset cells.** No per-user color customization. The previous 8-color-picker system, AI Designer screenshot analyzer, and UI Component glossary were removed — they fought the locked design and added admin overhead for a personal preference.

## Settings UI — where the picker lives

The theme picker lives in the **TopBar user menu dropdown** (`src/components/TopBar.tsx`). Click the user avatar → dropdown shows two segmented controls:

```
┌────────────────────────────┐
│ Frank Dalton               │
│ frank@coastalclaims.net    │
├────────────────────────────┤
│ ⚙  My Settings             │
├────────────────────────────┤
│ APPEARANCE                 │
│ Style: [Modern][Throwback] │
│ Mode:  [Dark][Med][Light]  │
├────────────────────────────┤
│ ⏻  Sign Out                │
└────────────────────────────┘
```

`src/components/ThemePicker.tsx` is the self-contained component. Theme changes apply live (no reload) by calling `applyTheme()` from `theme.ts`.

**System Settings → no Appearance tab.** That admin surface is gone. The only remaining tab there is "Company Logo" (white-label: logo upload + company name, persists to `localStorage["portal-logo"]` + `localStorage["portal-company-name"]`, dispatches `portal-branding-changed`). Plus "AI Configuration" for org AI provider/key setup.

## Sidebar architecture

The structural rule depends on which module you're in:

### Non-CRM pages (Dashboard, Onboarder KPI, Estimator KPI, Settlement Tracker, Claim Calculator, Compliance, Talent Partner Network, Claim Health, etc.)
- **Primary sidebar (IconSidebar):** Always visible. Collapsible to icon-only via chevron — preserve existing behavior. Default expanded width ~260px. Contains app-level nav grouped USER / ADMIN / SYSTEM (already implemented as accordion in `IconSidebar.tsx`).
- **Secondary sidebar (TextSidebar):** **KILLED on non-CRM pages.** Whatever was in it surfaces at the top of the page:
  - Stage/section navigation → top-of-page tabs (squared pills with counts and semantic colors)
  - Actions (e.g., "Add Client") → primary CTA button in the page header
  - "My Stats" / "Performance" → outline button in the page header

### CRM module (claims management — NOT YET BUILT)
- **Primary sidebar:** collapses to icons-only ~90% of the time. Adjusters need horizontal real estate.
- **Secondary sidebar:** **PERMANENT** — holds claim-context navigation (sections, documents, communications, ledger). The only module where the two-sidebar pattern stays.

## Card pattern (cross-style)

- Squared rounded corners (12-18px — Throwback tighter at 10-12, Modern more relaxed at 16-18)
- 1-1.5px solid border at idle opacity per cell
- Hover: border brightens, slight `translateY(-1px)`
- Top accent stripe: Throwback Dark/Med only (cyan glow); Modern uses subtle box-shadow elevation instead
- **Solid backgrounds in every cell** — never translucent

## Implementation philosophy

1. **Paint-job first, structural changes second.** Pure CSS variable swap before any nav/component refactor.
2. **No functional changes.** Theme work doesn't change what the app does.
3. **One screen at a time.** Frank reviews each before propagating.
4. **Reversible at every step.** No big-bang rewrites.
5. **BINGO required** before any code touches the actual repo. Throwaway HTML mocks on the desktop don't need BINGO. Real code does.

## Important context

- Norkendol Portal is owned by Frank/Norkendol. Coastal Claims Services is a customer. **Never reference CCS branding in product UI** — the portal is white-label.
- Branch: `staging` (default — never main).
- Repo: `noor-muhammad-norkendol/norkendol-employee-portal` on GitHub.
- Push convention: confirm with Frank before pushing.
