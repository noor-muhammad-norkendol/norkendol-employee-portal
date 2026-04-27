# Norkendol Portal — Handoff for Next Session

**Last touched:** 2026-04-27 evening
**Where we are:** Done with planning. Ready to build CRM Phase 1.
**Why this file exists:** The previous session's context window hit ~400k tokens after a deep ClaimWizard walkthrough + 8 architectural decisions. Rather than continue stale, we wrote planning docs and parked here. Read this, read the three planning docs it references, then start coding Phase 1.

---

## What the previous session accomplished

1. **Painted PA Settlements Round 1** (header + tabs + main data grid) on `staging`. PACreateModal NOT touched — Round 2 was paused mid-stream.
2. **Walked through ClaimWizard end-to-end** with Frank narrating live in a Playwright session (logged in as `frank@coastalclaims.net`). Captured every section, toolbar button, modal, and access pattern.
3. **Audited the abandoned `coastal-claims-crm` repo.** Verdict: don't import. Wrong stack (Vite vs Next.js), wrong backend (allurt.co vs Supabase), shallow coverage, 5 commits then dead.
4. **Wrote three planning docs** in `.planning/`:
   - `CRM-PLAN.md` — master plan, hub-and-spoke architecture, 13 build phases, full decision log, all 8 open questions answered
   - `CW-LEARNINGS.md` — what to keep / fix / discard from CW
   - `OLD-REPO-AUDIT.md` — dead repo verdict
5. **Resolved 8 architecture questions through conversation.** All logged with rationale in `CRM-PLAN.md`.

---

## How to resume — exact prompt

Paste this into the next Claude session:

```
Resuming Norkendol Portal CRM build. Read these IN ORDER, then start Phase 1:

1. C:\Users\FrankDalton\CLAUDE.md (auto-loaded)
2. myProjects/norkendol-employee-portal/.planning/HANDOFF-NEXT-SESSION.md (this file)
3. myProjects/norkendol-employee-portal/.planning/CRM-PLAN.md
4. myProjects/norkendol-employee-portal/.planning/CW-LEARNINGS.md
5. myProjects/norkendol-employee-portal/.planning/OLD-REPO-AUDIT.md
6. myProjects/norkendol-employee-portal/HANDOFF.md (Supabase warning)

After reading, do NOT re-plan. Start executing Phase 1 of CRM-PLAN.md —
migrations only, no UI yet. BINGO each migration file with me before applying.
Branch off `staging`. Norkendol Supabase project is hkscsovtejeedjebytsv (NOT
the lookalike mmccqhxomkohjydukxnn).

First task: draft migration for the canonical `claims` table.
```

---

## Phase 1 first move

**Step 1:** Draft the migration for the canonical `claims` table. From `CRM-PLAN.md` Phase 1 outline:

1. Create `claims` table — canonical per-claim record
2. Create `claim_personnel` (m2m: `claim_id × user_id × role × fee_pct × has_visible_access × added_at × added_by`)
3. Departmental access — for v1, keep using existing `users.department` single string (decision logged); defer multi-department
4. Backfill: every existing `litigation_files` row gets a corresponding `claims` row; same for `onboarding_clients` where status=completed; same for `estimates`, `claim_health_records`
5. Add `claim_id` foreign keys on existing tables (nullable initially; non-null after backfill)
6. Update `useClaimLookup` to respect scope (`scope: 'mine' | 'global'` param)
7. Rewrite RLS policies on every table to enforce scope (replace `USING (true)` with real predicates)
8. Update existing hooks to align with the new model
9. Test plan before any deploy

Migrations go in `supabase/migrations/` with a `20260428_*.sql` date prefix (or whatever the actual date is when next session opens).

Step 1 alone is roughly one session of careful work. Frank wants migrations BINGO'd one at a time before they run. Don't batch-write all of Phase 1 in one shot.

---

## Do NOT do in the next session (avoid scope creep)

- Do **NOT** start building UI for the CRM yet — Phase 1 is database only
- Do **NOT** touch Litigation / Mediation / Appraisal sub-track paint work — paused intentionally (will be partly restructured by CRM Phase 7-12)
- Do **NOT** finish PA Settlements Rounds 2/3/4 yet — they can run in parallel with Phase 1, but Phase 1 takes priority since that's the keystone
- Do **NOT** re-plan or re-discuss the access model — every question is locked in `CRM-PLAN.md` decision log. If something feels unanswered, the answer is probably already there — search before asking Frank.
- Do **NOT** import code from `coastal-claims-crm` repo — verdict in `OLD-REPO-AUDIT.md` says no

---

## Critical context Claude should already know via memory

These are saved in MEMORY.md and load automatically:
- **CCS works with thousands of external partners** — design TPN/permissions for thousands, not the dev set
- **Norkendol Supabase project: `hkscsovtejeedjebytsv`** (CCS org). Lookalike `mmccqhxomkohjydukxnn` in noor's org will mislead — never swap `.env.local`
- **Norkendol Portal redesign:** 2 styles × 3 modes, sidebar architecture in `DESIGN-RULES.md`
- **Whole-system thinking**, not isolated feature building (Frank's standing rule)
- **BINGO required** before any code change in Builder mode

---

## Frank's frustration at end of session — don't repeat it

The previous session leaned too heavily on planning and re-asking architecture questions. Frank pushed back: *"when are you going to grow a set of balls and we're going to build this thing."* Fair. The docs are done. Open code, not more questions. If you find yourself asking Frank to re-confirm a decision he already made today, search `CRM-PLAN.md` decision log first.

---

## When to delete this file

Delete `HANDOFF-NEXT-SESSION.md` once we're more than ~3 sessions into the CRM build and the resume rhythm is established. Until then it's the bridge that keeps cold-starts from re-discussing the same architecture.
