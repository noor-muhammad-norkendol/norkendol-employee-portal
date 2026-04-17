"use client";

import React from "react";
import {
  CreateClientInput,
  PERIL_OPTIONS,
  ONBOARD_TYPE_OPTIONS,
  ASSIGNMENT_TYPE_OPTIONS,
  STATUS_CLAIM_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
} from "@/types/onboarder-kpi";
import type { ClaimLookupMatch, LookupField } from "@/hooks/useClaimLookup";
import ClaimMatchBanner from "@/components/ClaimMatchBanner";
import { cardStyle, inputStyle, labelStyle, selectStyle, btnPrimary, btnOutline } from "./styles";
import UserAutocomplete from "./UserAutocomplete";

interface AddClientFormProps {
  form: CreateClientInput;
  editId: string | null;
  formError: string | null;
  saving: boolean;
  userName: string | null;
  // AI Assist
  showAIAssist: boolean;
  aiEmailText: string;
  aiParsing: boolean;
  aiError: string | null;
  onSetShowAIAssist: (v: boolean) => void;
  onSetAiEmailText: (v: string) => void;
  onAIParse: () => void;
  onSetAiError: (v: string | null) => void;
  // Claim lookup
  claimMatches: ClaimLookupMatch[];
  claimSearching: boolean;
  lookupField: LookupField;
  onSetLookupField: (f: LookupField) => void;
  onClaimAccept: (m: ClaimLookupMatch) => void;
  onClearLookup: () => void;
  // Form
  onSet: (key: string, value: unknown) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function AddClientForm({
  form, editId, formError, saving, userName,
  showAIAssist, aiEmailText, aiParsing, aiError,
  onSetShowAIAssist, onSetAiEmailText, onAIParse, onSetAiError,
  claimMatches, claimSearching, lookupField, onSetLookupField, onClaimAccept, onClearLookup,
  onSet, onSubmit, onCancel,
}: AddClientFormProps) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {editId ? "Edit Client" : "New Client"}
          </h2>
          <button
            style={{ ...btnOutline, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)", borderColor: "var(--accent)" }}
            onClick={() => onSetShowAIAssist(true)}
          >
            <span style={{ fontSize: 16 }}>&#x1F916;</span> AI Assist
          </button>
        </div>
        {userName && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{userName}</span>
        )}
      </div>

      {/* AI Assist Modal */}
      {showAIAssist && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) onSetShowAIAssist(false); }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 600, border: "1px solid var(--border-color)", maxHeight: "80vh", overflow: "auto" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>AI Assist — Paste Onboarding Email</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
              Paste the onboarding form submission email below and click Extract. The AI will pull out all the client data and fill the form.
            </p>
            <textarea
              style={{ ...inputStyle, minHeight: 220, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
              value={aiEmailText}
              onChange={(e) => onSetAiEmailText(e.target.value)}
              placeholder="Paste the full onboarding email here..."
              autoFocus
            />
            {aiError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", marginTop: 8, color: "#ef4444", fontSize: 12 }}>
                {aiError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button style={btnOutline} onClick={() => { onSetShowAIAssist(false); onSetAiEmailText(""); onSetAiError(null); }}>Cancel</button>
              <button
                style={{ ...btnPrimary, opacity: !aiEmailText.trim() || aiParsing ? 0.5 : 1 }}
                onClick={onAIParse}
                disabled={!aiEmailText.trim() || aiParsing}
              >
                {aiParsing ? "Extracting..." : "Extract & Fill Form"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Section: Policyholder ─── */}
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Policyholder</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Policyholder Name * — First</label>
          <input style={inputStyle} value={form.client_first_name || ""} onChange={(e) => { onSet("client_first_name", e.target.value || null); const full = [e.target.value, form.client_last_name].filter(Boolean).join(" "); onSet("client_name", full); if (full.length >= 3 && !form.claim_number && !form.file_number) onSetLookupField('client_name'); }} placeholder="First" />
        </div>
        <div>
          <label style={labelStyle}>Last</label>
          <input style={inputStyle} value={form.client_last_name || ""} onChange={(e) => { onSet("client_last_name", e.target.value || null); const full = [form.client_first_name, e.target.value].filter(Boolean).join(" "); onSet("client_name", full); }} placeholder="Last" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Additional Policyholder Name — First</label>
          <input style={inputStyle} value={form.additional_policyholder_first || ""} onChange={(e) => onSet("additional_policyholder_first", e.target.value || null)} placeholder="First" />
        </div>
        <div>
          <label style={labelStyle}>Last</label>
          <input style={inputStyle} value={form.additional_policyholder_last || ""} onChange={(e) => onSet("additional_policyholder_last", e.target.value || null)} placeholder="Last" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Policyholder Email *</label>
          <input style={inputStyle} value={form.email || ""} onChange={(e) => onSet("email", e.target.value || null)} placeholder="Enter email" />
        </div>
        <div>
          <label style={labelStyle}>Additional Policyholder Email</label>
          <input style={inputStyle} value={form.additional_policyholder_email || ""} onChange={(e) => onSet("additional_policyholder_email", e.target.value || null)} placeholder="Enter email" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Policyholder Phone *</label>
          <input style={inputStyle} value={form.phone || ""} onChange={(e) => onSet("phone", e.target.value || null)} placeholder="Enter phone" />
        </div>
        <div>
          <label style={labelStyle}>Additional Policyholder Phone</label>
          <input style={inputStyle} value={form.additional_policyholder_phone || ""} onChange={(e) => onSet("additional_policyholder_phone", e.target.value || null)} placeholder="Enter phone" />
        </div>
      </div>

      {/* ─── Section: Loss Info ─── */}
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Loss Info</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>What State is Loss Located? *</label>
          <input style={inputStyle} value={form.state || ""} onChange={(e) => onSet("state", e.target.value || null)} placeholder="2-letter state code" maxLength={2} />
        </div>
        <div>
          <label style={labelStyle}>Date of Loss *</label>
          <input type="date" style={inputStyle} value={form.date_of_loss || ""} onChange={(e) => onSet("date_of_loss", e.target.value || null)} />
        </div>
        <div>
          <label style={labelStyle}>Cause of Loss *</label>
          <select style={selectStyle} value={form.peril || ""} onChange={(e) => onSet("peril", e.target.value || null)}>
            <option value="">Select cause</option>
            {PERIL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, marginTop: 8 }}>Address of Loss *</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 4 }}>
        <input style={inputStyle} value={form.loss_street || ""} onChange={(e) => onSet("loss_street", e.target.value || null)} placeholder="Street" />
        <input style={inputStyle} value={form.loss_line2 || ""} onChange={(e) => onSet("loss_line2", e.target.value || null)} placeholder="Address Line 2" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <input style={inputStyle} value={form.loss_city || ""} onChange={(e) => onSet("loss_city", e.target.value || null)} placeholder="City" />
        <input style={inputStyle} value={form.loss_state || ""} onChange={(e) => onSet("loss_state", e.target.value || null)} placeholder="State" maxLength={2} />
        <input style={inputStyle} value={form.loss_zip || ""} onChange={(e) => onSet("loss_zip", e.target.value || null)} placeholder="ZIP" />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Loss/Damage Description *</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.loss_description || ""} onChange={(e) => onSet("loss_description", e.target.value || null)} placeholder="Describe the loss or damage" maxLength={205} />
      </div>

      {/* Claim lookup banner */}
      <ClaimMatchBanner matches={claimMatches} searching={claimSearching} onAccept={onClaimAccept} onDismiss={onClearLookup} />

      {/* ─── Section: Parties ─── */}
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Parties</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Contractor Company Name</label>
          <input style={inputStyle} value={form.contractor_company || ""} onChange={(e) => onSet("contractor_company", e.target.value || null)} placeholder="Enter company name" />
        </div>
        <div>
          <label style={labelStyle}>Contractor Name</label>
          <input style={inputStyle} value={form.contractor_name || ""} onChange={(e) => onSet("contractor_name", e.target.value || null)} placeholder="Enter contractor name" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Contractor Email</label>
          <input style={inputStyle} value={form.contractor_email || ""} onChange={(e) => onSet("contractor_email", e.target.value || null)} placeholder="Enter email" />
        </div>
        <div>
          <label style={labelStyle}>Contractor Phone</label>
          <input style={inputStyle} value={form.contractor_phone || ""} onChange={(e) => onSet("contractor_phone", e.target.value || null)} placeholder="Enter phone" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Referral Source</label>
          <select style={selectStyle} value={REFERRAL_SOURCE_OPTIONS.includes(form.referral_source || "") ? form.referral_source || "" : form.referral_source ? "Other" : ""} onChange={(e) => { if (e.target.value === "Other") { onSet("referral_source", "Other"); } else { onSet("referral_source", e.target.value || null); } }}>
            <option value="">Select referral source</option>
            {REFERRAL_SOURCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {(form.referral_source === "Other" || (form.referral_source && !REFERRAL_SOURCE_OPTIONS.includes(form.referral_source))) && (
          <div>
            <label style={labelStyle}>Specify Referral Source</label>
            <input style={inputStyle} value={form.referral_source === "Other" ? "" : form.referral_source || ""} onChange={(e) => onSet("referral_source", e.target.value || "Other")} placeholder="Type referral source" autoFocus />
          </div>
        )}
        <div>
          <label style={labelStyle}>Source Email</label>
          <input style={inputStyle} value={form.source_email || ""} onChange={(e) => onSet("source_email", e.target.value || null)} placeholder="Enter source email" />
        </div>
      </div>

      {/* ─── Section: Claim & Assignment ─── */}
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Claim & Assignment</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>What type of assignment? *</label>
          <select style={selectStyle} value={form.assignment_type || ""} onChange={(e) => onSet("assignment_type", e.target.value || null)}>
            <option value="">Select assignment type</option>
            {ASSIGNMENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Insurance Company *</label>
          <input style={inputStyle} value={form.insurance_company || ""} onChange={(e) => onSet("insurance_company", e.target.value || null)} placeholder="Enter insurance company" />
        </div>
        <div>
          <label style={labelStyle}>Policy Number *</label>
          <input style={inputStyle} value={form.policy_number || ""} onChange={(e) => onSet("policy_number", e.target.value || null)} placeholder="Enter policy number" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Status of Claim *</label>
          <select style={selectStyle} value={form.status_claim || ""} onChange={(e) => onSet("status_claim", e.target.value || null)}>
            <option value="">Select claim status</option>
            {STATUS_CLAIM_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Claim Number</label>
          <input style={inputStyle} value={form.claim_number || ""} onChange={(e) => { onSet("claim_number", e.target.value || null); if (e.target.value.length >= 3) onSetLookupField('claim_number'); }} placeholder="Enter claim number" />
        </div>
        <div>
          <label style={labelStyle}>File Number {!editId && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(auto-generated)</span>}</label>
          <input style={{ ...inputStyle, background: !editId ? "var(--bg-page)" : inputStyle.background, color: form.file_number ? "var(--text-primary)" : "var(--text-muted)" }} value={form.file_number || ""} readOnly={!editId} onChange={editId ? (e) => { onSet("file_number", e.target.value || null); if (e.target.value.length >= 3) onSetLookupField('file_number'); } : undefined} placeholder={!editId ? "Fills when state is entered" : "File #"} />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>If Supplement Dollar Amount Paid/Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={form.supplement_notes || ""} onChange={(e) => onSet("supplement_notes", e.target.value || null)} placeholder="Enter supplement details or notes" />
      </div>

      {/* ─── Section: Assignment ─── */}
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Assignment</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Assigned User</label>
          <UserAutocomplete
            value={form.assigned_user_name || ""}
            onSelect={(id, name) => { onSet("assigned_user_id", id); onSet("assigned_user_name", name); }}
            onChange={(text) => onSet("assigned_user_name", text || null)}
            placeholder="Start typing a name..."
          />
        </div>
        <div>
          <label style={labelStyle}>Assigned PA {(form.state || form.loss_state) && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(licensed in {(form.state || form.loss_state || "").toUpperCase()})</span>}</label>
          <UserAutocomplete
            value={form.assigned_pa_name || ""}
            onSelect={(_id, name) => onSet("assigned_pa_name", name)}
            onChange={(text) => onSet("assigned_pa_name", text || null)}
            placeholder="Start typing a name..."
            requireLicenseInState={form.state || form.loss_state || null}
          />
        </div>
        <div>
          <label style={labelStyle}>Onboard Type</label>
          <select style={selectStyle} value={form.onboard_type || ""} onChange={(e) => onSet("onboard_type", e.target.value || null)}>
            <option value="">Select...</option>
            {ONBOARD_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* ─── Section: Notes ─── */}
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</p>
      <div style={{ marginBottom: 20 }}>
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes || ""} onChange={(e) => onSet("notes", e.target.value || null)} placeholder="Enter any additional notes..." />
      </div>

      {formError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#ef4444", fontSize: 13 }}>
          {formError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button style={btnPrimary} onClick={onSubmit} disabled={saving}>
          {saving ? "Saving..." : editId ? "Update Client" : "Save Entry"}
        </button>
        <button style={btnOutline} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
