# TPN Rebuild Plan — Norkendol Employee Portal

## Context
The old TPN was a standalone Lovable/Vite app (shadcn, MongoDB, Axios, react-simple-maps) that got copy-pasted into the CCS portal and never fully integrated. We're rebuilding it as a native section of the Norkendol portal — same auth, same Supabase, same styling, same role system. This is furniture that goes in the house, not a separate house.

Two reference repos:
- `Coastal-Claims-Services/talent-partner-network` (standalone app, cleaner structure)
- `Coastal-Claims-Services/coastalclaims-employee-portal` (embedded version in old portal)

### The Problem We're Solving
The old TPN was a standalone Vite app (Lovable) with its own dependencies (shadcn, MongoDB, Axios, react-simple-maps). It got copy-pasted into the CCS portal and never fully integrated. We're rebuilding it as a native section of the Norkendol portal — same auth, same Supabase, same styling, same role system.

### Core Model: Two Tables, Two Purposes

There are two completely separate concepts for people outside your organization:

#### 1. `external_contacts` — The Rolodex
A contact record. Name, email, phone, specialty, states, company. **No portal access. No auth account.** You can have 500 attorneys in here and none of them can log in. This is what the **TPN External tab** displays.

- Any logged-in user can add a contact (adjusters add their own lawyers, contractors, etc.)
- No admin approval needed to create a contact — it's just a Rolodex entry
- Fields: name, email, phone, specialty (predefined dropdown), states they cover, company name (optional free text)
- Optional `firm_id` FK to `firms` table for grouping
- Optional `user_id` FK to `users` table — **null when they're a contact only, populated when they've been promoted to a portal account**

#### 2. `users` with `user_type = 'external'` — Portal Accounts
A real auth account with login credentials and granular permissions. Created **separately and only when that person actually needs to log into the portal.** An admin takes an existing external contact and "promotes" them — creates a `users` record, assigns permissions that control exactly what they can see (just the Legal KPI tracker, just their work portfolio, whatever you decide).

- Admin-only action to promote a contact to a portal user
- Uses the existing `user_permissions` table for granular access control (dashboard, CRM, compliance, etc.)
- Shows up in User Management → External Partners tab
- Goes through the standard pending → active approval flow
- The `external_contacts.user_id` gets set to link the contact record to the portal account

#### The Flow
1. **Add external contact** → they exist as a contact only in the Rolodex (TPN External tab)
2. **If and when they need portal access** → admin creates their portal account (users table) and assigns specific permissions
3. **They log in** → only see what you've given them access to
4. **The link stays** → `external_contacts.user_id` points to their `users` record, so you can always see who has portal access from the TPN view

### Internal Users = Your Entire Team
Every person in the directory is in the TPN. Not a filtered subset — literally everyone. If someone has no licenses yet, they still appear with a "No licenses on file" badge. Licenses are what make them searchable by state — no license means they won't appear in state-filtered results, but they're always visible when no state filter is active.

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

**External card:** Name, specialty badge (big, prominent), states they cover (small badges), company name if any, email, phone. If they have a portal account (`user_id` is set), show a small "Has Portal Access" indicator.

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
- `external_contacts` table — the Rolodex (contact records, no portal access)
- `firms` table — optional grouping container for external contacts
- `firm_services` — tracks what firms do
- Auth/roles — `ep_user`, `ep_admin`, `admin`, `super_admin` all have different views

**TPN feeds into:**
- **User Management** — clicking an internal user goes to their user record; promoting an external contact creates a portal account in User Management → External Partners
- **Compliance tab** — state coverage data from TPN shows who's licensed where
- **CRM** (future) — external contacts and firms get assigned work
- **Directory** — the directory IS the internal side of the TPN

**This means:** No new auth, no new user model for internal people. Internal = directory. External contacts = simple Rolodex records. Portal access for externals is a separate promotion step handled through User Management.

## Build Phases

### Phase 1: Save reference material to disk ✅ DONE
- Clone `Coastal-Claims-Services/talent-partner-network` to `myProjects/` as read-only reference
- Save `External_Partner_Onboarding_Flow.md` to the Norkendol project's `.planning/` folder
- Write this plan to `.planning/TPN-REBUILD-PLAN.md`

### Phase 2: Schema completion (migration) ✅ DONE
- ✅ ALTER `firms`: add `website`, `entity_type`, `year_established`, `city`, `state`, `rating`
- ✅ ALTER `users`: add `availability` (available/busy/unavailable)
- ✅ CREATE `firm_documents` (id, firm_id, org_id, file_name, file_url, uploaded_by, uploaded_at)
- ✅ RLS policies for all new columns/tables

### Phase 2b: External contacts schema ✅ DONE (needs migration update)
- ✅ CREATE `external_contacts` table (migration exists: `20260404_tpn_phase2b_external_contacts.sql`)
- ⬜ ALTER `external_contacts`: ADD `user_id` uuid REFERENCES users(id) ON DELETE SET NULL — nullable, links contact to portal account when promoted
- ⬜ ALTER `external_contacts`: ADD `created_by` uuid REFERENCES auth.users(id) — tracks who added the contact
- ⬜ UPDATE RLS: any authenticated org user can INSERT (not admin-only) — adjusters add their own contacts

### Phase 3: Hub page — Internal/External model with client-side filtering ✅ DONE (needs update)
- ✅ 4 tabs: Overview, Internal, External, Analytics
- ✅ Overview: 6 metric cards
- ✅ Internal tab: loads ALL directory users + licenses, client-side filtering, cards with click → user management
- ✅ External tab: loads external_contacts, filter chips (specialty, state, firm, search), cards with specialty badge
- ✅ Analytics tab: license breakdown, geographic coverage, specialty breakdown
- ✅ Invite link buttons on both tabs (available to all users, not admin-only)
- ⬜ "Add External User" button label (currently says "Add Contact" — rename)
- ⬜ External contact form creates records in `external_contacts` (Rolodex only — no auth, no portal access)
- ⬜ External card: show "Has Portal Access" indicator when `user_id` is set
- ⬜ Remove admin-only guard on add/edit — any user can manage contacts

### Phase 4: External contact CRUD (update for new model)
- "Add External User" form — 6 fields (available to ALL logged-in users, not admin-only):
  1. Name (required)
  2. Email
  3. Phone
  4. Specialty (dropdown: Attorney, Appraiser, Engineer, HVAC, Plumber, Electrician, Roofer, Restoration, Drywall, General Contractor, Other) — required. If Other, show free text field.
  5. States they cover (multi-select state picker)
  6. Company name (optional free text)
- Edit existing contacts (same form, pre-filled) — any user can edit
- Deactivate (soft delete via status = 'inactive') — admin-only
- This creates a **Rolodex entry only**. No portal access. No auth account.

### Phase 5: Promote to Portal Account (NEW — replaces old "Firm management" phase)
- Admin-only "Grant Portal Access" action on external contact cards
- Creates a `users` record with `user_type = 'external'`, `status = 'pending'`
- Pre-fills name/email from the external contact record
- Sets `external_contacts.user_id` to link the records
- Redirects to User Management to assign permissions (which sidebar items, CRM access, etc.)
- The contact stays in the TPN Rolodex AND now appears in User Management → External Partners
- Card shows "Has Portal Access" badge after promotion

### Phase 6: Firm management (inside External tab) ✅ DONE
- ✅ Firm filter chip in External tab — select a firm name, list narrows to that firm's people (also shows unlinked company names)
- ✅ Admin can create/edit/deactivate firms (full CRUD modal with name, type, location, contact info, website, states)
- ✅ "Attach to Firm" — firm picker dropdown in external contact add/edit form, sets firm_id + auto-fills company_name
- ✅ Firm detail modal — click firm name on any external card to see firm info + all attached contacts
- ✅ Deactivate firm unlinks all contacts from the firm first
- ✅ "+ New Firm" button in External tab header (admin-only)
- Firms are a grouping tool, not a standalone view

### Phase 7: TPN Admin features (lives at `/dashboard/tpn-admin`) ✅ DONE
- ✅ Bulk select: checkboxes on external cards, Select All / Deselect All
- ✅ Bulk Assign to Firm: select contacts → pick firm → all get linked + company_name set
- ✅ Bulk Update States: select contacts → pick states → add or replace mode
- ✅ Bulk Deactivate: select contacts → confirmation → all marked inactive
- ✅ Status filter: Active / Inactive / All toggle on External tab
- ✅ Reactivate button on inactive contact cards
- ✅ Activity Log tab: tracks added, edited, deactivated, reactivated, bulk operations with who/when/what
- ✅ `tpn_activity_log` table with RLS (migration: `20260404_tpn_phase7_activity_log.sql`)
- ✅ Firm picker in admin external contact form (same as TPN page)

### Phase 8: Analytics tab (deep) ✅ DONE
- ✅ License status overview (active/expiring/expired with progress bars)
- ✅ Team availability breakdown (available/busy/unavailable)
- ✅ Geographic coverage grid: color-coded state badges (internal/external/both/none) with tooltips
- ✅ Specialty breakdown: bar chart of all external contact specialties
- ✅ External Partner Status: portal access, email status, firm linkage stats
- ✅ Contacts by Firm breakdown with progress bars
- ✅ All computed from live Supabase data
- ✅ Both TPN page and TPN Admin page have matching deep analytics

## Session Strategy (context window management)
- Each session tackles ONE phase
- Read old repo files one at a time as needed, not all 6 at once
- Reference the plan file at session start instead of re-deriving everything

## Dependencies to Note
- Phase 4 (CRUD) needs the `user_id` column added to `external_contacts` first (Phase 2b update)
- Phase 5 (promote to portal) needs Phase 4 working first so contacts exist to promote
- Phase 6 (firms as containers) needs external contacts to exist so you can attach people
- Firm documents will eventually need Supabase Storage for uploads
- Analytics (Phase 8) is last because it needs real data flowing through Phases 4-6 first

## Key Files
- **Current TPN page:** `src/app/dashboard/talent-partner-network/page.tsx`
- **TPN Admin placeholder:** `src/app/dashboard/tpn-admin/page.tsx`
- **User Management:** `src/app/dashboard/user-management/page.tsx` (has Internal/External tabs, permissions editor)
- **Pending Users:** `src/app/dashboard/pending-users/page.tsx` (approve/reject flow)
- **Public Apply:** `src/app/apply/page.tsx` (internal user signup)
- **Sidebar nav:** `src/components/IconSidebar.tsx` (TPN already in Tier 1A)
- **Text sidebar:** `src/components/TextSidebar.tsx`
- **Supabase client:** `src/lib/supabase.ts`
- **Pattern reference (action items):** `src/app/dashboard/action-items/page.tsx`
- **Pattern reference (compliance):** `src/app/dashboard/compliance/page.tsx`

## Existing Schema
- `firms` table: `status`, `updated_at`, `website`, `entity_type`, `year_established`, `city`, `state`, `rating`
- `firm_services` table: created with RLS
- `firm_documents` table: created with RLS
- `users` table: has `availability`, `user_type` (internal/external), `status`, full permission system via `user_permissions`
- `user_permissions` table: granular toggle per user (dashboard, CRM, TPN, compliance, AI, etc.)
- `external_contacts` table: EXISTS but needs `user_id` FK column added
- RLS policies on all tables (org-scoped read, admin write — external_contacts RLS needs update to allow any user to insert)
- Migrations committed: `talent_partner_network_schema`, `tpn_phase2_schema_completion`, `tpn_phase2b_external_contacts`

## Existing User Management System (reference)
- **Roles:** user, ep_user (External Partner), ep_admin (Partner Admin), admin, super_admin, system_admin
- **User types:** internal, external — filtered by tabs in User Management
- **Approval flow:** users.status = pending → admin approves → active
- **Permissions:** `user_permissions` table with per-feature toggles (dashboard, teams_chat, calendar, university, directory, documents, AI, TPN, compliance, CRM, plus admin toggles)
- **Feature flags:** talent_network (shows in TPN listings), crm_assignable, crm_office_staff
- External partners get `ep_user` role by default, permissions control exactly which pages they see

## Verification
After each phase:
1. `npx next build` — must pass clean
2. Visual check at `http://localhost:3002/dashboard/talent-partner-network`
3. Git commit with descriptive message
4. Push to staging branch

## Current Status
- Phase 1: ✅ Done
- Phase 2: ✅ Done (firms + users schema)
- Phase 2b: ✅ Done (external_contacts table + user_id FK + RLS)
- Phase 3: ✅ Done (hub page with 4 tabs, filtering, cards)
- Phase 4: ✅ Done (external contact CRUD)
- Phase 5: ✅ Done (Grant Portal Access — invite-external-user API)
- Phase 6: ✅ Done (Firm management — CRUD, attach contacts, detail view, filter)
- Phase 7: ✅ Done (TPN Admin — bulk ops, status management, activity log)
- Phase 8: ✅ Done (deep analytics — both pages)
