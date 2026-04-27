# ClaimWizard Walkthrough — Distilled Learnings

**Session:** 2026-04-27 evening
**Source:** Live walk-through of CW with Frank, claim MD-2025120011 (Wetzel)
**Purpose:** Capture what we want to keep, fix, or discard before designing the portal CRM module.

---

## How CW is structured (top-level)

### Global left rail
Home, Clients, Claims, Companies, Staff, Schedule, Reports, The Library, Admin. Roughly two-thirds of this is already covered by the existing portal modules (Onboarder KPI, Estimator KPI, Settlement Tracker, TPN, University, etc.). The missing third is the per-claim CRM view.

### Per-claim view (the secondary sidebar — what's missing in our portal)
A claim opens into a tab with a permanent secondary sidebar listing the per-claim sections:

`Claim Summary, Files, Notes, Company Personnel, Demands and Offers, Action Items, Schedule, Activity Log & Message Archive, Insurer & Policy, Mortgages and Liens, Matterport, Time Tracking, Legal Details, Claim Ledger`

This is the **only** module in the portal where the secondary sidebar must be permanent. Already documented in `DESIGN-RULES.md` — confirmed live.

### Action toolbar (above the secondary sidebar)
Menu, Watch, Update Claim, Hide Client, Edit Client, Edit Property, Timely, Focus, Templates, POL Builder, Doc Builder, Diary, Refresh, Options.

### Right rail ("Timely Quick View")
Claim summary + Upcoming Deadlines + Upcoming Appointments + Upcoming Action Items. Always visible. A scoped sidebar showing the same claim's "what needs my attention" data without leaving the current section.

---

## Patterns we KEEP

### File numbering
**State + year + month + sequence.** `MD-2025120011` = Maryland, December 2025, sequence 0011. State prefix is the loss state. We already do this in the portal — confirmed correct.

### Per-claim auto-email + archive
Every claim auto-generates an email address (`ccsvcs-MD-2025120011@claimmail.net`). Outbound emails CC that address; inbound to it auto-archives onto the claim. Activity Log has an **E-mail toggle** that swaps the activity feed for the email archive. Two-pane email viewer (list + body), 27 emails on this claim. **Critical feature — must build.**

### Hierarchy: Client → Property → Claim
A single Client can own multiple Properties. A single Property can have multiple Claims (different perils, different loss dates). The claim record references the property; the property references the client. Our schema needs this.

### Action items are role-templated, not person-assigned
Tasks like "06. Negotiation" are assigned to a **role** ("Adjuster, Apprentice"), not a specific person. The system targets whoever holds those roles on **this** claim. Completion records the actual person + date.

Numbered/phase-ordered checklist (`00A`, `00B`, `01`, `02A`, `02D`, `03`, `04`, `05B`, `05U`, `06`, `07A`) — each phase has a script of action items that fire when the claim enters that phase.

### Two kinds of role
- **Per-claim role** — Lee=Adjuster on claim X. Tied to a specific claim's personnel.
- **Departmental role** — Onboarding, Scheduling, Processing, Collections, Finance. A team of people who handle their kind of action items across all claims.

Action items can target either kind. **The portal CRM needs both concepts in the data model.**

### Claim Ledger structure
Four sub-tabs: **Payments** (carrier → us), **Expenses** (costs we incurred), **Disbursements** (us → client/contractor/staff), **Notes**. Plus a header showing Total Payments / Outstanding on Claim / Outstanding Expenses / Waiting Disbursement / Accepted Settlements. Clean financial summary. Keep this layout.

### Demands → Checks rule
**Demands must exist before checks can be recorded.** For early payments before a formal demand, create a placeholder demand of category "Other" first. Hard rule.

### Document generation in two flavors
1. **Templates** (generic) — flat list of named Word/PDF templates (~25+ in the modal we saw: AR Collections, Appraisal Engagement, ALE Agreement, etc.). User picks one, system fills `[[ ]]` template fields with claim data.
2. **POL Builder** (structured wizard) — multi-step: Name → Format Options → Select Demands (auto-pulls from Demands & Offers) → Preview Amounts. Specific to Proofs of Loss.

We need both. Templates is the everyday tool; POL Builder is the structured form.

### Doc Builder (full claim print)
Modal with checkboxes for every claim section. Generates a single comprehensive PDF combining selected sections. Used when sending the entire claim file to carrier/attorney/client. Notable: there's an **"Activity Log (All Entries)" vs "Activity Log (Public Only)"** option — confirms there's a public/private flag on every activity entry.

### Section-level group permissions
**Legal Details** has the banner: *"This section is a protected area for legal-related notes. Access permission to this area may be controlled from within the 'Group Permissions' options in the Administration controls."*

So claim-level access alone doesn't get you everything — certain sections (Legal Details, maybe others) require an additional group permission. The portal CRM needs a section-permission layer on top of claim-level access.

### Focus mode
Toggle that collapses the secondary sidebar to icons-only for more horizontal real estate. Already in `DESIGN-RULES.md` (sidebar collapse pattern). Confirmed live.

### File share via tokenized link (per file or per file set)
Files panel: select files via checkboxes → Share → modal generates `claimwizard.com/fv/[token]` URL, default 30-day expiration, optional email-to + message. Recipient opens the link with no login needed. **This is how external partners get document-only access without needing a portal account.**

### Get Share Link (claim-level)
Menu dropdown → "Get Share Link." Same pattern as file share but for the whole claim view (likely). Lets you grant external read-only access via a token URL.

---

## Patterns we FIX

### 1. Conflated "Assigned" badge
**CW shows `Assigned: Eileen Mary Dalton; Lee Samuel Pratt` at the top of the claim.** Eileen is the Estimator who finished her work weeks ago. Lee is the active Adjuster. They shouldn't be lumped together — Eileen has access (because her Estimator row is on Company Personnel) but she's not driving the claim.

**Fix:** "Assigned" badge in our CRM = the active Adjuster only (the person currently driving the claim). Everyone else with access stays on the Company Personnel list and is reachable via that block, but doesn't clutter the header badge.

### 2. "No longer has visible access" toggle on Company Personnel rows
**CW does not have this — Frank has been asking the CW vendor for it for years.** When an Estimator finishes the estimate, their dashboard should not keep showing the claim. They've done their job.

**Fix:** Each Company Personnel row gets a per-row toggle: **`Has Visible Access`** (default ON) vs **`No Longer Has Visible Access`**. Person stays on the personnel list (audit trail, fee record, historical) but the claim drops off their dashboard / notifications / action items when toggled OFF.

This is a **2-state visibility flag separate from the personnel attachment itself.** The flag is per-claim-per-person.

### 3. Close-prompt → auto-footprint
**CW prompts "leave a note?" with yes/no/cancel every time you close a claim tab.** Frank has wanted this changed for years. The intent was to automatically log "X viewed the claim from [enter] to [exit]" without interrupting the user.

**Fix:** Auto-footprint on claim view enter/exit. Push a row to time tracking and the activity log automatically: `"X viewed claim from 2:31pm to 2:48pm"`. **No prompt.** Optional note field somewhere unobtrusive (e.g., a small icon in the toolbar) — non-blocking.

### 4. Send-to-homeowner upload links
**CW makes staff manually enter mortgage info, policy details, etc. — by phone or email chase.** Frank estimates this costs hundreds of hours/year of admin time.

**Fix:** "Send Upload Link" pattern. Generates a tokenized URL → emailed to the homeowner → they upload mortgage doc / policy doc / signed contract / loss photos directly. File lands on the claim in the right folder. Same auto-expiration pattern as file shares.

This is essentially a **claim-scoped guest endpoint with per-link permissions** (e.g., "this link uploads to mortgages-and-liens only"). Pattern extends to any homeowner-touched data we'd otherwise chase.

### 5. RLS / access scoping
**The `coastal-claims-crm` repo and CW both have weak access scoping.** CW relies on opaque "Group Permissions" admin and Frank's anecdotal "Adjusters only see assigned claims." The old repo has `USING (true)` everywhere.

**Fix:** Real RLS based on a `claim_personnel` join table. Non-admin users see claims where they're on the personnel list AND their visibility flag is ON. Admin/super_admin/system_admin see everything. External partners see only the claims they're tokenized into.

---

## Patterns we DISCARD

- **"Single browser tab" rule with broken back/forward navigation.** CW forces everything into one tab; back/forward break. We use Next.js with proper routing — multi-tab support, back/forward work fine.
- **Tab bar at top with one tab per opened claim.** Useful in CW because of the no-back rule. Not needed in our portal.
- **WordPress-era visual chrome.** Already discarded — our DESIGN-RULES.md is the spec.
- **Matterport integration** — keep it as a "future integration" note. Not high priority unless Frank uses Matterport heavily today.
- **`Update Claim` as a separate modal vs inline editing.** Our portal already handles inline edits well; don't reproduce CW's modal-everything pattern.

---

## Open architectural questions (for the access-model conversation)

These were surfacing during the walkthrough. Not yet decided:

1. **Litigation file assignment.** `litigation_files` has no internal-staff `assigned_user_id` column today. Add one? Or inherit assignment from the parent onboarding record / parent claim? Probably inherit — a litigation file is an extension of the claim it belongs to.
2. **Departmental "team" membership** — how does Joe Mayday end up "on the Onboarding team"? A `team_memberships` table? Or a `users.team` enum? Or both (primary team + secondary team flags)?
3. **Action item routing rules** — when phase changes, the system needs to know which action items to spawn. Rule engine? Hardcoded per-phase template tables? CW has these baked in; we'd need to either replicate or make them admin-configurable.
4. **Section-level group permissions** (Legal Details case) — table-driven (`section_permissions(claim_id, section_name, group_id)`)? Or coarser (`legal_groups` table that lists who can see legal sections org-wide)?
5. **Tokenized share TTL defaults** — 30 days like CW, or configurable per share? Probably configurable but with a 30-day default.
6. **The "footprint on view" data model** — is auto-footprint a `time_entry` row (consumes the time tracking table) or a `claim_activity_log` row with a special type? Probably the latter (activity log) so we don't pollute time tracking with non-billable footprints, but track time spent in the activity log entry itself.

These get resolved in `CRM-PLAN.md` and the access-model conversation.

---

## Components that exist in the portal already and DON'T need rebuilding

When the CRM module is built, these existing portal modules already cover their CW counterparts:
- **Onboarder KPI** ↔ CW Clients view (intake stage)
- **Estimator KPI** ↔ CW per-claim Estimator workflow (the estimator does their thing here)
- **Settlement Tracker** (Litigation, Mediation, Appraisal, PA Settlements) ↔ specialized resolution workflows (CW lumps these into "Legal Details" and ad-hoc)
- **Talent Partner Network** ↔ CW Companies + external partner sections
- **University** ↔ CW The Library (training)
- **Claim Health, Claim Calculator, Compliance** ↔ specialized panels

**The CRM module fills in the per-claim canonical view that ties them all together** — the thing that's missing today.
