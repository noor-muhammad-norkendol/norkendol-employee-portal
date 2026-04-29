# Portal Punch List — Known Gaps & Follow-up Items

**Created:** 2026-04-28
**Purpose:** Single source of truth for known UX/UI/data gaps, follow-up work, and "we'll fix this later" items found during sessions. Add to it when something is flagged but deferred. Cross off (or move to a Done section) when fixed.

This is NOT a roadmap. It's a punch list — small, specific, fixable items.

---

## UI / UX

### 1. Peril + Peril Other = should be ONE combobox, not two fields
**Where:** Every form with peril input — Calculator, Estimator, Onboarder, Settlement Tracker (all 4 tracks), Claim Health, TLS detail panel.

**Current:** Two side-by-side controls — a `<select>` for peril (with "Other" as one option) PLUS a separate `<input type="text">` for the "Peril Other" free-text. The second field is grayed out unless peril = 'Other'.

**Frank's call (2026-04-28):** "That whole second box is completely pointless." Right.

**Better:** Single combobox using HTML5 `<input list="...">` + `<datalist>`. User picks from the canonical perils OR types a custom value. On save, the form code splits to populate both DB columns:
- If entered text matches a canonical peril → `peril='Hurricane'` (etc.), `peril_other=null`
- Otherwise → `peril='Other'`, `peril_other='whatever they typed'`

Canonical 9-column standard stays intact at the DB level. UI gets one clean field instead of two.

**Effort:** ~10 min per form. Apply consistently across all spoke forms in one focused pass.

---

### 2. Onboarder form missing `severity` input
**Where:** `src/app/dashboard/onboarder-kpi/components/AddClientForm.tsx`

**Current:** DB column exists (added in 2026-04-28 canonical sweep). Form has no UI input. Saved rows always have `severity = NULL`.

**Fix:** Add a 1-5 number input (or 1-5 dropdown) in the Loss Info section. Match whatever pattern Estimator uses.

---

### 3. Settlement Tracker uses a DROPDOWN for file/claim number, not a typeable search
**Where:** Settlement Tracker forms (Litigation / Mediation / Appraisal / PA Settlements)

**Frank's call (2026-04-28):** "The file number or claim ID — you can't search that, it's a drop down button. We need to fix this side of things before we can do these tests." Original flag, deferred to focus on TLS spoke build.

**Fix:** Replace dropdown with text input + `useClaimLookup` cross-spoke search banner (same pattern Onboarder, Calculator, and TLS use).

---

### 4. Stale canonical fields on TLS rows
**Where:** `team_lead_reviews` rows (and any spoke that auto-creates a row from upstream)

**Current:** TLS auto-create is "create-once" — once a row exists for `(org, file, phase)`, it's never updated by upstream changes. Protects TL's review work but means canonical fields (client_name, peril, etc.) go stale if onboarding gets corrected after TLS row exists.

**Example seen 2026-04-28:** Onboarder row's client_name changed from "h h" → "Maria Rodriguez", but TLS row stayed showing "h h".

**Options to consider:**
- A **"Refresh from Source"** button on the TLS detail panel that pulls latest canonical fields from the upstream spoke (preserves reviewer_id, decision_at, status, notes).
- A smarter upsert that updates ONLY canonical columns (peril, client_name, etc.) but leaves review state untouched.

Either is fine. Decide when it actually bites someone.

---

## Cross-spoke audit (still owed)

### 5. Walk every spoke page and verify the canonical surfaces match
**Where:** All 9 spoke pages

**What to check on each page:**
- Form has UI inputs for all 9 canonical columns (file_number, claim_number, policy_number, client_name, loss_address, peril, peril_other, severity, status)
- `useClaimLookup` is wired with the latest `LookupField` type (5 search fields including `policy_number`)
- `handleClaimAccept`-style functions propagate ALL 9 canonical fields, not just the older 4-5
- Labels say "File Number" not "Claim File", "Claim Number" not "Claim ID", etc. (Frank's canonical vocabulary lock 2026-04-28)

**Pages to audit:**
- [ ] Onboarder KPI (`/dashboard/onboarder-kpi`)
- [ ] Estimator KPI (`/dashboard/estimator-kpi`)
- [ ] Settlement Tracker — Litigation
- [ ] Settlement Tracker — Mediation
- [ ] Settlement Tracker — Appraisal
- [ ] Settlement Tracker — PA Settlements
- [ ] Claim Health (`/dashboard/claim-health`)
- [ ] Claim Calculator (`/dashboard/claim-calculator`) — partially audited 2026-04-28
- [ ] Team Lead Support (`/dashboard/team-lead-support`) — built 2026-04-28

This is the audit Frank wanted to do before the smoke test that got paused for the TLS spoke build.

---

## Workflow chain — missing builds

### 6. Build Scope of Loss spoke
**Where:** New work — `scope_of_loss` Supabase table + RLS + landing page

**What's in:** Placeholder page exists at `/dashboard/scope-of-loss`. Sidebar nav entry exists. **Backing spoke does NOT exist** (no DB table, no auto-create wiring).

**Next session scope:**
- DB table with all 9 canonical columns from day 1 per the locked Standard
- Replace placeholder page with functional landing
- Auto-create wiring: TLS Phase 1 `status='approved'` → INSERTs a Scope of Loss row

---

### 7. Build Adjuster KPI spoke
**Where:** New work — `adjuster_reviews` (or similar) Supabase table + RLS + landing page

**What's in:** Placeholder page exists at `/dashboard/adjuster-kpi`. Sidebar nav entry exists. Backing spoke does NOT exist.

**Next session scope:**
- DB table with all 9 canonical columns from day 1
- Replace placeholder page
- Auto-create wiring: TLS Phase 2 `status='approved'` → INSERTs an Adjuster row

Frank also flagged that more trackables come AFTER Adjuster KPI. Those are even later builds.

---

### 8. Wire TLS Phase 1 approval → Scope of Loss row creation
**Where:** `src/app/dashboard/team-lead-support/page.tsx` — the `approveRow()` function

**Currently:** `approveRow()` flips status to 'approved' and stops. No downstream insert.

**After Scope of Loss spoke exists:** Add an `ensureScopeOfLossRow(supabase, tlsRow)` call inside `approveRow()` for `phase_1` rows. Mirror pattern of Onboarder → TLS auto-create (create-once, idempotent, error-logged).

---

### 9. Wire TLS Phase 2 approval → Adjuster KPI row creation
**Where:** Same `approveRow()` function in TLS page.

**After Adjuster spoke exists:** Add `ensureAdjusterRow(supabase, tlsRow)` for `phase_2` approvals. Same pattern.

---

## Access control — deferred policies

### 10. "Direct manager sees their reports' TLS reviews"
**Where:** Supabase RLS — `team_lead_reviews` SELECT policies

**Currently:** Only super_admin sees all rows. Reviewers see their own. No "manager" pattern.

**Blocked on:** Either a `users.manager_id uuid REFERENCES users(id)` column, OR the existing `org_hierarchy` migration getting run in production (per HANDOFF.md it's not yet run — Noor task).

**Once the column exists:** Add a 5th SELECT policy:
```sql
CREATE POLICY "Manager sees direct reports' tls reviews"
  ON team_lead_reviews FOR SELECT
  USING (
    reviewer_id IN (
      SELECT id FROM users WHERE manager_id = auth.uid()
    )
    AND auth.uid() IN (SELECT id FROM users WHERE status = 'active')
  );
```

Same pattern would extend to `claim_calculator_runs` and any other spoke with reviewer-style access.

---

## Power BI

### 11. Build a Power BI exec-intelligence layer over `kpi_snapshots`
**Where:** External — Power BI Desktop / Service connecting to Supabase project `hkscsovtejeedjebytsv`.

**What this is:** Rather than building richer-and-richer dashboards inside the portal, the in-portal EI Dashboard stays as the *operational* view (real-time, embedded in workflow), and Power BI becomes the *analytical* layer (deep slicing, trend analysis, exec reporting, mobile, scheduled refresh, eventually PE-diligence-ready).

**Why this fits cleanly today:**
- `kpi_snapshots` is already shaped like a fact table: `org_id`, `source_module`, `metric_key`, `metric_value`, `metric_unit`, `period_start`, `period_end`, `metadata` jsonb with the full ClaimContext (~30 fields).
- Every spoke (onboarder_kpi, estimator_kpi, claim_health, eventually scope_of_loss + adjuster + others) writes to the same shape — Frank designed it that way deliberately.
- Power BI's Postgres connector reads Supabase directly. No re-architecture needed.

**Prerequisites (do these once before pointing Power BI at the DB):**
- Build read-only Postgres views in Supabase that flatten the common jsonb fields (`metadata->>'file_number'`, `metadata->>'client_name'`, etc.) into typed columns. This avoids Power BI parsing JSON on every refresh and lets it model relationships properly.
- Create a couple of dimension tables/views: `dim_user`, `dim_phase` (with the STATUS_LABELS mapping), `dim_metric_key`, `dim_date`. Star-schema the model.
- Decide on Power BI access posture — direct connection from a desktop file exposes the DB to whoever has the .pbix. Better: Power BI Service workspace + on-premises gateway, or a Supabase service-role read-only key locked to the views above.
- Map RLS strategy: Supabase RLS doesn't cross over to Power BI; if you want per-user visibility scoping in Power BI, that's a Power BI RLS rule expressed against `dim_user`.

**Initial dashboards to scope when we start (Frank to confirm priorities):**
- Onboarder leaderboard (entries, completion %, avg time-to-completion, abandonment rate, by date range)
- Cross-spoke claim journey (one claim's full timeline: intake → TLS Phase 1 → scope → estimator → TLS Phase 2 → adjuster, with phase durations)
- Carrier/peril/contractor pivots over time
- Time-in-phase distribution + outliers (find the 7-hour onboarding cases)
- Estimator efficiency by referral source / by onboarder

**Effort:** prerequisites are a half-day of SQL views; first dashboard ~1-2 hours after that; mature multi-spoke environment is a couple of days; adding new spokes later is trivial because the schema is uniform.

**Status (2026-04-29):** Foundation shipped. `vw_onboarder_kpi_events` exists in Supabase with `security_invoker = true`. Power BI Desktop connects via Session pooler (cert fix: uncheck Encrypt connections in Edit Permissions). First report `Onboarder KPI.pbix` published to Frank's Power BI Service "My workspace" under PPU license, embedded inline in EI → KPI Power BI tab via auto-auth iframe. **Remaining:** views for the other 5 spokes when they mature, dim tables, RLS posture, scheduled refresh. Visual report design tracked separately as item #16.

---

## TLS workflow (next session)

### 12. Redesign TLS Phase 1 review page to consume the procedural templates
**Where:** `src/app/dashboard/team-lead-support/page.tsx`

**What's in (locked 2026-04-28 PM):** the Templates side is built — `tls_phase_templates` + `tls_phase_template_steps` schema with RLS, and the admin UI in EI → KPI Admin → Templates → Team Lead Support pad. Phase 1 / Phase 2 sub-tabs, four domain sections, full CRUD. Frank's exec team can populate templates immediately.

**What's NOT in:** the actual TLS Phase 1 review page does not yet consume those templates. Today's review panel is a single status-toggle UI (pending → in_review → approved / kicked_back).

**Next-session scope:**
- Redesign the TLS Phase 1 review for one claim as a multi-pad workspace: Contractor pad / Insurance Company pad / Coastal Requirements pad / Complete pad.
- Each pad pulls the matching `tls_phase_templates` row(s) for the claim's `firm_id` (with "Homeowner Direct" fallback when there's no firm) and renders the steps as a checklist.
- Per-claim, per-step completion state goes on the existing `team_lead_reviews` row as jsonb (no third table per the architecture call).
- "Complete" pad's final action sends the closing email and flips status to `approved`, which auto-creates the next-step row (Scope of Loss once that spoke exists, or Phase 2 once Estimator approval routing is wired).

### 13. Apply Today's-Completed pattern to other spokes as they mature
**Where:** Estimator KPI workboard, Claim Health workboard, eventually Scope of Loss / Adjuster KPI when those exist.

**Pattern:** when a claim hits a terminal state in a spoke (estimator marks `review`, etc.), filter older terminations out of that spoke's workboard query and relabel the corresponding pipeline bubble to "Today's [Action]" so it acts as a daily-tally counter rather than an accumulating bucket. The actual record stays in the DB and flows to `kpi_snapshots` for analytical rollups; only the workboard UI changes.

**Why deferred:** wait until each spoke has enough terminal-state UX wired to know the exact bubble label and date-cutoff semantics. Don't apply preemptively.

### 14. Customer-portal mortgage statement upload (future)
**What's in:** today CCS calls / emails the insured asking for the most recent mortgage statement during TLS Phase 1.

**Future state:** email the insured a self-service link → they upload the doc directly → it lands attached to the claim and the relevant TLS Phase 1 step auto-ticks as complete.

**Scope when we get there:** secure tokenized link (no auth required), upload-only landing page, file storage (Supabase Storage bucket), webhook back to flip a step on `team_lead_reviews`. Same pattern would extend to other documents (carrier docs, ID, etc.) and other spokes.

### 15. Delete the standalone `/dashboard/claim-calculator-settings` page
**Where:** `src/app/dashboard/claim-calculator-settings/page.tsx` + the directory.

**Currently:** the page is now embedded in EI → KPI Admin → Templates → Claim Calculator pad. The standalone URL still works (we removed it from the sidebar but didn't delete the file). Once you've confirmed the embedded version covers all your use cases, the standalone page can go.

---

### 16. Power BI report design deep-dive (Onboarder KPI v1)
**Where:** External — `Onboarder KPI.pbix` in Frank's Power BI Service My workspace.

**Why this is its own item, separate from #11:** The plumbing in #11 is done — Supabase view → PPU license → Power BI Desktop → Service → embedded iframe → portal. What's missing is the actual *report*. Today's report is one ugly dot chart on a white square. Frank's words: "underwhelming would be a statement... I'd like to see a larger panel that shows me a chart of trends so I can look for flat lines and decreases."

**The design library Frank already owns:** ~100 BiFlex `.pbix` templates purchased ~2025. Frank shared the catalog 2026-04-29.

**Templates to evaluate first (highest structural match for Onboarder KPI):**
1. **Performance Tracker Demo Report** *(Personal Performance & Tracking)* — purpose-built for the use case.
2. **Marketing KPI Dashboard** *(Marketing & Advertising)* — universal exec KPI pattern.
3. **HR Analytics Dashboard** + **HR Analytics** *(HR & Recruitment)* — per-employee leaderboards, time-based metrics. Maps directly to ranking onboarders (Reyniel vs Ardee).
4. **Sales Performance Dashboard** + **Sales Performance Analysis** *(Sales & E-commerce)* — intake → contract is structurally a sales funnel.
5. **Customer Churn Analysis** *(Customer Behavior)* — abandonment = churn ("claims that started but never finished").

**Reality check on `.pbix` templates:** BiFlex says "100% customizable" but their templates are bound to fields like `Total_Sales`, `Region`, `Quarter`. Our data has `file_number`, `metric_key`, `time_in_phase`, `source_module`. Each visual on each template page has to be re-bound by hand — ~30-60 min per template if everything goes well. So the realistic play is: **use templates as design reference**, then build a clean version against our data, not literally swap the data source.

**What "deep dive" looks like as a session:**
1. Open the 6 candidate templates above in Power BI Desktop. Screenshot each layout.
2. Frank picks the visual structure he wants. Likely candidate layout based on the BiFlex cover page screenshot: left-sidebar nav + 4 KPI cards top + bar chart mid-right + trend line lower-right + sortable data table bottom-left.
3. Decide the 4-5 questions the report answers at a glance. Working list:
   - Top onboarder this week / month
   - Slowest claims (find the 7-hour outliers)
   - Abandonment trend (line chart over last 30 days)
   - Today's intake count
   - Conversion funnel: started → contract signed → completed
4. Build a fresh `.pbix` against `vw_onboarder_kpi_events` mirroring the chosen layout.
5. Republish. The portal iframe updates automatically — no code changes needed.

**Effort:** half a session for evaluation + template selection; one full session for the v1 build.

**Status:** Deferred 2026-04-29. Frank wants to live with the foundation working before tackling visual design.

---

### 18. Claim Breakdown Calculator — math reconciliation vs Frank's hand worksheet

**Date opened:** 2026-04-29
**Status:** Investigation complete, no code changed. Decision pending.

**Where:** `src/app/dashboard/claim-calculator/page.tsx`

**Test fixture:** `.planning/claim-calc-test-data/Total Coverage.docx` (Frank's hand-computed worksheet — this is the canonical "what should the calculator say" reference for further smoke tests)

**Inputs in the worksheet (so you can replay the test):**
- Coverages: A=$10k, B=$10k, C=$10k, D=$10k (limit $5k → over-limit $5k NOT applied to deductible)
- Endorsement under A (Screen Enclosure): $5,000
- Deductible: $5,000
- Deductions ($500): RD/nRD/PWI/O&L/Custom — all $100, all checked
- Prior Payments ($200): two $100 entries; one carries 10% PA fee = $10 marked "not yet" (owed, not paid)
- Payments without Fees ($300): Legal $100 / Paid-Incurred $100 / Custom $100
- PA fee %: 10% on each of A/B/C/D
- Insured Repairs ($500): all 5 items at $100 (Interior, Exterior, Fences, Screen, Additional)
- Contractor Repairs ($700): all 7 items at $100 (Roof, Add Roof, Gutters, Solar, Soffit, Fascia, Additional)

**Three-way comparison (worksheet vs old standalone repo vs current portal):**

| Metric | Frank's worksheet | Old `claim-breakdown-calcuator` repo | Current portal | Old vs Frank | New vs Frank |
| --- | ---: | ---: | ---: | ---: | ---: |
| Total Coverage | $40,000 | $40,000 | $40,000 | ✅ | ✅ |
| Balance before PA fees | $34,000 | $34,000 | $34,000 | ✅ | ✅ |
| Current PA fees | $3,400 | $3,400 | $3,400 | ✅ | ✅ |
| Total PA fees (incl. $10 owed) | $3,410 | $3,410 | $3,410 | ✅ | ✅ |
| Total Possible Recovered | $36,590 | $36,300 | $36,300 | −$290 | −$290 |
| Final Balance — printed PDF | $34,590 | **$34,390** | (no separate PDF formula) | **−$200** | — |
| Final Balance — on screen | $34,590 | $35,000 | $35,000 | +$410 | +$410 |

**The four "running" numbers all match.** The two terminal numbers diverge for two unrelated reasons (see below).

**The 2026-04-05 audit fix `268c7db` — what it actually did:**

Five separate fixes in one commit. Three are pure bug fixes; two are correctness changes that don't materially affect this test case.

1. **Roof checkbox key bug.** State stored under `roofRepairs`; sum-of-repairs code looked for `roof`. Mismatch meant clicking "Roof" never added roof cost to the total. Fix: rename to `roof`.
2. **Final balance now subtracts owed prior PA fees.** Pre-fix: `balance − currentPAFees`. Post-fix: `balance − currentPAFees − priorPAFeesOwed`. Pre-fix hid PA fees that were owed but not yet paid.
3. **Total Possible Recovered uses real PA fees, not flat 0.9 multiplier.** Pre-fix: `(balance × 0.9) + …`. Post-fix: `(balance − currentPAFees) + …`. The 0.9 multiplier worked only when every coverage's PA fee was 10%; broke as soon as any coverage had a different rate.
4. **nRD only subtracted when checkbox is checked.** Pre-fix: `baseAmount = totalPossibleRecovered − nRD` (raw). Post-fix: respects the checkbox. Pre-fix had a phantom deduction.
5. **`withheldAmount` simplified to `totalDeductions`** (no longer subtracts nRD from itself). Affects the yellow/red traffic-light boundary only, not displayed dollar values.

**The fix did NOT cause the worksheet divergence.** Items 1, 2, 4 are pure bug fixes — reverting them re-breaks behavior. Item 3 only diverges from the old formula when PA fee % is non-10% on some coverage; this test uses 10% everywhere, so old and new give identical answers. Item 5 doesn't move dollar values.

**Where the divergence actually comes from (pre-dates the audit fix):**

- **$200 gap (Final Balance, PDF formula):** Frank's worksheet does a "prior payments add-back" before the final-balance step ($200 back, less $10 old fees = +$190 net). Neither old nor new calculator does this add-back at the headline number.
- **$210 additional gap (Final Balance, on-screen formula):** the on-screen `finalBalanceAmount` formula adds back recoverable deductions ($500 total deductions − $100 nRD = +$400 net) and treats $10 priorPAFeesOwed differently. That's structural to the formula — it's computing "ceiling of recoverable" rather than "money client takes home this round."
- **$290 gap (Total Possible Recovered):** Frank adds back $800 = $500 deductions + $300 payments-without-fees. The calculator only adds back $500 (totalDeductions) — payments-without-fees are treated as permanent reductions. (Net Δ shows as $290 because of how the −$10 priorPAFeesOwed nets.)

**Notable historical artifact:** the old standalone repo had **two different "Final Balance" numbers** simultaneously — `finalBalanceAfterRepairs` (= `balancePlusDeductible − repairs` = $34,390 in this test) used only by the print PDF, and `finalBalanceAmount` (= `(totalPossibleRecovered − nRD) − repairs` = $35,000) used on screen. The audit fix retired the PDF formula. The PDF formula was the closer one to Frank's hand math (off by $200, just the prior-payments add-back).

**My recommendation (Claude's, 2026-04-29):**

**Do not revert `268c7db`.** Three of the five fixes are real bug fixes; reverting brings back broken behavior. The audit fix is not the cause of Frank's worksheet divergence.

If we want the calculator to match Frank's hand math, the targeted changes are:
1. Add prior-payments add-back into the displayed Final Balance: change `finalBalanceAmount` from `baseAmount − totalRepairCosts` to a formula that includes prior payments. Closes ~$200 of the gap.
2. Decide whether the headline "Final Balance" should be "ceiling of recoverable" (current behavior, $35,000) or "money this round" (Frank's worksheet, $34,590). They're answering different questions; pick one and label it clearly.
3. Decide whether Payments without Fees should add back into Total Possible Recovered. Frank's worksheet says yes (+$300); calculator says no. Closes the $290 / $410 remaining gap.

These are three small targeted edits, not a revert. Each is independently smoke-testable.

**Hard rule for this item:** smoke tests + Frank's approval BEFORE any code change to `claim-calculator/page.tsx`. Frank stated this explicitly 2026-04-29.

**Test artifacts on Desktop (delete after final smoke test):**
- `C:\Users\FrankDalton\Desktop\Total Coverage.docx` (now also archived in `.planning/claim-calc-test-data/`)
- `C:\Users\FrankDalton\Desktop\claim-breakdown-calcuator\` (cloned old standalone repo for comparison)

---

### 17. Extract `PadCard` / `BackButton` / `ComingSoonPlaceholder` to a shared module
**Where:** `src\app\dashboard\executive-intelligence\KPIAdminTab.tsx` (originals) + `src\app\dashboard\executive-intelligence\KpiPowerBiTab.tsx` (near-byte-identical duplicates).

**Why:** Surfaced by the 2026-04-29 `/simplify` pass on the new Power BI tab. `PadCard` is byte-identical between the two files; `BackButton` is identical except the Power BI version hardcodes its label while the Admin version takes a `label` prop; `ComingSoonPlaceholder` is duplicated as inline JSX in the Power BI file. The `SpokeKey` type and the canonical 6-spoke list are also duplicated.

**Why deferred and not auto-fixed:** Touching `KPIAdminTab.tsx` carries higher risk than the duplication itself today — that file is the recently-shipped KPI Admin redesign (commit 22cf460) and breaking its pad behavior would be a much bigger problem than two copies of a 30-line component. Doing this as its own focused pass is safer than bundling it into the `/simplify` cleanup.

**Fix:**
- Create `src\app\dashboard\executive-intelligence\PadGrid.tsx` (or `src\components\PadGrid.tsx` if Settlement Tracker ends up wanting it next — Settlement Tracker's current page is a visual cousin of the pattern but doesn't share the helpers).
- Export `PadCard`, `BackButton` (the labeled `KPIAdminTab` version — strict superset), `ComingSoonPlaceholder` (with optional `color` prop so the Power BI variant's colored top-border is supported), the `SpokeKey` type, and the canonical `SpokePad` interface.
- Delete the duplicates from both `KpiPowerBiTab.tsx` and `KPIAdminTab.tsx` and import from the shared module.
- Smoke-test: open EI → KPI Admin → Templates landing (verify all 6 pads render and click-through still works), then EI → KPI Power BI (verify Onboarder pad still renders the iframe).

**Effort:** ~30 minutes including the smoke test.

---

## Done (recently fixed — keep here as record, prune occasionally)

- ✅ **2026-04-29** — **Tron Traffic easter egg — ambient lightcycles on the Throwback grid.** New `TronTraffic` singleton mounted in `PortalShell` renders nothing on Modern theme and nothing for users who set `prefers-reduced-motion`. On Throwback, schedules waves of 2–3 glowing bikes (cyan / magenta / violet / amber) that race horizontally along the 56px grid lanes every 30–90 seconds. Bikes ride at z-index 0 so cards visually occlude them — the cards become "buildings on the grid" the way Frank wanted. Component lives in `PortalShell` so it survives page navigation: a wave that finishes on `/dashboard` may reappear on `/calendar` 60 seconds later, giving the "they went off and came back" Tron feel. Tunable knobs at the top of `TronTraffic.tsx` for race duration, idle time, bike count, and trail length. Manual trigger via exported `<StartRaceButton />` component placed in the dashboard Welcome banner (right side, next to the Coastal Claims logo); the button dispatches a `tron-start-race` window event that the singleton listens for, so `<StartRaceButton />` is drop-anywhere. Also includes a hydration fix for the Sidebar Vault's `vaultExpanded` state — was reading `localStorage` synchronously inside `useState`, now reads in `useEffect` after mount so server and client first render match.
- ✅ **2026-04-29** — **Sidebar Vault — per-user "hide tabs I don't use".** Drag any non-Dashboard sidebar item into a new "Vault" group at the bottom of the sidebar to hide it. Vault is collapsed by default, expands inline on click; expanded view lists hidden items as normal nav entries (icon + label + active state + working `<Link>`). Drag back into a tier (or any tier section's empty space) to restore — items always return to their origin tier regardless of where dropped. Persists per-user to new `users.nav_vault` jsonb column (`Record<tier, slug[]>`, mirrors `nav_order`). Single shared `DndContext` spans all tiers + Vault so cross-zone drag works; `TierDropZone` makes empty tier areas droppable. Dashboard is hardcoded un-vaultable. Vault expand/collapse state persists to `localStorage` (`portal-vault-expanded`).
- ✅ **2026-04-28** — `startEdit` on Onboarder was wiping name/address/contractor/etc. fields when clicking Edit. Fixed by spreading all canonical fields into the form, not just a tiny subset.
- ✅ **2026-04-28** — TLS auto-create initial implementation used Supabase `upsert(..., onConflict)` which would have wiped reviewer_id/decision_notes/status on every onboarder re-save. Fixed to "create-once" pattern (existence check, then INSERT).
- ✅ **2026-04-28 PM** — Onboarder KPI `source_module` unified to `'onboarder_kpi'` across producers and consumers. Old `'onboarding'` bucket retired; existing rows migrated. EI Dashboard collapses to one Onboarder section instead of two.
- ✅ **2026-04-28 PM** — `KPIDataTab` Module dropdown cleanup: dead `'onboarding'` option removed, `(legacy)` suffix stripped from `onboarder_kpi`/`estimator_kpi` (those buckets are canonical, not legacy), default flipped to `onboarder_kpi`.
- ✅ **2026-04-28 PM** — EI Data tab redesign: 7-column main table (parent/claim row), expand-to-15-column sub-table with full per-event detail. Org-level aggregate rows hidden from Data tab. Header text brightened from `text-muted` to `text-primary`. Onboarder email column dropped from main table + CSV.
- ✅ **2026-04-28 PM** — Two-sheet xlsx export replaces flat CSV: outlined Activity sheet (parent/child mirroring screen) + flat Claims Summary sheet with aggregates (`Total Time`, `Current Phase` humanized via STATUS_LABELS, `Outcome`).
- ✅ **2026-04-28 PM** — Stale `panelClient` snapshot fix: every Move-To click in the slide-out detail panel was reading the same frozen `client.status` captured at panel-open, so `phase_completed` events always published the original status as `from_phase`. Now the page stores the panel's claim ID and derives `panelClient` from the live `useOnboardingClients` query so each click sees fresh data.
- ✅ **2026-04-28 PM** — KPI Admin redesigned: Data tab is now the default sub-tab (Templates demoted), Templates is a Settlement-Tracker-style pad grid (one pad per spoke). Onboarder Templates and Claim Calculator Settings embedded under their respective pads (Claim Calculator's standalone Super Admin sidebar entry removed).
- ✅ **2026-04-28 PM** — Module-aware user dropdown on Data tab: when `module='onboarder_kpi'`, the dropdown narrows to `users.department='Intake'` instead of dumping all 75 users. Driven by `MODULE_DEPARTMENTS` map; trivial to extend per spoke.
- ✅ **2026-04-28 PM** — Onboarder workboard "Today's Completed" model: 7th pipeline bubble relabeled, completed claims older than today's local midnight drop out of the workboard query (still queryable via Data tab / Power BI). TLS Phase 1 auto-create on completion is unchanged.
- ✅ **2026-04-28 PM** — TLS Phase 1 filter button label "Pending" → "New" (DB value `pending` unchanged so existing onboarder→TLS auto-create still slots rows in).
- ✅ **2026-04-28 PM** — TLS procedural templates schema + admin UI shipped (`tls_phase_templates` + `tls_phase_template_steps` tables with RLS). Phase 1 / Phase 2 templates organized by domain (Contractor / Insurance / Coastal / Complete), Contractor templates anchor to `firms.id` from TPN. Review-page consumption is item #12 on this list.
- ✅ **2026-04-28 PM** — `KPI Power BI` placeholder tab added between KPI Dashboard and KPI Admin — reserved for the analytical layer once the Supabase flattening views land (item #11).
