export type Status = "open" | "approved" | "resolved";
export type Severity = "critical" | "high" | "medium" | "low";

export type RecordRow = {
  id: string;
  customer: string;
  invoice: string;
  invoiceAmount: number;
  paidAmount: number;
  invoiceDate: string;
  dueDate: string;
  paymentDate: string | null;
  paymentRef: string | null;
  status: "matched" | "short" | "overdue" | "duplicate" | "missing";
};

export type ExceptionItem = {
  id: string;
  invoice: string;
  type: "mismatch" | "overdue" | "duplicate" | "missing_payment";
  severity: Severity;
  title: string;
  customer: string;
  amount: number;
  expected: number;
  actual: number;
  reason: string;
  recommendation: string;
  evidence: string[];
  status: Status;
};

export type RunSummary = {
  processed: number;
  matched: number;
  exceptions: number;
  totalValue: number;
  atRisk: number;
  savedMinutes: number;
  confidence: number;
};
