"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import KPIAdminTab from "./KPIAdminTab";

/* ── Types ───────────────────────────────────────────── */

interface HierarchyNode {
  id: string;
  org_id: string;
  name: string;
  title: string;
  reports_to: string | null;
  linked_user_id: string | null;
  created_at: string;
}

interface FeatureAssignment {
  id: string;
  hierarchy_id: string;
  feature_key: string;
  is_owner: boolean;
}

interface FeatureTemplate {
  id: string;
  feature_key: string;
  name: string;
}

interface OrgUser {
  id: string;
  email: string;
  full_name: string | null;
}

interface Interview {
  id: string;
  hierarchy_id: string;
  status: "pending" | "in_progress" | "completed";
  questions: { text: string; answer?: string }[];
  suggestions?: AlertSuggestion[];
  created_at: string;
}

interface AlertSuggestion {
  feature_key: string;
  condition: string;
  route_to_hierarchy_id: string;
  delivery: "push" | "digest" | "both";
}

interface RoutingRule {
  id: string;
  org_id: string;
  feature_key: string;
  condition: string;
  route_to_hierarchy_id: string;
  delivery: "push" | "digest" | "both";
  active: boolean;
}

import { cardStyle, inputStyle, labelStyle, selectStyle, btnPrimary, btnOutline, overlayStyle } from "@/lib/styles";

/* ── Styles (local overrides) ───────────────────────── */

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border-color)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-color)",
};

const btnDanger: React.CSSProperties = {
  background: "#dc3545",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const modalStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-color)",
  borderRadius: 12,
  width: "100%",
  maxWidth: 600,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  color: active ? "var(--accent)" : "var(--text-secondary)",
  background: "transparent",
  borderTop: "none",
  borderLeft: "none",
  borderRight: "none",
  borderBottomWidth: 2,
  borderBottomStyle: "solid",
  borderBottomColor: active ? "var(--accent)" : "transparent",
});

const sidePanelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: 420,
  height: "100vh",
  background: "var(--bg-secondary)",
  borderLeft: "1px solid var(--border-color)",
  zIndex: 40,
  overflowY: "auto",
  padding: "24px",
  boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
};

/* ── Helpers ───────────────────────────────────────────── */

function buildTree(nodes: HierarchyNode[]): Map<string | null, HierarchyNode[]> {
  const map = new Map<string | null, HierarchyNode[]>();
  for (const n of nodes) {
    const key = n.reports_to;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  return map;
}

/* ── Main Page ───────────────────────────────────────── */

export default function ExecutiveIntelligencePage() {
  const supabase = createClient();

  const [orgId, setOrgId] = useState("");
  const [activeTab, setActiveTab] = useState<"hierarchy" | "features" | "alerts" | "kpis" | "kpi_admin">("hierarchy");

  // KPI data from kpi_snapshots
  const [kpiSnapshots, setKpiSnapshots] = useState<{ metric_key: string; metric_value: number; metric_unit: string; source_module: string; period_end: string }[]>([]);

  // Data
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [features, setFeatures] = useState<FeatureAssignment[]>([]);
  const [templates, setTemplates] = useState<FeatureTemplate[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);

  // UI state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [editingNode, setEditingNode] = useState<HierarchyNode | null>(null);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<string | null>(null);
  const [featureSearch, setFeatureSearch] = useState("");
  const [interviewState, setInterviewState] = useState<{
    hierarchyId: string;
    questions: { text: string; answer?: string }[];
    currentQ: number;
    loading: boolean;
    submitted: boolean;
    suggestions: AlertSuggestion[];
  } | null>(null);

  // Form state
  const [personForm, setPersonForm] = useState({ name: "", title: "", reports_to: "", linked_user_id: "" });
  const [ruleForm, setRuleForm] = useState({ feature_key: "", condition: "", route_to_hierarchy_id: "", delivery: "push" as "push" | "digest" | "both" });

  /* ── Fetch org ───────────────────────────────────── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("users").select("org_id").eq("id", user.id).single()
          .then(({ data }) => { if (data) setOrgId(data.org_id); });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Fetch all data when orgId is set ────────────── */
  const fetchHierarchy = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("org_hierarchy").select("*").eq("org_id", orgId).order("name");
    if (data) setHierarchy(data);
  }, [orgId, supabase]);

  const fetchFeatures = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("hierarchy_feature_assignments").select("*");
    if (data) setFeatures(data);
  }, [orgId, supabase]);

  const fetchTemplates = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("ai_context_templates").select("id, feature_key, name");
    if (data) setTemplates(data);
  }, [orgId, supabase]);

  const fetchUsers = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("users").select("id, email, full_name").eq("org_id", orgId);
    if (data) setOrgUsers(data);
  }, [orgId, supabase]);

  const fetchInterviews = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("ai_onboarding_interviews").select("*");
    if (data) setInterviews(data);
  }, [orgId, supabase]);

  const fetchRoutingRules = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("alert_routing_rules").select("*").eq("org_id", orgId).order("feature_key");
    if (data) setRoutingRules(data);
  }, [orgId, supabase]);

  const fetchKPISnapshots = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("kpi_snapshots")
      .select("metric_key, metric_value, metric_unit, source_module, period_end")
      .eq("org_id", orgId)
      .order("period_end", { ascending: false })
      .limit(100);
    if (data) setKpiSnapshots(data);
  }, [orgId, supabase]);

  useEffect(() => {
    if (!orgId) return;
    fetchHierarchy();
    fetchFeatures();
    fetchTemplates();
    fetchUsers();
    fetchInterviews();
    fetchRoutingRules();
    fetchKPISnapshots();
  }, [orgId, fetchHierarchy, fetchFeatures, fetchTemplates, fetchUsers, fetchInterviews, fetchRoutingRules, fetchKPISnapshots]);

  /* ── Hierarchy CRUD ─────────────────────────────── */
  const handleAddPerson = async () => {
    if (!personForm.name.trim() || !personForm.title.trim()) return;
    await supabase.from("org_hierarchy").insert({
      org_id: orgId,
      name: personForm.name.trim(),
      title: personForm.title.trim(),
      reports_to: personForm.reports_to || null,
      linked_user_id: personForm.linked_user_id || null,
    });
    setPersonForm({ name: "", title: "", reports_to: "", linked_user_id: "" });
    setShowAddPersonModal(false);
    fetchHierarchy();
  };

  const handleEditPerson = async () => {
    if (!editingNode || !personForm.name.trim() || !personForm.title.trim()) return;
    await supabase.from("org_hierarchy").update({
      name: personForm.name.trim(),
      title: personForm.title.trim(),
      reports_to: personForm.reports_to || null,
      linked_user_id: personForm.linked_user_id || null,
    }).eq("id", editingNode.id);
    setEditingNode(null);
    setPersonForm({ name: "", title: "", reports_to: "", linked_user_id: "" });
    fetchHierarchy();
  };

  const handleDeletePerson = async (id: string) => {
    await supabase.from("org_hierarchy").delete().eq("id", id);
    setConfirmDelete(null);
    if (selectedNodeId === id) setSelectedNodeId(null);
    fetchHierarchy();
    fetchFeatures();
  };

  /* ── Feature Assignment CRUD ────────────────────── */
  const nodeFeatures = (hierarchyId: string) => features.filter((f) => f.hierarchy_id === hierarchyId);

  const handleAddFeature = async (hierarchyId: string, featureKey: string) => {
    await supabase.from("hierarchy_feature_assignments").insert({
      hierarchy_id: hierarchyId,
      feature_key: featureKey,
      is_owner: false,
    });
    fetchFeatures();
  };

  const handleToggleOwner = async (assignmentId: string, current: boolean) => {
    await supabase.from("hierarchy_feature_assignments").update({ is_owner: !current }).eq("id", assignmentId);
    fetchFeatures();
  };

  const handleRemoveFeature = async (assignmentId: string) => {
    await supabase.from("hierarchy_feature_assignments").delete().eq("id", assignmentId);
    fetchFeatures();
  };

  /* ── AI Interview ───────────────────────────────── */
  const handleStartInterview = async (hierarchyId: string) => {
    setInterviewState({ hierarchyId, questions: [], currentQ: 0, loading: true, submitted: false, suggestions: [] });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/executive/onboarding-interview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ hierarchy_id: hierarchyId }),
      });
      const result = await res.json();
      if (result.questions) {
        setInterviewState((prev) =>
          prev ? { ...prev, questions: result.questions.map((q: string) => ({ text: q })), loading: false } : null
        );
      }
    } catch {
      setInterviewState(null);
    }
  };

  const handleAnswerChange = (idx: number, answer: string) => {
    setInterviewState((prev) => {
      if (!prev) return null;
      const qs = [...prev.questions];
      qs[idx] = { ...qs[idx], answer };
      return { ...prev, questions: qs };
    });
  };

  const handleSubmitInterview = async () => {
    if (!interviewState) return;
    setInterviewState((prev) => (prev ? { ...prev, loading: true } : null));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/executive/onboarding-interview", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          hierarchy_id: interviewState.hierarchyId,
          answers: interviewState.questions.map((q) => ({ text: q.text, answer: q.answer || "" })),
        }),
      });
      const result = await res.json();
      setInterviewState((prev) =>
        prev ? { ...prev, loading: false, submitted: true, suggestions: result.suggestions || [] } : null
      );
      fetchInterviews();
    } catch {
      setInterviewState((prev) => (prev ? { ...prev, loading: false } : null));
    }
  };

  const handleAcceptSuggestion = async (suggestion: AlertSuggestion) => {
    await supabase.from("alert_routing_rules").insert({
      org_id: orgId,
      feature_key: suggestion.feature_key,
      condition: suggestion.condition,
      route_to_hierarchy_id: suggestion.route_to_hierarchy_id,
      delivery: suggestion.delivery,
      active: true,
    });
    fetchRoutingRules();
  };

  /* ── Routing Rule CRUD ──────────────────────────── */
  const handleAddRule = async () => {
    if (!ruleForm.feature_key || !ruleForm.condition.trim() || !ruleForm.route_to_hierarchy_id) return;
    await supabase.from("alert_routing_rules").insert({
      org_id: orgId,
      ...ruleForm,
      active: true,
    });
    setRuleForm({ feature_key: "", condition: "", route_to_hierarchy_id: "", delivery: "push" });
    setShowAddRuleModal(false);
    fetchRoutingRules();
  };

  const handleEditRule = async () => {
    if (!editingRule) return;
    await supabase.from("alert_routing_rules").update({
      feature_key: ruleForm.feature_key,
      condition: ruleForm.condition,
      route_to_hierarchy_id: ruleForm.route_to_hierarchy_id,
      delivery: ruleForm.delivery,
    }).eq("id", editingRule.id);
    setEditingRule(null);
    setRuleForm({ feature_key: "", condition: "", route_to_hierarchy_id: "", delivery: "push" });
    fetchRoutingRules();
  };

  const handleDeleteRule = async (id: string) => {
    await supabase.from("alert_routing_rules").delete().eq("id", id);
    setConfirmDeleteRule(null);
    fetchRoutingRules();
  };

  const handleToggleRuleActive = async (id: string, current: boolean) => {
    await supabase.from("alert_routing_rules").update({ active: !current }).eq("id", id);
    fetchRoutingRules();
  };

  /* ── Derived data ───────────────────────────────── */
  const treeMap = buildTree(hierarchy);
  const selectedNode = hierarchy.find((n) => n.id === selectedNodeId) || null;
  const selectedNodeUser = selectedNode?.linked_user_id ? orgUsers.find((u) => u.id === selectedNode.linked_user_id) : null;
  const selectedNodeFeatures = selectedNode ? nodeFeatures(selectedNode.id) : [];
  const selectedInterview = selectedNode ? interviews.find((i) => i.hierarchy_id === selectedNode.id) : null;

  const getInterviewStatus = (hId: string): "Not Started" | "In Progress" | "Completed" => {
    const iv = interviews.find((i) => i.hierarchy_id === hId);
    if (!iv) return "Not Started";
    return iv.status === "completed" ? "Completed" : "In Progress";
  };

  const getNodeName = (id: string) => hierarchy.find((n) => n.id === id)?.name || "Unknown";

  /* ── Toggle expand ──────────────────────────────── */
  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Render tree recursively ────────────────────── */
  const renderTreeNode = (node: HierarchyNode, depth: number): React.ReactNode => {
    const children = treeMap.get(node.id) || [];
    const hasChildren = children.length > 0;
    const expanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id}>
        <div
          onClick={() => setSelectedNodeId(node.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            paddingLeft: 12 + depth * 24,
            cursor: "pointer",
            borderRadius: 6,
            background: isSelected ? "var(--bg-hover)" : "transparent",
            marginBottom: 2,
          }}
        >
          {hasChildren ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer", width: 16, textAlign: "center" }}
            >
              {expanded ? "\u25BC" : "\u25B6"}
            </span>
          ) : (
            <span style={{ width: 16 }} />
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{node.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{node.title}</div>
          </div>
        </div>
        {hasChildren && expanded && children.map((child) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  /* ── Person Modal Content ───────────────────────── */
  const renderPersonForm = (onSubmit: () => void, submitLabel: string) => (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={labelStyle}>Name *</label>
        <input style={inputStyle} value={personForm.name} onChange={(e) => setPersonForm((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>Title *</label>
        <input style={inputStyle} value={personForm.title} onChange={(e) => setPersonForm((p) => ({ ...p, title: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>Reports To</label>
        <select style={selectStyle} value={personForm.reports_to} onChange={(e) => setPersonForm((p) => ({ ...p, reports_to: e.target.value }))}>
          <option value="">None (Root)</option>
          {hierarchy.filter((n) => n.id !== editingNode?.id).map((n) => (
            <option key={n.id} value={n.id}>{n.name} - {n.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Link to User</label>
        <select style={selectStyle} value={personForm.linked_user_id} onChange={(e) => setPersonForm((p) => ({ ...p, linked_user_id: e.target.value }))}>
          <option value="">None</option>
          {orgUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button
          style={btnOutline}
          onClick={() => {
            setShowAddPersonModal(false);
            setEditingNode(null);
            setPersonForm({ name: "", title: "", reports_to: "", linked_user_id: "" });
          }}
        >
          Cancel
        </button>
        <button style={btnPrimary} onClick={onSubmit}>{submitLabel}</button>
      </div>
    </div>
  );

  /* ── Rule Modal Content ─────────────────────────── */
  const renderRuleForm = (onSubmit: () => void, submitLabel: string) => (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={labelStyle}>Feature *</label>
        <select style={selectStyle} value={ruleForm.feature_key} onChange={(e) => setRuleForm((p) => ({ ...p, feature_key: e.target.value }))}>
          <option value="">Select feature...</option>
          {templates.map((t) => (
            <option key={t.id} value={t.feature_key}>{t.name || t.feature_key}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Condition *</label>
        <input style={inputStyle} placeholder="Plain English description..." value={ruleForm.condition} onChange={(e) => setRuleForm((p) => ({ ...p, condition: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>Route To *</label>
        <select style={selectStyle} value={ruleForm.route_to_hierarchy_id} onChange={(e) => setRuleForm((p) => ({ ...p, route_to_hierarchy_id: e.target.value }))}>
          <option value="">Select person...</option>
          {hierarchy.map((n) => (
            <option key={n.id} value={n.id}>{n.name} - {n.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Delivery</label>
        <select style={selectStyle} value={ruleForm.delivery} onChange={(e) => setRuleForm((p) => ({ ...p, delivery: e.target.value as "push" | "digest" | "both" }))}>
          <option value="push">Push</option>
          <option value="digest">Digest</option>
          <option value="both">Both</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button
          style={btnOutline}
          onClick={() => {
            setShowAddRuleModal(false);
            setEditingRule(null);
            setRuleForm({ feature_key: "", condition: "", route_to_hierarchy_id: "", delivery: "push" });
          }}
        >
          Cancel
        </button>
        <button style={btnPrimary} onClick={onSubmit}>{submitLabel}</button>
      </div>
    </div>
  );

  /* ── Side Panel ─────────────────────────────────── */
  const renderSidePanel = () => {
    if (!selectedNode) return null;

    const assignedKeys = new Set(selectedNodeFeatures.map((f) => f.feature_key));
    const availableTemplates = templates.filter((t) => !assignedKeys.has(t.feature_key));
    const hasFeatures = selectedNodeFeatures.length > 0;

    return (
      <div style={sidePanelStyle}>
        {/* Close button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>{selectedNode.name}</h3>
          <button style={{ ...btnOutline, padding: "4px 10px" }} onClick={() => setSelectedNodeId(null)}>X</button>
        </div>

        {/* Info */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Title: <span style={{ color: "var(--text-primary)" }}>{selectedNode.title}</span></div>
          {selectedNodeUser && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Linked User: <span style={{ color: "var(--text-primary)" }}>{selectedNodeUser.email}</span></div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              style={btnOutline}
              onClick={() => {
                setEditingNode(selectedNode);
                setPersonForm({
                  name: selectedNode.name,
                  title: selectedNode.title,
                  reports_to: selectedNode.reports_to || "",
                  linked_user_id: selectedNode.linked_user_id || "",
                });
              }}
            >
              Edit
            </button>
            <button style={btnDanger} onClick={() => setConfirmDelete(selectedNode.id)}>Remove</button>
          </div>
        </div>

        {/* Feature Assignments */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, color: "var(--text-primary)" }}>Feature Assignments</h4>
          </div>
          {selectedNodeFeatures.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>No features assigned.</div>
          )}
          {selectedNodeFeatures.map((fa) => (
            <div key={fa.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{fa.feature_key}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input type="checkbox" checked={fa.is_owner} onChange={() => handleToggleOwner(fa.id, fa.is_owner)} />
                  Owner
                </label>
                <button style={{ ...btnOutline, padding: "2px 6px", fontSize: 11 }} onClick={() => handleRemoveFeature(fa.id)}>X</button>
              </div>
            </div>
          ))}
          {availableTemplates.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <select
                style={{ ...selectStyle, fontSize: 12 }}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddFeature(selectedNode.id, e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">+ Add Feature...</option>
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.feature_key}>{t.name || t.feature_key}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* AI Interview */}
        <div style={cardStyle}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: 14, color: "var(--text-primary)" }}>AI Interview</h4>

          {/* Active interview form */}
          {interviewState && interviewState.hierarchyId === selectedNode.id ? (
            <div>
              {interviewState.loading ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>Loading...</div>
              ) : interviewState.submitted ? (
                <div>
                  <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 8 }}>Interview Completed</div>
                  {interviewState.questions.map((q, i) => (
                    <div key={i} style={{ marginBottom: 10, padding: 8, background: "var(--bg-surface)", borderRadius: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Q{i + 1}: {q.text}</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{q.answer || "(no answer)"}</div>
                    </div>
                  ))}
                  {interviewState.suggestions.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Suggested Alert Routing</div>
                      {interviewState.suggestions.map((s, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-color)" }}>
                          <div style={{ fontSize: 12, color: "var(--text-primary)" }}>
                            {s.feature_key}: {s.condition} → {getNodeName(s.route_to_hierarchy_id)} ({s.delivery})
                          </div>
                          <button style={{ ...btnPrimary, padding: "4px 10px", fontSize: 11 }} onClick={() => handleAcceptSuggestion(s)}>Accept</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button style={{ ...btnOutline, marginTop: 10 }} onClick={() => setInterviewState(null)}>Close</button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                    Question {interviewState.currentQ + 1} of {interviewState.questions.length}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
                    {interviewState.questions[interviewState.currentQ]?.text}
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                    value={interviewState.questions[interviewState.currentQ]?.answer || ""}
                    onChange={(e) => handleAnswerChange(interviewState.currentQ, e.target.value)}
                    placeholder="Type your answer..."
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {interviewState.currentQ > 0 && (
                      <button style={btnOutline} onClick={() => setInterviewState((p) => p ? { ...p, currentQ: p.currentQ - 1 } : null)}>Back</button>
                    )}
                    {interviewState.currentQ < interviewState.questions.length - 1 ? (
                      <button style={btnPrimary} onClick={() => setInterviewState((p) => p ? { ...p, currentQ: p.currentQ + 1 } : null)}>Next Question</button>
                    ) : (
                      <button style={btnPrimary} onClick={handleSubmitInterview}>Submit All</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : selectedInterview && selectedInterview.status === "completed" ? (
            <div>
              <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 8 }}>Completed</div>
              {selectedInterview.questions.map((q, i) => (
                <div key={i} style={{ marginBottom: 8, padding: 8, background: "var(--bg-surface)", borderRadius: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Q{i + 1}: {q.text}</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{q.answer || "(no answer)"}</div>
                </div>
              ))}
            </div>
          ) : selectedInterview && selectedInterview.status !== "completed" ? (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Interview in progress</div>
              <button style={btnPrimary} onClick={() => handleStartInterview(selectedNode.id)}>Resume Interview</button>
            </div>
          ) : hasFeatures ? (
            <button style={btnPrimary} onClick={() => handleStartInterview(selectedNode.id)}>Run AI Interview</button>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Assign at least one feature to run an interview.</div>
          )}
        </div>
      </div>
    );
  };

  /* ── Tab: Hierarchy ─────────────────────────────── */
  const renderHierarchyTab = () => {
    const roots = treeMap.get(null) || [];
    return (
      <div style={{ display: "flex", gap: 0, position: "relative" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Org Chart</h2>
            <button style={btnPrimary} onClick={() => {
              setPersonForm({ name: "", title: "", reports_to: "", linked_user_id: "" });
              setShowAddPersonModal(true);
            }}>
              + Add Person
            </button>
          </div>
          <div style={cardStyle}>
            {hierarchy.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No people in org hierarchy. Click &quot;+ Add Person&quot; to get started.
              </div>
            ) : roots.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                All nodes have parents but no root nodes found. Check data.
              </div>
            ) : (
              roots.map((node) => renderTreeNode(node, 0))
            )}
          </div>
        </div>
        {selectedNode && renderSidePanel()}
      </div>
    );
  };

  /* ── Tab: Feature Assignments Overview ──────────── */
  const renderFeaturesTab = () => {
    const filtered = featureSearch
      ? hierarchy.filter((n) => n.name.toLowerCase().includes(featureSearch.toLowerCase()))
      : hierarchy;

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Feature Assignments Overview</h2>
          <input
            style={{ ...inputStyle, width: 260 }}
            placeholder="Search by name..."
            value={featureSearch}
            onChange={(e) => setFeatureSearch(e.target.value)}
          />
        </div>
        <div style={cardStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Features</th>
                <th style={thStyle}>Interview Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)" }}>No results.</td>
                </tr>
              ) : (
                filtered.map((node) => {
                  const nf = nodeFeatures(node.id);
                  const status = getInterviewStatus(node.id);
                  const statusColor = status === "Completed" ? "#28a745" : status === "In Progress" ? "var(--accent)" : "var(--text-muted)";
                  return (
                    <tr
                      key={node.id}
                      onClick={() => {
                        setSelectedNodeId(node.id);
                        setActiveTab("hierarchy");
                      }}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                    >
                      <td style={tdStyle}>{node.name}</td>
                      <td style={tdStyle}>{node.title}</td>
                      <td style={tdStyle}>
                        {nf.length === 0
                          ? <span style={{ color: "var(--text-muted)" }}>None</span>
                          : nf.map((f) => f.feature_key).join(", ")}
                      </td>
                      <td style={{ ...tdStyle, color: statusColor, fontWeight: 600 }}>{status}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {selectedNode && renderSidePanel()}
      </div>
    );
  };

  /* ── Tab: Alert Routing ─────────────────────────── */
  const renderAlertsTab = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Alert Routing Rules</h2>
        <button style={btnPrimary} onClick={() => {
          setRuleForm({ feature_key: "", condition: "", route_to_hierarchy_id: "", delivery: "push" });
          setShowAddRuleModal(true);
        }}>
          + Add Rule
        </button>
      </div>
      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Feature</th>
              <th style={thStyle}>Condition</th>
              <th style={thStyle}>Routes To</th>
              <th style={thStyle}>Delivery</th>
              <th style={thStyle}>Active</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {routingRules.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)" }}>No routing rules configured.</td>
              </tr>
            ) : (
              routingRules.map((rule) => (
                <tr key={rule.id}>
                  <td style={tdStyle}>{rule.feature_key}</td>
                  <td style={tdStyle}>{rule.condition}</td>
                  <td style={tdStyle}>{getNodeName(rule.route_to_hierarchy_id)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: rule.delivery === "push" ? "#28a74520" : rule.delivery === "digest" ? "#ffc10720" : "#17a2b820",
                      color: rule.delivery === "push" ? "#28a745" : rule.delivery === "digest" ? "#ffc107" : "#17a2b8",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {rule.delivery}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <label style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={rule.active}
                        onChange={() => handleToggleRuleActive(rule.id, rule.active)}
                      />
                    </label>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        style={btnOutline}
                        onClick={() => {
                          setEditingRule(rule);
                          setRuleForm({
                            feature_key: rule.feature_key,
                            condition: rule.condition,
                            route_to_hierarchy_id: rule.route_to_hierarchy_id,
                            delivery: rule.delivery,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button style={{ ...btnDanger, fontSize: 11 }} onClick={() => setConfirmDeleteRule(rule.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── RENDER ─────────────────────────────────────── */
  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px 0" }}>Executive Intelligence</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px 0" }}>Org hierarchy, feature assignments, alert routing, and KPI dashboard</p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-color)", marginBottom: 24 }}>
        <button style={tabStyle(activeTab === "hierarchy")} onClick={() => setActiveTab("hierarchy")}>Hierarchy</button>
        <button style={tabStyle(activeTab === "features")} onClick={() => setActiveTab("features")}>Feature Assignments</button>
        <button style={tabStyle(activeTab === "alerts")} onClick={() => setActiveTab("alerts")}>Alert Routing</button>
        <button style={tabStyle(activeTab === "kpis")} onClick={() => setActiveTab("kpis")}>KPI Dashboard</button>
        <button style={tabStyle(activeTab === "kpi_admin")} onClick={() => setActiveTab("kpi_admin")}>KPI Admin</button>
      </div>

      {/* Tab Content */}
      {activeTab === "hierarchy" && renderHierarchyTab()}
      {activeTab === "features" && renderFeaturesTab()}
      {activeTab === "alerts" && renderAlertsTab()}
      {activeTab === "kpis" && (
        <div>
          {kpiSnapshots.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>No KPI data yet</p>
              <p style={{ fontSize: 12 }}>KPIs will appear here as claim health records, onboarding metrics, and other module data flows in.</p>
            </div>
          ) : (
            <>
              {/* Group by source module */}
              {Object.entries(
                kpiSnapshots.reduce<Record<string, typeof kpiSnapshots>>((acc, s) => {
                  (acc[s.source_module] = acc[s.source_module] || []).push(s);
                  return acc;
                }, {})
              ).map(([mod, snapshots]) => {
                // Deduplicate: take the latest value per metric_key
                const latest: Record<string, typeof snapshots[0]> = {};
                for (const s of snapshots) {
                  if (!latest[s.metric_key] || s.period_end > latest[s.metric_key].period_end) {
                    latest[s.metric_key] = s;
                  }
                }
                const metrics = Object.values(latest);
                const modLabel = mod.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

                return (
                  <div key={mod} style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, textTransform: "capitalize" }}>
                      {modLabel}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                      {metrics.map((m) => {
                        const label = m.metric_key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                        let display = String(m.metric_value);
                        if (m.metric_unit === "%") display = m.metric_value.toFixed(2) + "%";
                        else if (m.metric_unit === "days") display = m.metric_value.toFixed(1) + " days";
                        else if (m.metric_unit === "per_day") display = m.metric_value.toFixed(2) + "/day";
                        else if (m.metric_unit === "count") display = String(Math.round(m.metric_value));

                        return (
                          <div key={m.metric_key} style={{ ...cardStyle, textAlign: "center" }}>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{display}</p>
                            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>as of {m.period_end}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ── Settlement Tracker Section ─────────────── */}
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Settlement Tracker</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Track and analyze settlement outcomes across all resolution paths</p>

            {/* ── Straight Settlement ── */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                Straight Settlement
              </h3>
              <div style={{ ...cardStyle, padding: "24px 22px" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                  Direct carrier settlements — data feeds from Claim Health Matrix entries
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Total Straight Settlements", value: "—" },
                    { label: "Avg Days to Settle", value: "—" },
                    { label: "Avg Recovery Rate", value: "—" },
                    { label: "Total Settled Value", value: "—" },
                    { label: "Linked Claim Health Files", value: "—" },
                  ].map((m) => (
                    <div key={m.label} style={{ background: "var(--bg-page)", borderRadius: 8, padding: 14, textAlign: "center", border: "1px solid var(--border-color)" }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, fontStyle: "italic" }}>
                  Placeholder — will auto-populate from Claim Health Matrix data when adjuster completes the claim health form
                </p>
              </div>
            </div>

            {/* ── Appraisal Settlement ── */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", display: "inline-block" }} />
                Appraisal Settlement
              </h3>
              <div style={{ ...cardStyle, padding: "24px 22px" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                  Claims resolved through appraisal process — appraiser performance and outcome tracking
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Total Appraisal Settlements", value: "—" },
                    { label: "Avg Days in Appraisal", value: "—" },
                    { label: "Avg Recovery Rate", value: "—" },
                    { label: "Total Estimated Value", value: "—" },
                    { label: "Total Actual Value", value: "—" },
                    { label: "Umpire Invoked Rate", value: "—" },
                  ].map((m) => (
                    <div key={m.label} style={{ background: "var(--bg-page)", borderRadius: 8, padding: 14, textAlign: "center", border: "1px solid var(--border-color)" }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, fontStyle: "italic" }}>
                  Placeholder — will populate from appraisal track data in Settlement Tracker
                </p>
              </div>
            </div>

            {/* ── Mediation Settlement ── */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} />
                Mediation Settlement
              </h3>
              <div style={{ ...cardStyle, padding: "24px 22px" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                  ADR proceedings — mediator performance, settlement rates, and outcome tracking
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Total Mediations", value: "—" },
                    { label: "Settlement Rate", value: "—" },
                    { label: "Avg Days to Mediation", value: "—" },
                    { label: "Avg Settlement Value", value: "—" },
                    { label: "Impasse Rate", value: "—" },
                  ].map((m) => (
                    <div key={m.label} style={{ background: "var(--bg-page)", borderRadius: 8, padding: 14, textAlign: "center", border: "1px solid var(--border-color)" }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, fontStyle: "italic" }}>
                  Placeholder — will populate from mediation track data in Settlement Tracker
                </p>
              </div>
            </div>

            {/* ── Litigation Settlement ── */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                Litigation Settlement
              </h3>

              {/* Law Firm Scorecard */}
              <div style={{ ...cardStyle, padding: "24px 22px", marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Law Firm Scorecard</h4>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                  Per-firm KPIs — claims volume, litigation rate, retention, duration, recovery rate
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Law Firm", "Open Claims", "In Litigation", "Lit. Rate %", "Retention %", "Avg Days in Lit.", "Recovery Rate %", "Total Estimated", "Total Actual"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                          No law firm data yet — will populate from litigation track entries
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Duration Analysis */}
              <div style={{ ...cardStyle, padding: "24px 22px", marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Duration Analysis</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                  {[
                    { label: "0-90 Days", value: "—" },
                    { label: "91-180 Days", value: "—" },
                    { label: "181-365 Days", value: "—" },
                    { label: "366-730 Days", value: "—" },
                    { label: "730+ Days", value: "—" },
                    { label: "Avg Days in Litigation", value: "—" },
                  ].map((m) => (
                    <div key={m.label} style={{ background: "var(--bg-page)", borderRadius: 8, padding: 14, textAlign: "center", border: "1px solid var(--border-color)" }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Performance */}
              <div style={{ ...cardStyle, padding: "24px 22px", marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Financial Performance</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Total Estimated", value: "—" },
                    { label: "Total Actual", value: "—" },
                    { label: "Avg Recovery Rate", value: "—" },
                    { label: "Avg Estimated / Claim", value: "—" },
                    { label: "Avg Actual / Claim", value: "—" },
                  ].map((m) => (
                    <div key={m.label} style={{ background: "var(--bg-page)", borderRadius: 8, padding: 14, textAlign: "center", border: "1px solid var(--border-color)" }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{m.label}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personnel Tracking */}
              <div style={{ ...cardStyle, padding: "24px 22px" }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Personnel Tracking</h4>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                  Which adjusters/estimators have claims with which law firms
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Personnel", "Role", "Open Claims", "Law Firms", "Avg Days in Lit."].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                          No personnel data yet — will populate from litigation track entries
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, fontStyle: "italic" }}>
                Placeholder — metrics derived from law firm comparison spreadsheets (claims volume, litigation duration buckets, financial performance, firm rankings, personnel tracking)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────── */}

      {/* Add Person Modal */}
      {showAddPersonModal && (
        <div style={overlayStyle} onClick={() => setShowAddPersonModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Add Person</h3>
            </div>
            {renderPersonForm(handleAddPerson, "Add Person")}
          </div>
        </div>
      )}

      {/* Edit Person Modal */}
      {editingNode && (
        <div style={overlayStyle} onClick={() => { setEditingNode(null); setPersonForm({ name: "", title: "", reports_to: "", linked_user_id: "" }); }}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Edit Person</h3>
            </div>
            {renderPersonForm(handleEditPerson, "Save Changes")}
          </div>
        </div>
      )}

      {/* Add Rule Modal */}
      {showAddRuleModal && (
        <div style={overlayStyle} onClick={() => setShowAddRuleModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Add Routing Rule</h3>
            </div>
            {renderRuleForm(handleAddRule, "Add Rule")}
          </div>
        </div>
      )}

      {/* Edit Rule Modal */}
      {editingRule && (
        <div style={overlayStyle} onClick={() => { setEditingRule(null); setRuleForm({ feature_key: "", condition: "", route_to_hierarchy_id: "", delivery: "push" }); }}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Edit Routing Rule</h3>
            </div>
            {renderRuleForm(handleEditRule, "Save Changes")}
          </div>
        </div>
      )}

      {/* Confirm Delete Person */}
      {confirmDelete && (
        <div style={overlayStyle} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...modalStyle, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 16 }}>Remove this person from the org hierarchy?</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button style={btnOutline} onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button style={btnDanger} onClick={() => handleDeletePerson(confirmDelete)}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ KPI ADMIN TAB ═══ */}
      {activeTab === "kpi_admin" && <KPIAdminTab />}

      {/* Confirm Delete Rule */}
      {confirmDeleteRule && (
        <div style={overlayStyle} onClick={() => setConfirmDeleteRule(null)}>
          <div style={{ ...modalStyle, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 24, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 16 }}>Delete this routing rule?</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button style={btnOutline} onClick={() => setConfirmDeleteRule(null)}>Cancel</button>
                <button style={btnDanger} onClick={() => handleDeleteRule(confirmDeleteRule)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
