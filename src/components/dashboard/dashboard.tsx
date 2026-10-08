"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RemediationPanel } from "@/components/remediation/panel";

type Resource = { id: string; provider: string; accountScope: string; region: string; type: string; externalId: string; latestObservedAt: string | null; demo: boolean };
type Finding = { id: string; resourceId: string; externalId: string; provider: string; rule: string; severity: string; explanation: string; projectedLeakage: string | null; currency: string; estimateCategory: string; status: string; selectedForTotal: boolean; windowStart: string; windowEnd: string };
type DashboardData = {
  counts: { resources: number; imports: number; observations: number; findings: number; pendingApprovals: number };
  currencies: { currency: string; avoidableWaste: string; potentialExcessSpend: string; unpricedFindings: number }[];
  resources: Resource[]; findings: Finding[];
  remediations: { id: string; findingId: string; status: string; scriptHash: string; format: string; createdAt: string; externalId: string }[];
  auditEvents: { id: string; action: string; previousState: string | null; nextState: string | null; simulation: boolean; outcome: string; createdAt: string; details: unknown }[];
};
const box = "dashboard-card mt-6 rounded-xl border border-slate-700 bg-slate-900 p-5 sm:p-6";
const link = "text-emerald-300 underline underline-offset-4";
const button = "rounded border border-slate-600 px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50";
const friendly = (value: string) => value.replaceAll("_", " ");

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [provider, setProvider] = useState("all");
  const [sort, setSort] = useState("latest");
  const [selectedRemediation, setSelectedRemediation] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const load = useCallback(async () => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Dashboard records are unavailable.");
      setData(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Dashboard records are unavailable."); }
    finally { setPending(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!data) return <section className={box}>{error ? <p role="alert" className="text-red-300">{error}</p> : <p role="status">Loading PostgreSQL dashboard records…</p>}<button type="button" onClick={load} disabled={pending} className={`${button} mt-3`}>Refresh</button></section>;
  const resources = data.resources.filter(resource => provider === "all" || resource.provider === provider).sort((a, b) => sort === "id" ? a.externalId.localeCompare(b.externalId) : sort === "provider" ? a.provider.localeCompare(b.provider) : (b.latestObservedAt || "").localeCompare(a.latestObservedAt || ""));
  const findings = data.findings.filter(finding => provider === "all" || finding.provider === provider);
  return <>
    <section className={box} aria-labelledby="dashboard-title"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="dashboard-title" className="text-xl font-semibold">Cloud cost intelligence</h2><button type="button" onClick={load} disabled={pending} className={button}>{pending ? "Refreshing…" : "Refresh saved state"}</button></div><p className="mt-2 text-sm text-slate-400">Live database records. DEMO fixtures are explicitly marked. All cloud remediation is simulated.</p>
      {error && <p role="alert" className="mt-3 text-red-300">{error} Displaying the last successfully fetched state.</p>}
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(data.counts).map(([key, value]) => <div key={key} className="metric-card rounded bg-slate-950 p-3" title={key === "pendingApprovals" ? "Scripts waiting for a human decision; approval permits simulation only." : "Saved PostgreSQL records, including labeled DEMO data."}><dt className="text-xs text-slate-400">{key === "pendingApprovals" ? "Pending approvals" : friendly(key)}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>)}</dl>
      <h3 className="mt-6 font-semibold">30-day projections · 720 hours</h3><p className="mt-2 text-sm text-slate-400">Current resource estimates, separated by currency. Spike excess is potential spend, not confirmed savings. Simulation does not change observed costs or claim realized savings.</p>
      {data.currencies.length === 0 ? <p className="mt-4 text-slate-400">No priced findings yet. Upload a log below.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.currencies.map(currency => <div key={currency.currency} className="rounded border border-slate-700 p-4"><h4 className="font-semibold">{currency.currency}</h4><p className="mt-2">Avoidable waste estimate: <strong className="text-emerald-300">{currency.avoidableWaste}</strong></p><p className="mt-2">Potential spike excess: <strong className="text-amber-200">{currency.potentialExcessSpend}</strong></p><p className="mt-2 text-xs text-slate-400">{currency.unpricedFindings} findings lack sufficient pricing. No prices invented.</p></div>)}</div>}
    </section>
    <section id="resource-inventory" className={box}><h2 className="text-xl font-semibold">Resource inventory</h2><div className="mt-4 flex flex-wrap gap-4"><label className="text-sm">Provider <select className="ml-2 rounded border border-slate-600 bg-slate-950 p-2" value={provider} onChange={event => setProvider(event.target.value)}><option value="all">All providers</option><option value="aws">AWS</option><option value="azure">Azure</option><option value="gcp">GCP</option></select></label><label className="text-sm">Sort <select className="ml-2 rounded border border-slate-600 bg-slate-950 p-2" value={sort} onChange={event => setSort(event.target.value)}><option value="latest">Latest observation</option><option value="id">Resource ID</option><option value="provider">Provider</option></select></label></div>
      {resources.length === 0 ? <p className="mt-4 text-slate-400">No resources match this filter. Choose All providers or upload a CSV/JSON log below.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th scope="col" className="p-2">Exact resource</th><th scope="col" className="p-2">Provider / account</th><th scope="col" className="p-2">Region / type</th><th scope="col" className="p-2">Latest observation (UTC)</th></tr></thead><tbody>{resources.map(resource => <tr key={resource.id} className="border-t border-slate-700"><td className="max-w-xs break-all p-2"><Link href={`/console/resources/${resource.id}`} className={`${link} font-mono`}>{resource.externalId}</Link>{resource.demo && <span className="ml-2 text-amber-200">DEMO</span>}</td><td className="max-w-xs break-all p-2">{resource.provider}<br />{resource.accountScope}</td><td className="p-2">{resource.region}<br />{friendly(resource.type)}</td><td className="p-2">{resource.latestObservedAt || "Unknown"}</td></tr>)}</tbody></table></div>}
    </section>
    <section className={box}><h2 className="text-xl font-semibold">Explainable findings</h2>{findings.length === 0 ? <p className="mt-4 text-slate-400">No qualifying findings match this filter. Sufficient observation history is required; missing measurements remain unknown.</p> : findings.map(finding => <article className="mt-4 border-t border-slate-700 pt-4" key={finding.id}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{friendly(finding.rule)} · {finding.severity}</h3><span className="text-sm text-slate-400">{friendly(finding.status)}</span></div><Link href={`/console/resources/${finding.resourceId}`} className={`${link} mt-2 block break-all font-mono`}>{finding.externalId}</Link><p className="mt-2 text-sm">{finding.explanation}</p><p className="mt-2 text-sm">30-day {finding.estimateCategory === "potential_excess_spend" ? "potential excess" : "avoidable waste estimate"}: {finding.projectedLeakage === null ? "Unavailable — insufficient pricing" : `${finding.currency} ${finding.projectedLeakage}`}</p><p className="mt-1 text-xs text-slate-400">Evidence: {finding.windowStart} → {finding.windowEnd}</p><button type="button" className={`${button} mt-3`} onClick={() => setSelectedFinding(selectedFinding === finding.id ? null : finding.id)}>{selectedFinding === finding.id ? "Close remediation review" : "Review remediation options"}</button>{selectedFinding === finding.id && <RemediationPanel key={finding.id} findingId={finding.id} onChanged={() => { void load(); }} />}</article>)}</section>
    <section id="approval-queue" className={box}><h2 className="text-xl font-semibold">Approval queue & simulations</h2>{data.remediations.length === 0 ? <p className="mt-4 text-slate-400">No scripts generated yet. Open Review remediation options on a finding to generate a script for human review.</p> : <ul className="mt-4 space-y-3">{data.remediations.map(remediation => <li key={remediation.id} className="rounded border border-slate-700 p-3"><button type="button" className={`${link} break-all text-left`} onClick={() => setSelectedRemediation(selectedRemediation === remediation.id ? null : remediation.id)}>{remediation.externalId} · {remediation.format} · {friendly(remediation.status)}</button>{selectedRemediation === remediation.id && <RemediationPanel key={remediation.id} remediationId={remediation.id} onChanged={() => { void load(); }} />}</li>)}</ul>}</section>
    <section id="audit-timeline" className={box}><h2 className="text-xl font-semibold">Persistent audit timeline</h2>{data.auditEvents.length === 0 ? <p className="mt-4 text-slate-400">No audit records yet. Saved imports, decisions and simulations will appear here.</p> : <ol className="mt-4 space-y-3">{data.auditEvents.map(event => <li key={event.id} className="border-l-2 border-slate-600 pl-4"><p className="text-sm"><strong>{event.action}</strong> · {event.outcome}{event.simulation && <span className="ml-2 text-amber-200">SIMULATION</span>}</p><p className="mt-1 text-xs text-slate-400">{event.createdAt} · {event.previousState || "—"} → {event.nextState || "—"}</p><details className="mt-2"><summary className="cursor-pointer text-xs text-slate-300">Event details</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(event.details, null, 2)}</pre></details></li>)}</ol>}</section>
  </>;
}
