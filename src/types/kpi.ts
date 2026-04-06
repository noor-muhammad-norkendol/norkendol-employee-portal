export interface KPISnapshot {
  id: string;
  org_id: string;
  source_module: string;
  metric_key: string;
  metric_value: number;
  metric_unit: string;
  period_start: string;
  period_end: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateKPISnapshotInput {
  source_module: string;
  metric_key: string;
  metric_value: number;
  metric_unit: string;
  period_start: string;
  period_end: string;
  metadata?: Record<string, unknown>;
}
