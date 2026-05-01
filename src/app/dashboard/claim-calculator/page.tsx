"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useClaimLookup, type ClaimLookupMatch, type LookupField } from "@/hooks/useClaimLookup";
import ClaimMatchBanner from "@/components/ClaimMatchBanner";
/* ───── local spec-token styles (replaces @/lib/styles imports) ───── */
const cardStyle: React.CSSProperties = {
  background: "var(--pad)",
  borderRadius: "var(--radius-card)",
  padding: "18px 22px",
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: "var(--border)",
  boxShadow: "var(--card-shadow)",
  position: "relative",
  zIndex: 1,
};
const inputStyle: React.CSSProperties = {
  background: "var(--pad-input)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--border)",
  color: "var(--text)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
  fontFamily: "var(--font-body)",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  display: "block",
  marginBottom: 6,
  fontFamily: "var(--font-ui)",
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

const btnPrimary: React.CSSProperties = {
  background: "var(--cta-bg)",
  color: "var(--cta-text)",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "var(--font-display)",
  cursor: "pointer",
  boxShadow: "var(--cta-shadow)",
};
const btnOutline: React.CSSProperties = {
  background: "var(--bg)",
  color: "var(--accent)",
  borderWidth: "2px",
  borderStyle: "solid",
  borderColor: "var(--accent)",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  fontFamily: "var(--font-display)",
  cursor: "pointer",
};

/* ───── status bars (semantic-token, no hex) — kept as named consts so existing call sites keep working ───── */
function makeBar(token: string): React.CSSProperties {
  const tokenVar = `var(${token})`;
  return {
    background: `linear-gradient(180deg, color-mix(in srgb, ${tokenVar} 14%, var(--pad)) 0%, var(--pad) 100%)`,
    color: tokenVar,
    borderRadius: 10,
    padding: "14px 20px",
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: "1.5px",
    borderStyle: "solid",
    borderColor: `color-mix(in srgb, ${tokenVar} 50%, transparent)`,
    boxShadow: `0 0 22px color-mix(in srgb, ${tokenVar} 22%, transparent)`,
    fontFamily: "var(--font-display)",
    letterSpacing: "0.04em",
  };
}
const blueBar: React.CSSProperties = makeBar("--info");
const greenBar: React.CSSProperties = makeBar("--green");
const orangeBar: React.CSSProperties = makeBar("--orange");
const redBar: React.CSSProperties = makeBar("--red");

/* ───── helpers ───── */
const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const p = (s: string) => parseFloat(s) || 0;
let _id = 1;
const uid = () => _id++;

/* ───── Section component (themed-card) ───── */
function Section({
  title, open, onToggle, extra, children,
}: {
  title: string; open: boolean; onToggle: () => void;
  extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="themed-card" style={{ marginBottom: 16, padding: "18px 22px" }}>
      <div className="themed-card-stripe" aria-hidden />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={onToggle}>
        <h3
          className="page-title"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text)",
            margin: 0,
            fontFamily: "var(--font-display)",
          }}
        >
          <span style={{ color: "var(--accent)", marginRight: 8 }}>{open ? "▼" : "▶"}</span>
          {title}
        </h3>
        {extra && <div onClick={(e) => e.stopPropagation()}>{extra}</div>}
      </div>
      {open && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

/* ───── types ───── */
interface SubLimit { id: number; type: string; amount: string; policyLimit: string; checked: boolean }
interface PriorPayment { id: number; amount: string; description: string; paFeesChecked: boolean; paFeesPercent: string; paFeesAmount: number; paFeesPaid: boolean }
interface PaymentWithoutFee { id: number; type: string; typeName: string; amount: string; checked: boolean }
interface CustomRepair { id: number; description: string; amount: string; checked: boolean }
interface CustomDeduction { id: number; description: string; amount: string; checked: boolean }

/* ───── opening statements ───── */
interface ReleaseTypeOption {
  id: string;
  name: string;
  opening_statement: string;
}

/* ===================================================================
   MAIN COMPONENT
   =================================================================== */
export default function ClaimCalculatorPage() {
  /* ── supabase + claim info ── */
  const supabase = useMemo(() => createClient(), []);
  const [orgId, setOrgId] = useState<string>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('users').select('org_id').eq('id', user.id).single()
        .then(({ data }) => { if (data) setOrgId(data.org_id); });
    });
  }, [supabase]);

  const [claimNumber, setClaimNumber] = useState("");
  const [fileNumber, setFileNumber] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [lossAddress, setLossAddress] = useState("");

  // Canonical CHARACTERISTICS — 9-column standard
  const [peril, setPeril] = useState("");
  const [perilOther, setPerilOther] = useState("");
  const [severity, setSeverity] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  // peril_types lookup table (admin-editable)
  const [perilTypes, setPerilTypes] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!orgId) return;
    supabase.from('peril_types')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { if (data) setPerilTypes(data as { id: string; name: string }[]); });
  }, [supabase, orgId]);

  const [ccLookupField, setCcLookupField] = useState<LookupField>('claim_number');
  const ccLookupTerm =
    ccLookupField === 'claim_number'  ? claimNumber  :
    ccLookupField === 'file_number'   ? fileNumber   :
    ccLookupField === 'policy_number' ? policyNumber :
    ccLookupField === 'client_name'   ? clientName   :
    lossAddress;
  const { matches: claimMatches, searching: claimSearching, clear: clearLookup } = useClaimLookup({
    supabase, orgId, searchTerm: ccLookupTerm, searchField: ccLookupField,
  });

  function handleCcClaimAccept(match: ClaimLookupMatch) {
    if (match.claim_number)   setClaimNumber(match.claim_number);
    if (match.file_number)    setFileNumber(match.file_number);
    if (match.policy_number)  setPolicyNumber(match.policy_number);
    if (match.client_name)    setClientName(match.client_name);
    if (match.loss_address)   setLossAddress(match.loss_address);
    if (match.peril)          setPeril(match.peril);
    if (match.peril_other)    setPerilOther(match.peril_other);
    if (match.severity != null) setSeverity(match.severity);
  }

  /* ── open sections ── */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    coverages: true, deductions: false, priorPayments: false,
    paymentsWithoutFees: false, paFees: false, insuredRepairs: false,
    contractorRepairs: false,
  });
  const toggle = (k: string) => setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));

  /* ── release type (from localStorage — shared with claim-calculator-settings) ── */
  const [releaseTypes, setReleaseTypes] = useState<ReleaseTypeOption[]>([]);
  const [releaseType, setReleaseType] = useState("");
  const [openingStatement, setOpeningStatement] = useState("");

  useEffect(() => {
    const defaults: ReleaseTypeOption[] = [
      { id: "proposed", name: "Proposed Release", opening_statement: "" },
      { id: "litigated", name: "Litigated Release", opening_statement: "" },
      { id: "mediation", name: "Mediation Release", opening_statement: "" },
      { id: "appraisal", name: "Appraisal Release", opening_statement: "" },
      { id: "standard", name: "Standard Release", opening_statement: "" },
    ];
    try {
      const stored = localStorage.getItem("claimCalc_releaseTypes");
      const types = stored ? JSON.parse(stored) : defaults;
      setReleaseTypes(types);
      if (types.length > 0) {
        setReleaseType(types[0].name);
        setOpeningStatement(types[0].opening_statement || "");
      }
    } catch {
      setReleaseTypes(defaults);
      setReleaseType(defaults[0].name);
    }
  }, []);

  useEffect(() => {
    const match = releaseTypes.find((rt) => rt.name === releaseType);
    if (match) setOpeningStatement(match.opening_statement || "");
  }, [releaseType, releaseTypes]);

  /* ── main inputs ── */
  const [claimAmount, setClaimAmount] = useState("");
  const [deductible, setDeductible] = useState("");

  /* ── coverages ── */
  const [coverageA, setCoverageA] = useState("");
  const [coverageB, setCoverageB] = useState("");
  const [coverageC, setCoverageC] = useState("");
  const [coverageD, setCoverageD] = useState("");
  const [policyLimitA, setPolicyLimitA] = useState("");
  const [policyLimitB, setPolicyLimitB] = useState("");
  const [policyLimitC, setPolicyLimitC] = useState("");
  const [policyLimitD, setPolicyLimitD] = useState("");

  /* ── sub-limits (endorsements under coverage A) ── */
  const [customSubLimits, setCustomSubLimits] = useState<SubLimit[]>([]);

  /* ── deductions ── */
  const [recoverableDepreciationAmount, setRecoverableDepreciationAmount] = useState("");
  const [nonRecoverableDepreciationAmount, setNonRecoverableDepreciationAmount] = useState("");
  const [paidWhenIncurredAmount, setPaidWhenIncurredAmount] = useState("");
  const [ordinanceLawAmount, setOrdinanceLawAmount] = useState("");
  const [customPaymentDeductions, setCustomPaymentDeductions] = useState<CustomDeduction[]>([]);

  /* ── prior payments ── */
  const [priorPayments, setPriorPayments] = useState<PriorPayment[]>([]);

  /* ── payments without fees ── */
  const [paymentsWithoutFees, setPaymentsWithoutFees] = useState<PaymentWithoutFee[]>([
    { id: uid(), type: "legalFees", typeName: "Legal Fees", amount: "", checked: false },
    { id: uid(), type: "paidIncurred", typeName: "Paid / Incurred", amount: "", checked: false },
  ]);

  /* ── PA fee percentages per coverage (default 10%) ── */
  const [coverageAFeePercent, setCoverageAFeePercent] = useState("10");
  const [coverageBFeePercent, setCoverageBFeePercent] = useState("10");
  const [coverageCFeePercent, setCoverageCFeePercent] = useState("10");
  const [coverageDFeePercent, setCoverageDFeePercent] = useState("10");

  /* ── insured repairs ── */
  const [interiorRepairsAmount, setInteriorRepairsAmount] = useState("");
  const [exteriorRepairsAmount, setExteriorRepairsAmount] = useState("");
  const [fencesAmount, setFencesAmount] = useState("");
  const [screenEnclosureAmount, setScreenEnclosureAmount] = useState("");
  const [customInsuredRepairs, setCustomInsuredRepairs] = useState<CustomRepair[]>([]);

  /* ── contractor repairs ── */
  const [roofSquares, setRoofSquares] = useState("");
  const [roofTotalCost, setRoofTotalCost] = useState("");
  const [additionalRoofSquares, setAdditionalRoofSquares] = useState("");
  const [additionalRoofTotalCost, setAdditionalRoofTotalCost] = useState("");
  const [guttersLinearFeet, setGuttersLinearFeet] = useState("");
  const [guttersTotalCost, setGuttersTotalCost] = useState("");
  const [solarPanels, setSolarPanels] = useState("");
  const [solarTotalCost, setSolarTotalCost] = useState("");
  const [soffitLinearFeet, setSoffitLinearFeet] = useState("");
  const [soffitTotalCost, setSoffitTotalCost] = useState("");
  const [fasciaLinearFeet, setFasciaLinearFeet] = useState("");
  const [fasciaTotalCost, setFasciaTotalCost] = useState("");
  const [customContractorRepairs, setCustomContractorRepairs] = useState<CustomRepair[]>([]);

  /* ── overage applied to deductible ── */
  const [overageAppliedToDeductible, setOverageAppliedToDeductible] = useState<Record<string, boolean>>({
    A: false, B: false, C: false, D: false,
  });

  /* ── checked items ── */
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    recoverableDepreciation: false, nonRecoverableDepreciation: false,
    paidWhenIncurred: false, ordinanceLaw: false,
    priorPayments: false,
    interiorRepairs: false, exteriorRepairs: false, fences: false, screenEnclosure: false,
    roof: false, additionalRoof: false, gutters: false, solar: false, soffit: false, fascia: false,
  });
  const ck = (k: string) => setCheckedItems((prev) => ({ ...prev, [k]: !prev[k] }));

  /* ── print preview ── */
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printOptions, setPrintOptions] = useState<Record<string, boolean>>({
    legalFees: true, paFees: true, priorPayments: true, repairs: true, subLimits: true,
  });

  /* ── auto-calc prior payment PA fees ── */
  useEffect(() => {
    setPriorPayments((prev) =>
      prev.map((pp) => ({
        ...pp,
        paFeesAmount: pp.paFeesChecked ? (p(pp.amount) * p(pp.paFeesPercent)) / 100 : 0,
      }))
    );
  }, [priorPayments.map((pp) => `${pp.amount}-${pp.paFeesPercent}-${pp.paFeesChecked}`).join(",")]);

  /* ───── calculations (useMemo) ───── */
  const cappedA = useMemo(() => p(policyLimitA) > 0 ? Math.min(p(coverageA), p(policyLimitA)) : p(coverageA), [coverageA, policyLimitA]);
  const cappedB = useMemo(() => p(policyLimitB) > 0 ? Math.min(p(coverageB), p(policyLimitB)) : p(coverageB), [coverageB, policyLimitB]);
  const cappedC = useMemo(() => p(policyLimitC) > 0 ? Math.min(p(coverageC), p(policyLimitC)) : p(coverageC), [coverageC, policyLimitC]);
  const cappedD = useMemo(() => p(policyLimitD) > 0 ? Math.min(p(coverageD), p(policyLimitD)) : p(coverageD), [coverageD, policyLimitD]);

  const endorsementTotal = useMemo(() =>
    customSubLimits.filter((s) => s.checked).reduce((sum, s) => {
      const amt = p(s.amount);
      const lim = p(s.policyLimit);
      return sum + (lim > 0 ? Math.min(amt, lim) : amt);
    }, 0),
    [customSubLimits]
  );

  const totalCoverage = useMemo(() => cappedA + cappedB + cappedC + cappedD + endorsementTotal,
    [cappedA, cappedB, cappedC, cappedD, endorsementTotal]);

  const overageA = useMemo(() => p(policyLimitA) > 0 && p(coverageA) > p(policyLimitA) ? p(coverageA) - p(policyLimitA) : 0, [coverageA, policyLimitA]);
  const overageB = useMemo(() => p(policyLimitB) > 0 && p(coverageB) > p(policyLimitB) ? p(coverageB) - p(policyLimitB) : 0, [coverageB, policyLimitB]);
  const overageC = useMemo(() => p(policyLimitC) > 0 && p(coverageC) > p(policyLimitC) ? p(coverageC) - p(policyLimitC) : 0, [coverageC, policyLimitC]);
  const overageD = useMemo(() => p(policyLimitD) > 0 && p(coverageD) > p(policyLimitD) ? p(coverageD) - p(policyLimitD) : 0, [coverageD, policyLimitD]);

  const totalOverageApplied = useMemo(() => {
    let total = 0;
    if (overageAppliedToDeductible.A) total += overageA;
    if (overageAppliedToDeductible.B) total += overageB;
    if (overageAppliedToDeductible.C) total += overageC;
    if (overageAppliedToDeductible.D) total += overageD;
    return total;
  }, [overageA, overageB, overageC, overageD, overageAppliedToDeductible]);

  const effectiveDeductible = useMemo(() => Math.max(0, p(deductible) - totalOverageApplied), [deductible, totalOverageApplied]);

  const totalDeductions = useMemo(() => {
    let total = 0;
    if (checkedItems.recoverableDepreciation) total += p(recoverableDepreciationAmount);
    if (checkedItems.nonRecoverableDepreciation) total += p(nonRecoverableDepreciationAmount);
    if (checkedItems.paidWhenIncurred) total += p(paidWhenIncurredAmount);
    if (checkedItems.ordinanceLaw) total += p(ordinanceLawAmount);
    total += customPaymentDeductions.filter((d) => d.checked).reduce((s, d) => s + p(d.amount), 0);
    return total;
  }, [checkedItems, recoverableDepreciationAmount, nonRecoverableDepreciationAmount, paidWhenIncurredAmount, ordinanceLawAmount, customPaymentDeductions]);

  const priorPaymentsTotal = useMemo(() =>
    checkedItems.priorPayments ? priorPayments.reduce((s, pp) => s + p(pp.amount), 0) : 0,
    [checkedItems.priorPayments, priorPayments]
  );

  const paymentsWithoutFeesTotal = useMemo(() =>
    paymentsWithoutFees.filter((pw) => pw.checked).reduce((s, pw) => s + p(pw.amount), 0),
    [paymentsWithoutFees]
  );

  const balanceBeforePAFees = useMemo(() =>
    Math.max(0, totalCoverage - totalDeductions - priorPaymentsTotal - paymentsWithoutFeesTotal - effectiveDeductible),
    [totalCoverage, totalDeductions, priorPaymentsTotal, paymentsWithoutFeesTotal, effectiveDeductible]
  );

  const priorPAFeesPaid = useMemo(() =>
    !checkedItems.priorPayments ? 0 : priorPayments.filter((pp) => pp.paFeesChecked && pp.paFeesPaid).reduce((s, pp) => s + pp.paFeesAmount, 0),
    [checkedItems.priorPayments, priorPayments]
  );

  const priorPAFeesOwed = useMemo(() =>
    !checkedItems.priorPayments ? 0 : priorPayments.filter((pp) => pp.paFeesChecked && !pp.paFeesPaid).reduce((s, pp) => s + pp.paFeesAmount, 0),
    [checkedItems.priorPayments, priorPayments]
  );

  const priorPAFees = useMemo(() => priorPAFeesPaid + priorPAFeesOwed, [priorPAFeesPaid, priorPAFeesOwed]);

  // PA fees: proportionally allocated by coverage weight using individual coverage percentages
  const currentPAFees = useMemo(() => {
    const totalCoverages = cappedA + cappedB + cappedC + cappedD;
    if (totalCoverages === 0) return 0;
    const feeA = (balanceBeforePAFees * cappedA / totalCoverages) * (p(coverageAFeePercent)) / 100;
    const feeB = (balanceBeforePAFees * cappedB / totalCoverages) * (p(coverageBFeePercent)) / 100;
    const feeC = (balanceBeforePAFees * cappedC / totalCoverages) * (p(coverageCFeePercent)) / 100;
    const feeD = (balanceBeforePAFees * cappedD / totalCoverages) * (p(coverageDFeePercent)) / 100;
    return feeA + feeB + feeC + feeD;
  }, [balanceBeforePAFees, cappedA, cappedB, cappedC, cappedD, coverageAFeePercent, coverageBFeePercent, coverageCFeePercent, coverageDFeePercent]);

  const totalPAFees = useMemo(() => currentPAFees + priorPAFees, [currentPAFees, priorPAFees]);
  // FIX: subtract owed prior PA fees from balance (not just current fees)
  const finalBalance = useMemo(() => balanceBeforePAFees - currentPAFees - priorPAFeesOwed, [balanceBeforePAFees, currentPAFees, priorPAFeesOwed]);
  const balancePlusDeductible = useMemo(() => finalBalance + effectiveDeductible, [finalBalance, effectiveDeductible]);
  const remainingPAFeesDue = useMemo(() => Math.max(0, totalPAFees - priorPAFeesPaid), [totalPAFees, priorPAFeesPaid]);

  const totalRepairCosts = useMemo(() => {
    let total = 0;
    if (checkedItems.interiorRepairs) total += p(interiorRepairsAmount);
    if (checkedItems.exteriorRepairs) total += p(exteriorRepairsAmount);
    if (checkedItems.fences) total += p(fencesAmount);
    if (checkedItems.screenEnclosure) total += p(screenEnclosureAmount);
    total += customInsuredRepairs.filter((r) => r.checked).reduce((s, r) => s + p(r.amount), 0);
    // FIX: checkbox key matches source — "roof" not "roof"
    if (checkedItems.roof) total += p(roofTotalCost);
    if (checkedItems.additionalRoof) total += p(additionalRoofTotalCost);
    if (checkedItems.gutters) total += p(guttersTotalCost);
    if (checkedItems.solar) total += p(solarTotalCost);
    if (checkedItems.soffit) total += p(soffitTotalCost);
    if (checkedItems.fascia) total += p(fasciaTotalCost);
    total += customContractorRepairs.filter((r) => r.checked).reduce((s, r) => s + p(r.amount), 0);
    return total;
  }, [checkedItems, interiorRepairsAmount, exteriorRepairsAmount, fencesAmount, screenEnclosureAmount, customInsuredRepairs, roofTotalCost, additionalRoofTotalCost, guttersTotalCost, solarTotalCost, soffitTotalCost, fasciaTotalCost, customContractorRepairs]);

  // FIX: proper total possible recovered formula (not 0.9 flat multiplier)
  // Source: (balance - currentPAFees + priorPayments - priorPAFeesPaid + effectiveDeductible + totalDeductions)
  const totalPossibleRecovered = useMemo(() =>
    Math.max(0, (balanceBeforePAFees - currentPAFees) + priorPaymentsTotal - priorPAFeesPaid + effectiveDeductible + totalDeductions),
    [balanceBeforePAFees, currentPAFees, priorPaymentsTotal, priorPAFeesPaid, effectiveDeductible, totalDeductions]
  );

  const baseAmount = useMemo(() => totalPossibleRecovered - (checkedItems.nonRecoverableDepreciation ? p(nonRecoverableDepreciationAmount) : 0), [totalPossibleRecovered, checkedItems.nonRecoverableDepreciation, nonRecoverableDepreciationAmount]);
  const finalBalanceAmount = useMemo(() => baseAmount - totalRepairCosts, [baseAmount, totalRepairCosts]);
  // FIX: withheld amount = full total deductions (source doesn't subtract non-RD)
  const withheldAmount = useMemo(() => totalDeductions, [totalDeductions]);

  const trafficLight = useMemo(() => {
    if (finalBalanceAmount >= 0) return "green";
    if (Math.abs(finalBalanceAmount) <= withheldAmount) return "yellow";
    return "red";
  }, [finalBalanceAmount, withheldAmount]);

  /* ── contractor cost per unit ── */
  const roofCostPerSquare = p(roofSquares) > 0 ? p(roofTotalCost) / p(roofSquares) : 0;
  const additionalRoofCostPerSquare = p(additionalRoofSquares) > 0 ? p(additionalRoofTotalCost) / p(additionalRoofSquares) : 0;
  const guttersCostPerFoot = p(guttersLinearFeet) > 0 ? p(guttersTotalCost) / p(guttersLinearFeet) : 0;
  const solarCostPerPanel = p(solarPanels) > 0 ? p(solarTotalCost) / p(solarPanels) : 0;
  const soffitCostPerFoot = p(soffitLinearFeet) > 0 ? p(soffitTotalCost) / p(soffitLinearFeet) : 0;
  const fasciaCostPerFoot = p(fasciaLinearFeet) > 0 ? p(fasciaTotalCost) / p(fasciaLinearFeet) : 0;

  /* ── add-back for display ── */
  const addBackPriorPayments = priorPaymentsTotal - priorPAFees;

  /* ── Spoke #8 persistence: save / load / list runs ── */
  type SavedRun = {
    id: string;
    status: 'proposed' | 'final';
    file_number: string | null;
    claim_number: string | null;
    policy_number: string | null;
    client_name: string | null;
    loss_address: string | null;
    peril: string | null;
    peril_other: string | null;
    severity: number | null;
    total_coverage: number | null;
    final_balance: number | null;
    total_possible_recovered: number | null;
    notes: string | null;
    created_at: string;
    inputs: Record<string, unknown>;
  };
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // Fetch existing runs when an identifier is entered
  useEffect(() => {
    if (!orgId) return;
    const hasIdentifier = !!(fileNumber || claimNumber || policyNumber);
    if (!hasIdentifier) { setSavedRuns([]); return; }
    const t = setTimeout(async () => {
      let q = supabase.from('claim_calculator_runs')
        .select('id, status, file_number, claim_number, policy_number, client_name, loss_address, peril, peril_other, severity, total_coverage, final_balance, total_possible_recovered, notes, created_at, inputs')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (fileNumber)        q = q.eq('file_number', fileNumber);
      else if (claimNumber)  q = q.eq('claim_number', claimNumber);
      else if (policyNumber) q = q.eq('policy_number', policyNumber);
      const { data } = await q;
      if (data) setSavedRuns(data as SavedRun[]);
    }, 400);
    return () => clearTimeout(t);
  }, [supabase, orgId, fileNumber, claimNumber, policyNumber]);

  // Build the full state snapshot for the inputs jsonb column
  function buildInputsSnapshot() {
    return {
      claimAmount, deductible,
      coverageA, coverageB, coverageC, coverageD,
      policyLimitA, policyLimitB, policyLimitC, policyLimitD,
      customSubLimits,
      recoverableDepreciationAmount, nonRecoverableDepreciationAmount,
      paidWhenIncurredAmount, ordinanceLawAmount,
      customPaymentDeductions,
      priorPayments,
      paymentsWithoutFees,
      coverageAFeePercent, coverageBFeePercent, coverageCFeePercent, coverageDFeePercent,
      interiorRepairsAmount, exteriorRepairsAmount, fencesAmount, screenEnclosureAmount,
      customInsuredRepairs,
      roofSquares, roofTotalCost, additionalRoofSquares, additionalRoofTotalCost,
      guttersLinearFeet, guttersTotalCost, solarPanels, solarTotalCost,
      soffitLinearFeet, soffitTotalCost, fasciaLinearFeet, fasciaTotalCost,
      customContractorRepairs,
      overageAppliedToDeductible,
      checkedItems,
      releaseType, openingStatement,
    };
  }

  async function saveRun(status: 'proposed' | 'final') {
    if (!orgId) { setSaveMsg("No org context — cannot save."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveMsg("Not signed in."); return; }
    setSaving(true);
    setSaveMsg("");
    const row = {
      org_id: orgId,
      created_by: user.id,
      status,
      file_number: fileNumber || null,
      claim_number: claimNumber || null,
      policy_number: policyNumber || null,
      client_name: clientName || null,
      loss_address: lossAddress || null,
      peril: peril || null,
      peril_other: perilOther || null,
      severity,
      release_type: releaseType || null,
      opening_statement: openingStatement || null,
      notes: notes || null,
      inputs: buildInputsSnapshot(),
      total_coverage: totalCoverage,
      final_balance: finalBalance,
      total_possible_recovered: totalPossibleRecovered,
    };
    const { data, error } = await supabase.from('claim_calculator_runs').insert(row).select().single();
    setSaving(false);
    if (error) { setSaveMsg(`Save failed: ${error.message}`); return; }
    setSaveMsg(`Saved as ${status}.`);
    if (data) setSavedRuns((prev) => [data as SavedRun, ...prev]);
  }

  // Pull a saved run back into all the inputs
  function loadRun(run: SavedRun) {
    const i = run.inputs || {};
    const get = <T,>(k: string, fallback: T): T => (i[k] !== undefined ? (i[k] as T) : fallback);
    setClaimNumber(run.claim_number || "");
    setFileNumber(run.file_number || "");
    setPolicyNumber(run.policy_number || "");
    setClientName(run.client_name || "");
    setLossAddress(run.loss_address || "");
    setPeril(run.peril || "");
    setPerilOther(run.peril_other || "");
    setSeverity(run.severity);
    setClaimAmount(get("claimAmount", ""));
    setDeductible(get("deductible", ""));
    setCoverageA(get("coverageA", "")); setCoverageB(get("coverageB", ""));
    setCoverageC(get("coverageC", "")); setCoverageD(get("coverageD", ""));
    setPolicyLimitA(get("policyLimitA", "")); setPolicyLimitB(get("policyLimitB", ""));
    setPolicyLimitC(get("policyLimitC", "")); setPolicyLimitD(get("policyLimitD", ""));
    setCustomSubLimits(get<SubLimit[]>("customSubLimits", []));
    setRecoverableDepreciationAmount(get("recoverableDepreciationAmount", ""));
    setNonRecoverableDepreciationAmount(get("nonRecoverableDepreciationAmount", ""));
    setPaidWhenIncurredAmount(get("paidWhenIncurredAmount", ""));
    setOrdinanceLawAmount(get("ordinanceLawAmount", ""));
    setCustomPaymentDeductions(get<CustomDeduction[]>("customPaymentDeductions", []));
    setPriorPayments(get<PriorPayment[]>("priorPayments", []));
    setPaymentsWithoutFees(get<PaymentWithoutFee[]>("paymentsWithoutFees", []));
    setCoverageAFeePercent(get("coverageAFeePercent", "10"));
    setCoverageBFeePercent(get("coverageBFeePercent", "10"));
    setCoverageCFeePercent(get("coverageCFeePercent", "10"));
    setCoverageDFeePercent(get("coverageDFeePercent", "10"));
    setInteriorRepairsAmount(get("interiorRepairsAmount", ""));
    setExteriorRepairsAmount(get("exteriorRepairsAmount", ""));
    setFencesAmount(get("fencesAmount", ""));
    setScreenEnclosureAmount(get("screenEnclosureAmount", ""));
    setCustomInsuredRepairs(get<CustomRepair[]>("customInsuredRepairs", []));
    setRoofSquares(get("roofSquares", "")); setRoofTotalCost(get("roofTotalCost", ""));
    setAdditionalRoofSquares(get("additionalRoofSquares", "")); setAdditionalRoofTotalCost(get("additionalRoofTotalCost", ""));
    setGuttersLinearFeet(get("guttersLinearFeet", "")); setGuttersTotalCost(get("guttersTotalCost", ""));
    setSolarPanels(get("solarPanels", "")); setSolarTotalCost(get("solarTotalCost", ""));
    setSoffitLinearFeet(get("soffitLinearFeet", "")); setSoffitTotalCost(get("soffitTotalCost", ""));
    setFasciaLinearFeet(get("fasciaLinearFeet", "")); setFasciaTotalCost(get("fasciaTotalCost", ""));
    setCustomContractorRepairs(get<CustomRepair[]>("customContractorRepairs", []));
    setOverageAppliedToDeductible(get<Record<string, boolean>>("overageAppliedToDeductible", { A: false, B: false, C: false, D: false }));
    setCheckedItems(get<Record<string, boolean>>("checkedItems", {
      recoverableDepreciation: false, nonRecoverableDepreciation: false,
      paidWhenIncurred: false, ordinanceLaw: false, priorPayments: false,
      interiorRepairs: false, exteriorRepairs: false, fences: false, screenEnclosure: false,
      roof: false, additionalRoof: false, gutters: false, solar: false, soffit: false, fascia: false,
    }));
    setReleaseType(get("releaseType", ""));
    setOpeningStatement(get("openingStatement", ""));
    setNotes(run.notes || "");
    setSaveMsg(`Loaded run from ${new Date(run.created_at).toLocaleString()} (${run.status}).`);
  }

  /* ===================================================================
     RENDER
     =================================================================== */
  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>
      <div className="no-print" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <h1
          className="page-title"
          style={{
            fontSize: "3rem",
            lineHeight: 1,
            letterSpacing: "-0.01em",
            marginBottom: 28,
            fontFamily: "var(--font-display)",
          }}
        >
          <span
            style={{
              color: "var(--accent)",
              textShadow: "var(--accent-text-shadow)",
              fontWeight: 800,
            }}
          >
            Claim
          </span>{" "}
          <span style={{ color: "var(--text)", fontWeight: 500, opacity: 0.92 }}>
            Breakdown Calculator
          </span>
        </h1>

        {/* ── 0. Claim Info ── */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Claim Info</p>
          {/* Row 1 — Identifiers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Claim Number</label>
              <input style={inputStyle} value={claimNumber} onChange={(e) => { setClaimNumber(e.target.value); if (e.target.value.length >= 3) setCcLookupField('claim_number'); }} placeholder="Claim #" />
            </div>
            <div>
              <label style={labelStyle}>File Number</label>
              <input style={inputStyle} value={fileNumber} onChange={(e) => { setFileNumber(e.target.value); if (e.target.value.length >= 3) setCcLookupField('file_number'); }} placeholder="File #" />
            </div>
            <div>
              <label style={labelStyle}>Policy Number</label>
              <input style={inputStyle} value={policyNumber} onChange={(e) => { setPolicyNumber(e.target.value); if (e.target.value.length >= 3 && !claimNumber && !fileNumber) setCcLookupField('policy_number'); }} placeholder="Policy #" />
            </div>
            <div>
              <label style={labelStyle}>Client Name</label>
              <input style={inputStyle} value={clientName} onChange={(e) => { setClientName(e.target.value); if (e.target.value.length >= 3 && !claimNumber && !fileNumber && !policyNumber) setCcLookupField('client_name'); }} placeholder="Client name" />
            </div>
          </div>
          {/* Row 2 — Loss address (full row) */}
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Loss Address</label>
            <input style={inputStyle} value={lossAddress} onChange={(e) => { setLossAddress(e.target.value); if (e.target.value.length >= 3 && !claimNumber && !fileNumber && !policyNumber) setCcLookupField('address'); }} placeholder="123 Main St" />
          </div>
          {/* Row 3 — Characteristics */}
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Peril</label>
              <select style={selectStyle} value={peril} onChange={(e) => { setPeril(e.target.value); if (e.target.value !== 'Other') setPerilOther(""); }}>
                <option value="">— Select —</option>
                {perilTypes.map((pt) => (
                  <option key={pt.id} value={pt.name}>{pt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Peril Other {peril !== 'Other' && <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(only if peril = Other)</span>}</label>
              <input style={inputStyle} value={perilOther} onChange={(e) => setPerilOther(e.target.value)} placeholder="Free text" disabled={peril !== 'Other'} />
            </div>
            <div>
              <label style={labelStyle}>Severity (1-5)</label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={5}
                step={1}
                value={severity ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") setSeverity(null);
                  else {
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n >= 1 && n <= 5) setSeverity(n);
                  }
                }}
                placeholder="1-5"
              />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <ClaimMatchBanner matches={claimMatches} searching={claimSearching} onAccept={handleCcClaimAccept} onDismiss={clearLookup} />
          </div>
        </div>

        {/* ── 0b. Saved Runs (Spoke #8 — versioned per-claim history) ── */}
        {savedRuns.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Saved Runs ({savedRuns.length}) — click a row to load
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {savedRuns.map((run) => (
                <button
                  key={run.id}
                  onClick={() => loadRun(run)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    background: "var(--bg)",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: 13,
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 1fr 1fr 1fr",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                    color: run.status === 'final' ? "var(--green)" : "var(--orange)",
                  }}>{run.status}</span>
                  <span style={{ color: "var(--text-dim)" }}>
                    {new Date(run.created_at).toLocaleDateString()} {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>Coverage: {run.total_coverage != null ? fmt(Number(run.total_coverage)) : "—"}</span>
                  <span>Final: {run.final_balance != null ? fmt(Number(run.final_balance)) : "—"}</span>
                  <span style={{ color: "var(--text-faint)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {run.notes || "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 1. Release Type ── */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>Release Type</label>
              <select style={selectStyle} value={releaseType} onChange={(e) => setReleaseType(e.target.value)}>
                {releaseTypes.map((rt) => (
                  <option key={rt.id} value={rt.name}>{rt.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Opening Statement</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={openingStatement} readOnly />
          </div>
        </div>

        {/* ── 2. Total Coverage Amount ── */}
        <div style={{ ...blueBar, fontSize: 20, marginBottom: 16 }}>
          <span>Total Coverage Amount</span>
          <span>{fmt(totalCoverage)}</span>
        </div>

        {/* ── 3. Coverages ── */}
        <Section title="Coverages" open={openSections.coverages} onToggle={() => toggle("coverages")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Coverage A — left column */}
            <div>
              <label style={labelStyle}>Coverage A — Dwelling</label>
              <input style={inputStyle} type="number" placeholder="0.00" value={coverageA} onChange={(e) => setCoverageA(e.target.value)} />
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>Policy Limit A</label>
                <input style={inputStyle} type="number" placeholder="0.00" value={policyLimitA} onChange={(e) => setPolicyLimitA(e.target.value)} />
              </div>
              {overageA > 0 && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "color-mix(in srgb, var(--orange) 14%, var(--pad))", borderRadius: 6, fontSize: 12, border: "1px solid color-mix(in srgb, var(--orange) 35%, transparent)" }}>
                  <span style={{ color: "var(--orange)", fontWeight: 600 }}>Overage: {fmt(overageA)}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, cursor: "pointer", color: "var(--text-dim)", fontSize: 12 }}>
                    <input type="checkbox" checked={overageAppliedToDeductible.A}
                      onChange={() => setOverageAppliedToDeductible((prev) => ({ ...prev, A: !prev.A }))} />
                    Apply to Deductible
                  </label>
                </div>
              )}

              {/* Sub-limits / Endorsements */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>Sub-Limits / Endorsements</span>
                  <button style={btnOutline} onClick={() => setCustomSubLimits((prev) => [...prev, { id: uid(), type: "", amount: "", policyLimit: "", checked: true }])}>+ Add</button>
                </div>
                {customSubLimits.map((sl, idx) => (
                  <div key={sl.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input type="checkbox" checked={sl.checked} onChange={() => {
                      const u = [...customSubLimits]; u[idx] = { ...u[idx], checked: !u[idx].checked }; setCustomSubLimits(u);
                    }} />
                    <input style={{ ...inputStyle, flex: 2 }} placeholder="Type" value={sl.type} onChange={(e) => {
                      const u = [...customSubLimits]; u[idx] = { ...u[idx], type: e.target.value }; setCustomSubLimits(u);
                    }} />
                    <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="Amount" value={sl.amount} onChange={(e) => {
                      const u = [...customSubLimits]; u[idx] = { ...u[idx], amount: e.target.value }; setCustomSubLimits(u);
                    }} />
                    <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="Limit" value={sl.policyLimit} onChange={(e) => {
                      const u = [...customSubLimits]; u[idx] = { ...u[idx], policyLimit: e.target.value }; setCustomSubLimits(u);
                    }} />
                    <button style={{ ...btnOutline, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)" }} onClick={() => setCustomSubLimits((prev) => prev.filter((_, i) => i !== idx))}>X</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — B, C, D */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                { label: "Coverage B — Other Structures", val: coverageB, setVal: setCoverageB, lim: policyLimitB, setLim: setPolicyLimitB, overage: overageB, key: "B" },
                { label: "Coverage C — Personal Property", val: coverageC, setVal: setCoverageC, lim: policyLimitC, setLim: setPolicyLimitC, overage: overageC, key: "C" },
                { label: "Coverage D — Loss of Use", val: coverageD, setVal: setCoverageD, lim: policyLimitD, setLim: setPolicyLimitD, overage: overageD, key: "D" },
              ] as const).map((cov) => (
                <div key={cov.key}>
                  <label style={labelStyle}>{cov.label}</label>
                  <input style={inputStyle} type="number" placeholder="0.00" value={cov.val} onChange={(e) => cov.setVal(e.target.value)} />
                  <div style={{ marginTop: 6 }}>
                    <label style={labelStyle}>Policy Limit {cov.key}</label>
                    <input style={inputStyle} type="number" placeholder="0.00" value={cov.lim} onChange={(e) => cov.setLim(e.target.value)} />
                  </div>
                  {cov.overage > 0 && (
                    <div style={{ marginTop: 4, padding: "6px 10px", background: "color-mix(in srgb, var(--orange) 14%, var(--pad))", borderRadius: 6, fontSize: 12, border: "1px solid color-mix(in srgb, var(--orange) 35%, transparent)" }}>
                      <span style={{ color: "var(--orange)", fontWeight: 600 }}>Overage: {fmt(cov.overage)}</span>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, cursor: "pointer", color: "var(--text-dim)", fontSize: 12 }}>
                        <input type="checkbox" checked={overageAppliedToDeductible[cov.key]}
                          onChange={() => setOverageAppliedToDeductible((prev) => ({ ...prev, [cov.key]: !prev[cov.key] }))} />
                        Apply to Deductible
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── 4. Optional Deductions ── */}
        <Section
          title="Payment (Deductions / Withholding)"
          open={openSections.deductions}
          onToggle={() => toggle("deductions")}
          extra={<button style={btnOutline} onClick={() => setCustomPaymentDeductions((prev) => [...prev, { id: uid(), description: "", amount: "", checked: true }])}>+ Add</button>}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([
              { label: "Recoverable Depreciation", key: "recoverableDepreciation", val: recoverableDepreciationAmount, setVal: setRecoverableDepreciationAmount },
              { label: "Non-Recoverable Depreciation", key: "nonRecoverableDepreciation", val: nonRecoverableDepreciationAmount, setVal: setNonRecoverableDepreciationAmount },
              { label: "Paid When Incurred", key: "paidWhenIncurred", val: paidWhenIncurredAmount, setVal: setPaidWhenIncurredAmount },
              { label: "Ordinance & Law", key: "ordinanceLaw", val: ordinanceLawAmount, setVal: setOrdinanceLawAmount },
            ] as const).map((d) => (
              <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={checkedItems[d.key]} onChange={() => ck(d.key)} />
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{d.label}</label>
                  {checkedItems[d.key] && (
                    <input style={inputStyle} type="number" placeholder="0.00" value={d.val} onChange={(e) => d.setVal(e.target.value)} />
                  )}
                </div>
              </div>
            ))}
          </div>
          {customPaymentDeductions.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <span style={{ ...labelStyle, marginBottom: 8 }}>Custom Deductions</span>
              {customPaymentDeductions.map((d, idx) => (
                <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <input type="checkbox" checked={d.checked} onChange={() => {
                    const u = [...customPaymentDeductions]; u[idx] = { ...u[idx], checked: !u[idx].checked }; setCustomPaymentDeductions(u);
                  }} />
                  <input style={{ ...inputStyle, flex: 2 }} placeholder="Description" value={d.description} onChange={(e) => {
                    const u = [...customPaymentDeductions]; u[idx] = { ...u[idx], description: e.target.value }; setCustomPaymentDeductions(u);
                  }} />
                  <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="0.00" value={d.amount} onChange={(e) => {
                    const u = [...customPaymentDeductions]; u[idx] = { ...u[idx], amount: e.target.value }; setCustomPaymentDeductions(u);
                  }} />
                  <button style={{ ...btnOutline, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)" }} onClick={() => setCustomPaymentDeductions((prev) => prev.filter((_, i) => i !== idx))}>X</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── 5. Prior Payments ── */}
        <Section
          title="Prior Payments"
          open={openSections.priorPayments}
          onToggle={() => toggle("priorPayments")}
          extra={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }}>
                <input type="checkbox" checked={checkedItems.priorPayments} onChange={() => ck("priorPayments")} />
                Enable
              </label>
              <button style={btnOutline} onClick={() => setPriorPayments((prev) => [...prev, { id: uid(), amount: "", description: "", paFeesChecked: false, paFeesPercent: "10", paFeesAmount: 0, paFeesPaid: false }])}>+ Add</button>
            </div>
          }
        >
          {priorPayments.length === 0 && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No prior payments added.</p>}
          {priorPayments.map((pp, idx) => (
            <div key={pp.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 100 }} type="number" placeholder="Amount" value={pp.amount} onChange={(e) => {
                const u = [...priorPayments]; u[idx] = { ...u[idx], amount: e.target.value }; setPriorPayments(u);
              }} />
              <input style={{ ...inputStyle, flex: 2, minWidth: 140 }} placeholder="Description" value={pp.description} onChange={(e) => {
                const u = [...priorPayments]; u[idx] = { ...u[idx], description: e.target.value }; setPriorPayments(u);
              }} />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={pp.paFeesChecked} onChange={() => {
                  const u = [...priorPayments]; u[idx] = { ...u[idx], paFeesChecked: !u[idx].paFeesChecked }; setPriorPayments(u);
                }} />
                PA Fees
              </label>
              {pp.paFeesChecked && (
                <>
                  <input style={{ ...inputStyle, width: 60 }} type="number" placeholder="%" value={pp.paFeesPercent} onChange={(e) => {
                    const u = [...priorPayments]; u[idx] = { ...u[idx], paFeesPercent: e.target.value }; setPriorPayments(u);
                  }} />
                  <span style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{fmt(pp.paFeesAmount)}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={pp.paFeesPaid} onChange={() => {
                      const u = [...priorPayments]; u[idx] = { ...u[idx], paFeesPaid: !u[idx].paFeesPaid }; setPriorPayments(u);
                    }} />
                    Paid
                  </label>
                </>
              )}
              <button style={{ ...btnOutline, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)" }} onClick={() => setPriorPayments((prev) => prev.filter((_, i) => i !== idx))}>X</button>
            </div>
          ))}
        </Section>

        {/* ── 6. Payments Without Fees ── */}
        <Section
          title="Payments Without Fees"
          open={openSections.paymentsWithoutFees}
          onToggle={() => toggle("paymentsWithoutFees")}
          extra={<button style={btnOutline} onClick={() => setPaymentsWithoutFees((prev) => [...prev, { id: uid(), type: "custom", typeName: "", amount: "", checked: false }])}>+ Add</button>}
        >
          {paymentsWithoutFees.map((pw, idx) => (
            <div key={pw.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input type="checkbox" checked={pw.checked} onChange={() => {
                const u = [...paymentsWithoutFees]; u[idx] = { ...u[idx], checked: !u[idx].checked }; setPaymentsWithoutFees(u);
              }} />
              {pw.type === "custom" ? (
                <input style={{ ...inputStyle, flex: 2 }} placeholder="Description" value={pw.typeName} onChange={(e) => {
                  const u = [...paymentsWithoutFees]; u[idx] = { ...u[idx], typeName: e.target.value }; setPaymentsWithoutFees(u);
                }} />
              ) : (
                <span style={{ flex: 2, fontSize: 13, color: "var(--text)" }}>{pw.typeName}</span>
              )}
              {pw.checked && (
                <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="0.00" value={pw.amount} onChange={(e) => {
                  const u = [...paymentsWithoutFees]; u[idx] = { ...u[idx], amount: e.target.value }; setPaymentsWithoutFees(u);
                }} />
              )}
              {pw.type === "custom" && (
                <button style={{ ...btnOutline, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)" }} onClick={() => setPaymentsWithoutFees((prev) => prev.filter((_, i) => i !== idx))}>X</button>
              )}
            </div>
          ))}
        </Section>

        {/* ── 7. Deductible ── */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <label style={labelStyle}>Deductible</label>
          <input style={inputStyle} type="number" placeholder="0.00" value={deductible} onChange={(e) => setDeductible(e.target.value)} />
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Effective Deductible</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{fmt(effectiveDeductible)}</span>
          </div>
          {totalOverageApplied > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-faint)" }}>
              Overage applied: {fmt(totalOverageApplied)} (Original: {fmt(p(deductible))})
            </div>
          )}
        </div>

        {/* ── 8. Balance Before PA Fees ── */}
        <div style={blueBar}>
          <span>Balance Before PA Fees</span>
          <span>{fmt(balanceBeforePAFees)}</span>
        </div>

        {/* ── 9. PA Fees ── */}
        <Section title="PA Fees" open={openSections.paFees} onToggle={() => toggle("paFees")}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Total PA Fees</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{fmt(totalPAFees)}</span>
          </div>
          <div style={{ ...blueBar, fontSize: 14, padding: "10px 16px", marginBottom: 8 }}>
            <span>Current PA Fees</span>
            <span>{fmt(currentPAFees)}</span>
          </div>
          {priorPAFeesPaid > 0 && (
            <div style={{ ...greenBar, fontSize: 14, padding: "10px 16px", marginBottom: 8 }}>
              <span>Prior PA Fees (Paid)</span>
              <span>{fmt(priorPAFeesPaid)}</span>
            </div>
          )}
          {priorPAFeesOwed > 0 && (
            <div style={{ ...orangeBar, fontSize: 14, padding: "10px 16px", marginBottom: 8 }}>
              <span>Prior PA Fees (Owed)</span>
              <span>{fmt(priorPAFeesOwed)}</span>
            </div>
          )}
          {/* Per-coverage fee percentages */}
          <div style={{ marginTop: 12 }}>
            <label style={{ ...labelStyle, marginBottom: 8 }}>Fee Percentages by Coverage</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {([
                ["Coverage A", coverageAFeePercent, setCoverageAFeePercent],
                ["Coverage B", coverageBFeePercent, setCoverageBFeePercent],
                ["Coverage C", coverageCFeePercent, setCoverageCFeePercent],
                ["Coverage D", coverageDFeePercent, setCoverageDFeePercent],
              ] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([label, val, setter]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-dim)", minWidth: 80 }}>{label}</span>
                  <input style={{ ...inputStyle, width: 70 }} type="number" value={val} onChange={(e) => setter(e.target.value)} />
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>%</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── 10. Balance After PA Fees ── */}
        <div style={greenBar}>
          <span>Balance After PA Fees</span>
          <span>{fmt(finalBalance)}</span>
        </div>

        {/* ── 11. Balance + Deductible ── */}
        <div style={greenBar}>
          <span>Balance + Deductible</span>
          <span>{fmt(balancePlusDeductible)}</span>
        </div>

        {/* ── 12. Add Back Prior Payments Less Prior Fees ── */}
        {priorPaymentsTotal > 0 && (
          <div style={orangeBar}>
            <span>Add Back Prior Payments Less Prior Fees</span>
            <span>{fmt(addBackPriorPayments)}</span>
          </div>
        )}

        {/* ── 13. Amount Withheld ── */}
        {withheldAmount > 0 && (
          <div style={redBar}>
            <span>Amount Withheld</span>
            <span>{fmt(withheldAmount)}</span>
          </div>
        )}

        {/* ── 14. Total Possible Recovered ── */}
        <div style={orangeBar}>
          <span>Total Possible Recovered</span>
          <span>{fmt(totalPossibleRecovered)}</span>
        </div>

        {/* ── 15. Repairs by Insured ── */}
        <Section
          title="Repairs by Insured"
          open={openSections.insuredRepairs}
          onToggle={() => toggle("insuredRepairs")}
          extra={<button style={btnOutline} onClick={() => setCustomInsuredRepairs((prev) => [...prev, { id: uid(), description: "", amount: "", checked: true }])}>+ Add</button>}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([
              { label: "Interior Repairs", key: "interiorRepairs", val: interiorRepairsAmount, setVal: setInteriorRepairsAmount },
              { label: "Exterior Repairs", key: "exteriorRepairs", val: exteriorRepairsAmount, setVal: setExteriorRepairsAmount },
              { label: "Fences", key: "fences", val: fencesAmount, setVal: setFencesAmount },
              { label: "Screen Enclosure", key: "screenEnclosure", val: screenEnclosureAmount, setVal: setScreenEnclosureAmount },
            ] as const).map((r) => (
              <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={checkedItems[r.key]} onChange={() => ck(r.key)} />
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{r.label}</label>
                  {checkedItems[r.key] && (
                    <input style={inputStyle} type="number" placeholder="0.00" value={r.val} onChange={(e) => r.setVal(e.target.value)} />
                  )}
                </div>
              </div>
            ))}
          </div>
          {customInsuredRepairs.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              {customInsuredRepairs.map((r, idx) => (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <input type="checkbox" checked={r.checked} onChange={() => {
                    const u = [...customInsuredRepairs]; u[idx] = { ...u[idx], checked: !u[idx].checked }; setCustomInsuredRepairs(u);
                  }} />
                  <input style={{ ...inputStyle, flex: 2 }} placeholder="Description" value={r.description} onChange={(e) => {
                    const u = [...customInsuredRepairs]; u[idx] = { ...u[idx], description: e.target.value }; setCustomInsuredRepairs(u);
                  }} />
                  <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="0.00" value={r.amount} onChange={(e) => {
                    const u = [...customInsuredRepairs]; u[idx] = { ...u[idx], amount: e.target.value }; setCustomInsuredRepairs(u);
                  }} />
                  <button style={{ ...btnOutline, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)" }} onClick={() => setCustomInsuredRepairs((prev) => prev.filter((_, i) => i !== idx))}>X</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── 16. Repairs by Contractor ── */}
        <Section
          title="Repairs by Contractor"
          open={openSections.contractorRepairs}
          onToggle={() => toggle("contractorRepairs")}
          extra={<button style={btnOutline} onClick={() => setCustomContractorRepairs((prev) => [...prev, { id: uid(), description: "", amount: "", checked: true }])}>+ Add</button>}
        >
          {([
            { label: "Roof", key: "roof", qty: roofSquares, setQty: setRoofSquares, qtyLabel: "Squares", cost: roofTotalCost, setCost: setRoofTotalCost, perUnit: roofCostPerSquare, unitLabel: "/sq" },
            { label: "Additional Roof", key: "additionalRoof", qty: additionalRoofSquares, setQty: setAdditionalRoofSquares, qtyLabel: "Squares", cost: additionalRoofTotalCost, setCost: setAdditionalRoofTotalCost, perUnit: additionalRoofCostPerSquare, unitLabel: "/sq" },
            { label: "Gutters", key: "gutters", qty: guttersLinearFeet, setQty: setGuttersLinearFeet, qtyLabel: "Linear Ft", cost: guttersTotalCost, setCost: setGuttersTotalCost, perUnit: guttersCostPerFoot, unitLabel: "/ft" },
            { label: "Solar Panels", key: "solar", qty: solarPanels, setQty: setSolarPanels, qtyLabel: "Panels", cost: solarTotalCost, setCost: setSolarTotalCost, perUnit: solarCostPerPanel, unitLabel: "/panel" },
            { label: "Soffit", key: "soffit", qty: soffitLinearFeet, setQty: setSoffitLinearFeet, qtyLabel: "Linear Ft", cost: soffitTotalCost, setCost: setSoffitTotalCost, perUnit: soffitCostPerFoot, unitLabel: "/ft" },
            { label: "Fascia", key: "fascia", qty: fasciaLinearFeet, setQty: setFasciaLinearFeet, qtyLabel: "Linear Ft", cost: fasciaTotalCost, setCost: setFasciaTotalCost, perUnit: fasciaCostPerFoot, unitLabel: "/ft" },
          ] as const).map((r) => (
            <div key={r.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={checkedItems[r.key]} onChange={() => ck(r.key)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{r.label}</span>
              </div>
              {checkedItems[r.key] && (
                <div style={{ display: "flex", gap: 8, marginTop: 6, marginLeft: 24 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{r.qtyLabel}</label>
                    <input style={inputStyle} type="number" placeholder="0" value={r.qty} onChange={(e) => r.setQty(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Total Cost</label>
                    <input style={inputStyle} type="number" placeholder="0.00" value={r.cost} onChange={(e) => r.setCost(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Cost {r.unitLabel}</label>
                    <div style={{ ...inputStyle, background: "var(--pad-elev)", cursor: "default" }}>{fmt(r.perUnit)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {customContractorRepairs.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              {customContractorRepairs.map((r, idx) => (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <input type="checkbox" checked={r.checked} onChange={() => {
                    const u = [...customContractorRepairs]; u[idx] = { ...u[idx], checked: !u[idx].checked }; setCustomContractorRepairs(u);
                  }} />
                  <input style={{ ...inputStyle, flex: 2 }} placeholder="Description" value={r.description} onChange={(e) => {
                    const u = [...customContractorRepairs]; u[idx] = { ...u[idx], description: e.target.value }; setCustomContractorRepairs(u);
                  }} />
                  <input style={{ ...inputStyle, flex: 1 }} type="number" placeholder="0.00" value={r.amount} onChange={(e) => {
                    const u = [...customContractorRepairs]; u[idx] = { ...u[idx], amount: e.target.value }; setCustomContractorRepairs(u);
                  }} />
                  <button style={{ ...btnOutline, padding: "4px 10px", color: "var(--red)", borderColor: "var(--red)" }} onClick={() => setCustomContractorRepairs((prev) => prev.filter((_, i) => i !== idx))}>X</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── 17. Final Balance Card ── */}
        {(() => {
          const tlToken =
            trafficLight === "green" ? "--green" :
            trafficLight === "yellow" ? "--amber" :
            "--red";
          const tlVar = `var(${tlToken})`;
          return (
            <div
              style={{
                background: `linear-gradient(180deg, color-mix(in srgb, ${tlVar} 18%, var(--pad)) 0%, var(--pad) 100%)`,
                color: tlVar,
                borderRadius: "var(--radius-card)",
                padding: "24px 28px",
                marginBottom: 16,
                textAlign: "center",
                borderWidth: "1.5px",
                borderStyle: "solid",
                borderColor: `color-mix(in srgb, ${tlVar} 60%, transparent)`,
                boxShadow: `0 0 0 1px ${tlVar} inset, 0 0 28px color-mix(in srgb, ${tlVar} 40%, transparent), 0 0 56px color-mix(in srgb, ${tlVar} 18%, transparent)`,
                fontFamily: "var(--font-display)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                  opacity: 0.9,
                }}
              >
                {trafficLight === "green" ? "Final Balance" : trafficLight === "yellow" ? "You Can Possibly Recover" : "Additional Cost to Insured"}
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  fontFamily: "var(--font-mono)",
                  textShadow: `0 0 18px color-mix(in srgb, ${tlVar} 70%, transparent)`,
                }}
              >
                {fmt(Math.abs(finalBalanceAmount))}
              </div>
              {totalRepairCosts > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 8,
                    color: "var(--text-dim)",
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  Total Repair Costs: {fmt(totalRepairCosts)}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 17b. Save Run (Spoke #8) ── */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Save This Run</p>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='e.g. "After carrier denied A coverage" or "Pre-supplement estimate"'
            />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              style={{ ...btnOutline, opacity: saving ? 0.6 : 1 }}
              onClick={() => saveRun('proposed')}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save as Proposed"}
            </button>
            <button
              style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
              onClick={() => saveRun('final')}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save as Final"}
            </button>
            {saveMsg && (
              <span style={{ fontSize: 13, color: saveMsg.startsWith("Save failed") ? "var(--red)" : "var(--text-dim)" }}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>

        {/* ── 18. Print Preview ── */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <button style={btnPrimary} onClick={() => setShowPrintPreview(true)}>Print Preview</button>
        </div>

        {/* ── Print Preview Modal ── */}
        {showPrintPreview && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--pad)", borderRadius: 12, padding: 24, maxWidth: 700, width: "90%", maxHeight: "90vh", overflow: "auto", color: "var(--text)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Print Preview</h2>
                <button style={btnOutline} onClick={() => setShowPrintPreview(false)}>Close</button>
              </div>

              {/* print option checkboxes */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                {([
                  ["legalFees", "Legal Fees"], ["paFees", "PA Fees"], ["priorPayments", "Prior Payments"], ["repairs", "Repairs"], ["subLimits", "Sub-Limits"],
                ] as const).map(([k, label]) => (
                  <label key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }}>
                    <input type="checkbox" checked={printOptions[k]} onChange={() => setPrintOptions((prev) => ({ ...prev, [k]: !prev[k] }))} />
                    {label}
                  </label>
                ))}
              </div>

              {/* formatted summary */}
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>{releaseType} Settlement Breakdown</p>
                <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 16 }}>{openingStatement}</p>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <tbody>
                    <tr><td style={{ padding: "4px 0" }}>Coverage A (Dwelling)</td><td style={{ textAlign: "right" }}>{fmt(cappedA)}</td></tr>
                    <tr><td style={{ padding: "4px 0" }}>Coverage B (Other Structures)</td><td style={{ textAlign: "right" }}>{fmt(cappedB)}</td></tr>
                    <tr><td style={{ padding: "4px 0" }}>Coverage C (Personal Property)</td><td style={{ textAlign: "right" }}>{fmt(cappedC)}</td></tr>
                    <tr><td style={{ padding: "4px 0" }}>Coverage D (Loss of Use)</td><td style={{ textAlign: "right" }}>{fmt(cappedD)}</td></tr>
                    {printOptions.subLimits && endorsementTotal > 0 && (
                      <tr><td style={{ padding: "4px 0" }}>Endorsements / Sub-Limits</td><td style={{ textAlign: "right" }}>{fmt(endorsementTotal)}</td></tr>
                    )}
                    <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 700 }}><td style={{ padding: "6px 0" }}>Total Coverage</td><td style={{ textAlign: "right" }}>{fmt(totalCoverage)}</td></tr>

                    {totalDeductions > 0 && <tr><td style={{ padding: "4px 0", color: "var(--red)" }}>Less: Deductions</td><td style={{ textAlign: "right", color: "var(--red)" }}>({fmt(totalDeductions)})</td></tr>}
                    {printOptions.priorPayments && priorPaymentsTotal > 0 && <tr><td style={{ padding: "4px 0", color: "var(--red)" }}>Less: Prior Payments</td><td style={{ textAlign: "right", color: "var(--red)" }}>({fmt(priorPaymentsTotal)})</td></tr>}
                    {printOptions.legalFees && paymentsWithoutFeesTotal > 0 && <tr><td style={{ padding: "4px 0", color: "var(--red)" }}>Less: Payments Without Fees</td><td style={{ textAlign: "right", color: "var(--red)" }}>({fmt(paymentsWithoutFeesTotal)})</td></tr>}
                    <tr><td style={{ padding: "4px 0", color: "var(--red)" }}>Less: Deductible</td><td style={{ textAlign: "right", color: "var(--red)" }}>({fmt(effectiveDeductible)})</td></tr>

                    <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 700 }}><td style={{ padding: "6px 0" }}>Balance Before PA Fees</td><td style={{ textAlign: "right" }}>{fmt(balanceBeforePAFees)}</td></tr>

                    {printOptions.paFees && (
                      <>
                        <tr><td style={{ padding: "4px 0" }}>Current PA Fees</td><td style={{ textAlign: "right" }}>{fmt(currentPAFees)}</td></tr>
                        {priorPAFees > 0 && <tr><td style={{ padding: "4px 0" }}>Prior PA Fees</td><td style={{ textAlign: "right" }}>{fmt(priorPAFees)}</td></tr>}
                      </>
                    )}

                    <tr style={{ borderTop: "1px solid var(--border)", fontWeight: 700, color: "var(--green)" }}><td style={{ padding: "6px 0" }}>Balance After PA Fees</td><td style={{ textAlign: "right" }}>{fmt(finalBalance)}</td></tr>
                    <tr style={{ fontWeight: 700, color: "var(--green)" }}><td style={{ padding: "4px 0" }}>Balance + Deductible</td><td style={{ textAlign: "right" }}>{fmt(balancePlusDeductible)}</td></tr>

                    {printOptions.repairs && totalRepairCosts > 0 && <tr><td style={{ padding: "4px 0", color: "var(--red)" }}>Less: Total Repair Costs</td><td style={{ textAlign: "right", color: "var(--red)" }}>({fmt(totalRepairCosts)})</td></tr>}

                    <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                      <td style={{ padding: "8px 0", color: trafficLight === "green" ? "var(--green)" : trafficLight === "yellow" ? "var(--amber)" : "var(--red)" }}>
                        {trafficLight === "green" ? "Final Balance" : trafficLight === "yellow" ? "Possibly Recoverable" : "Additional Cost to Insured"}
                      </td>
                      <td style={{ textAlign: "right", color: trafficLight === "green" ? "var(--green)" : trafficLight === "yellow" ? "var(--amber)" : "var(--red)" }}>
                        {fmt(Math.abs(finalBalanceAmount))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 20, textAlign: "right" }}>
                <button style={btnPrimary} onClick={() => window.print()}>Print</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* print-only view */}
      <div className="print-only" style={{ display: "none", padding: 40, color: "#000", fontSize: 13 }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>{releaseType} Settlement Breakdown</h1>
        <p style={{ fontSize: 11, color: "#666", marginBottom: 20 }}>{openingStatement}</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={{ padding: "4px 0", borderBottom: "1px solid #ddd" }}>Total Coverage</td><td style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}>{fmt(totalCoverage)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Deductions</td><td style={{ textAlign: "right" }}>({fmt(totalDeductions)})</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Deductible</td><td style={{ textAlign: "right" }}>({fmt(effectiveDeductible)})</td></tr>
            <tr style={{ fontWeight: 700, borderTop: "1px solid #000" }}><td style={{ padding: "4px 0" }}>Balance Before PA Fees</td><td style={{ textAlign: "right" }}>{fmt(balanceBeforePAFees)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>PA Fees</td><td style={{ textAlign: "right" }}>({fmt(currentPAFees)})</td></tr>
            <tr style={{ fontWeight: 700, borderTop: "1px solid #000" }}><td style={{ padding: "6px 0" }}>Balance After PA Fees</td><td style={{ textAlign: "right" }}>{fmt(finalBalance)}</td></tr>
            <tr style={{ fontWeight: 700 }}><td style={{ padding: "4px 0" }}>Total Possible Recovered</td><td style={{ textAlign: "right" }}>{fmt(totalPossibleRecovered)}</td></tr>
            {totalRepairCosts > 0 && <tr><td style={{ padding: "4px 0" }}>Total Repair Costs</td><td style={{ textAlign: "right" }}>({fmt(totalRepairCosts)})</td></tr>}
            <tr style={{ fontWeight: 700, borderTop: "2px solid #000", fontSize: 15 }}><td style={{ padding: "8px 0" }}>Final Balance</td><td style={{ textAlign: "right" }}>{fmt(Math.abs(finalBalanceAmount))}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
