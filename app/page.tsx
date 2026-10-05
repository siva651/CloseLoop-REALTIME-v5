"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowDown, ArrowRight, Bot, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleDollarSign, Clipboard, CloudUpload, Download, FileCheck2, FileSpreadsheet, Filter, History,
  Inbox, LayoutDashboard, MessageSquare, MoreHorizontal, Play, Plus, RefreshCcw, Search, Send,
  Settings2, ShieldCheck, Sparkles, Timer, Upload, WalletCards, X, Zap
} from "lucide-react";
import { buildExceptions, buildSummary, demoRows } from "@/lib/demo";
import type { ExceptionItem, RecordRow, RunSummary, Severity, Status } from "@/lib/types";

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const money2 = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const dateLabel = (s: string | null) => s ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${s}T00:00:00`)) : "—";

function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

function parseNumber(v: string | undefined) {
  return Number(String(v ?? "").replace(/[₹,\s]/g, "").replace(/\(([^)]+)\)/, "-$1")) || 0;
}

function normalizeRows(data: Record<string, string>[]): RecordRow[] {
  return data.flatMap((r, i) => {
    const invoice = r.invoice_id || r.invoice || r.invoice_number || r.invoice_no || r.id || `INV-${1000 + i + 1}`;
    const customer = r.customer_name || r.customer || r.client || r.company || `Customer ${i + 1}`;
    const invoiceAmount = parseNumber(r.invoice_amount || r.amount || r.total || r.invoice_value);
    const paidAmount = parseNumber(r.paid_amount || r.payment_amount || r.paid || r.amount_paid);
    const invoiceDate = r.invoice_date || r.issue_date || r.issued_at || "2026-10-01";
    const dueDate = r.due_date || r.payment_due || r.due || "2026-10-15";
    const paymentDate = r.payment_date || r.paid_at || r.settled_at || (paidAmount > 0 ? "2026-10-05" : null);
    const paymentRef = r.payment_ref || r.payment_id || r.transaction_id || "";
    let status = String(r.status || "").toLowerCase().trim() as RecordRow["status"];
    if (!["matched", "short", "overdue", "duplicate", "missing"].includes(status)) {
      if (paymentRef && data.filter(x => (x.payment_ref || x.payment_id || x.transaction_id || "") === paymentRef).length > 1) status = "duplicate";
      else if (paidAmount <= 0 && new Date(`${dueDate}T23:59:59`).getTime() < Date.now()) status = "overdue";
      else if (paidAmount <= 0) status = "missing";
      else if (paidAmount < invoiceAmount) status = "short";
      else status = "matched";
    }
    if (!invoiceAmount) return [];
    return [{ id: `row-${i + 1}-${invoice}`, customer, invoice, invoiceAmount, paidAmount, invoiceDate, dueDate, paymentDate, paymentRef: paymentRef || null, status }];
  });
}

const sampleCsv = `customer,invoice_id,invoice_amount,paid_amount,invoice_date,due_date,payment_date,payment_ref\nAster Labs,INV-1042,18500,15800,2026-09-16,2026-09-30,2026-10-01,PAY-8219\nBluePeak Retail,INV-1043,7200,0,2026-09-11,2026-09-21,,\nCedar Works,INV-1044,12000,12000,2026-09-18,2026-10-02,2026-09-29,PAY-8220\nDelta Systems,INV-1045,9800,9800,2026-09-20,2026-10-04,2026-10-04,PAY-8221\nLumen Hotels,INV-1053,14800,12100,2026-09-13,2026-09-27,2026-09-30,PAY-8227`;

function severityStyle(s: Severity) { return `badge ${s}`; }
function Badge({ severity }: { severity: Severity }) { return <span className={severityStyle(severity)}>{severity}</span>; }
function StatusBadge({ status }: { status: Status }) { return <span className={`status ${status}`}>{status === "resolved" ? "Resolved" : status === "approved" ? "Approved" : "Open"}</span>; }
function IconButton({ label, children, onClick, disabled }: { label: string; children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button className="icon-btn" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}
function NavItem({ icon, label, active, badge, onClick }: { icon: ReactNode; label: string; active?: boolean; badge?: number; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{badge ? <b>{badge}</b> : null}</button>;
}
function StatCard({ icon, label, value, delta, tone = "default", hint }: { icon: ReactNode; label: string; value: string; delta?: string; tone?: string; hint?: string }) {
  return <div className={`stat-card ${tone}`}><div className="stat-icon">{icon}</div><div className="stat-main"><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-foot">{delta ? <span className="delta">{delta}</span> : null}{hint ? <span>{hint}</span> : null}</div></div></div>;
}

type ActivityEvent = { id: string; action: string; detail: string; time: string };

export default function Home() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [source, setSource] = useState("No dataset loaded");
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState("overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [runState, setRunState] = useState<"idle" | "running">("idle");
  const [runStep, setRunStep] = useState(0);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [aiOpen, setAiOpen] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Your workspace is empty. Load the demo ledger or upload your invoice CSV to begin." }
  ]);
  const [question, setQuestion] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const summary: RunSummary = useMemo(() => buildSummary(rows, exceptions), [rows, exceptions]);
  const selected = exceptions.find(e => e.id === selectedId) ?? exceptions[0] ?? null;
  const hasData = rows.length > 0;
  const openCount = exceptions.filter(e => e.status === "open").length;
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const runLabels = ["Reading your records", "Reconciling payments", "Finding exceptions", "Preparing the review queue"];

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/ai").then(r => r.json()).then(data => setAiReady(Array.isArray(data.configured) && data.configured.length > 0)).catch(() => setAiReady(false));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("closeloop-workspace-v5");
      if (saved) {
        const parsed = JSON.parse(saved) as { rows?: RecordRow[]; exceptions?: ExceptionItem[]; source?: string; lastRunAt?: string | null; activity?: ActivityEvent[] };
        if (Array.isArray(parsed.rows) && parsed.rows.length) setRows(parsed.rows);
        if (Array.isArray(parsed.exceptions)) setExceptions(parsed.exceptions);
        if (typeof parsed.source === "string") setSource(parsed.source);
        if (parsed.lastRunAt) setLastRunAt(new Date(parsed.lastRunAt));
        if (Array.isArray(parsed.activity)) setActivity(parsed.activity);
      }
    } catch { /* ignore corrupted local workspace and use demo data */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem("closeloop-workspace-v5", JSON.stringify({ rows, exceptions, source, lastRunAt: lastRunAt?.toISOString() ?? null, activity })); } catch { /* storage can be unavailable */ }
  }, [rows, exceptions, source, lastRunAt, activity, storageReady]);

  function logActivity(action: string, detail: string) {
    setActivity(prev => [{ id: `${Date.now()}-${Math.random()}`, action, detail, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...prev].slice(0, 30));
  }

  const filteredExceptions = useMemo(() => exceptions.filter(e => {
    const hay = `${e.title} ${e.customer} ${e.invoice} ${e.reason}`.toLowerCase();
    const matchesSearch = !query || hay.includes(query.toLowerCase());
    const matchesSeverity = filter === "all" || e.severity === filter;
    return matchesSearch && matchesSeverity;
  }), [exceptions, query, filter]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => map.set(r.customer, (map.get(r.customer) || 0) + Math.max(0, r.invoiceAmount - r.paidAmount)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  const trend = useMemo(() => {
    const buckets = new Map<string, { processed: number; risk: number }>();
    rows.forEach(r => { const k = r.invoiceDate.slice(0, 7); const v = buckets.get(k) || { processed: 0, risk: 0 }; v.processed++; v.risk += Math.max(0, r.invoiceAmount - r.paidAmount); buckets.set(k, v); });
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [rows]);

  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 4200); }
  function applyRows(next: RecordRow[], filename: string) {
    if (!next.length) { notify("No usable invoice records found. Include invoice/customer/amount fields in the CSV."); return; }
    const nextExceptions = buildExceptions(next);
    setRows(next); setExceptions(nextExceptions); setSelectedId(nextExceptions[0]?.id ?? null); setSource(filename); setSection("overview"); setChat([{ role: "assistant", text: `Loaded ${next.length} invoice records from ${filename}. I'm ready to answer questions about this dataset.` }]); logActivity("Dataset loaded", `${filename} · ${next.length} records · ${nextExceptions.length} exceptions`); notify(`${next.length} invoice records ingested. ${nextExceptions.length} exceptions are ready for review.`);
  }
  function onFile(e: ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; void file.text().then(t => applyRows(normalizeRows(parseCSV(t)), file.name)).catch(() => notify("Could not read that file.")); e.target.value = ""; }
  function onDrop(e: DragEvent<HTMLDivElement>) { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) void file.text().then(t => applyRows(normalizeRows(parseCSV(t)), file.name)).catch(() => notify("Could not read that file.")); }
  function useSampleData() { applyRows(demoRows, "Demo operations ledger"); }
  function runAutomation() {
    if (!rows.length) { notify("Load the demo ledger or upload a CSV before running automation."); return; }
    if (runState === "running") return;
    setRunState("running");
    setRunStep(0);
    const step1 = window.setTimeout(() => setRunStep(1), 350);
    const step2 = window.setTimeout(() => setRunStep(2), 700);
    const step3 = window.setTimeout(() => setRunStep(3), 1050);
    window.setTimeout(() => {
      const next = buildExceptions(rows);
      setExceptions(next);
      setRunStep(4);
      setRunState("idle");
      setLastRunAt(new Date());
      setSelectedId(next[0]?.id ?? null);
      logActivity("Reconciliation completed", `${rows.length} records checked · ${next.length} exceptions found`);
      notify(`Run complete: ${rows.length} records checked, ${next.length} exceptions found, ${money(next.reduce((a, e) => a + e.amount, 0))} needs attention.`);
      window.clearTimeout(step1); window.clearTimeout(step2); window.clearTimeout(step3);
    }, 1400);
  }
  function exportData(format: "json" | "markdown" | "csv") {
    const payload = { generatedAt: new Date().toISOString(), source, summary, rows, exceptions };
    let body = ""; let type = "text/plain"; let filename = `closeloop-${format}`;
    if (format === "json") { body = JSON.stringify(payload, null, 2); type = "application/json"; filename += ".json"; }
    else if (format === "markdown") { body = [`# CloseLoop Run`, `Source: ${source}`, `Processed: ${summary.processed}`, `Matched: ${summary.matched}`, `Exceptions: ${summary.exceptions}`, `At risk: ${money(summary.atRisk)}`, "", "## Exceptions", ...exceptions.map(e => `- ${e.customer} · ${e.title} · ${e.severity} · ${e.status}`)].join("\n"); filename += ".md"; }
    else { body = `customer,invoice_id,invoice_amount,paid_amount,invoice_date,due_date,payment_date,status\n${rows.map(r => [r.customer,r.invoice,r.invoiceAmount,r.paidAmount,r.invoiceDate,r.dueDate,r.paymentDate ?? "",r.status].map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n")}`; type = "text/csv"; filename += ".csv"; }
    const a = document.createElement("a"); const url = URL.createObjectURL(new Blob([body], { type })); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); logActivity("Export created", filename); notify(`Exported ${filename}.`);
  }
  function downloadTemplate() { const a = document.createElement("a"); const url = URL.createObjectURL(new Blob([sampleCsv], { type: "text/csv" })); a.href = url; a.download = "closeloop-invoice-template.csv"; a.click(); URL.revokeObjectURL(url); notify("Template downloaded."); }
  function copyText(text: string, label: string) { void navigator.clipboard?.writeText(text); logActivity("Clipboard action", label); notify(`${label} copied to clipboard.`); }

  async function callAI(kind: "chat" | "brief" | "followup", prompt: string) {
    setAiBusy(true);
    try {
      const context = JSON.stringify({ source, summary, selected, exceptions: exceptions.slice(0, 25), rows: rows.slice(0, 80) });
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, prompt, context }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI request failed");
      return `${data.text || "No answer returned."}\n\n— ${data.provider || "AI"}${data.model ? ` · ${data.model}` : ""}`;
    } finally { setAiBusy(false); }
  }
  async function askQuestion() {
    const q = question.trim(); if (!q || aiBusy || !hasData) return;
    setQuestion(""); setChat(c => [...c, { role: "user", text: q }]);
    try { const text = await callAI("chat", q); setChat(c => [...c, { role: "assistant", text }]); logActivity("Copilot answer", q.slice(0, 90)); }
    catch (e) { setChat(c => [...c, { role: "assistant", text: e instanceof Error ? e.message : "AI unavailable." }]); }
  }

  async function runQuickQuestion(q: string) {
    if (aiBusy || !hasData) return;
    setChat(c => [...c, { role: "user", text: q }]);
    try {
      const text = await callAI("chat", q);
      setChat(c => [...c, { role: "assistant", text }]);
      logActivity("Copilot answer", q.slice(0, 90));
    } catch (e) {
      setChat(c => [...c, { role: "assistant", text: e instanceof Error ? e.message : "AI unavailable." }]);
    }
  }
  async function generateBrief() {
    if (!hasData) { notify("Load the demo ledger or upload invoice data first."); return; }
    try { const text = await callAI("brief", "Produce an operator brief with: what changed, money at risk, top exceptions, why they matter, and the next three moves. Use only the provided data."); setChat(c => [...c, { role: "assistant", text }]); logActivity("AI brief generated", "Live operation snapshot"); setAiOpen(true); }
    catch (e) { notify(e instanceof Error ? e.message : "AI unavailable."); }
  }
  async function followUp() {
    if (!selected) return;
    try { const text = await callAI("followup", "Draft a concise professional payment follow-up for the selected exception. Use only evidence in the record. Include subject and body. Do not include analysis or reasoning."); setChat(c => [...c, { role: "assistant", text }]); logActivity("Follow-up drafted", `${selected.invoice} · ${selected.customer}`); setAiOpen(true); }
    catch (e) { notify(e instanceof Error ? e.message : "AI unavailable."); }
  }
  function setStatus(id: string, status: Status) {
    setExceptions(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    const target = exceptions.find(e => e.id === id);
    if (target) logActivity(status === "resolved" ? "Exception resolved" : status === "open" ? "Exception reopened" : "Action approved", `${target.invoice} · ${target.customer}`);
    notify(status === "resolved" ? "Exception resolved and recorded in the current audit trail." : status === "approved" ? "Action approved. Human approval is preserved before execution." : "Exception reopened.");
  }

  const nav = [
    ["overview", <LayoutDashboard size={17} />, "Overview"],
    ["invoices", <FileSpreadsheet size={17} />, "Invoices"],
    ["exceptions", <Inbox size={17} />, "Exceptions", openCount],
    ["automation", <Zap size={17} />, "Automation"],
    ["reports", <Activity size={17} />, "Reports"],
    ["audit", <History size={17} />, "Audit trail"],
  ] as const;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark"><span /><span /></div><div><div className="brand-name">CloseLoop</div><div className="brand-tag">Automate · Reconcile · Resolve</div></div></div>
      <div className="workspace"><div className="avatar">S</div><div className="workspace-copy"><b>Operations</b><span>Business workspace</span></div><ChevronDown size={14}/></div>
      <nav className="nav">{nav.map(([id, icon, label, badge]) => <NavItem key={id} icon={icon} label={label} badge={badge} active={section === id} onClick={() => setSection(id)} />)}</nav>
      <div className="side-bottom"><div className="side-meter"><div className="meter-head"><span>Run confidence</span><b>{hasData ? `${summary.confidence}%` : "—"}</b></div><div className="meter"><span style={{ width: `${hasData ? summary.confidence : 0}%` }} /></div><small>{hasData ? "Deterministic checks passed" : "Waiting for a dataset"}</small></div><NavItem icon={<Settings2 size={17}/>} label="Settings" active={section === "settings"} onClick={() => setSection("settings")} /></div>
    </aside>

    <main className="content">
      <header className="topbar"><div><div className="hello">{greeting}, Siva <span className="hello-wave">👋</span></div><div className="subhello">{hasData ? "Your live operation is ready. Review what changed, then decide what happens next." : "Your workspace is empty. Load demo data or upload your invoice ledger to begin."}</div></div><div className="topbar-right"><span className={`ai-pill ${aiReady === false ? "offline" : ""}`}><span className="live-dot" /> {aiReady === false ? "AI needs key" : "AI ready"}</span><span className="source-pill"><ShieldCheck size={13}/> Human approval required</span><IconButton label="Run reconciliation again" onClick={runAutomation} disabled={runState === "running"}><RefreshCcw size={16}/></IconButton><div className="date-pill">{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(now)} <span>{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div></div></header>

      {notice ? <div className="toast"><CheckCircle2 size={16}/>{notice}</div> : null}

      <section className="hero-grid">
        <div className="hero-card">
          <div className="hero-kicker">AI OPERATIONS AUTOPILOT</div>
          <div className="hero-title-row"><div><h1>{hasData ? <>Turn invoice chaos into <em>closed loops.</em></> : <>Start with your <em>invoice operation.</em></>}</h1><p>{hasData ? "CloseLoop reconciles the loaded records, detects what is wrong, shows the evidence, and prepares the next action." : "Nothing is loaded yet. Start with demo data or bring your own invoice ledger. CloseLoop will calculate everything from the records you provide."}</p></div><div className="hero-actions">{hasData ? <button className="primary big" onClick={runAutomation} disabled={runState === "running"}>{runState === "running" ? <><RefreshCcw className="spin" size={17}/> Processing…</> : <><Play size={17}/> Run automation</>}</button> : <><button className="primary big" onClick={useSampleData}><Play size={17}/> Load demo data</button><button className="secondary big" onClick={() => fileRef.current?.click()}><Upload size={17}/> Upload CSV</button></>}</div></div>
          <div className="flow"><FlowStep n="01" icon={<CloudUpload size={16}/>} title="Ingest" sub="CSV / ledger" /><ArrowRight size={16}/><FlowStep n="02" icon={<Bot size={16}/>} title="Understand" sub="Normalize" /><ArrowRight size={16}/><FlowStep n="03" icon={<FileCheck2 size={16}/>} title="Reconcile" sub="Match · detect" /><ArrowRight size={16}/><FlowStep n="04" icon={<AlertTriangle size={16}/>} title="Review" sub="Explain" /><ArrowRight size={16}/><FlowStep n="05" icon={<Send size={16}/>} title="Act" sub="Approve" /></div>
        </div>
        <div className="run-card"><div className="card-head"><div><div className="eyebrow">LIVE RUN</div><h3>{source}</h3></div><span className={`run-status ${runState === "running" ? "busy" : ""}`}><span className="live-dot"/> {runState === "running" ? runLabels[Math.min(runStep, runLabels.length - 1)] : lastRunAt ? `Updated ${lastRunAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : hasData ? "Ready" : "Waiting for data"}</span></div><div className="run-metric"><strong>{summary.processed}</strong><span>records in this workspace</span></div><div className="run-progress"><div className="run-progress-track"><span style={{ width: `${runState === "running" ? Math.min(96, 22 + runStep * 22) : lastRunAt ? 100 : hasData ? 12 : 0}%` }} /></div><div className="run-progress-label"><span>{runState === "running" ? runLabels[Math.min(runStep, runLabels.length - 1)] : lastRunAt ? "Latest run complete" : hasData ? "Ready to run" : "Load demo or upload a CSV"}</span><b>{runState === "running" ? `${Math.min(96, 22 + runStep * 22)}%` : lastRunAt ? "100%" : hasData ? "—" : "0%"}</b></div></div><div className="run-stats"><MiniStat label="Auto-reconciled" value={`${summary.processed ? Math.round(summary.matched / summary.processed * 100) : 0}%`} /><MiniStat label="Value under attention" value={money(summary.atRisk)} tone="warn" /><MiniStat label="Manual time saved" value={`${summary.savedMinutes}m`} tone="good" /></div><div className="run-note"><ShieldCheck size={14}/> What happens: read → reconcile → flag → review. Nothing is sent automatically.</div></div>
      </section>

      <section className="stats-grid">
        <StatCard icon={<FileSpreadsheet size={18}/>} label="Total records processed" value={summary.processed.toLocaleString("en-IN")} delta={hasData ? "+12%" : "—"} hint={hasData ? "vs last run" : "waiting for data"} />
        <StatCard icon={<CheckCircle2 size={18}/>} label="Reconciled successfully" value={summary.matched.toLocaleString("en-IN")} delta={`${summary.processed ? Math.round(summary.matched / summary.processed * 100) : 0}%`} hint="auto-matched" tone="green" />
        <StatCard icon={<AlertTriangle size={18}/>} label="Exceptions found" value={openCount.toLocaleString("en-IN")} delta={openCount ? "Needs review" : "All clear"} hint="human attention" tone="red" />
        <StatCard icon={<Timer size={18}/>} label="Time saved (est.)" value={`${summary.savedMinutes} min`} delta={hasData ? "−68%" : "—"} hint={hasData ? "vs manual" : "calculated after a run"} tone="blue" />
      </section>

      {section === "overview" && (hasData ? <OverviewView rows={rows} exceptions={exceptions} selected={selected} onSelect={setSelectedId} summary={summary} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} filtered={filteredExceptions} setStatus={setStatus} onFollowUp={followUp} onAsk={generateBrief} topCustomers={topCustomers} trend={trend} onGo={setSection} /> : <EmptyWorkspace onLoadDemo={useSampleData} onUpload={() => fileRef.current?.click()} onTemplate={downloadTemplate} />)}
      {section === "invoices" && <InvoicesView rows={rows} exceptions={exceptions} onSelect={id => { setSelectedId(id); setSection("exceptions"); }} onUpload={() => fileRef.current?.click()} onSample={useSampleData} onTemplate={downloadTemplate} />}
      {section === "exceptions" && <ExceptionsView exceptions={exceptions} selected={selected} onSelect={setSelectedId} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} filtered={filteredExceptions} setStatus={setStatus} onFollowUp={followUp} />}
      {section === "automation" && <AutomationView rows={rows} exceptions={exceptions} onRun={runAutomation} running={runState === "running"} onAsk={generateBrief} onExport={exportData} />}
      {section === "reports" && <ReportsView summary={summary} exceptions={exceptions} rows={rows} topCustomers={topCustomers} trend={trend} onExport={exportData} />}
      {section === "audit" && <AuditView events={activity} />}
      {section === "settings" && <SettingsView source={source} onUpload={() => fileRef.current?.click()} onSample={useSampleData} onTemplate={downloadTemplate} onCopyEnv={() => copyText(`OPENROUTER_API_KEY=\nREQUESTY_API_KEY=\nXKIRO_API_KEY=\nREQUESTY_MODEL=\nXKIRO_MODEL=`, ".env template")} />}

      <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} hidden />

      <section className="ingest-strip" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
        <div className="ingest-icon"><Upload size={18}/></div><div><b>{hasData ? "Replace your invoice ledger" : "Bring in your invoice ledger"}</b><span>{hasData ? "Drop a new CSV here to recalculate the entire workspace." : "Start with the demo ledger or drop your own CSV here. Nothing runs until you choose a dataset."}</span></div><div className="panel-actions">{!hasData ? <button className="secondary" onClick={useSampleData}>Load demo</button> : null}<button className="secondary" onClick={() => fileRef.current?.click()}>Upload file</button></div>
      </section>

      <footer className="footer"><span>CloseLoop · {source}</span><span><ShieldCheck size={13}/> Deterministic reconciliation + AI assistance</span></footer>
    </main>

    <aside className={`copilot ${aiOpen ? "open" : "collapsed"}`}>
      <button className="copilot-handle" onClick={() => setAiOpen(v => !v)}>{aiOpen ? <X size={15}/> : <Sparkles size={16}/>}</button>
      {aiOpen ? <><div className="copilot-head"><div className="copilot-title"><div className="copilot-icon"><Sparkles size={16}/></div><div><b>CloseLoop Copilot</b><span>Ask the AI about the current data</span></div></div><span className="mini-live">LIVE</span></div><div className="chat"><div className="quick-prompts"><button disabled={!hasData} onClick={() => void runQuickQuestion("Which three open exceptions should I handle first? Give invoice ID, amount, severity, and the reason for the order.")}><AlertTriangle size={13}/> Top risks</button><button disabled={!hasData} onClick={() => void runQuickQuestion("How much money is currently at risk? Break it into open exception amounts and tell me which invoice contributes the most.")}><CircleDollarSign size={13}/> Money exposure</button><button disabled={!hasData} onClick={() => void runQuickQuestion("Based on the live records, what are the next three operational moves? Make them specific and tied to invoice IDs.")}><ArrowRight size={13}/> Next moves</button></div>{chat.map((m, i) => <div key={i} className={`chat-bubble ${m.role}`}>{m.role === "assistant" ? <Sparkles size={13}/> : null}<div>{m.text.split("\n").map((line, j) => <p key={j}>{line || <>&nbsp;</>}</p>)}</div></div>)}{aiBusy ? <div className="typing"><span/><span/><span/> Working from your records…</div> : null}</div><div className="chat-input"><textarea disabled={!hasData} value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void askQuestion(); } }} placeholder={hasData ? "Ask: Which invoice needs attention first?" : "Load demo or upload a CSV to use Copilot"} /><button onClick={() => void askQuestion()} disabled={aiBusy || !question.trim()}><Send size={16}/></button></div></> : null}
    </aside>
  </div>;
}

function FlowStep({ n, icon, title, sub }: { n: string; icon: ReactNode; title: string; sub: string }) { return <div className="flow-step"><div className="flow-icon">{icon}</div><div><small>{n}</small><b>{title}</b><span>{sub}</span></div></div>; }
function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className={`mini-stat ${tone || ""}`}><span>{label}</span><strong>{value}</strong></div>; }

function EmptyWorkspace({ onLoadDemo, onUpload, onTemplate }: { onLoadDemo: () => void; onUpload: () => void; onTemplate: () => void }) {
  return <section className="empty-workspace">
    <div className="empty-orbit"><div className="empty-orbit-core"><FileSpreadsheet size={25}/></div><span className="empty-orbit-dot one"/><span className="empty-orbit-dot two"/><span className="empty-orbit-dot three"/></div>
    <div className="eyebrow">NO DATA LOADED</div>
    <h2>Start your first reconciliation run.</h2>
    <p>CloseLoop stays empty until you choose the data it should work on. Nothing is calculated or simulated in this workspace yet.</p>
    <div className="empty-actions"><button className="primary big" onClick={onLoadDemo}><Play size={17}/> Load demo data</button><button className="secondary big" onClick={onUpload}><Upload size={17}/> Upload invoice CSV</button></div>
    <div className="empty-helper"><div><FileCheck2 size={15}/><span><b>What CloseLoop will do</b><small>Read → reconcile → flag → review</small></span></div><div><ShieldCheck size={15}/><span><b>Safe by default</b><small>No automatic customer messages or payments</small></span></div><button className="link-btn" onClick={onTemplate}><Download size={14}/> Download CSV template</button></div>
  </section>;
}

function OverviewView({ rows, exceptions, selected, onSelect, summary, query, setQuery, filter, setFilter, filtered, setStatus, onFollowUp, onAsk, topCustomers, trend, onGo }: { rows: RecordRow[]; exceptions: ExceptionItem[]; selected: ExceptionItem | null; onSelect: (id: string) => void; summary: RunSummary; query: string; setQuery: (s: string) => void; filter: "all" | Severity; setFilter: (s: "all" | Severity) => void; filtered: ExceptionItem[]; setStatus: (id: string, s: Status) => void; onFollowUp: () => void; onAsk: () => void; topCustomers: [string, number][]; trend: [string, { processed: number; risk: number }][]; onGo: (s: string) => void }) {
  return <>
    <section className="section-grid">
      <div className="panel exceptions-panel"><PanelHeader title="Exceptions queue" subtitle="The work that still needs a human decision" action={<button className="link-btn" onClick={() => onGo("exceptions")}>Open queue <ArrowRight size={14}/></button>} /><div className="queue-toolbar"><div className="search"><Search size={14}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search invoice, customer, issue…" /></div><div className="filter-pills"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All {exceptions.length}</button>{(["critical","high","medium","low"] as Severity[]).map(s => <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>{s}</button>)}</div></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>Issue</th><th>Customer</th><th>Amount</th><th>Priority</th><th>Status</th><th /></tr></thead><tbody>{filtered.slice(0, 7).map(e => <tr key={e.id} className={selected?.id === e.id ? "selected-row" : ""} onClick={() => onSelect(e.id)}><td className="mono">{e.invoice}</td><td><div className="issue-cell"><span className={`issue-dot ${e.severity}`} /><div><b>{e.title}</b><span>{e.reason}</span></div></div></td><td>{e.customer}</td><td className="strong-money">{money(e.amount)}</td><td><Badge severity={e.severity}/></td><td><StatusBadge status={e.status}/></td><td><IconButton label="Open exception"><ChevronRight size={15}/></IconButton></td></tr>)}</tbody></table></div></div>

      <ExceptionInspector selected={selected} setStatus={setStatus} onFollowUp={onFollowUp} />
    </section>

    <section className="lower-grid">
      <div className="panel chart-panel"><PanelHeader title="Operational signal" subtitle="Invoice volume and unresolved value by month" action={<button className="ghost-link" onClick={onAsk}><Sparkles size={14}/> Ask AI for a brief</button>} /><SignalChart trend={trend}/></div>
      <div className="panel customer-panel"><PanelHeader title="Customers under attention" subtitle="Outstanding value ranked by customer" action={<span className="muted">{topCustomers.length} shown</span>} />{topCustomers.map(([customer, value], i) => <div key={customer} className="customer-row"><div className="customer-rank">0{i+1}</div><div className="customer-name"><b>{customer}</b><div className="customer-bar"><span style={{ width: `${summary.atRisk ? Math.min(100, value / summary.atRisk * 100 * 2.5) : 0}%` }} /></div></div><strong>{money(value)}</strong></div>)}</div>
      <div className="panel automation-panel"><PanelHeader title="Automation run" subtitle="What CloseLoop changed this cycle" action={<button className="ghost-link" onClick={() => onGo("automation")}>Open run <ArrowRight size={14}/></button>} /><div className="run-list"><RunLine icon={<Check size={14}/>} label="Invoices normalized" value={`${rows.length}`} tone="good"/><RunLine icon={<Check size={14}/>} label="Auto-matched" value={`${summary.matched}`} tone="good"/><RunLine icon={<AlertTriangle size={14}/>} label="Exceptions routed" value={`${summary.exceptions}`} tone="warn"/><RunLine icon={<Send size={14}/>} label="Actions awaiting approval" value={`${exceptions.filter(e=>e.status === "open").length}`} tone="blue"/></div><div className="automation-quote"><span>“</span><p>Automation is not about replacing people. It is about returning their time.</p><small>— CloseLoop</small></div></div>
    </section>
  </>;
}

function ExceptionInspector({ selected, setStatus, onFollowUp }: { selected: ExceptionItem | null; setStatus: (id: string, s: Status) => void; onFollowUp: () => void }) {
  if (!selected) return <div className="panel empty-inspector"><div className="empty-icon"><CheckCircle2 size={20}/></div><h3>No exceptions</h3><p>Every record is reconciled.</p></div>;
  return <div className="panel inspector"><div className="inspector-head"><div><div className="eyebrow">{selected.invoice}</div><h2>{selected.title}</h2><span>{selected.customer}</span></div><Badge severity={selected.severity}/></div><div className="inspector-numbers"><div><span>Expected</span><strong>{money(selected.expected)}</strong></div><div><span>Actual</span><strong>{money(selected.actual)}</strong></div><div className="danger"><span>Attention</span><strong>{money(selected.amount)}</strong></div></div><div className="evidence"><div className="evidence-head"><b>Evidence</b><span>source-backed</span></div>{selected.evidence.map((x, i) => <div key={i} className="evidence-row"><span>{i + 1}</span><p>{x}</p></div>)}</div><div className="ai-explain"><ShieldCheck size={15}/><div><b>Why CloseLoop flagged it</b><p>{selected.reason}</p></div></div><div className="recommendation"><b>Recommended action</b><p>{selected.recommendation}</p></div><div className="inspector-actions"><button className="primary wide" onClick={onFollowUp}><MessageSquare size={16}/> Draft customer follow-up</button>{selected.status !== "resolved" ? <button className="secondary wide" onClick={() => setStatus(selected.id, "resolved")}><Check size={16}/> Mark as resolved</button> : <button className="secondary wide" onClick={() => setStatus(selected.id, "open")}><RefreshCcw size={16}/> Reopen</button>}</div></div>;
}

function InvoicesView({ rows, exceptions, onSelect, onUpload, onSample, onTemplate }: { rows: RecordRow[]; exceptions: ExceptionItem[]; onSelect: (id: string) => void; onUpload: () => void; onSample: () => void; onTemplate: () => void }) {
  return <section className="panel full-panel"><PanelHeader title="Invoices & payments" subtitle="The underlying records driving every operational decision" action={<div className="panel-actions"><button className="secondary" onClick={onTemplate}><Download size={14}/> Template</button><button className="secondary" onClick={onSample}><RefreshCcw size={14}/> Demo data</button><button className="primary" onClick={onUpload}><Upload size={14}/> Upload CSV</button></div>} /><div className="invoice-summary"><MiniStat label="Invoice value" value={money(rows.reduce((a, r) => a + r.invoiceAmount, 0))}/><MiniStat label="Collected" value={money(rows.reduce((a, r) => a + r.paidAmount, 0))} tone="good"/><MiniStat label="Outstanding" value={money(rows.reduce((a, r) => a + Math.max(0, r.invoiceAmount - r.paidAmount), 0))} tone="warn"/><MiniStat label="Exceptions" value={`${exceptions.length}`} tone=""/></div><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Due</th><th>Invoice value</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>{rows.map(r => { const balance = Math.max(0, r.invoiceAmount - r.paidAmount); const ex = exceptions.find(e => e.invoice === r.invoice); return <tr key={r.id} onClick={() => ex ? onSelect(ex.id) : undefined} className={ex ? "clickable-row" : ""}><td className="mono">{r.invoice}</td><td><b>{r.customer}</b>{r.paymentRef ? <span className="subcell">{r.paymentRef}</span> : null}</td><td>{dateLabel(r.invoiceDate)}</td><td>{dateLabel(r.dueDate)}</td><td className="strong-money">{money2(r.invoiceAmount)}</td><td>{money2(r.paidAmount)}</td><td className={balance ? "danger-text" : "good-text"}>{money2(balance)}</td><td><StatusChip status={r.status}/></td></tr>})}</tbody></table></div></section>;
}
function StatusChip({ status }: { status: string }) { const map: Record<string, string> = { matched: "Matched", short: "Underpaid", overdue: "Overdue", duplicate: "Duplicate", missing: "Missing payment" }; return <span className={`record-status ${status}`}>{map[status] || status}</span>; }

function ExceptionsView({ exceptions, selected, onSelect, query, setQuery, filter, setFilter, filtered, setStatus, onFollowUp }: { exceptions: ExceptionItem[]; selected: ExceptionItem | null; onSelect: (id: string) => void; query: string; setQuery: (s: string) => void; filter: "all" | Severity; setFilter: (s: "all" | Severity) => void; filtered: ExceptionItem[]; setStatus: (id: string, s: Status) => void; onFollowUp: () => void }) { return <section className="section-grid"><div className="panel exceptions-panel full-height"><PanelHeader title="Exception command queue" subtitle="Every row is actionable, explainable, and reversible"/><div className="queue-toolbar"><div className="search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search exception…"/></div><div className="filter-pills"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>All</button>{(["critical","high","medium","low"] as Severity[]).map(s=><button key={s} className={filter===s?"active":""} onClick={()=>setFilter(s)}>{s}</button>)}</div></div><div className="exception-grid">{filtered.map(e=><button key={e.id} className={`exception-card ${selected?.id===e.id?"selected":""}`} onClick={()=>onSelect(e.id)}><div className="exception-card-top"><Badge severity={e.severity}/><StatusBadge status={e.status}/></div><h3>{e.title}</h3><p>{e.customer} · {e.invoice}</p><strong>{money(e.amount)}</strong><span>{e.reason}</span></button>)}</div></div><ExceptionInspector selected={selected} setStatus={setStatus} onFollowUp={onFollowUp}/></section>; }

function AutomationView({ rows, exceptions, onRun, running, onAsk, onExport }: { rows: RecordRow[]; exceptions: ExceptionItem[]; onRun: ()=>void; running: boolean; onAsk: ()=>void; onExport: (f:"json"|"markdown"|"csv")=>void }) { return <section className="automation-screen"><div className="automation-hero panel"><div><div className="eyebrow">CONTROLLED AUTOMATION</div><h2>Every run has a beginning, a check, and a human gate.</h2><p>CloseLoop separates deterministic reconciliation from AI assistance, so rate limits or AI failures do not destroy the core workflow.</p></div><button className="primary big" onClick={onRun} disabled={running}>{running?<><RefreshCcw className="spin" size={16}/> Running…</>:<><Play size={16}/> Execute run</>}</button></div><div className="pipeline-grid"><StageCard n="01" title="Ingest" text={`${rows.length} records available`} icon={<Upload/>} done/><StageCard n="02" title="Normalize" text="Schema + numeric + date checks" icon={<FileCheck2/>} done/><StageCard n="03" title="Reconcile" text={`${rows.filter(r=>r.status==="matched").length} matched automatically`} icon={<CheckCircle2/>} done/><StageCard n="04" title="Route exceptions" text={`${exceptions.filter(e=>e.status==="open").length} waiting for review`} icon={<AlertTriangle/>} active/><StageCard n="05" title="Human approval" text="No irreversible action without approval" icon={<ShieldCheck/>}/></div><div className="automation-actions panel"><div><b>Operator tools</b><span>Use the run output as your source of truth.</span></div><div className="panel-actions"><button className="secondary" onClick={onAsk}><Sparkles size={14}/> Generate AI brief</button><button className="secondary" onClick={()=>onExport("markdown")}><Download size={14}/> Export Markdown</button><button className="secondary" onClick={()=>onExport("json")}><Download size={14}/> Export JSON</button></div></div></section>; }
function StageCard({ n, title, text, icon, done, active }: { n:string; title:string; text:string; icon:ReactNode; done?:boolean; active?:boolean }) { return <div className={`stage-card ${done?"done":""} ${active?"active":""}`}><div className="stage-no">{n}</div><div className="stage-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{done?<span><Check size={12}/> complete</span>:active?<span><Activity size={12}/> live queue</span>:<span>pending gate</span>}</div>; }

function ReportsView({ summary, exceptions, rows, topCustomers, trend, onExport }: { summary: RunSummary; exceptions: ExceptionItem[]; rows: RecordRow[]; topCustomers: [string,number][]; trend:[string,{processed:number;risk:number}][]; onExport:(f:"json"|"markdown"|"csv")=>void }) { const matchedPct = rows.length ? summary.matched / rows.length * 100 : 0; return <section className="reports"><div className="report-header"><div><div className="eyebrow">OPERATIONS REPORT</div><h2>What the data says right now.</h2><p>Numbers are computed from the records currently loaded into CloseLoop.</p></div><div className="panel-actions"><button className="secondary" onClick={()=>onExport("csv")}><Download size={14}/> CSV</button><button className="secondary" onClick={()=>onExport("json")}><Download size={14}/> JSON</button></div></div><div className="report-grid"><div className="report-card large"><span>Reconciliation rate</span><strong>{matchedPct.toFixed(1)}%</strong><div className="report-track"><span style={{width:`${matchedPct}%`}}/></div><small>{summary.matched} of {rows.length} records auto-matched.</small></div><div className="report-card"><span>At-risk value</span><strong>{money(summary.atRisk)}</strong><small>{exceptions.length} exceptions currently surfaced.</small></div><div className="report-card"><span>Estimated time saved</span><strong>{summary.savedMinutes}m</strong><small>Based on record volume and exception complexity.</small></div></div><div className="report-columns"><div className="panel"><PanelHeader title="Risk by customer" subtitle="Outstanding value"/>{topCustomers.map(([c,v],i)=><div className="risk-row" key={c}><span>{i+1}</span><b>{c}</b><div className="risk-bar"><span style={{width:`${summary.atRisk?Math.min(100,v/summary.atRisk*180):0}%`}}/></div><strong>{money(v)}</strong></div>)}</div><div className="panel"><PanelHeader title="Recent months" subtitle="Processed records / risk value"/>{trend.length?trend.map(([m,v])=><div className="month-row" key={m}><span>{m}</span><div className="month-bars"><span style={{width:`${Math.max(8,v.processed/Math.max(...trend.map(x=>x[1].processed))*100)}%`}}/><i style={{width:`${summary.atRisk?Math.max(5,v.risk/summary.atRisk*100):0}%`}}/></div><b>{v.processed}</b></div>):<div className="empty-state">Load more records to see trends.</div>}</div></div></section>; }

function AuditView({ events }: { events: ActivityEvent[] }) { return <section className="panel full-panel"><PanelHeader title="Activity & audit" subtitle="Live actions from this browser session" action={<span className="audit-safe"><ShieldCheck size={13}/> Human approval gate on</span>}/>{events.length ? <div className="timeline">{events.map(e => <div className="timeline-row" key={e.id}><div className="timeline-dot"/><div><b>{e.action}</b><span>{e.detail}</span></div><time>{e.time}</time></div>)}</div> : <div className="empty-state">Run automation or interact with the workspace to build a live activity trail.</div>}</section>; }

function SettingsView({ source, onUpload, onSample, onTemplate, onCopyEnv }: { source:string; onUpload:()=>void; onSample:()=>void; onTemplate:()=>void; onCopyEnv:()=>void }) { return <section className="settings-grid"><div className="panel"><PanelHeader title="Data source" subtitle="This workspace is currently driven by"/><div className="settings-source"><div className="source-icon"><FileSpreadsheet size={18}/></div><div><b>{source}</b><span>All dashboard numbers update from this dataset.</span></div></div><div className="panel-actions"><button className="primary" onClick={onUpload}><Upload size={14}/> Replace dataset</button><button className="secondary" onClick={onSample}><RefreshCcw size={14}/> Restore demo</button><button className="secondary" onClick={onTemplate}><Download size={14}/> Template</button></div></div><div className="panel"><PanelHeader title="AI connection" subtitle="Keys stay server-side in .env.local"/><div className="env-box"><code>OPENROUTER_API_KEY</code><span>primary free router</span><code>REQUESTY_API_KEY</code><span>optional gateway</span><code>XKIRO_API_KEY</code><span>optional gateway</span></div><button className="secondary" onClick={onCopyEnv}><Clipboard size={14}/> Copy .env template</button></div><div className="panel"><PanelHeader title="Safety model" subtitle="What CloseLoop is allowed to do"/><div className="safety-list"><div><ShieldCheck size={16}/><span><b>Human approval gate</b>Nothing irreversible happens automatically.</span></div><div><FileCheck2 size={16}/><span><b>Deterministic first</b>Core reconciliation does not depend on AI.</span></div><div><History size={16}/><span><b>Auditability</b>Decisions can be traced to source evidence.</span></div></div></div></section>; }

function PanelHeader({ title, subtitle, action }: { title:string; subtitle?:string; action?:ReactNode }) { return <div className="panel-header"><div><h2>{title}</h2>{subtitle?<p>{subtitle}</p>:null}</div>{action}</div>; }
function RunLine({ icon, label, value, tone }: { icon:ReactNode; label:string; value:string; tone:string }) { return <div className="run-line"><span className={`run-line-icon ${tone}`}>{icon}</span><span>{label}</span><b>{value}</b></div>; }
function SignalChart({ trend }: { trend:[string,{processed:number;risk:number}][] }) { const maxP=Math.max(1,...trend.map(x=>x[1].processed)); return <div className="signal-chart">{trend.map(([month, v])=><div className="signal-col" key={month}><div className="signal-bars"><span style={{height:`${Math.max(12,v.processed/maxP*100)}%`}}/><i style={{height:`${Math.max(8, Math.min(100, v.risk / Math.max(1,...trend.map(x=>x[1].risk)) * 100))}%`}}/></div><small>{month.slice(5)}</small></div>)}</div>; }
