CCS Portal
External Partner Onboarding Flow
Developer Reference Guide
Date: February 14, 2026
Author: Frank Dalton, CEO
Portal URL: portal.coastalclaims.net
Overview
This document describes the end-to-end flow for onboarding external partners (attorneys, contractors, or any third-party entity) into the CCS Employee Portal. External partners are granted selective access to specific portal applications through a checkbox-based permission system. The portal sidebar dynamically shows or hides menu items based on these permissions.
The key takeaway for the dev team: the permission system is already built into the portal. You do not need to invent a new permission system. The application (e.g., Legal KPIs) simply needs to know who is logged in and what firm they belong to, then filter data accordingly.
Step 1: Registration
Talent Partner Network
URL: portal.coastalclaims.net/talent
This is the front door for all external partners. Whether they are an attorney, a contractor, or any outside firm, they register through the Talent Partner Network. There are two ways an external partner can be added:
Self-Registration: The external partner uses a shared registration link (available via the “Share Partner Link” or “External Partner Registration” buttons on the Talent Partner Network page). They fill out their name, firm/company name, email, and license information.
Direct Add (Shortcut): A CCS admin can skip the registration step entirely and add the partner directly through User Management. This is the shortcut path.
Once registered, the partner is classified as a “Partner” resource within the Talent Partner Network. Their firm/company association is captured at this point.
Dev Note
Key Question for Taha: Where does “firm association” live? When a partner registers, is their firm/company name stored in the user profile object? The downstream app (Legal KPIs, etc.) needs to know “this user belongs to ABC Law Firm” or “this user belongs to XYZ Contracting” to filter data. Confirm this field exists in the user object or needs to be added.

Step 2: Approval
Pending Users → User Management
URL: portal.coastalclaims.net/admin/staff-management
After an external partner registers, they land in the Pending Users queue under the Manager section of the sidebar. A CCS manager must review and approve them before they gain any access.
Once approved, the partner appears in User Management under the External Partners tab. This is separate from the Staff tab which contains internal CCS employees.
The User Management page shows all users with their name, email, role, department, status, and action buttons for editing permissions or removing access.
Step 3: Permission Assignment
The Permissions Modal
When an admin clicks the edit (pencil) icon on any user in User Management, a permissions modal opens. This modal contains checkbox-based permission groups that control exactly what the user can see and do in the portal.
The three permission groups are:
Group
Count
Includes
CRM Features
7 options
Company CAM, Team Chat, Calendar, Documents, Financials, Reports, CRM Admin
Portal Apps
8 options
Talent Partner Network, Compliance, Legal KPIs, Scopepro, Claim Breakdown Calculator, Claims Health Matrix, Employee Directory, Training & Certifications
Admin Features
5 options
Staff Management, Department Management, Notification Management, App Management, User Permissions

For a typical external partner (attorney or contractor), the admin would only check “Legal KPIs” under Portal Apps. They would not receive any CRM Features or Admin Features. If additional access is needed later (e.g., Employee Directory), the admin simply checks that box too.
Step 4: External Partner Login Experience
What the Partner Sees
The portal sidebar is already smart enough to dynamically show or hide menu items based on the permission checkboxes. When an external partner logs in:
They never see the Manager or Super Admin sidebar sections.
Under the User section, they only see the items that have been checked in their permissions.
Within the Legal KPIs app, they see only their firm’s files — not all files across the system.
Internal CCS users (managers, admins) see all files across all firms.
Example — Legal KPIs only:
User
    └─ Legal KPIs

Example — Legal KPIs + Employee Directory:
User
    ├─ Legal KPIs
    └─ Employee Directory

What the App Needs to Do
The portal handles authentication, approval, and sidebar visibility. The individual app (Legal KPIs or any future portal app) only needs to handle data filtering. Here’s what the app should expect:
#
Requirement
Details
1
Expect a user object with role and firm fields
The logged-in user’s profile should include their role (internal vs. external) and their firm/company name. This comes from the portal backend (Taha’s responsibility).
2
If firm is present, filter to that firm’s files only
An external partner from ABC Law Firm should only see ABC Law Firm’s case files. An external partner from XYZ Contracting should only see XYZ’s files.
3
If firm is absent (internal user), show all files
Internal CCS staff (managers, adjusters, admins) should have visibility into all case files across all firms.

The actual plumbing of how the user object gets populated (JWT tokens, session data, etc.) is backend/portal work. The app just needs to be ready to receive and act on that data.
Responsibility Split
Portal / Backend (Taha)
App / Frontend (Dev Team)
User authentication (JWT)
Firm association in user profile
Permission checkbox system
Sidebar show/hide logic
Pending user approval flow
Read user object (role + firm)
Filter data by firm if external
Show all data if internal
Build app UI and functionality
Handle app-specific permissions

Portal Screenshots Reference
The accompanying diagram and the following screenshots were used to document this flow. They are available from Frank upon request:
Dashboard — portal.coastalclaims.net/dashboard/ (shows full sidebar with User, Manager, Super Admin sections)
Talent Partner Network — portal.coastalclaims.net/talent (registration entry point, state-by-state overview)
User Management — portal.coastalclaims.net/admin/staff-management (Staff and External Partners tabs)
Permissions Modal — Accessed via edit icon on any user (CRM Features, Portal Apps, Admin Features checkboxes)
Questions? Reach out to Frank Dalton (fdalton@coastalclaims.net) or Taha Masood (tmasood@coastalclaims.net) for portal backend questions.