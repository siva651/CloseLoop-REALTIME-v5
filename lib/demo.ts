import type { ExceptionItem, RecordRow, RunSummary } from "./types";

export type DemoRow = RecordRow;

export const demoRows: RecordRow[] = [
  { id:"r-1001", customer:"Aster Labs", invoice:"INV-1042", invoiceAmount:18500, paidAmount:15800, invoiceDate:"2026-09-16", dueDate:"2026-09-30", paymentDate:"2026-10-01", paymentRef:"PAY-8219", status:"short" },
  { id:"r-1002", customer:"BluePeak Retail", invoice:"INV-1043", invoiceAmount:7200, paidAmount:0, invoiceDate:"2026-09-11", dueDate:"2026-09-21", paymentDate:null, paymentRef:null, status:"overdue" },
  { id:"r-1003", customer:"Cedar Works", invoice:"INV-1044", invoiceAmount:12000, paidAmount:12000, invoiceDate:"2026-09-18", dueDate:"2026-10-02", paymentDate:"2026-09-29", paymentRef:"PAY-8220", status:"matched" },
  { id:"r-1004", customer:"Delta Systems", invoice:"INV-1045", invoiceAmount:9800, paidAmount:9800, invoiceDate:"2026-09-20", dueDate:"2026-10-04", paymentDate:"2026-10-04", paymentRef:"PAY-8221", status:"matched" },
  { id:"r-1005", customer:"Echo Health", invoice:"INV-1046", invoiceAmount:4600, paidAmount:4600, invoiceDate:"2026-09-02", dueDate:"2026-09-17", paymentDate:"2026-09-16", paymentRef:"PAY-8210", status:"matched" },
  { id:"r-1006", customer:"Fjord Media", invoice:"INV-1047", invoiceAmount:15300, paidAmount:15300, invoiceDate:"2026-09-22", dueDate:"2026-10-06", paymentDate:"2026-10-04", paymentRef:"PAY-8224", status:"matched" },
  { id:"r-1007", customer:"GreenCart", invoice:"INV-1048", invoiceAmount:5400, paidAmount:0, invoiceDate:"2026-08-28", dueDate:"2026-09-12", paymentDate:null, paymentRef:null, status:"overdue" },
  { id:"r-1008", customer:"Harbor Foods", invoice:"INV-1049", invoiceAmount:8700, paidAmount:8700, invoiceDate:"2026-09-23", dueDate:"2026-10-07", paymentDate:"2026-10-05", paymentRef:"PAY-8225", status:"matched" },
  { id:"r-1009", customer:"Ion Mobility", invoice:"INV-1050", invoiceAmount:6200, paidAmount:6200, invoiceDate:"2026-09-24", dueDate:"2026-10-08", paymentDate:"2026-10-05", paymentRef:"PAY-8226", status:"matched" },
  { id:"r-1010", customer:"Juno Studio", invoice:"INV-1051", invoiceAmount:11000, paidAmount:11000, invoiceDate:"2026-09-09", dueDate:"2026-09-23", paymentDate:"2026-09-24", paymentRef:"PAY-8215", status:"duplicate" },
  { id:"r-1011", customer:"Kite Security", invoice:"INV-1052", invoiceAmount:2900, paidAmount:0, invoiceDate:"2026-09-27", dueDate:"2026-10-12", paymentDate:null, paymentRef:null, status:"missing" },
  { id:"r-1012", customer:"Lumen Hotels", invoice:"INV-1053", invoiceAmount:14800, paidAmount:12100, invoiceDate:"2026-09-13", dueDate:"2026-09-27", paymentDate:"2026-09-30", paymentRef:"PAY-8227", status:"short" },
];

export function buildExceptions(rows: RecordRow[]): ExceptionItem[] {
  return rows.flatMap((r): ExceptionItem[] => {
    const balance = Math.max(0, r.invoiceAmount - r.paidAmount);
    if (r.status === "short") return [{ id:`ex-${r.id}`, invoice:r.invoice, type:"mismatch", severity:balance > 5000 ? "critical" : "high", title:`Payment short by ${money(balance)}`, customer:r.customer, amount:balance, expected:r.invoiceAmount, actual:r.paidAmount, reason:`Invoice ${r.invoice} is ${Math.round((1-r.paidAmount/r.invoiceAmount)*100)}% underpaid. The invoice amount and payment record are linked, but the remitted amount is lower.`, recommendation:`Request remittance advice and collect the ${money(balance)} balance before the next billing cycle.`, evidence:[`Invoice ${r.invoice}: ${money(r.invoiceAmount)}`,`Payment received: ${money(r.paidAmount)}`,`Outstanding: ${money(balance)}`], status:"open" }];
    if (r.status === "overdue") return [{ id:`ex-${r.id}`, invoice:r.invoice, type:"overdue", severity:r.invoiceAmount >= 10000 ? "critical" : "high", title:`Invoice overdue — ${money(r.invoiceAmount)}`, customer:r.customer, amount:r.invoiceAmount, expected:r.invoiceAmount, actual:r.paidAmount, reason:`Invoice ${r.invoice} passed its due date without a recorded payment.`, recommendation:"Send a payment-status follow-up and schedule a recheck after the next bank-feed refresh.", evidence:[`Due date: ${r.dueDate}`,`Recorded payment: none`,`Invoice value: ${money(r.invoiceAmount)}`], status:"open" }];
    if (r.status === "duplicate") return [{ id:`ex-${r.id}`, invoice:r.invoice, type:"duplicate", severity:"critical", title:"Possible duplicate payment trail", customer:r.customer, amount:r.invoiceAmount, expected:r.invoiceAmount, actual:r.paidAmount, reason:`The record carries a duplicate payment reference signal. It should not be considered safely settled until the reference is verified.`, recommendation:"Hold settlement and verify the payment reference before closing this invoice.", evidence:[`Invoice ${r.invoice}: ${money(r.invoiceAmount)}`,`Recorded payment: ${money(r.paidAmount)}`,`Payment reference: ${r.paymentRef || "duplicate signal"}`], status:"open" }];
    if (r.status === "missing") return [{ id:`ex-${r.id}`, invoice:r.invoice, type:"missing_payment", severity:"medium", title:"Payment expected but not found", customer:r.customer, amount:r.invoiceAmount, expected:r.invoiceAmount, actual:0, reason:`The invoice is active but no payment record is linked yet.`, recommendation:"Check ingestion and bank-feed freshness before contacting the customer.", evidence:[`Invoice ${r.invoice}: ${money(r.invoiceAmount)}`,`Due date: ${r.dueDate}`,`Payment record: none`], status:"open" }];
    return [];
  });
}

export function buildSummary(rows: RecordRow[], exceptions: ExceptionItem[]): RunSummary {
  const totalValue = rows.reduce((a,r)=>a+r.invoiceAmount,0);
  const atRisk = exceptions.reduce((a,e)=>a+e.amount,0);
  const matched = rows.filter(r=>r.status === "matched").length;
  const savedMinutes = Math.max(8, Math.round(rows.length * 3.6 + exceptions.length * 2.1));
  const confidence = Math.max(94, Math.min(99, 99 - Math.min(5, exceptions.filter(e=>e.severity === "critical").length)));
  return { processed:rows.length, matched, exceptions:exceptions.length, totalValue, atRisk, savedMinutes, confidence };
}

function money(n:number){ return new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(n); }
