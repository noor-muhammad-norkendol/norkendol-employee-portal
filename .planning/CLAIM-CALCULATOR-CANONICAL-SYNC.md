# Claim Calculator — Canonical Sync Plan

**Status:** OPEN — calculator did NOT receive the 2026-04-28 canonical sweep
**File:** `src/app/dashboard/claim-calculator/page.tsx`
**Related:** HANDOFF.md "Canonical CRM Spoke Standard" (locked 2026-04-28)
**Created:** 2026-04-28

---

## Why this doc exists

On 2026-04-28 the Canonical CRM Spoke Standard was locked across the 7 CRM spokes (`onboarding_clients`, `estimates`, `litigation_files`, `mediations`, `appraisals`, `pa_settlements`, `claim_health_records`). Every spoke now carries the full 9-column canonical set:

- **Identifiers (5):** `file_number`, `claim_number`, `policy_number`, `client_name`, `loss_address`
- **Characteristics (3):** `peril`, `peril_other`, `severity` (1-5)
- **Status:** deferred

The Claim Calculator was **not** updated in that sweep. It is the only claim-touching surface in the portal that is out of alignment.

**Important nuance:** The calculator is a CONSUMER of `useClaimLookup`, not a CRM spoke. It has no DB table of its own — claim info on it lives in component state, not Supabase. So this is **NOT a DB migration job.** It is a UI/UX + lookup-wiring job.

---

## What's already aligned ✅

- Imports `useClaimLookup`, `ClaimLookupMatch`, `LookupField` from the canonical hook (page.tsx:5)
- Has 4 of the 5 canonical identifier inputs:
  - Claim Number (page.tsx:389-390)
  - File Number (page.tsx:393-394)
  - Client Name (page.tsx:397-398)
  - Loss Address (page.tsx:401-402)
- Labels already match canonical naming — uses "File Number" not "Claim File"
- Existing fields are read back from accepted matches via `handleCcClaimAccept` (page.tsx:99-104)

---

## What's missing ❌

### 1. Policy Number field (Identifier #5)
- No input on the form
- Not in `ccLookupTerm` ternary (page.tsx:91-94) — falls through to `lossAddress`. If `ccLookupField` is ever `'policy_number'`, the lookup will search the loss-address text against the policy_number column. Bug-by-omission.
- Not propagated in `handleCcClaimAccept` (page.tsx:99-104) — when a user accepts a match, `policy_number` from the matched spoke row is dropped on the floor.

### 2. Peril (Characteristic) — dropdown sourced from `peril_types`
- No input on the form
- Not stored in component state
- The 12 starter perils live in the `peril_types` lookup table (admin-editable). UI must query `peril_types WHERE is_active = true ORDER BY sort_order` for the dropdown options.

### 3. Peril Other (Characteristic) — free text when peril = 'Other'
- No input on the form
- Should only render when `peril === 'Other'`

### 4. Severity (Characteristic) — int 1-5
- No input on the form
- `CHECK (severity IS NULL OR severity BETWEEN 1 AND 5)` in DB. UI displays integers only (1-5). Not a lookup table.
- Internal text mapping for documentation only: 1=Light, 2=Minor, 3=Moderate, 4=Severe, 5=Total Loss.

---

## What needs to change (proposed scope)

### Code changes — all in `src/app/dashboard/claim-calculator/page.tsx`

1. **Add state hooks** for the 4 missing fields:
   ```ts
   const [policyNumber, setPolicyNumber] = useState("");
   const [peril, setPeril] = useState("");
   const [perilOther, setPerilOther] = useState("");
   const [severity, setSeverity] = useState<number | null>(null);
   ```

2. **Fix `ccLookupTerm` ternary** (line 91-94) to include `policy_number`:
   ```ts
   const ccLookupTerm =
     ccLookupField === 'claim_number'  ? claimNumber  :
     ccLookupField === 'file_number'   ? fileNumber   :
     ccLookupField === 'policy_number' ? policyNumber :
     ccLookupField === 'client_name'   ? clientName   :
     lossAddress;
   ```

3. **Update `handleCcClaimAccept`** (line 99-104) to propagate the missing fields:
   ```ts
   if (match.policy_number) setPolicyNumber(match.policy_number);
   if (match.peril)         setPeril(match.peril);
   if (match.peril_other)   setPerilOther(match.peril_other);
   if (match.severity != null) setSeverity(match.severity);
   ```

4. **Add UI inputs to the Claim Info card** (around line 384-408):
   - Policy Number text input — same style as the other identifiers, with `setCcLookupField('policy_number')` on change ≥3 chars
   - Peril dropdown — fed from `peril_types` query (same fetch pattern other forms use)
   - Peril Other text input — conditional on `peril === 'Other'`
   - Severity input — number 1-5, plain int (NOT a select from a lookup, NOT text)

   Grid layout decision deferred to BINGO — current grid is `1fr 1fr 1fr 1fr` (4 columns). Adding 4 more fields likely means a second row, possibly `1fr 1fr 1fr 1fr` × 2 rows OR a wider grid that breaks at narrow widths.

### NO database changes

The calculator does not persist claim info to Supabase. There is no `claim_calculator_results` table, no row to backfill, no migration to write. **Do not add a DB schema for the calculator as part of this work** — that's a separate decision (see Open question 2 below).

### NO `useClaimLookup` changes

`useClaimLookup` was already widened in commit `cbb5498` to support all 5 identifiers and return all 3 characteristics. The hook is correct. The calculator is the only consumer that didn't catch up.

---

## Open questions (need Frank input before BINGO)

1. **Where does the calculator land in the canonical standard's sphere?**
   The Standard says: "Display on every claim form consistently." The calculator IS a claim form (it has a Claim Info card). Treat it as in-scope and add the 4 missing fields? Or keep it lean as a calculation surface only and skip the characteristics? Recommendation: add them — peril and severity affect settlement context and there's value in surfacing them next to the math.

2. **Should the calculator persist results to a future `claim_calculator_results` spoke?**
   If yes, that spoke would need all 9 canonical columns in its initial CREATE TABLE per the standard. This is bigger than the canonical sync — it's a new feature. Out of scope for this MD; flag for a future planning session.

3. **Severity input style — slider, dropdown, or number input?**
   Other spokes use a plain int with CHECK 1-5. Recommendation: match — number input with `min=1 max=5 step=1`. Don't introduce a new pattern in the calculator.

4. **Peril dropdown — fetch on mount, or share via React context?**
   The 12 starter perils are already queried on Settlement Tracker forms. Fetching again in the calculator is fine (small list, cached). A shared context is cleaner long-term but premature for this sync. Recommendation: fetch on mount, same pattern other forms use.

---

## Compliance check after sync

After the changes above land, the calculator should match every other claim-touching surface on the portal:

| Surface | Identifiers (5) | Characteristics (3) | useClaimLookup |
|---|---|---|---|
| Onboarder KPI | ✅ | ✅ | ✅ |
| Estimator KPI | ✅ | ✅ | ✅ |
| Settlement Tracker (all 4 tracks) | ✅ | ✅ | ✅ |
| Claim Health | ✅ | ✅ | ✅ |
| **Claim Calculator** | **❌ (4/5)** | **❌ (0/3)** | ✅ |

After this work: calculator row flips to all ✅.

---

## Next step

BINGO this scope with Frank. No code changes until the 4 open questions above are answered, especially #1 (in-scope at all?) and #3 (severity input style).
