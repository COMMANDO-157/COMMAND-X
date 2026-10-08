"use client";

import { useEffect, useId, useState } from "react";

type Remediation = { id: string; findingId: string; action: string; format: "bash" | "terraform"; scriptText: string; scriptHash: string; status: string; simulationOnly: boolean; createdAt: string };
type Detail = { remediation: Remediation; decisions: unknown[]; auditEvents: unknown[]; resource: { externalId: string; provider: string; accountScope: string; region: string }; finding: { rule: string; status: string } };
const button = "rounded border border-slate-600 px-3 py-2 text-sm font-medium hover:bg-slate-700 disabled:cursor-wait disabled:opacity-50";

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The action could not be saved. Please retry.");
  return result as T;
}

export function RemediationPanel({ findingId, remediationId, onChanged }: { findingId?: string; remediationId?: string; onChanged?: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [format, setFormat] = useState<"bash" | "terraform">("bash");
  const id = useId();

  useEffect(() => {
    if (!remediationId) return;
    let active = true;
    request<Detail>(`/api/remediations/${remediationId}`).then(result => { if (active) setDetail(result); }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [remediationId]);

  async function generate() {
    if (!findingId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request<{ remediation: Remediation }>("/api/remediations", { findingId, format });
      setDetail(await request<Detail>(`/api/remediations/${result.remediation.id}`));
      setReviewed(false); setNotice("Script saved. Review its exact target and content before deciding."); onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Generation failed."); }
    finally { setBusy(false); }
  }

  async function act(action: "approve" | "reject" | "simulate") {
    if (!detail) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const record = detail.remediation;
      await request(`/api/remediations/${record.id}/${action === "simulate" ? "simulate" : "decision"}`, action === "simulate" ? { scriptHash: record.scriptHash } : { decision: action, comment: comment.trim() || undefined, scriptHash: record.scriptHash });
      setDetail(await request<Detail>(`/api/remediations/${record.id}`));
      setNotice(action === "simulate" ? "SIMULATION recorded. No cloud commands ran and no actual savings are claimed." : `Your ${action === "approve" ? "approval" : "rejection"} was saved to PostgreSQL.`);
      onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed."); }
    finally { setBusy(false); }
  }

  async function copy() {
    if (!detail) return;
    try { await navigator.clipboard.writeText(detail.remediation.scriptText); setNotice("Manual-review script copied. Running downloaded Bash changes real cloud resources; this application only simulates."); }
    catch { setError("Clipboard access failed. Select the script text to copy it manually."); }
  }
  function download() {
    if (!detail) return;
    const objectUrl = URL.createObjectURL(new Blob([detail.remediation.scriptText], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = `cloudsentry-manual-review-${detail.remediation.id}.${detail.remediation.format === "bash" ? "sh" : "tf"}`; anchor.click(); URL.revokeObjectURL(objectUrl);
  }

  const record = detail?.remediation;
  return <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4">
    <h4 className="font-semibold">Human approval & remediation simulation</h4>
    <p className="mt-2 text-sm text-amber-200">The application runs SIMULATION ONLY. Downloaded Bash contains real stop/delete commands: running it manually changes cloud resources. Review the exact target and impact. Approval here permits only a separately audited simulation.</p>
    {!record && findingId && <div className="mt-4 flex flex-wrap items-center gap-3"><label htmlFor={`${id}-format`}>Script format</label><select id={`${id}-format`} value={format} onChange={event => setFormat(event.target.value as "bash" | "terraform")} disabled={busy} className="rounded border border-slate-600 bg-slate-900 p-2"><option value="bash">Bash</option><option value="terraform">Terraform</option></select><button type="button" className={button} disabled={busy} onClick={generate}>{busy ? "Saving script…" : "Generate remediation script"}</button></div>}
    {!record && remediationId && !error && <p role="status" className="mt-3">Loading saved approval request…</p>}
    {detail && record && <>
      <p className="mt-4">Status: <strong>{record.status}</strong> · Format: {record.format}</p>
      <dl className="mt-3 grid gap-1 text-sm"><dt className="text-slate-400">Exact target</dt><dd className="break-all font-mono">{detail.resource.externalId}</dd><dt className="text-slate-400">Provider / account / region</dt><dd className="break-all">{detail.resource.provider} / {detail.resource.accountScope} / {detail.resource.region}</dd><dt className="text-slate-400">Action</dt><dd>{record.action}</dd><dt className="text-slate-400">SHA-256 script hash</dt><dd className="break-all font-mono">{record.scriptHash}</dd></dl>
      <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded border border-slate-700 p-3 text-xs" tabIndex={0}>{record.scriptText}</pre>
      <div className="mt-3 flex gap-3"><button type="button" className={button} onClick={copy}>Copy script</button><button type="button" className={button} onClick={download}>Download script</button></div>
      {record.status === "pending_approval" && <div className="mt-5 space-y-3"><label htmlFor={`${id}-comment`} className="block text-sm">Decision note (optional)</label><textarea id={`${id}-comment`} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} disabled={busy} className="w-full rounded border border-slate-600 bg-slate-900 p-3" rows={2} /><label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} disabled={busy} />I reviewed the exact resource, account, region and script above. Approval permits simulation only.</label><div className="flex gap-3"><button type="button" className={`${button} border-emerald-600 text-emerald-300`} disabled={busy || !reviewed} onClick={() => act("approve")}>Approve simulation</button><button type="button" className={`${button} text-red-300`} disabled={busy} onClick={() => act("reject")}>Reject</button></div></div>}
      {record.status === "approved" && <button type="button" className={`${button} mt-4 border-amber-600 text-amber-200`} disabled={busy} onClick={() => act("simulate")}>Run approved simulation</button>}
      {record.status.startsWith("simulated_") && <p className="mt-4 text-amber-200">Simulation outcome saved. Observed costs and financial projections remain evidence-based; this did not realize savings.</p>}
      <details className="mt-4"><summary className="cursor-pointer text-sm text-slate-300">Persisted decisions and audit history</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify({ decisions: detail.decisions, auditEvents: detail.auditEvents }, null, 2)}</pre></details>
    </>}
    {busy && <p role="status" className="mt-3 text-sm">Saving and refreshing persisted state…</p>}
    {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-200">{notice}</p>}
  </div>;
}
