/**
 * Row shapes for the tables and views this app reads. Hand-written rather than
 * generated so the build never depends on a live database being reachable. When the
 * schema changes, update these to match — they are the app's contract with the DB.
 */

export type BillingStatus = "open" | "closed";
export type PaymentMode = "upi" | "bank" | "cash" | "cheque";
export type PaymentStatus = "recorded" | "verified" | "bounced";
export type IssueStatus =
  | "open"
  | "acknowledged"
  | "estimating"
  | "approved"
  | "in_progress"
  | "resolved"
  | "closed"
  | "rejected";
export type IssuePriority = "low" | "normal" | "high" | "urgent";
export type WaterSource = "manjeera" | "tanker";

export interface FlatRow {
  id: string;
  block_id: string;
  floor: string;
  number: string;
  flat_type: string;
  area_sqft: number | null;
  is_active: boolean;
}

export interface FlatBalanceRow {
  flat_id: string;
  number: string;
  billed_paise: number;
  paid_paise: number;
  balance_paise: number;
}

export interface InvoiceRow {
  id: string;
  flat_id: string;
  period_id: string;
  invoice_no: string;
  total_paise: number;
  issued_on: string;
  voided_at: string | null;
}

export interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  kind: string;
  description: string;
  qty: number | null;
  unit_rate: number | null;
  amount_paise: number;
  metadata: Record<string, unknown>;
}

export interface PaymentRow {
  id: string;
  flat_id: string;
  paid_on: string;
  amount_paise: number;
  mode: PaymentMode;
  reference: string | null;
  status: PaymentStatus;
  notes: string | null;
}

export interface BillingPeriodRow {
  id: string;
  year: number;
  month: number;
  status: BillingStatus;
  maintenance_paise: number;
  sinking_fund_paise: number;
  due_date: string | null;
  closed_at: string | null;
}

export interface WaterTransparencyRow {
  period_id: string;
  year: number;
  month: number;
  status: BillingStatus;
  total_cost_paise: number;
  purchased_litres: number;
  metered_litres: number;
  loss_litres: number;
  loss_pct: number;
  blended_rate_paise_per_litre: number;
  manjeera_litres: number;
  manjeera_cost_paise: number;
  manjeera_rate_paise_per_litre: number | null;
  tanker_litres: number;
  tanker_cost_paise: number;
  tanker_rate_paise_per_litre: number | null;
  estimated_reading_count: number;
  tanker_delivery_count: number;
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  normal_side: "debit" | "credit";
  debit_paise: number;
  credit_paise: number;
  balance_paise: number;
}

export interface IssueRow {
  id: string;
  reference: string;
  title: string;
  description: string;
  category: string;
  location: string;
  flat_id: string | null;
  block_id: string | null;
  raised_by_flat_id: string | null;
  raised_by_name: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  resolved_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssueCostRow {
  issue_id: string;
  reference: string;
  title: string;
  status: IssueStatus;
  category: string;
  approved_estimate_paise: number | null;
  actual_spent_paise: number;
  overrun_paise: number;
}
