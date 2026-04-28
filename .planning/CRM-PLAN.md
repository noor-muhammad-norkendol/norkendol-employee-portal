# Norkendol Portal — CRM Module Plan

**Status:** Draft v2 — rewritten 2026-04-27 after reading the live portal source. The first draft underestimated how much already exists. This version reflects what's actually built.
**Companion docs:**
- `CW-LEARNINGS.md` — what we observed in ClaimWizard, what we keep/fix/discard
- `OLD-REPO-AUDIT.md` — verdict on the abandoned `coastal-claims-crm` repo (don't import)

---

## The architecture in one sentence

**The portal is hub-and-spoke. The spokes already exist. The hub does not.**

Today the portal has many specialized views — Onboarder KPI, Estimator KPI, Settlement Tracker (Litigation / Mediation / Appraisal / PA Settlements), Claim Health, Claim Calculator, Compliance, TPN, Executive Intelligence — each owning its slice of a claim's lifecycle, each with its own table, hook, and page.

There is no place where one specific claim is shown end-to-end across all those slices. The CRM module IS that hub. It does not own the data the spokes own. It pulls from them, presents the canonical per-claim view, and adds the per-claim "table of contents" pages that don't have a natural home in any existing module (Notes, Files, Personnel, Action Items, Activity Log, Email Archive, Disbursement Ledger, etc.).

The route stub is already in place: `src/app/dashboard/crm/page.tsx` is currently a "coming soon" placeholder waiting for this build.

---

## What already exists in the portal — the spokes

This is the actual surface area. Anything we build for the CRM module either **consumes** these spokes or **adds** to them. We do not duplicate.

### Onboarder KPI — `src/app/dashboard/onboarder-kpi/`

**Owns the intake stage.** The 72-hour-or-less window between a lead arriving and a claim being assigned to an Adjuster.

- Table: `onboarding_clients` (status: `new` → `step_2` → `step_3` → `final_step` → `completed` / `on_hold` / `erroneous` / `revised` / `abandoned`)
- Hooks: `useOnboardingClients`, `useStageActions`, `useStatusHistory`, `useActivityLogs`, `usePALookup`, `useOnboarderKPIs`
- Already has: per-stage email/text templates, status transitions enforced, activity logging, scoped queries (admin sees all, others see `created_by_id = me OR assigned_user_id = me`)
- **The CRM consumes this** — when an `onboarding_client` is marked `completed`, that's the moment the canonical claim record gets created (or its existence is confirmed).

### Estimator KPI — `src/app/dashboard/estimator-kpi/`

**Owns the estimating workflow.** Estimators write up scopes; the system tracks status, blockers, time-to-estimate, revisions.

- Table: `estimates` (with parent/child revision linking via `parent_estimate_id`)
- Tables: `kpi_snapshots`, `estimator_kpi_revisions`
- Hooks: `useEstimates`, `useSearchEstimatesByFileNumber`
- Status flow: `assigned` → `in-progress` → `review` → `sent-to-carrier` → `settled` → `closed`, with `blocked`, `revision-requested`, `revised` branches
- Scoping: admin sees all, others see `estimator_id = me`
- **The CRM consumes this** — every estimate references a claim. The CRM's per-claim view shows estimate history.

### Settlement Tracker — `src/app/dashboard/settlement-tracker/`

**Owns the resolution workflows when a claim doesn't settle the easy way.** Four sub-tracks, each with its own deep schema.

#### Litigation
- Table: `litigation_files` — file_number, client_name, attorney_firm, attorney_contact (+ `attorney_contact_id` for external user link), state, state_workflow_type, peril, status (`Open` → `Pending CRN` → `Post-CRN` → `In Discovery` → `In Mediation` → `In Trial` → `Settled` → `Closed (No Pay)`), phase, current_reserves, current_offer
- Table: `legal_actions` (the action items inside a litigation — CRN, motions, depositions, etc.)
- Hooks: `useLitigationFiles`, `useLegalActions`, `useStateRequirements` (state-by-state legal procedure data)
- Scoping today: external `ep_user`/`ep_admin` see only `attorney_contact_id = me`. Internal staff see everything (no internal scoping yet — this is part of what Phase 1 fixes).

#### Mediation, Appraisal
- Tables for each, similar shape to litigation but with mediator/umpire-specific fields
- Hooks: `useMediations`, `useAppraisals`

#### PA Settlements — **this is where the disbursement / check / ledger work already lives**
- Table: `pa_settlements` — full money model: RCV, ACV, depreciation, PA estimate, carrier initial offer, settlement amount, was_supplemented, supplement_amount, op_included, op_amount, deductible, pa_fee_percentage, pa_fee_amount, **net_to_client**, total_payments_received, settlement_status (`Open` / `Closed`), settlement_type (`Global Release` / `Partial Payment (Open Coverage)`), 4 coverages settled flags (A/B/C/D + endorsements), carrier_adjuster_rating + review
- Table: `pa_settlement_payments` — the actual payment ledger. Each row: payment_type (`Initial Payment` / `Supplement` / `Depreciation Recovery` / `O&P Recovery` / `Final Payment` / `Other`), amount, date_received, description, entered_by
- Table: `pa_settlement_updates` — activity log per settlement (description + next_action_date + entered_by)
- Hooks: `usePASettlements`, `useArchivedPASettlements`, `useAllPASettlementsForLiquidity`, `useCreatePASettlement`, `useUpdatePASettlement`, `useArchivePASettlement`, etc.

**Critical insight for the CRM ledger:** PA Settlements already has the canonical money model the CRM's Claim Ledger needs. The CW Claim Ledger is broader (Payments / Expenses / Disbursements / Notes), but for *settlement* money flow, PA Settlements is the source of truth. The CRM doesn't rebuild this — it surfaces it.

#### Claim Lookup hook — `src/hooks/useClaimLookup.ts`
Cross-table search across `onboarding_clients`, `estimates`, `litigation_files`, `claim_health_records`. **Currently does NOT respect access scoping** (org-wide search regardless of role). Phase 1 fixes this.

### Talent Partner Network (TPN) — `src/app/dashboard/talent-partner-network/`

**Owns the external-partner directory.** This IS the portal's replacement for CW's "Companies + Staff + External Personnel" sections.

- Tables: `tpn_firms`, `tpn_external_contacts`, plus phase-2 schemas, phase-2B external_contacts → user_link, phase-7 activity log
- 6 migrations total just for TPN — substantial depth
- **The CRM consumes this** — when a claim's Company Personnel block lists "Rose Roofing & Restoration" as the contractor, that's a TPN firm reference. When Cassidee Snyder is the rep on this claim, that's a TPN contact reference.
- TPN already has a `pending_status` flag (external contacts can be "pending" before being approved into the network) — feeds the same access pattern the CRM personnel block needs.

### Claim Health — `src/app/dashboard/claim-health/`

- Table: `claim_health_records`
- Per-claim health-check scoring used by the Claim Health Matrix
- Scoping: admin sees all, others see `adjuster_id = me`
- **The CRM consumes this** — health scores surface in the per-claim view.

### Claim Calculator — `src/app/dashboard/claim-calculator/`

- Settlement breakdown / fee distribution calculator
- Has `claim-calculator-settings` admin page + `claim_release_types` migration
- **The CRM consumes this** — the calculator runs against a specific claim's coverage figures.

### Compliance — `src/app/dashboard/compliance/`

- State-routed compliance pages: `compliance/state/[code]/page.tsx`
- Used to enforce state-specific PA regulations and deadlines
- **The CRM consumes this** — claim-level compliance status surfaces in the per-claim view.

### Executive Intelligence — `src/app/dashboard/executive-intelligence/`

- Admin/exec analytics on top of all the above
- Migrations: `executive_intelligence`, `notification_preferences`
- **The CRM does not feed this directly** — it's the other direction. EI reads aggregate data the CRM helps generate (claim counts, settlement metrics, etc.).

### TPN-Admin, Settlement-Tracker-Admin, User-Management, Tenant-Management, Departments, Directory, Dashboard-Admin

Admin panels for each module. **The CRM doesn't reproduce these** — but the per-claim view links into them where appropriate.

### AI Agents — `src/app/dashboard/ai/`, `src/app/dashboard/ai-agents/`

- Tables: `ai_foundation`, `ai_usage_log`, `unmatched_adjusters_data`
- AI tooling for matching, parsing, automation
- **The CRM consumes this** — e.g., the Files page can use AI for document parsing (matches the "AI Reports" folder we saw in CW). Long term, the auto-footprint on view, the email parsing, and the "send-upload-to-homeowner" flow can all be AI-augmented.

### Calendar, Diary, Schedule, Documents, Training/University, Departments, Teams Chat, Compliance Settings, Applications, Apply page, Pending page

Each owns its slice. CRM links to them where relevant from the per-claim view but doesn't duplicate.

---

## The canonical claim record — the one gap that matters

Today there's no `claims` table. Each module has its own version of "a claim":
- Onboarder KPI: `onboarding_clients` row
- Settlement Tracker: `litigation_files` row (used as a de-facto canonical record because it has `file_number` + `client_name` + state + carrier + etc., and `pa_settlements`, mediations, appraisals all FK to it)
- Estimator KPI: `estimates` rows reference a `file_number` string
- Claim Health: `claim_health_records` row
- Claim Calculator: ad hoc per-instance

**This is the thing the CRM module fixes.** We add a real `claims` table that:
- Owns the canonical `file_number`, `client_name`, `loss_address`, `state`, `peril`, `loss_date`, `carrier`, `policy_number`, `claim_number`, `current_phase`, `assigned_adjuster_id`, `created_at`
- Is referenced by everyone: `onboarding_clients` gets a `claim_id` once intake completes; `litigation_files` gets a `claim_id`; `pa_settlements`, `estimates`, `claim_health_records` all reference `claim_id` instead of (or in addition to) the loose `file_number` string they use today
- Becomes the join key for the per-claim CRM view

**The migration path is real, not theoretical.** The portal already pivots around `litigation_files` for cross-module joins because that's the one with a stable UUID. Adding `claims` and migrating references is a focused, multi-step migration — not a rewrite.

---

## How the CRM module hub-and-spokes the spokes — concrete picture

A user opens `/dashboard/crm/[claimId]`. The page renders the per-claim secondary sidebar (CW pattern). Each section is composed from:

| Section | Data source | Already built? |
|---|---|---|
| **Claim Summary** | `claims` (new) + joined header from spokes | NEW |
| **Files** | `claim_files` (new) + Supabase Storage bucket | NEW |
| **Notes** | `claim_notes` (new — separate from Activity Log per CW pattern) | NEW |
| **Company Personnel** | `claim_personnel` (new — m2m) | NEW |
| **Demands and Offers** | `claim_demands` (new) — but for litigated claims, joined to `legal_actions` and `pa_settlements`; for plain claims, just `claim_demands` | PARTIAL (PA settlements has its own demand-shape data) |
| **Action Items** | `claim_action_items` (new) + joined `legal_actions` for litigation cases + joined `onboarding_stage_actions` for intake | PARTIAL |
| **Schedule** | `claim_appointments` (new) — feeds the existing Calendar module | NEW (Calendar exists, this is per-claim slice) |
| **Activity Log & Message Archive** | `claim_activity_log` (new — unified) + `claim_emails` (new) | NEW |
| **Insurer & Policy** | `claim_insurer_policy` (new) — per-claim. Plus `insurer_personnel` join to TPN | NEW |
| **Mortgages & Liens** | `claim_mortgages` (new) | NEW |
| **Time Tracking** | `claim_time_entries` (new) + auto-footprint rows | NEW |
| **Management Notes** (replaces CW's Legal Notes) | `claim_management_notes` (new) — gated by `management_notes_access` flag in User Management | NEW |
| **Claim Ledger** | `claim_payments`, `claim_expenses`, `claim_disbursements` (new) — but **inherits the PA Settlements payments pattern** (`payment_type`, amount, date_received) and surfaces all `pa_settlement_payments` rows for the claim's PA settlements | PARTIAL — PA settlement payments are the model |

Plus toolbar features:
- **Templates** — generic Word/PDF doc generator with `[[ ]]` field substitution. NEW (the existing `compliance` module has some doc generation but not full templates).
- **POL Builder** — structured Proof of Loss wizard. NEW.
- **Doc Builder** — full claim PDF compiler. NEW.
- **Diary** — personal task assignment per claim. NEW.
- **Watch** — `claim_watchers` (whoever wants notifications on this claim). NEW.
- **Get Share Link / File Share** — `claim_share_tokens` (new — unified table for file shares + claim shares + send-upload-to-homeowner links).

---

## Disbursements, checks, and the ledger — Frank's specific concern

CW's Claim Ledger has 4 sub-tabs: **Payments** (carrier → us), **Expenses** (costs we incurred), **Disbursements** (us → client / contractor / staff fee splits), **Notes**.

The portal today has:
- `pa_settlements` — settlement-amount-level records (one settlement = one row)
- `pa_settlement_payments` — payment-event records (carrier issued $X on date Y, with payment_type)
- These together cover the **Payments** sub-tab semantics for *settlement* money flow

What's missing for a complete Claim Ledger:
- **Expenses** — engineering reports, third-party costs, etc. (not currently tracked)
- **Disbursements** — money going OUT of CCS to the client, contractor, or staff per the fee split structure (Lee 20%, Carlos 3%, Bill 2%, etc. — these % come from Company Personnel)
- **Cross-track unification** — a litigation claim that ends in a Mediation settlement still needs its payments tracked. Today PA Settlements is the only sub-track with a payment ledger. Litigation/Mediation/Appraisal don't have equivalent payment tables.
- **Mortgagee disbursement** — the mortgages-and-liens table needs to feed disbursement logic (carrier check made out to "Wetzel + ABC Mortgage Co" requires both signatures)

**Fix proposal:** Generalize the `pa_settlement_payments` shape into `claim_payments` keyed on `claim_id` (not `pa_settlement_id`). PA Settlements still owns the settlement-record shape, but payment events live at the claim level so they're shared across all four resolution tracks. Then add `claim_expenses` + `claim_disbursements` tables matching CW's ledger structure. The Claim Ledger UI is the existing Demands+Disbursements panel from PA Settlements, generalized.

This unifies the money model without breaking the PA Settlements feature today. PA Settlements becomes a **specialized lens** on `claim_payments` rather than the only place payments live.

---

## Access model — what's left to decide

Frank's running list of access requirements:

1. **Per-claim personnel = access list.** Internal staff named on a claim's personnel block sees the full claim. External partners (TPN) see a limited "cliff-notes" view.
2. **Per-row visibility flag.** Each personnel row has `has_visible_access` (default ON). Toggle OFF when the person's role is done — they stay on the file (audit / fee record), claim drops off their dashboard.
3. **Active driver = single Adjuster.** The "Assigned" header badge shows only the active Adjuster, not everyone with access.
4. **Departmental routing.** Action items target either a per-claim role (Adjuster, Estimator) OR a department (Onboarding, Scheduling, Processing, Collections, Finance). Department members pick up their queue.
5. **Section-level group permissions.** Some sections (Legal Details case in CW) require additional permission beyond claim-level access.
6. **Tokenized external access.** File shares, claim shares, and homeowner upload links use 30-day-default tokenized URLs with no portal account required.
7. **Auto-footprint on view.** No close-prompt. Enter/exit auto-logs to the claim activity log + time tracking.
8. **Executive global access.** Admin / super_admin / system_admin / Frank / Tara Dalton / Heidi Haskell / etc. see everything regardless of personnel attachment.
9. **Regional manager scoping.** Warren Harbin (East Coast Regional President) sees East Coast claims with his name attached. **Open question:** is his name attached manually at intake or via a territory rule?

The conversation paused on question 9. **Phase 1 cannot start writing migrations until 9 (and a few related questions in `CW-LEARNINGS.md`) are answered.**

---

## Build phases — what we actually do, in order

Each phase is **multiple sessions**, each session is a **BINGO'd chunk**. We never start a phase without finishing the prior one's planning loop. We never write a migration without confirming the schema with Frank.

### Phase 0 — Foundations (mostly done, this conversation)

- [x] Click through ClaimWizard end-to-end
- [x] Audit `coastal-claims-crm` (don't import)
- [x] Read the live portal source — confirm what's already built
- [x] Write `CW-LEARNINGS.md`, `OLD-REPO-AUDIT.md`, this doc
- [x] **Finish the access-model conversation** — all 8 questions resolved (see Decision Log + the "All 8 questions resolved. Phase 1 migrations are unblocked." line below).
- [x] **Decide priority** — Decision Log entry 2026-04-27: finish PA Settlements paint, pause Lit/Mediation/Appraisal paint, run CRM Phase 1 in parallel.

### Phase 1 — Canonical claims record + access model

The keystone phase. Nothing else makes sense until this lands.

1. ✅ **DONE 2026-04-27** — Create `claims` table (canonical per-claim record). Applied to live DB (`hkscsovtejeedjebytsv`) via Supabase dashboard SQL editor; captured in `supabase/migrations/20260427_crm_phase1_claims_table.sql`. RLS tightened from day 1 (see Decision Log).
2. ✅ **DONE 2026-04-27** — Create `claim_personnel_roles` (admin-editable lookup, 23 starter roles seeded) + `claim_personnel` (m2m with polymorphic `user_id` / `external_contact_id` and exactly-one CHECK). Applied to live DB (`hkscsovtejeedjebytsv`) via Supabase dashboard SQL editor; captured in `supabase/migrations/20260427_crm_phase1_step2_personnel_and_roles.sql`. RLS enabled on both tables.
3. ✅ **NOOP 2026-04-27** — Department membership shape locked: v1 keeps the existing `users.department` single string column unchanged. No new table, no new column. Multi-department (`user_departments` join table) deferred until operating data justifies it. See Decision Log row "Single department per user for v1; multi-department deferred."
4. ✅ **DONE 2026-04-27** — Backfill `claims` from the seven spokes. In dev only `estimates` had rows (6 → 1 after DISTINCT ON dedup; the other six spokes are empty no-ops). All backfilled rows AL-prefixed and flagged `is_legacy = true`. Captured in `supabase/migrations/20260427_crm_phase1_step4_backfill_estimates_to_claims.sql`. Future CCS historical rollover is a separate one-time import job per locked decision, not part of this Step 4.
5. Add `claim_id` foreign keys on existing tables (nullable initially; non-null after backfill)
6. Update `useClaimLookup` to respect scope — accept `scope: 'mine' | 'global'` param; filter each table query by assignment when `scope=mine`
7. Rewrite RLS policies on every table to enforce scope (replace `USING (true)` with real predicates)
8. Update existing hooks (`useOnboardingClients`, `useEstimates`, `useLitigationFiles`, `useClaimHealthRecords`, etc.) to align with the new model — they already do partial scoping; we tighten and unify
9. **Test plan** before any deploy: verify Joe Mayday only sees his claims in every module; admin sees all; external `ep_user` sees only attorney-attached litigation; etc.

### Phase 2 — The shared lookup component

The original lookup question that started this whole thread.

1. Build `<ClaimLookupBar>` — reusable component with 4 inputs (Claim # / File # / Client Name / Address) + the `<ClaimMatchBanner>`
2. Drops into any Add form. Each consuming form passes a `fillForm(match)` callback
3. Wire into PA Settlements `PACreateModal` (the original ask)
4. Refactor Onboarder + Estimator to use it (they already have the wiring; just consolidate to the shared component)
5. Audit every other Add form across the portal — wire missing ones (Settlement Tracker Litigation create, Mediation, Appraisal, Claim Health, Claim Calculator, etc.)

### Phase 3 — The per-claim CRM view shell

1. Build `src/app/dashboard/crm/[claimId]/layout.tsx` — page shell with secondary sidebar
2. Add the secondary sidebar items (Claim Summary, Files, Notes, etc.) — each as a `[claimId]/[section]/page.tsx` route
3. Build the top header: state-prefixed file number, current phase, key fields, assigned adjuster badge (active driver only)
4. Build the right rail "Quick View" — deadlines, appointments, action items
5. Add the path to `HIDE_TEXT_SIDEBAR_ON` exception (CRM is the one place secondary sidebar stays)
6. Auto-footprint hook — log enter/exit to activity log + time tracking, no prompt

### Phase 4 — Claim Summary section + Personnel section

1. Claim Summary page — pulls from `claims` + joined data from spokes for the header info
2. Company Personnel page:
   - List rows from `claim_personnel`
   - Edit row → role, fee%, visibility toggle, dates
   - Add row → searches users + TPN external contacts
   - Insurer Personnel — separate block, joins to TPN
3. **Visibility toggle wired to dashboard filtering** — Joe's dashboard `useMyClaims` filter respects the flag

### Phase 5 — Files + Share tokens

1. `claim_files` table + Supabase Storage integration
2. Folder taxonomy (01 Intake / 02 Carrier / 03 PA / 04 Estimator / 05 TL / 06 Attorney / 07 Insured / 08 AR / 09 Contractor / 10 Appraisal / AI Reports / [Email Attachments])
3. Upload, download, move, delete, gallery view
4. **Share tokens** — `claim_share_tokens` table (kind: `file` / `file_set` / `claim_view` / `homeowner_upload`)
5. Generate tokenized URL → email recipient → recipient lands at a public route that validates token
6. Send-upload-to-homeowner flow — homeowner uploads via tokenized link, file lands in correct folder, optional AI parsing

### Phase 6 — Notes + Activity Log + Email Archive

1. `claim_notes` (with `is_pinned`, `is_private`)
2. `claim_activity_log` (unified events: phase changes, file uploads, action item completions, footprints, disbursements, etc., with `is_public` flag)
3. `claim_emails` + per-claim auto-email infrastructure (`@claimmail.[norkendol].net` or similar) — outbound CC, inbound auto-archive
4. Activity Log page with the View: Activity / Email toggle (CW pattern)

### Phase 7 — Action Items

1. `claim_action_items` (with role-templated assignment + departmental fallback)
2. Phase scripts — when claim phase changes, system spawns the new phase's action items
3. Phase scripts admin UI — edit which items spawn at each phase (or hardcoded per workflow type initially)
4. Joined view: legal_actions (from litigation) + onboarding_stage_actions (from intake) + claim_action_items all surface in the per-claim Action Items page

### Phase 8 — Demands & Offers + Claim Ledger

1. `claim_demands` + `claim_offers` (separate from `pa_settlements` — those are *resolution* records; demands are the formal asks issued at any point)
2. `claim_payments` — generalized from `pa_settlement_payments`. Migrate existing PA payment rows to the new shape with a `pa_settlement_id` link preserved
3. `claim_expenses` (engineering reports, third-party costs)
4. `claim_disbursements` (us → client / contractor / staff fee splits derived from Company Personnel %)
5. Claim Ledger page with 4 sub-tabs (Payments / Expenses / Disbursements / Notes) per CW
6. Mortgagee disbursement logic — checks made out jointly when mortgagee on file
7. Hard rule: Demand must exist before a payment is recorded (CW pattern)

### Phase 9 — Insurer & Policy + Mortgages & Liens

1. `claim_insurer_policy` — carrier info, policy details, coverage limits A/B/C/D/Ord/Debris/Mold/BI, deductible, depreciation, clauses (appraisal/arbitration/repair/force-placed)
2. `claim_mortgages_liens` — mortgagee company, contact, balance
3. **Send-mortgage-link** flow on Mortgages page — homeowner upload tokenized link

### Phase 10 — Time Tracking + Management Notes

1. `claim_time_entries` — already in `pa_settlement_updates` schema spirit; generalize to claim level
2. Auto-footprint rows from Phase 3 land here
3. Billable / non-billable / billed_on / paid_on per the old repo's good idea
4. `claim_management_notes` table (replaces CW's Legal Notes) — visible only to users with `management_notes_access` permission flag. Add the flag to the User Management permissions table.

### Phase 11 — Document generation

1. Templates — flat list, `[[ ]]` field substitution against claim data
2. POL Builder — multi-step wizard
3. Doc Builder — section-checkbox PDF compiler

### Phase 12 — Cross-module integration polish

1. Onboarder KPI completion → claim record creation hook
2. Estimator KPI estimates → claim_id linkage
3. Settlement Tracker tracks → claim_id linkage
4. Adjuster dashboard "Your Assigned Claims" tile
5. Manager / Regional dashboard variants
6. Executive Intelligence — read aggregate metrics from `claims` + spokes

### Phase 13+ — Polish, edge cases, performance

Diary, Watch, Update Claim modal, Edit Client / Edit Property modals, Print Settlement, etc.

**Admin UI for managing `claim_personnel_roles`** — add / rename / activate / deactivate / reorder. Until this ships, role management is via Supabase dashboard (admin runs INSERT/UPDATE on `claim_personnel_roles` directly). Per the 2026-04-27 Approach C decision.

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-27 | CRM lives **inside the portal**, not as a separate app | Hub-and-spoke. One system. |
| 2026-04-27 | Don't import `coastal-claims-crm` repo | Wrong stack (Vite vs Next.js), wrong backend (allurt.co vs Supabase), 5 commits then abandoned. Cherry-pick a couple of schema sketches only. |
| 2026-04-27 | Per-claim secondary sidebar is the only place the secondary sidebar stays | DESIGN-RULES.md, confirmed live in CW. |
| 2026-04-27 | Per-row "no longer has visible access" toggle on Company Personnel | Frank has wanted this in CW for years. Stays on file for audit/fee, drops off dashboard. |
| 2026-04-27 | Auto-footprint on claim view enter/exit (no close-prompt) | Frank: "footprint that they were in the file and add it to time log without asking them." |
| 2026-04-27 | Send-to-homeowner upload tokenized links | Saves hundreds of admin hours/year on mortgage/policy/photo collection. |
| 2026-04-27 | 30-day-default TTL for share tokens | Matches CW's `claimwizard.com/fv/[token]` 30-day auto-expiration. Configurable per share. |
| 2026-04-27 | "Assigned" badge on claim header = active Adjuster only | Don't conflate access with active driver. |
| 2026-04-27 | Action items target either per-claim role OR departmental role | CW does both implicitly (Adjuster vs Onboarding); we make it explicit in the data model. |
| 2026-04-27 | Add a real `claims` table; existing tables get `claim_id` FK | Today the portal de-facto pivots around `litigation_files`, which only exists for litigated claims. |
| 2026-04-27 | Generalize `pa_settlement_payments` → `claim_payments` keyed on `claim_id` | Unify money model across all 4 resolution tracks. PA Settlements becomes a specialized lens on shared payment events. |
| 2026-04-27 | TPN is the canonical "Companies + External Personnel" replacement; CRM does not duplicate it | TPN already has 6 phases of schema. CRM personnel block joins to TPN for external rows. |
| 2026-04-27 | Onboarder KPI stays the intake stage; on `completed` status it produces a `claims` row | The handoff between intake and active claim is the moment the canonical record is created. |
| 2026-04-27 | **Regional manager / account exec / education director / strategic growth attachment is MANUAL at intake (v1)** | Onboarder picks the names from dropdowns when they assign the Adjuster. Future v2 adds territory/role auto-attach (state → regional president lookup table). Manual ships first, auto comes later. |
| 2026-04-27 | **Build sequencing: finish PA Settlements paint Rounds 2/3/4; pause Lit/Mediation/Appraisal paint; start CRM Phase 1 in parallel** | PA paint is 3 short sessions in flight, won't be wasted. Lit/Mediation/Appraisal sub-tracks will be partly restructured by CRM Phase 7-12 (their action items, payments, personnel merge into the unified claim model) — painting them now risks throwaway work. CRM Phase 1 is database/migration work and doesn't conflict with paint sessions. |
| 2026-04-27 | **Action item phase scripts are ALWAYS admin-configurable, never hardcoded** | Bill Pendergast + claim leadership tune them by state/region; they change frequently. Hardcoding them would force code deploys for every workflow tweak. Configurable from day 1. |
| 2026-04-27 | **Migration strategy: launch-day forward = new model. Legacy claims get an `AL` prefix on their claim/file number** | Prevents collisions with new claim rotation. Legacy backfill is a separate one-time data import job, scheduled later. New CRM does NOT need to support importing every old claim on day 1. |
| 2026-04-27 | **External partner access is permission-gated, not type-gated** | A TPN external contact with no permissions = "cliff notes" view. Same contact, once granted permissions (e.g., `crm_assignable` ON in User Management), becomes assignable to claim_personnel and sees the claim per their permission level. Attorney vs. vendor distinction is NOT the gate — granted permissions are. The existing User Management `crm_assignable` flag already implements this. |
| 2026-04-27 | **Visibility toggle ("no longer has visible access") is flipped by Management only — never the Adjuster, never the person themselves** | "Management" for v1 = users with the `admin` role OR users with the `management_notes_access` flag. Specific groups, not a fuzzy "any permission above user" tier. v2 may revisit with a cleaner permission-ladder concept once the system has been operating for a while. Manual flip only for v1. |
| 2026-04-27 | **Visibility toggle is BIDIRECTIONAL — can flip back ON via a "Reassign to [role]" action item** | If 2 months after Eileen's estimate is done, the Adjuster finds more damages and needs Eileen back on the file, the Adjuster drops a "Reassign claim to estimating" action item; system flips Eileen's visibility back ON. Toggle is a switch, not a tombstone. |
| 2026-04-27 | **"Request removal" self-service button on each personnel row** | The person can REQUEST to be removed from a claim ("I've completed my work") — non-blocking, sends notification to management. Management approves or denies. Person cannot unilaterally toggle themselves off. Avoids both the abuse risk (people peeking) and the friction of having to chase management down. |
| 2026-04-27 | **v2 workflow auto-flip will create a pending request for management approval, not auto-toggle** | When Eileen marks her estimate `settled` in Estimator KPI later, that creates a pending visibility-off request — management has to approve before the toggle actually flips. Preserves human-in-the-loop. Don't build until v2. |
| 2026-04-27 | **Legal Notes section is REPLACED with "Management Notes"** | CCS has never used Legal Notes in CW. Don't carry it forward. Replaced by a Management Notes section visible ONLY to management — not to staff, adjusters, or even admins. Requires a new `management_notes_access` permission flag in User Management (typical holders: Frank, Tara, Heidi, leadership team). Gates above admin. |
| 2026-04-27 | **Single department per user for v1; multi-department deferred** | Frank: not enough operating data to decide if multi-department is needed. Start with the existing `users.department` single string. Add `user_departments` join table later if needed (non-breaking change). |
| 2026-04-27 | **Permissions system must scale to thousands of external partners** | Frank: "we deal with thousands of contractors, attorneys, and roofing companies in the US — what you're seeing is just my build environment." Phase 1 design constraint: per-user permission flags table needs proper indexes, the User Management UI needs search/filter/batch-grant, default permissions for new TPN partners are ALL OFF (zero-access by default; explicit grant per feature), and bulk grants by partner category (e.g., "all roofers get `roofer_settlement_kpi` ON") are first-class operations. |
| 2026-04-27 | **`crm_assignable` switch in User Management is a placeholder, not wired up yet** | The column exists in the permissions table and the toggle is rendered in the UI, but no code currently uses it (because the CRM doesn't exist yet). Phase 1 makes the switch real by wiring it as the gate for `claim_personnel` row creation. |
| 2026-04-27 | **Phase 1 Step 1 applied to live DB (`hkscsovtejeedjebytsv`).** `claims` table created via Supabase dashboard SQL editor; captured in `supabase/migrations/20260427_crm_phase1_claims_table.sql`. | RLS tightened from day 1 — admins see all org claims; non-admin internal users see only claims where `assigned_adjuster_id = auth.uid()`; external partners get NO access until Step 7. Reasoning: Steps 1–7 spread across multiple sessions, so the permissive Step-1-to-Step-7 window isn't acceptable. Step 7 will broaden non-admin internal access to also include claims they're attached to via `claim_personnel` with `has_visible_access = true`. |
| 2026-04-27 | **Clients and Properties get their own tables in a future phase (phase number TBD).** | v1 keeps `client_name`, `loss_address`, and the structured `loss_*` parts as flat text on `claims`. Real `clients` and `properties` tables will land when the system needs them; backfilling from the flat fields is a non-breaking change at that time. Doc gap acknowledged: this isn't called out as a phase in the build-phase list above — pencil it in when the right slot is clear. |
| 2026-04-27 | **Approach C chosen for the role list — separate `claim_personnel_roles` lookup table.** Roles fully editable by admin via Supabase dashboard today; future admin UI deferred (Phase 13+). | Hardcoded role lists are exactly why ClaimWizard mislabels Warren Harbin (he's a Regional President; CW labels him "Adjuster Supervisor" because the firm can't edit the list). Norkendol does not replicate that limitation. Adding a new role = INSERT a row, no migration. |
| 2026-04-27 | **Public Adjuster role is `kind=either`.** Internal CCS staff PAs use this role label (the only path used in practice today). External outside-firm PAs via TPN can also use this role if it ever happens. | CCS has never run a claim with an outside (TPN) Public Adjuster, but the role accommodates that future case without forcing a choice today. The polymorphic `claim_personnel.user_id` vs `external_contact_id` distinguishes which kind on a given row. |
| 2026-04-27 | **Backfilled `claims.current_phase` derived from source spoke status (Option B), with `closed_at` populated only when phase = 'Closed'.** | Keeps the rollup phase / closed_at internally consistent. For estimates: `status` IN (`closed`, `settled`) → `current_phase = 'Closed'`, else `'Estimating'`. `closed_at` populated from `settlement_date` (settled) or `date_closed` (closed), with `date_completed` as fallback. Pattern extends to other spokes when they have rows. |
| 2026-04-27 | **Backfill dedupes via `DISTINCT ON (file_number)` when a spoke has revision/parent linking.** Latest revision per claim wins (`ORDER BY file_number, revision_number DESC, created_at DESC`). | Estimates carries `parent_estimate_id` + `revision_number`. Six estimates rows in dev shared one file_number — they're parent + 5 revisions of the same claim. The canonical `claims` row reflects the latest revision's snapshot; historical revisions stay in `estimates` and get linked via `claim_id` FK in Step 5. |

---

## Open questions blocking Phase 1

These have to be answered before we touch a migration. Frank to address one at a time when ready:

1. ~~**Regional manager attachment** — does Warren Harbin's name get attached to a Maryland claim manually at intake (onboarder picks him from a dropdown), or via a territory rule (`MD → East Coast → Warren auto-attached`)?~~ **ANSWERED 2026-04-27:** Manual at intake (v1). Future v2 adds territory auto-attach via a state → regional president lookup table.
2. ~~**Account exec / education director / strategic growth attachment** — manual or rule-based, like above?~~ **ANSWERED 2026-04-27:** Same — manual at intake for v1, auto-attach later.
3. ~~**Attorney/vendor access depth via TPN**~~ **ANSWERED 2026-04-27:** Permission-gated, not type-gated. External TPN contact with no permissions = cliff notes only. Granted `crm_assignable` (existing flag in User Management) = becomes assignable to claim_personnel; once assigned, sees the claim per their permission level. The attorney/vendor split is irrelevant to access logic — permissions are the gate. May add granular permission throttles later (e.g., separate flags for "see ledger", "see internal notes") as the system matures.
4. ~~**Per-row visibility toggle authority**~~ **ANSWERED 2026-04-27:** Admin / Management only manually for v1. NEVER the Adjuster on the claim. NEVER the person themselves. v2 adds workflow auto-flip (Estimator marks estimate as `settled` → system auto-flips Estimator's visibility OFF on linked claim).
5. ~~**Section-level permissions**~~ **ANSWERED 2026-04-27:** Legal Notes is REPLACED with a "Management Notes" section. Add a `management_notes_access` flag to the existing User Management permissions table (org-wide gate, same pattern as `crm_assignable` etc.). Visible only to flag-holders (typically leadership: Frank, Tara, Heidi). Not admins. Not adjusters. Gates ABOVE admin.
6. ~~**Departmental membership shape**~~ **DEFERRED 2026-04-27:** v1 uses existing `users.department` single string. Multi-department decision deferred until system has more operating data. Adding a `user_departments` join later is non-breaking.
7. ~~**Action item phase scripts** — admin-configurable from day one, or hardcoded per `workflow_type`?~~ **ANSWERED 2026-04-27:** Always admin-configurable. Never hardcoded. Claim leadership (Bill Pendergast + team) tunes by state/region/frequency.
8. ~~**`claim_id` migration strategy** — backfill in one shot, or staged per-module?~~ **ANSWERED 2026-04-27:** Launch-day forward = new model only. Legacy claims tagged with `AL` prefix to prevent number collision. Legacy backfill is a separate later job, not blocking CRM launch.

**All 8 questions resolved.** Phase 1 migrations are unblocked.

---

## Hub-and-spoke — what the data flow actually looks like

```
                  ┌─────────────────────────────────────────────┐
                  │  CRM HUB — /dashboard/crm/[claimId]         │
                  │  Per-claim canonical view                   │
                  │  Owns: claims, claim_personnel,             │
                  │   claim_files, claim_notes, claim_demands,  │
                  │   claim_payments/expenses/disbursements,    │
                  │   claim_action_items, claim_activity_log,   │
                  │   claim_emails, claim_share_tokens,         │
                  │   claim_management_notes,                   │
                  │   claim_time_entries,                       │
                  │   claim_insurer_policy, claim_mortgages     │
                  └────────────────┬────────────────────────────┘
                                   │
       ┌──────────────┬────────────┼────────────┬───────────────┬───────────┐
       │              │            │            │               │           │
       ▼              ▼            ▼            ▼               ▼           ▼
 Onboarder KPI  Estimator KPI  Settlement   Claim Health   Claim Calc   Compliance
 (intake)       (scoping)      Tracker      (matrix)       (settlement   (state-by-
                               (4 tracks)                   breakdown)    state)
       │              │            │            │               │           │
       └──────────────┴────────────┴────────────┴───────────────┴───────────┘
                                   │
                                   ▼
                              ┌─────────┐
                              │   TPN   │ — external partners (firms + contacts)
                              └─────────┘
                                   │
                                   ▼
                              ┌──────────────────┐
                              │  Tokenized URLs  │ — file shares, claim shares,
                              │  (no portal acct │   send-to-homeowner uploads
                              │   needed)        │
                              └──────────────────┘
```

Every spoke FK's to the same `claim_id`. The CRM module is the only place that joins them all. Each module's existing dashboard remains its own thing — the CRM doesn't replace those, it adds the unified per-claim lens.
