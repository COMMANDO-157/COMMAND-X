"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type ImportRecord = { id: string; filename: string; demo: boolean; status: string; rowCount: number; createdAt: string };
type Resource = { id: string; provider: string; accountScope: string; region: string; type: string; externalId: string };
type Finding = { id: string; resourceId: string; externalId: string; provider: string; rule: string; severity: string; explanation: string; parameters: unknown; evidence: unknown; costInputs: unknown; projectedLeakage: string | null; currency: string; estimateCategory: string; selectedForTotal: boolean; status: string; windowStart: string; windowEnd: string };
type ImportDetail = { import: ImportRecord; resources: Resource[]; findings: Finding[]; summaries: { currency: string; avoidableWaste: string; potentialExcessSpend: string }[]; warnings: string[] };
type ResourceDetail = { resource: Resource; observations: unknown[]; observationCount: number; findings: Finding[] };
const panel = "mt-6 rounded-xl border border-slate-700 bg-slate-900 p-5";
const link = "text-emerald-300 underline underline-offset-4";

async function readApi<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(response.status === 401 ? "Session expired. Sign in again to continue." : payload.error || "Unable to load saved records.");
  return payload as T;
}

function useSavedData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    readApi<T>(url, controller.signal).then(setData).catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [url]);
  return { data, error };
}

function LoadState({ error }: { error: string }) {
  return error ? <p role="alert" className="mt-6 text-red-300">{error} <Link href="/login" className={link}>Sign in</Link></p> : <p role="status" className="mt-6 text-slate-400">Loading persisted records…</p>;
}

export function ImportWorkspace() {
  const { data, error } = useSavedData<{ imports: ImportRecord[] }>("/api/imports");
  const [pending, setPending] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [issues, setIssues] = useState<{ row?: number; field?: string; message: string }[]>([]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setUploadError(""); setIssues([]);
    try {
      const body = new FormData(event.currentTarget);
      const file = body.get("file");
      if (!(file instanceof File) || !file.size) throw new Error("Choose a CSV or JSON file.");
      if (file.size > 2 * 1024 * 1024) throw new Error("The file exceeds the 2 MiB upload limit.");
      const response = await fetch("/api/imports", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) { setIssues(result.issues || []); throw new Error(result.error || "Import failed."); }
      window.location.assign(`/console/imports/${encodeURIComponent(result.importId)}`);
    } catch (reason) { setUploadError(reason instanceof Error ? reason.message : "Import failed."); setPending(false); }
  }
  return <>
    <section className={panel} aria-labelledby="upload-title">
      <h2 id="upload-title" className="text-xl font-semibold">Import cloud utilization logs</h2>
      <p className="mt-2 text-slate-400">CSV with headers or JSON. Maximum 2 MiB and 5,000 observations. Missing measurements stay unknown.</p>
      <form onSubmit={upload} className="mt-5 space-y-4">
        <div><label htmlFor="log-file" className="mb-2 block">Cloud log file</label><input id="log-file" name="file" type="file" accept=".csv,.json,text/csv,application/json" required disabled={pending} className="block w-full rounded border border-slate-600 p-3 file:mr-4 file:rounded file:bg-slate-700 file:px-3 file:py-2" /></div>
        <label className="flex items-center gap-3"><input type="checkbox" name="demo" value="true" disabled={pending} /> This is a synthetic DEMO dataset</label>
        <button type="submit" disabled={pending} className="rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{pending ? "Validating and saving…" : "Upload and analyze"}</button>
      </form>
      {pending && <p role="status" className="mt-3">Import in progress. Results appear after database persistence succeeds.</p>}
      {uploadError && <div role="alert" className="mt-4 text-red-300"><p>{uploadError}</p>{issues.length > 0 && <ul className="mt-2 list-disc pl-5">{issues.map((issue, index) => <li key={index}>{issue.row !== undefined ? `Row ${issue.row}: ` : ""}{issue.field ? `${issue.field}: ` : ""}{issue.message}</li>)}</ul>}</div>}
      <p className="mt-5 text-sm text-slate-400">Synthetic spike fixtures: <a className={link} href="/fixtures/demo-cloud-spike.csv" download>Download CSV</a> · <a className={link} href="/fixtures/demo-cloud-spike.json" download>Download JSON</a>. Mark fixture uploads as DEMO.</p>
    </section>
    <section className={panel}><h2 className="text-xl font-semibold">Saved imports</h2>
      {!data ? <LoadState error={error} /> : data.imports.length === 0 ? <p className="mt-4 text-slate-400">No imports yet. Upload a log to begin.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">File</th><th className="p-2">Status</th><th className="p-2">Observations</th><th className="p-2">Imported (UTC)</th></tr></thead><tbody>{data.imports.map(item => <tr key={item.id} className="border-t border-slate-700"><td className="p-2"><Link className={link} href={`/console/imports/${item.id}`}>{item.filename}</Link>{item.demo && <span className="ml-2 text-amber-300">DEMO</span>}</td><td className="p-2">{item.status}</td><td className="p-2">{item.rowCount}</td><td className="p-2">{new Date(item.createdAt).toISOString()}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

function Findings({ findings }: { findings: Finding[] }) {
  return <section className={panel}><h2 className="text-xl font-semibold">Persisted findings</h2>{findings.length === 0 ? <p className="mt-4 text-slate-400">No qualifying findings. Insufficient evidence does not confirm an anomaly.</p> : findings.map(finding => <article key={finding.id} className="mt-5 border-t border-slate-700 pt-5">
    <h3 className="font-semibold">{finding.rule} · {finding.severity}</h3>
    <Link className={`${link} mt-2 block break-all font-mono`} href={`/console/resources/${finding.resourceId}`}>{finding.externalId}</Link>
    <p className="mt-3">{finding.explanation}</p>
    <p className="mt-3 text-emerald-300">30-day projection: {finding.projectedLeakage === null ? "Unavailable — pricing evidence missing" : `${finding.currency} ${finding.projectedLeakage}`} · {finding.estimateCategory}</p>
    <p className="mt-2 text-sm text-slate-400">{finding.estimateCategory === "potential_excess_spend" ? "Potential excess shown separately; excluded from confirmed-waste total" : finding.projectedLeakage === null ? "Unpriced finding; no savings invented" : finding.selectedForTotal ? "Selected as the current resource waste estimate" : "Historical estimate; excluded from the current resource waste total"} · Status: {finding.status}</p>
    <p className="mt-2 text-sm text-slate-400">Evidence window: {finding.windowStart} → {finding.windowEnd}</p>
    <details className="mt-3"><summary className="cursor-pointer text-slate-300">Inspect thresholds, evidence, pricing source and assumptions</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950 p-4 text-xs">{JSON.stringify({ thresholds: finding.parameters, evidence: finding.evidence, financialInputs: finding.costInputs }, null, 2)}</pre></details>
  </article>)}</section>;
}

export function ImportResults({ id }: { id: string }) {
  const { data, error } = useSavedData<ImportDetail>(`/api/imports/${encodeURIComponent(id)}`);
  if (!data) return <LoadState error={error} />;
  return <><h1 className="mt-6 text-2xl font-semibold">{data.import.filename} {data.import.demo && <span className="text-amber-300">— DEMO</span>}</h1><p className="mt-2 text-slate-400">{data.import.status} · {data.import.rowCount} persisted observations · {data.resources.length} resources</p>
    {data.warnings.length > 0 && <div role="status" className={`${panel} text-amber-200`}><h2 className="font-semibold">Import warnings</h2><ul className="mt-2 list-disc pl-5">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    <section className={panel}><h2 className="text-xl font-semibold">This import’s 30-day estimates by currency</h2><p className="mt-2 text-sm text-slate-400">Projections use 720 hours and are estimates, not guaranteed savings. These are saved per-import results. Potential spike excess is separate from confirmed avoidable waste. Currencies are never combined.</p>{data.summaries.length === 0 ? <p className="mt-4">No priced projections available.</p> : data.summaries.map(summary => <div key={summary.currency} className="mt-4"><h3 className="font-semibold">{summary.currency}</h3><p>Confirmed avoidable waste estimate: {summary.avoidableWaste}</p><p>Potential spike excess: {summary.potentialExcessSpend}</p></div>)}</section>
    <section className={panel}><h2 className="text-xl font-semibold">Resources</h2><ul className="mt-3 space-y-3">{data.resources.map(resource => <li key={resource.id}><Link className={`${link} break-all font-mono`} href={`/console/resources/${resource.id}`}>{resource.externalId}</Link><p className="text-sm text-slate-400">{resource.provider} · Account {resource.accountScope} · {resource.region} · {resource.type}</p></li>)}</ul></section>
    <Findings findings={data.findings} />
  </>;
}

export function ResourceResults({ id }: { id: string }) {
  const { data, error } = useSavedData<ResourceDetail>(`/api/resources/${encodeURIComponent(id)}`);
  if (!data) return <LoadState error={error} />;
  return <><h1 className="mt-6 break-all font-mono text-xl font-semibold">{data.resource.externalId}</h1><p className="mt-3 text-slate-400">{data.resource.provider} · Account {data.resource.accountScope} · {data.resource.region} · {data.resource.type}</p><Findings findings={data.findings} /><section className={panel}><h2 className="text-xl font-semibold">Persisted observations (latest {data.observations.length} of {data.observationCount})</h2><p className="mt-2 text-sm text-slate-400">Original utilization and pricing evidence; missing values remain unknown. This view shows at most 100 observations; all imported observations remain in the database.</p><pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950 p-4 text-xs">{JSON.stringify(data.observations, null, 2)}</pre></section></>;
}
