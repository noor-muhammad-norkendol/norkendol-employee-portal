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

---

# IMPLEMENTATION REFERENCE — Replicable Patterns

When building or redesigning any page, follow these patterns so it works in all 6 cells (Modern/Throwback × Dark/Med/Light) automatically. Reference pages: `src/app/login/page.tsx` and `src/app/dashboard/page.tsx`.

## Tokens added to all 6 cells (in `globals.css`)

Beyond the base tokens in DESIGN-RULES above, every combo cell now defines:

| Token | Modern Dk/Med/Light | Throwback Dark | Throwback Med | Throwback Light |
|---|---|---|---|---|
| `--card-stripe-bg` | `transparent` | `#5DECF7` | `#5DECF7` | `transparent` |
| `--card-stripe-shadow` | `none` | full cyan glow | softer cyan glow | `none` |
| `--grid-color` | `rgba(255,255,255,0.21/0.18)` Dk/Med, `rgba(15,23,42,0.05)` Lt | `rgba(93,236,247,0.33)` | `rgba(93,236,247,0.27)` | `rgba(15,23,42,0.05)` |
| `--grid-size` | `56px` (universal — `:root`) | — | — | — |

## Global utility classes (in `globals.css`)

```css
.themed-card               /* solid --pad bg, 1.5px --border, --radius-card, --card-shadow, overflow:hidden */
.themed-card.is-interactive /* hover: border → --border-active, translateY(-1px) */
.themed-card-stripe        /* absolutely-positioned 2px top stripe — uses --card-stripe-bg + --card-stripe-shadow */
.themed-accent             /* color: var(--accent); text-shadow: var(--accent-text-shadow) — for any accent word/link */
```

Throwback-only typography (Layer 2 — no component branching):
```css
[data-style="throwback"] .page-title       { text-transform: uppercase; letter-spacing: 0.04em; }
[data-style="throwback"] .nav-brand        { text-transform: uppercase; letter-spacing: 0.06em; }
[data-style="throwback"] .section-header   { text-transform: uppercase; letter-spacing: 0.15em; }
```

## Page-bg grid

Applied to `body` in `globals.css` via two `linear-gradient` background-image layers using `var(--grid-color)` at `var(--grid-size)` cell size. Visible on every page (login + dashboard + sub-pages) because:
- `body` has the grid
- `<main>` and content containers stay transparent (no `background` on them)
- Cards have solid `--pad` bg → grid only shows in gutters/padding (matches mocks)

**TopBar exception:** `<TopBar>` root sets `background: var(--bg)` solid — same color as page bg, but blocks the grid in the top 60px strip. This matches the Throwback Onboarder KPI mock where the top reads as a clean band before the grid kicks in.

## `<ThemedCard>` component pattern

Defined in `src/app/dashboard/page.tsx`. Lift to `src/components/ThemedCard.tsx` when used by a third page.

```tsx
<ThemedCard className="p-5 flex flex-col" interactive onClick={...}>
  <h2 className="page-title text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
    Recent <span className="themed-accent">Notifications</span>
  </h2>
  ...
</ThemedCard>
```

Always wrap a card in `<ThemedCard>` instead of building one inline. The component renders the stripe div automatically.

## Badge pattern (semantic, cell-aware)

Map a label to a semantic token, then `color-mix` for bg + border, full token for text. Works across all 6 cells without hardcoded hex.

```tsx
const PRIORITY_TOKEN = { low: "--green", medium: "--amber", high: "--red", urgent: "--red" };

<span style={{
  background: `color-mix(in srgb, var(${token}) 14%, transparent)`,
  color: `var(${token})`,
  border: `1px solid color-mix(in srgb, var(${token}) 30%, transparent)`,
}}>...</span>
```

Available semantic tokens per cell: `--green`, `--red`, `--amber`, `--violet`, `--magenta`, `--info`, `--accent`. Never hardcode hex for status colors.

## Heading pattern

Page titles and section headings always:
1. Use `font-family: var(--font-display)` — Plus Jakarta in Modern, Orbitron in Throwback (auto)
2. Add `className="page-title"` so Throwback gets uppercase + tracking
3. Wrap the last (or accent) word in `<span className="themed-accent">` for the cyan/green glow word

```tsx
<h1 className="page-title text-4xl font-extrabold tracking-tight"
    style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}>
  Welcome back, <span className="themed-accent">{firstName}</span>
</h1>

<h2 className="page-title text-xl font-semibold"
    style={{ fontFamily: "var(--font-display)" }}>
  Company <span className="themed-accent">Updates</span>
</h2>
```

## Sidebar (IconSidebar) pattern

- Width: **260px** expanded, **60px** collapsed
- Brand wordmark: display font, first letter `var(--accent)` + `text-shadow: var(--accent-text-shadow)`. Font-size auto-scales: ≤10 chars = 17px, longer = 14px (handles "Coastal Claims" without overflow).
- Section dividers: NO chevron icon. The label text itself is the click target. Color = `var(--accent)` with glow, uppercase + tracked (Throwback only). A 1px `var(--border)` rule line extends from label to right edge.
- Nav items: `h-10`, `text-[15px] font-medium`, 18px icons.
- Active item: full pill with `border: 1px solid var(--border-active)`, `background: color-mix(in srgb, var(--accent) 10%, transparent)`, `color: var(--accent)`, `text-shadow: var(--accent-text-shadow)`, `box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 18%, transparent)`. NO left bar — full pill outline.
- Inactive hover: bg → `var(--pad-elev)`, color → `var(--text)`.

## TopBar pattern

- Height: **60px**, `background: var(--bg)` solid (blocks grid).
- **Left:** breadcrumb `Company / Page` — company name `var(--text-dim)`, slash `var(--text-faint)`, current page `var(--accent)` + `text-shadow: var(--accent-text-shadow)`. Page label derived from `usePathname()`.
- **Right cluster (in order):**
  1. **Digital clock pill** — `HH:MM:SS` 24-hour, `var(--font-mono)`, accent text + glow, `var(--border-active)` border, `--radius-input`, ticks every second.
  2. **Search button** — 36×36, outline `var(--border)`, hover → `var(--border-active)` + accent color.
  3. **Bell button** — same outline treatment, 8px red dot indicator with red glow for unread.
  4. **Avatar + first name** — accent-tinted circle (initials in accent + glow, or photo with accent border), name in `var(--text)`. Click opens dropdown (My Settings / ThemePicker / Sign Out).

## Token migration cheatsheet (legacy → spec)

When updating an existing page:

| Legacy | Spec |
|---|---|
| `--bg-primary` | `--bg` |
| `--bg-secondary` | `--pad` |
| `--bg-surface` | `--pad` |
| `--bg-hover` | `--pad-elev` |
| `--text-primary` | `--text` |
| `--text-secondary` | `--text-dim` |
| `--text-muted` | `--text-faint` |
| `--border-color` | `--border` |

Legacy tokens are still aliased in every cell, so the old code still renders. New work uses spec tokens.

## Anti-patterns (what NOT to do)

- **No emoji icons** — use SVG. (E.g., medals: SVG trophy, not 🥇🥈🥉.)
- **No translucent cards** — solid `--pad` bg always.
- **No hardcoded hex for status colors** — use `color-mix` with semantic tokens.
- **No `bg-white/10` or similar opacity hacks** — invisible in Light mode.
- **Don't mix `border:` shorthand with `borderColor:` longhand** in the same element — React warns. Use `borderWidth/borderStyle/borderColor` separately.
- **Don't query active theme in components** (`if style === "throwback"`). All branching belongs in CSS via `[data-style]` selectors.
- **Don't set explicit `background: var(--bg)` on page roots** — let body show through, otherwise the grid disappears.

## Pages already migrated

- `src/app/login/page.tsx` — auth/landing pattern
- `src/app/dashboard/page.tsx` — cards, badges, headings, panels (Welcome dashboard)
- `src/app/dashboard/onboarder-kpi/page.tsx` + `components/PipelineHeader.tsx` + `components/UrgencyBanner.tsx` + `components/WorkboardTable.tsx` — KPI-with-pipeline pattern (REFERENCE for any future pipeline/stage page)
- `src/app/dashboard/estimator-kpi/page.tsx` — KPI-with-status-tiles pattern (REFERENCE for any future status-tiles page)
- `src/app/dashboard/university/page.tsx` — course-grid pattern with category filter (REFERENCE for any future "library/catalog" page)
- `src/components/IconSidebar.tsx` — sidebar pattern
- `src/components/TopBar.tsx` — chrome pattern

## Pages still to migrate

Every other `src/app/dashboard/*` page is on legacy tokens. Use Onboarder KPI as the template for KPI-style pages, University for catalog/list pages, Welcome dashboard for mixed-card layouts.

---

# COMPONENT CATALOG — STRICT SPECS

These are not suggestions. They're enforced patterns to keep the look consistent across all 6 cells. **Before merging a new page, run through the Pre-Merge Checklist at the bottom of this document.**

## Page header (any non-list page)

```tsx
<h1
  className="page-title text-5xl leading-none tracking-tight"
  style={{ fontFamily: "var(--font-display)" }}
>
  <span style={{ color: "var(--accent)", textShadow: "var(--accent-text-shadow)", fontWeight: 800 }}>
    PrimaryWord
  </span>{" "}
  <span style={{ color: "var(--text)", fontWeight: 500, opacity: 0.92 }}>
    SecondaryWord
  </span>
</h1>
```

- **Always `text-5xl`** for page titles — not `text-2xl`, not `text-3xl`. Pages must feel big.
- **Always `--font-display`** (Orbitron in Throwback / Plus Jakarta in Modern). Never `--font-ui`.
- **Always `.page-title` class** so Layer 2 CSS gives Throwback uppercase + tracking. Never hardcode uppercase in JSX.
- Two-word split: first word heavy + accent + glow, second word plain text 92% opacity. If the title is one word, the whole word gets the accent treatment.

Followed immediately by a **stats line**:
```tsx
<p className="mt-3 text-sm flex items-center gap-3" style={{ color: "var(--text-dim)" }}>
  <span><strong style={{ color: "var(--text)" }}>{n}</strong> items</span>
  <span style={{ color: "var(--text-faint)" }}>·</span>
  <span><strong style={{ color: "var(--green)" }}>{percent}%</strong> completion</span>
  ...
</p>
```
- Numbers each get their semantic color (`--green` for completion, `--red` for overdue, `--info` for in-progress, `--text` for raw counts).
- Dot separators in `--text-faint`.

## Top-right action buttons (next to the page title)

Always a pair — outline (secondary) + gradient (primary CTA).

```tsx
{/* Outline (My Performance / History / etc.) */}
<button
  className="px-7 py-3.5 text-[15px] font-bold uppercase cursor-pointer transition-all"
  style={{
    background: active ? "color-mix(in srgb, var(--accent) 14%, var(--bg))" : "var(--bg)",
    color: "var(--accent)",
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "var(--accent)",
    borderRadius: "8px",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.10em",
    textShadow: "var(--accent-text-shadow)",
    boxShadow: "0 0 16px color-mix(in srgb, var(--accent) 30%, transparent)",
  }}
>
  Label
</button>

{/* Gradient CTA (+ Add Client / + Add Entry) */}
<button
  className="px-7 py-3.5 text-[15px] font-extrabold uppercase cursor-pointer transition-all"
  style={{
    background: "var(--cta-bg)",
    color: "var(--cta-text)",
    borderRadius: "8px",
    boxShadow: "0 0 22px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 50px color-mix(in srgb, var(--magenta) 28%, transparent), 0 4px 14px rgba(0,0,0,0.30)",
    border: "none",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.08em",
  }}
>
  + Add Thing
</button>
```

**Strict rules:**
- Border radius **8px**, NEVER `var(--radius-pill)` (full pill is reserved for inline link-style chips).
- Font **`var(--font-display)`**, never `var(--font-ui)`.
- Padding `px-7 py-3.5` minimum. Don't shrink them.
- Outline button background is `var(--bg)` SOLID (or `color-mix` over `var(--bg)` when active). NEVER `transparent` — would let the page-bg grid show through and look broken.
- Gradient CTA needs the **multi-color halo** (cyan + magenta + grounding shadow). Single-color halo is rejected.
- Hover bumps the halo intensity AND brightness — do both.

## Stat tiles (the bar of clickable status counters)

```tsx
<button
  className="relative overflow-hidden p-4 text-left flex flex-col gap-2 cursor-pointer transition-all"
  style={{
    background: active ? `color-mix(in srgb, ${tokenVar} 14%, var(--pad))` : "var(--pad)",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: active ? tokenVar : "var(--border)",
    borderRadius: "var(--radius-card)",
    boxShadow: active
      ? `0 0 0 1px ${tokenVar} inset, 0 0 24px color-mix(in srgb, ${tokenVar} 55%, transparent), 0 0 48px color-mix(in srgb, ${tokenVar} 22%, transparent)`
      : "var(--card-shadow)",
  }}
  onMouseEnter/* lift -1px, light border to tokenVar, softer halo */
>
  <span className="absolute left-0 right-0 top-0 h-[2px]" style={{ background: active ? tokenVar : "var(--card-stripe-bg)", boxShadow: active ? `0 0 14px ${tokenVar}` : "var(--card-stripe-shadow)" }} />
  <div className="flex items-start justify-between">
    <span className="text-3xl font-extrabold" style={{ color: tokenVar, opacity: count > 0 ? 1 : 0.55, textShadow: count > 0 && active ? `0 0 18px color-mix(in srgb, ${tokenVar} 70%, transparent)` : undefined, fontFamily: "var(--font-display)" }}>{count}</span>
    <span style={{ color: tokenVar, opacity: count > 0 ? 1 : 0.55, filter: active ? `drop-shadow(0 0 6px ${tokenVar})` : undefined }}>{icon}</span>
  </div>
  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: tokenVar, opacity: active ? 1 : 0.78, fontFamily: "var(--font-ui)" }}>{label}</span>
</button>
```

**Strict rules:**
- Each tile maps to ONE semantic token (`--info`, `--amber`, `--orange`, `--red`, `--green`, `--violet`, `--text-faint` for "on hold"/neutral). Pick from this set.
- **Number, icon, label all use the tile's semantic token color** — not `--text-dim`, not `--text-faint`. When count is 0, drop opacity to 0.55. When inactive, drop label opacity to 0.78. The eye should see "this is the AMBER tile, this is the RED tile" at a glance.
- **Active state must have all three glow layers**: `inset 0 0 0 1px`, `0 0 24px medium`, `0 0 48px wide`. Single-shadow active state is rejected.
- Stripe always 2px tall, glows when active, transparent when inactive (uses `--card-stripe-bg` token).

## Filter pill row (category / time / type filters)

```tsx
<button
  className="text-[12px] font-bold uppercase cursor-pointer transition-all"
  style={{
    padding: "10px 18px",
    borderRadius: 8,
    letterSpacing: "0.10em",
    fontFamily: "var(--font-display)",
    background: active ? `color-mix(in srgb, ${tokenVar} 14%, var(--pad))` : "var(--pad)",
    color: active ? tokenVar : "var(--text-dim)",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: active ? tokenVar : "var(--border)",
    textShadow: active ? `0 0 8px color-mix(in srgb, ${tokenVar} 70%, transparent)` : undefined,
    boxShadow: active
      ? `0 0 0 1px ${tokenVar} inset, 0 0 18px color-mix(in srgb, ${tokenVar} 50%, transparent), 0 0 36px color-mix(in srgb, ${tokenVar} 22%, transparent)`
      : "none",
  }}
>
  {label}
</button>
```

**Strict rules:**
- **Border radius 8px**, NEVER 999px (no full-oval pills for filter rows). Full pill chips are reserved for **status badges inside table rows** ONLY.
- **Each pill option gets its own semantic token color**, not all the same accent. Adjusters can scan a multi-color pill row faster than a uniform cyan one. Map categories to: cyan/info, violet, amber, magenta, orange, green, text-faint.
- "All" or default option keeps `--accent`.
- Display font (Orbitron in Throwback). Letter-spacing `0.10em`. Padding `10px 18px` minimum.
- Hover state must show the eventual active color so the user sees "this would light up purple/green/etc."

## Status badges (inside table rows / data displays)

```tsx
<span style={{
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  fontFamily: "var(--font-ui)",
  background: `color-mix(in srgb, var(${token}) 12%, transparent)`,
  color: `var(${token})`,
  border: `1px solid color-mix(in srgb, var(${token}) 40%, transparent)`,
  textTransform: "uppercase",
}}>
  {label}
</span>
```

- 6px corners, 12%/40% color-mix for bg/border, full token for text. Always uppercase. Never raw text like `not_sent` — replace underscores and uppercase.

## Themed card (any container holding content)

```tsx
<div className="themed-card p-5">
  <div className="themed-card-stripe" aria-hidden />
  ...
</div>
```

Or for clickable cards:
```tsx
<div className="themed-card is-interactive p-5 cursor-pointer">
  <div className="themed-card-stripe" aria-hidden />
  ...
</div>
```

- Always render `<div className="themed-card-stripe" aria-hidden />` as the first child. The stripe self-hides in cells where it shouldn't show; never conditionally render it.
- Never replace with `style={{ background: "var(--pad)", border: "..." }}` inline — use the class.
- Solid bg only. NEVER translucent. NEVER `bg-white/10` or `color-mix(..., transparent)` for card backgrounds.

## Banner / alert (overdue, error, success)

- **Solid bg**: `var(--pad)` base + `linear-gradient(180deg, color-mix(in srgb, var(--<color>) 14%, var(--pad)) 0%, var(--pad) 100%)` overlay. Never `color-mix(..., transparent)` alone — Frank caught this and called it out as "transparent".
- 1.5px solid color border in the semantic token (full token, no `color-mix`).
- Multi-layer halo box-shadow.
- Top stripe glow in the same color.
- **Color hierarchy in the headline**: count number in semantic color + glow, neutral nouns in `--text-dim`, action verb in a DIFFERENT semantic color (e.g., overdue=red, "Action Required"=amber). Don't paint everything the same color.

## Workboard table (any list-of-things table)

- Wrapped in `<div className="themed-card p-5">` with stripe.
- Section header with `.page-title` + `.themed-accent` + count in mono + flex-1 rule line + (search input | filter button | download button) on the right.
- `<thead>` row has `borderBottom: 1px solid var(--border)`. Each `<tr>` in `<tbody>` also gets `borderBottom: 1px solid var(--border)`.
- Header cells: 11px, font-weight 600, letter-spacing 0.12em, uppercase, `var(--text-faint)`, font-ui.
- Data cells: 13px, padding `14px 12px`, vertical-align middle, `var(--text)`.
- Last column ("Actions") is right-aligned.

## Row pattern (Client column shape)

```tsx
<td>
  <div className="flex items-center gap-3">
    <span className="shrink-0 inline-flex items-center justify-center text-[12px] font-bold"
      style={{
        width: 38, height: 38, borderRadius: 7,
        background: "color-mix(in srgb, var(--accent) 14%, var(--pad))",
        border: "1px solid var(--border-active)",
        color: "var(--accent)",
        textShadow: "var(--accent-text-shadow)",
        fontFamily: "var(--font-display)",
      }}
    >
      {initials}
    </span>
    <span className="text-[14px]" style={{ fontWeight: 600, color: "var(--text)" }}>
      {name}
    </span>
  </div>
</td>
```

- **Always** an AG-style chip (38×38, 7px corner, accent-tinted) on the left of the client name. Never a plain bold name.
- Phone number does NOT belong in the Client cell. Move it to the next column with the referral source dim below.

## Action icons (per-row icon column)

- 30×30 outline buttons, 6px corner radius.
- 1px border in `color-mix(in srgb, var(--<token>) 40%, transparent)`.
- Color = full semantic token.
- **Color mapping (locked):** text/chat = `--info`, email = `--amber`, phone/call = `--violet`, complete/check = `--green`, notes/document = `--orange`, kebab/more = `--text-dim`.
- Never use plain gray for action icons. Each action gets its meaning from its color.

## Sidebar

- 300px expanded, 60px collapsed.
- Brand wordmark: `var(--font-display)`, fontSize 22px (≤10 chars) / 18px (longer). First letter accent + glow.
- Section labels (USER/ADMIN/SUPER ADMIN/etc.) are **the click target**, NO chevron icon. Color `var(--accent)` with `var(--accent-text-shadow)`. Followed by a 1px `var(--border)` rule line filling to the right edge.
- Active nav item: full pill outline in `var(--border-active)`, `--accent` text + glow, 10% accent bg tint, halo box-shadow. NO left bar.
- Chevron toggle: 34×30 inside the top-right of the sidebar at top:26px. 6px corners. Subtle border, no glow halo.

## TopBar

- 80px tall.
- `background: var(--bg)` SOLID (never transparent — would let the page-bg grid show through and look wrong).
- 1px gradient bottom line: `linear-gradient(90deg, var(--accent) 0%, var(--violet) 50%, var(--magenta) 100%)` with halo box-shadow. The same line continues across the sidebar via `SidebarLogo`'s bottom border.
- Left: breadcrumb `Company / Page` (company dim, slash faint, current page accent + glow).
- Right cluster (in order, never reordered): digital clock pill (`HH:MM:SS` 24-hour mono, accent border + glow) → search button → notification bell → avatar + first name.

## Avatar (TopBar / row-level)

- Always render initials chip as the base layer.
- If a photo exists, overlay it as `position: absolute inset-0` with `object-cover`, `var(--border-active)` border. Add `className="avatar-photo"`.
- CSS `[data-style="throwback"] .avatar-photo { display: none; }` automatically hides the photo in Throwback so the initials chip shows. Don't write JS to detect the theme.

---

# FORBIDDEN PATTERNS

These are explicit "don't do this" rules from things Frank had to correct multiple times:

1. **Don't make page titles `text-2xl` or `text-3xl`.** They must be `text-5xl`. The whole portal feels small if titles aren't big.
2. **Don't use `var(--font-ui)` (Audiowide) for buttons.** It's reserved for tiny accent text, never CTAs or filter pills. Use `var(--font-display)`.
3. **Don't use `var(--radius-pill)` (full oval) for buttons or filter chips.** Full pill is for status badges only, and even those are 6px square in some contexts. Default to 8px square corners.
4. **Don't make buttons translucent.** `background: transparent` lets the page-bg grid show through and looks broken. Use `var(--bg)` solid (or a `color-mix` over it when active).
5. **Don't make banners translucent either.** `color-mix(..., transparent)` for the bg color is rejected. Use `var(--pad)` base + linear-gradient overlay.
6. **Don't paint everything one color in a headline / status row.** Use color hierarchy: counts in semantic color, neutrals in dim, action verbs in a DIFFERENT semantic color.
7. **Don't use a single-shadow active state for stat tiles.** Active needs all three layers: inset 0 0 0 1px, 0 0 24px medium, 0 0 48px wide.
8. **Don't add page-bg atmospheric glow gradients (`--bg-glow`).** It was tried and rejected as "everything glowing." Glow comes from active components only.
9. **Don't ship plain bold client names without the AG chip.** Every list/table row that represents a person/entity gets a 38×38 initials chip on the left.
10. **Don't ship phone numbers in the Client cell.** They live in the Referral cell with the source dim below.
11. **Don't make filter pills round ovals.** 8px square corners. Each pill gets its OWN semantic color.
12. **Don't use emoji icons (🥇🚀⚙️).** SVG only, ALWAYS.
13. **Don't render the secondary TextSidebar on non-CRM pages.** Add the path to `HIDE_TEXT_SIDEBAR_ON` in `PortalShell.tsx` for any new non-CRM page.
14. **Don't query the active theme in JS.** Use CSS `[data-style="throwback"]` selectors. The avatar-photo hide is the canonical example.
15. **Don't mix `border:` shorthand with `borderColor:` longhand on the same element.** React warns. Use longhand for both.
16. **Don't hardcode hex colors.** Even for one-offs. Use semantic tokens (`--info`, `--green`, `--amber`, `--red`, `--violet`, `--magenta`, `--orange`, `--accent`, `--text-faint`).
17. **Don't use `bg-white/10`, `bg-black/20`, etc.** Invisible in Light cells. Use `var(--pad-elev)` for hover/elevation.
18. **Don't shrink the brand wordmark to fit.** It auto-scales 22px / 18px based on length. Anything below 18px reads as a label, not a brand mark.
19. **Don't kill the gradient TopBar bottom line.** Even if you redesign the TopBar, the cyan→violet→magenta line stays. It's the visual seam between chrome and content.
20. **Don't render hovers without the matching active glow color.** A neutral gray hover on a tile that activates to red feels broken. Hover previews the eventual active color.

---

# PRE-MERGE CHECKLIST

Before declaring a page done, walk through:

**Layout & chrome**
- [ ] TextSidebar killed for this path (added to `HIDE_TEXT_SIDEBAR_ON`)?
- [ ] Page renders correctly in all 6 cells (Modern Dark/Med/Light + Throwback Dark/Med/Light)?
- [ ] Toggle Style/Mode in TopBar — every element re-skins live, no hardcoded color anywhere?

**Headers**
- [ ] Page title is `text-5xl`, `--font-display`, `.page-title` class, two-word split with first word accent + glow?
- [ ] Stats line below title with each metric in its semantic color?
- [ ] Section headers use `.page-title` + `.themed-accent` last word + 1px rule line extending right?

**Buttons**
- [ ] Primary CTA + outline secondary at top-right?
- [ ] 8px corners, NOT pill?
- [ ] `--font-display`?
- [ ] Multi-color halo on the gradient CTA?
- [ ] Outline button bg is `var(--bg)` solid, not `transparent`?

**Stat tiles** (if applicable)
- [ ] Each tile maps to a unique semantic token?
- [ ] Number, icon, label ALL use the tile's color?
- [ ] Active state has all 3 halo layers?
- [ ] Hover previews the active color?
- [ ] Empty (count=0) tiles drop opacity to 0.55, not switch to gray?

**Cards & banners**
- [ ] Every card uses `themed-card` + `themed-card-stripe`?
- [ ] No translucent backgrounds anywhere?
- [ ] Banners use `var(--pad)` base + linear-gradient overlay?
- [ ] Color hierarchy in banner headlines?

**Tables** (if applicable)
- [ ] Wrapped in `themed-card`?
- [ ] Section header with rule line + search/filter/download cluster?
- [ ] `border-bottom: 1px solid var(--border)` on thead and every tr?
- [ ] AG-style chip in client cell?
- [ ] Phone in referral cell, not client cell?
- [ ] Status pills with semantic tokens (color-mix bg + border, full token text, uppercase)?
- [ ] Action icons with locked color mapping (text=info, email=amber, phone=violet, complete=green, notes=orange, kebab=text-dim)?

**Forbidden patterns**
- [ ] No emoji icons?
- [ ] No `var(--font-ui)` on buttons or pills?
- [ ] No `var(--radius-pill)` on buttons or filter chips?
- [ ] No hardcoded hex?
- [ ] No `bg-white/X` opacity hacks?
- [ ] No `--bg-glow` atmospheric lighting?
- [ ] No JS theme detection?

If anything fails the checklist, fix it BEFORE saying the page is done. This is what stops the back-and-forth.
