# TPN Rebuild Plan — Norkendol Employee Portal

## Context
The old TPN was a standalone Lovable/Vite app (shadcn, MongoDB, Axios, react-simple-maps) that got copy-pasted into the CCS portal and never fully integrated. We're rebuilding it as a native section of the Norkendol portal — same auth, same Supabase, same styling, same role system. This is furniture that goes in the house, not a separate house.

Two reference repos:
- `Coastal-Claims-Services/talent-partner-network` (standalone app, cleaner structure)
- `Coastal-Claims-Services/coastalclaims-employee-portal` (embedded version in old portal)

### The Problem We're Solving
The old TPN was a standalone Vite app (Lovable) with its own dependencies (shadcn, MongoDB, Axios, react-simple-maps). It got copy-pasted into the CCS portal and never fully integrated. We're rebuilding it as a native section of the Norkendol portal — same auth, same Supabase, same styling, same role system.

### Core Model: Internal vs External Users

The TPN is fundamentally about two kinds of people:

**Internal users = your entire team.** Every person in the directory is in the TPN. Not a filtered subset — literally everyone. If someone has no licenses yet, they still appear with a "No licenses on file" badge. Licenses are what make them searchable by state — no license means they won't appear in state-filtered results, but they're always visible when no state filter is active.

**External users = anyone outside your org you work with.** These are PEOPLE, not companies. A solo attorney. An independent appraiser. A drywall contractor. An HVAC tech. An umpire. They might work for a firm, or they might be solo. The firm is optional — just a grouping container.

**External user record — 6 fields only:**
1. Name
2. Email
3. Phone
4. What they do — predefined dropdown: Attorney, Appraiser, Engineer, HVAC, Plumber, Electrician, Roofer, Restoration, Drywall, General Contractor, Other (free text on Other)
5. What states they cover
6. Company name (optional, free text — not required to be in the firms table)

That's it. One simple form. No wizard. No onboarding flow.

**The firm relationship is optional and additive:**
- External users exist independently. They never need a firm to be valid.
- If five external users all work for Jeff's AC, you can later create a firm called "Jeff's Air Conditioning" and attach them via `firm_id`.
- But they exist as individual people first. The firm is just a grouping container — it never replaces the person record.
- When a firm IS created, searching by firm name shows everyone attached to that firm. But you can always search by individual name regardless of firm.
- `firm_id` on external users stays nullable. The `firms` table stays as-is.
- **Firms are a sub-filter inside the External tab, NOT a top-level tab.** Select "Jeff's Air Conditioning" from the firm filter chip and the list narrows to Jeff's people. No separate firms tab needed.

### Tab Structure

Three content tabs + analytics: **Overview | Internal | External | Analytics**

- "Team Members" → renamed to **Internal**
- "Firms" → removed as top-level tab. Firms live as a filter chip inside **External**

### Filter Behavior — Simple, Client-Side

**No complex search engine.** Load data once on page load, then all filtering happens in-memory on the loaded dataset. No API call on each filter change.

- Show everyone by default when you land on a tab
- Each filter chip narrows the visible list:
  - Select "Attorney" → removes everyone who isn't an attorney
  - Select "Texas" → removes everyone not in Texas
  - Select both → shows only attorneys in Texas
  - Hit clear → everyone comes back
- **Soft cap: 200 records loaded per tab.** "Load more" button at the bottom if there are more. Won't matter for a while but good to have as a safety valve.
- **Filters are independent per tab.** Florida selected on Internal stays when you switch to External, but each tab maintains its own filter state.

### Card Layouts

**Internal card:** Name, position, department, location, availability badge, license summary (active/expiring/expired counts), license state badges. Click → user management.

**External card:** Name, specialty badge (big, prominent), states they cover (small badges), company name if any, email, phone. That's it.

### What We Extract From the Old Repos
**From `Coastal-Claims-Services/talent-partner-network` (standalone) and the portal's embedded version:**
- The UI layout patterns (hub view, card grids, filter bar, metric cards)
- The data shapes (what fields matter for licenses, states)
- The business logic (multi-state filtering, license expiration math)
- The analytics dashboard structure

**What we DO NOT bring:**
- No shadcn components (Dialog, Tabs, Select, Card, Badge, Button, etc.)
- No Lucide icons (we use inline SVG paths like the rest of the portal)
- No MongoDB models or Mongoose schemas
- No Axios/Express API layer
- No react-simple-maps dependency
- No Lovable project references
- No CCS-specific terminology
- No registration wizard or multi-step onboarding flow

### How It Fits Into the Portal

The TPN is NOT a standalone feature. It depends on and feeds into other portal systems:

**TPN consumes from:**
- `users` table — ALL internal users (the entire directory), not a filtered subset
- `licenses` table — already exists, already tied to users — this is what makes search-by-state work
- `external_contacts` table (NEW) — external people with specialty, states, optional firm_id
- `firms` table — optional grouping container for external users
- `firm_services` — tracks what firms do
- Auth/roles — `ep_user`, `ep_admin`, `admin`, `super_admin` all have different views

**TPN feeds into:**
- **Compliance tab** — state coverage data from TPN shows who's licensed where
- **User Management** — clicking an internal user goes to their user record
- **CRM** (future) — external contacts and firms get assigned work
- **Directory** — the directory IS the internal side of the TPN

**This means:** No new auth, no new user model for internal people. Internal = directory. External = simple contact records with 6 fields. Firms are optional grouping on top.

## Build Phases

### Phase 1: Save reference material to disk ✅ DONE
- Clone `Coastal-Claims-Services/talent-partner-network` to `myProjects/` as read-only reference
- Save `External_Partner_Onboarding_Flow.md` to the Norkendol project's `.planning/` folder
- Write this plan to `.planning/TPN-REBUILD-PLAN.md`

### Phase 2: Schema completion (migration) ✅ DONE (partial — needs external_contacts)
- ✅ ALTER `firms`: add `website`, `entity_type`, `year_established`, `city`, `state`, `rating`
- ✅ ALTER `users`: add `availability` (available/busy/unavailable)
- ✅ CREATE `firm_documents` (id, firm_id, org_id, file_name, file_url, uploaded_by, uploaded_at)
- ✅ RLS policies for all new columns/tables
- ⬜ CREATE `external_contacts` — see Phase 2b below

### Phase 2b: External contacts schema (NEW)
- CREATE `external_contacts` table:
  - `id` uuid PK
  - `org_id` uuid NOT NULL
  - `name` text NOT NULL
  - `email` text
  - `phone` text
  - `specialty` text NOT NULL — predefined: Attorney, Appraiser, Engineer, HVAC, Plumber, Electrician, Roofer, Restoration, Drywall, General Contractor, Other
  - `specialty_other` text — free text, only used when specialty = "Other"
  - `states` text[] (what states they cover)
  - `company_name` text (optional free text — NOT a FK to firms)
  - `firm_id` uuid REFERENCES firms(id) — nullable, optional grouping
  - `status` text DEFAULT 'active' (active/inactive)
  - `created_at` timestamptz DEFAULT now()
  - `created_by` uuid REFERENCES users(id)
- RLS: org-scoped read, admin write

### Phase 3: Hub page — Internal/External model with client-side filtering
- ⬜ 4 tabs: Overview, Internal, External, Analytics
- ⬜ Overview: 6 metric cards (internal count, external count, states covered, available now, pending, license alerts)
- ⬜ Internal tab: load ALL directory users + their licenses in one fetch. Client-side filter chips: state (from license data), availability, search text. Soft cap 200 with "load more". Cards: name, position, department, location, availability badge, license state badges, license summary. Click → user management. No talent_network filter — everyone in the directory shows.
- ⬜ External tab: load external_contacts in one fetch. Client-side filter chips: specialty, state, firm (as sub-filter), search text. Soft cap 200 with "load more". Cards: name, specialty badge (big), states (small badges), company name, email, phone. "Add External Contact" button with 6-field form.
- ⬜ Analytics tab: license breakdown, geographic coverage grid, specialty breakdown, availability stats. All computed from already-loaded data.
- ⬜ Filter behavior: show everyone by default. Each chip narrows the list. Clear resets. All in-memory after initial load. Filters independent per tab.

### Phase 4: External contact CRUD
- "Add External Contact" form — 6 fields:
  1. Name (required)
  2. Email
  3. Phone
  4. Specialty (dropdown: Attorney, Appraiser, Engineer, HVAC, Plumber, Electrician, Roofer, Restoration, Drywall, General Contractor, Other) — required. If Other, show free text field.
  5. States they cover (multi-select state picker)
  6. Company name (optional free text)
- Edit existing contacts (same form, pre-filled)
- Deactivate (soft delete via status = 'inactive')
- Admin-only for add/edit/deactivate

### Phase 5: Firm management (inside External tab)
- Firm filter chip in External tab — select a firm name, list narrows to that firm's people
- Admin can create/edit/deactivate firms
- "Attach to Firm" — select existing external contacts, set their firm_id
- Firm detail: name, contact info, services, states, list of attached people
- Firms are a grouping tool, not a standalone view

### Phase 6: Admin features (lives at `/dashboard/tpn-admin`)
- Pending external contacts (if admin approval flow is wanted)
- Bulk operations (attach multiple contacts to a firm, update states)
- Status management

### Phase 7: Analytics tab (deep)
- License status overview (active/expiring/expired from real license data)
- Geographic coverage grid: which states have internal people licensed + which states external contacts cover
- Specialty breakdown: how many attorneys, appraisers, HVAC, etc.
- Availability (internal team: available/busy/unavailable)
- All computed from live Supabase data, not mock numbers

## Session Strategy (context window management)
- Each session tackles ONE phase
- Read old repo files one at a time as needed, not all 6 at once
- Reference the plan file at session start instead of re-deriving everything

## Dependencies to Note
- Phase 5 (external users) needs `external_contacts` table from Phase 2b first
- Phase 6 (firms as containers) needs external contacts to exist so you can attach people to firms
- Firm documents will eventually need Supabase Storage for uploads
- Analytics (Phase 8) is last because it needs real data flowing through Phases 4-6 first

## Key Files
- **Current TPN page:** `src/app/dashboard/talent-partner-network/page.tsx`
- **TPN Admin placeholder:** `src/app/dashboard/tpn-admin/page.tsx`
- **Sidebar nav:** `src/components/IconSidebar.tsx` (TPN already in Tier 1A)
- **Text sidebar:** `src/components/TextSidebar.tsx`
- **Supabase client:** `src/lib/supabase.ts`
- **Pattern reference (action items):** `src/app/dashboard/action-items/page.tsx`
- **Pattern reference (compliance):** `src/app/dashboard/compliance/page.tsx`

## Existing Schema
- `firms` table: `status`, `updated_at`, `website`, `entity_type`, `year_established`, `city`, `state`, `rating`
- `firm_services` table: created with RLS
- `firm_documents` table: created with RLS
- `users` table: added `availability` column
- `external_contacts` table: NOT YET CREATED — needed for Phase 2b
- RLS policies on all tables (org-scoped read, admin write)
- Migrations committed: `talent_partner_network_schema`, `tpn_phase2_schema_completion`

## Verification
After each phase:
1. `npx next build` — must pass clean
2. Visual check at `http://localhost:3002/dashboard/talent-partner-network`
3. Git commit with descriptive message
4. Push to staging branch

## Current Status
- Phase 1: ✅ Done
- Phase 2: ✅ Done (firms + users schema)
- Phase 2b: ⬜ Next — create `external_contacts` table
- Phase 3: ⬜ Next — rewrite hub page with Internal/External tabs + client-side filtering
- Phases 4-7: Not started
