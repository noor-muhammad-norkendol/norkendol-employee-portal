# Old CRM Repo Audit — `coastal-claims-crm`

**Repo:** https://github.com/Coastal-Claims-Services/CRM
**Local clone:** `C:\Users\FrankDalton\myProjects\coastal-claims-crm`
**Last commit:** Oct 23, 2025 (~6 months ago)
**Audited:** 2026-04-27 by Claude (after a deep CW walkthrough in the same session)

---

## Verdict

**Don't import. Don't merge. Don't run alongside the portal.** Cherry-pick a few schema ideas and a couple of UI structure cues, then move on.

The repo is a half-built CW clone on the wrong stack and the wrong backend, and it stopped at user management. Trying to integrate it would cost more than starting clean inside the portal.

---

## Why we don't import

| Issue | Impact |
|---|---|
| **Vite + react-router-dom** frontend | Our portal is **Next.js**. Different framework, different routing, different build. No drop-in compatibility. |
| **API at `coastalclaims.api.allurt.co`** (custom axios layer) | Our portal uses **Supabase** directly. The whole `src/lib/api.ts` is wired to a third-party endpoint we don't control and probably doesn't exist anymore. |
| **Supabase migrations exist but aren't wired up** | `supabase/` folder has 6 migrations but `@supabase/supabase-js` isn't even in `package.json`. The schema was sketched, never connected. |
| **RLS policies are non-functional** | Every policy is `USING (true)` — wide open. Zero access scoping. Has to be redone from scratch. |
| **Coverage is shallow** | 7 tables: `claims`, `claim_watchers`, `claim_updates`, `claim_files`, `claim_action_items`, `notes`, `time_entries`, `save_points`. Missing: clients, properties, companies, personnel, insurer/policy, demands, payments/disbursements/expenses, mortgages, phase history, share tokens, email archive. |
| **5 commits, then abandoned** | Last commit "feat(crm): implement user management" — got to the front door and stopped. |

---

## What's worth cherry-picking

### Schema ideas (small but useful)

- **`notes.is_pinned` + `notes.is_private`** flags — better than CW which treats notes as a flat journal. Worth keeping when we model claim notes in the portal.
- **`claim_updates.is_public`** flag — matches CW's "Activity Log (Public Only)" filter in Doc Builder. We need this.
- **`claim_updates.is_billable` + `billable_resource`** — billing-aware activity log. Useful if we want to derive billable vs non-billable hours from the log without a separate table.
- **`time_entries.billed_on` + `paid_on`** timestamps — track when time was invoiced and when it was paid. Cleaner than just an `is_billed` boolean.
- **`save_points` (jsonb snapshot of claim data, named, per-user)** — interesting concept not in CW. Lets a user freeze the claim state before a major change. Low priority but nice-to-have for audit/rollback scenarios.

### UI patterns to study (read, don't copy)

The repo has React component scaffolds matching every CW screen:
- `ClaimDashboard.tsx`, `ClaimSummary.tsx`, `ClaimMenu.tsx`
- `Notes.tsx`, `ActionItems.tsx`, `ActivityItem.tsx`, `TimeTracking.tsx`
- `FileManager.tsx`, `DemandsAndOffers.tsx`, `Ledger.tsx`
- `InsurerAndPolicy.tsx`, `LegalNotes.tsx`
- `AddCompanyModal.tsx`, `AddPersonnelModal.tsx`, `AddInsurerPersonnelModal.tsx`, `AddMortgageModal.tsx`
- `DocumentBuilder.tsx`, `TemplateModal.tsx`, `PrintSettlementModal.tsx`
- `Sidebar.tsx`, `TopBar.tsx`, `Layout.tsx`
- `UserPermissionsModal.tsx`, `WatchModal.tsx`, `UpdateClaimModal.tsx`

Useful as a "list of components we'll need to build for the CRM module." Not useful as code — we'd have to rewrite for Next.js + our token system + Supabase.

### Page/route inventory (confirms surface area)

Pages in the repo: Dashboard, Claims, Clients, Companies, Staff, Calendar, Reports, Diary, Board, Admin, ClaimDashboard. Roughly mirrors CW's left-rail global nav. Confirms the views we'll need top-level URLs for inside the portal CRM module.

---

## What we explicitly throw away

- The entire `src/lib/api.ts` axios layer (wired to a defunct API)
- The auth flow (we use Supabase Auth, not the allurt.co `/auth/login` endpoint)
- `ThemeContext.tsx` (we have a 2-style × 3-mode theme system already in `globals.css`)
- All RLS policies in the migrations (rewrite from scratch with real assignment scoping)
- The Vite/router scaffolding
- Mock data in `src/data/mock.ts`

---

## Recommendation

Treat `coastal-claims-crm` as an **archive reference** — git remote it stays where it is, we don't touch it, but we may grep through it occasionally to remember a pattern or check what tables were sketched.

The CRM module gets built **inside the portal** (`myProjects/norkendol-employee-portal/src/app/dashboard/crm/...`), reusing the portal's existing auth, theme, Supabase client, and TPN data, with a fresh data model informed by:
1. CW's actual workflow (mapped in `CW-LEARNINGS.md`)
2. Frank's correction list ("no longer has visible access" toggle, auto-footprint on claim view, send-to-homeowner upload, file share tokens, etc.)
3. The few good schema sketches above

No code from the old repo gets copy/pasted in. We learn from it and move on.

---

## How this fits with the current portal

**The portal has substantially exceeded what the old repo attempted.** Settlement Tracker alone (with 4 sub-tracks — Litigation, Mediation, Appraisal, PA Settlements) has more depth than the old CRM repo's entire schema. PA Settlements has a real money model (`pa_settlements` + `pa_settlement_payments` + `pa_settlement_updates`) that the old repo never reached. TPN has 6 phases of migrations covering external partners. Onboarder KPI has stage actions, status history, and activity logging. Estimator KPI has revisions and KPI snapshots. Claim Health, Claim Calculator, Compliance, AI agents, Executive Intelligence — all live and shipping.

The CRM module is the **per-claim canonical view that ties these spokes together**, plus the things that have no natural home in any existing module (Notes, Files, Personnel, Action Items, unified Activity Log, Email Archive, claim-level disbursement ledger). See `CRM-PLAN.md` for the actual hub-and-spoke architecture and build phases.
