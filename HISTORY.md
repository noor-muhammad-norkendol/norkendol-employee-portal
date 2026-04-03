# Norkendol Employee Portal — Full History

Everything that's ever been done on this project. Nothing gets deleted from this file.

---

## Session 1 — April 2, 2026

### Context & Decisions

**What is this project?**
A white-label employee portal built by Norkendol (Frank Dalton's dev company). Not branded to any specific company — sold to other businesses as a product. CCS (Coastal Claims Services) will use it but it's not a CCS product.

**Team:**
- Frank Dalton — CEO, product/UX direction
- Noor Mohammed — CTO, head of dev (GitHub: NoorMuhammad1, org: noor-muhammad-norkendol)
- Talha — OUT, no longer involved
- Muhammad-AnasKhan — was a low-end dev Talha hired. Not Noor. Gone with Talha.

**Old portal studied (not copied):**
- Repo: `Coastal-Claims-Services/coastalclaims-employee-portal`
- React + Express + MongoDB + some Supabase + S3
- Built from Lovable with ~1 week coding experience
- 40 Mongoose models, 36 route files, real-time chat, role-based access
- Problems: mixed DBs, duplicate API layers, incomplete CRM backend, hardcoded compliance rules, no email service, security gaps
- Used as reference for user flows and feature set only

**Login logic doc reviewed:**
- Frank's "CCS Portal — Login Logic & Assigned Roles" document
- Defined auth flow, permission checkboxes (3 groups: CRM Features, Portal Apps, Admin Features), internal vs external users, firm-based data filtering
- Adapted for white-label: stripped CCS branding, generalized roles

### Architecture Decisions (LOCKED IN)

**Role Hierarchy — 6 tiers:**

| Tier | Role | Scope |
|------|------|-------|
| 5 | System Administrator | Norkendol — all tenants. Invisible to customers. |
| 4 | Super Admin | Customer's top dog — their whole org. |
| 3 | Admin | Middle layer — team leads, dept heads. |
| 2 | User | Internal employee — sees what they're given. |
| 1b | External Partner Admin | Firm boss — all their firm's data across all cases. |
| 1a | External Partner User | Firm employee — only assigned items. |

- External partners are a mini-tenant within a tenant
- The customer (Super Admin/Admin) doesn't manage the firm's internal users — the EP Admin handles that
- System Administrator is invisible to all customers

**App Suite Model — 2 layers:**
- Layer 1 (Norkendol/System Admin): Controls which apps a tenant has access to (subscription tier)
- Layer 2 (Super Admin/Admin): Toggles those available apps on/off per user within their org
- Build the full system but design so app toggling is just a switch

**Tech Stack:**
- Next.js 16 + TypeScript + Tailwind v4 + Supabase
- Port 3002
- Supabase project: `mmccqhxomkohjydukxnn` (empty, no tables yet)

**UI Direction:**
- Supabase dashboard style — dark mode default
- Thin icon sidebar (far left) with tooltips on hover
- Collapsible text sidebar (second panel) — always visible, arrow button to collapse/expand
- Top bar with date/time + user info (name, role, initials avatar)
- Light on the eyes for long coding sessions

**Codeword:**
- BINGO = green light to write code

### What Was Built

**Repo:** `noor-muhammad-norkendol/norkendol-employee-portal`
**Branch:** main
**Commit:** `6909af0`

Files created:
- `src/app/layout.tsx` — Root layout, dark mode, Geist fonts
- `src/app/page.tsx` — Redirects `/` to `/login`
- `src/app/login/page.tsx` — Dark login page with email/password card, green accent button
- `src/app/dashboard/page.tsx` — Dashboard page wrapped in PortalShell
- `src/app/globals.css` — CSS variables for dark theme, thin scrollbar styling
- `src/components/PortalShell.tsx` — Main layout: icon sidebar + text sidebar + top bar + content
- `src/components/IconSidebar.tsx` — 50px icon strip with N logo, 6 nav icons, tooltips on hover
- `src/components/TextSidebar.tsx` — 220px collapsible menu panel, grouped sections, collapse arrow
- `src/components/TopBar.tsx` — Date/time left, user name/role/avatar right

Sidebar sections defined (placeholder menus):
- Dashboard: Home, Activity, Notifications
- Users: All Users, Departments, Pending Approval, Partner Firms, Invitations
- Apps: App Directory, Installed Apps, App Settings
- Messages: Inbox, Sent, Drafts
- Documents: All Documents, Shared With Me, Upload
- Settings: Profile, Preferences, General, Roles & Permissions, Billing

### Bugs Fixed During Session
- Text sidebar flyout approach was wrong — reverted to permanent panel (Supabase uses permanent, not flyout)
- Icon hover was changing text sidebar content — removed, icons just show tooltips
- Collapse button disappeared when sidebar collapsed — fixed overflow:visible when collapsed
- Tooltip z-index — tooltips were hidden behind text sidebar, added z-50
- Text sidebar collapse to 0px killed the chevron — changed to 16px minimum so chevron stays visible
- Chevron inconsistency — text sidebar used text character, icon sidebar used SVG. Made both identical SVG arrows with matching size, position, z-index, hover behavior

### Iterations on Sidebar Design
Frank provided Supabase dashboard screenshots as reference. Key learnings:
1. Icon sidebar is NOT a flyout — it's permanent. Tooltips on hover, that's it.
2. Text sidebar is also permanent — not a flyout overlay.
3. Both bars need to be independently collapsible/expandable via matching chevrons.
4. When icon sidebar expands, it shows icon + label side by side (160px).
5. When text sidebar collapses, it leaves a thin strip so the re-expand chevron stays visible.
6. Chevrons must be visually identical across both bars — consistency matters.

### Commits
- `6909af0` — Initial scaffold (login, dashboard, dual sidebar, top bar)
- `77977ba` — Added HISTORY.md and HANDOFF.md
- `e7d7919` — Fixed tooltip z-index
- `972ab34` — Both sidebars fully collapsible with matching chevrons

### What's NOT Done Yet
- No auth wired up (login just navigates, no Supabase)
- No database schema
- Sidebar links don't navigate anywhere
- No real user data (hardcoded "Frank Dalton / Super Admin")
- No light mode toggle
- No responsive/mobile layout
