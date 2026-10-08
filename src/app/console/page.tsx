import { redirect } from "next/navigation";
import { currentOperator } from "@/lib/auth";
import { SignOut } from "./sign-out";
import { ImportWorkspace } from "@/components/stage3/workspace";
import { Dashboard } from "@/components/dashboard/dashboard";
export default async function Console() {
  let operator;
  try { operator = await currentOperator(); } catch { redirect("/login"); }
  if (!operator) redirect("/login");
  return <main className="console-shell mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">CloudSentry operator console</h1><SignOut /></div>
    <p className="mt-3 text-slate-400">Signed in as {operator.login}. Your session was verified against PostgreSQL.</p>
    <nav aria-label="Console sections" className="console-nav mt-5 flex flex-wrap gap-2"><a href="#dashboard-title">Overview</a><a href="#resource-inventory">Resources</a><a href="#approval-queue">Approvals</a><a href="#audit-timeline">Audit trail</a><a href="#upload-title">Upload logs</a></nav>
    <section className="console-guide mt-6 rounded-xl border p-5" aria-labelledby="how-it-works"><h2 id="how-it-works" className="text-xl font-semibold">How CloudSentry Works</h2><p className="mt-2 text-sm">Turn cloud logs into explainable decisions. You stay in control; the application only simulates remediation.</p><ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{[{name:"Upload",detail:"CSV or JSON logs"},{name:"Detect",detail:"Evidence-based rules"},{name:"Calculate",detail:"30-day projections"},{name:"Generate",detail:"Exact-target scripts"},{name:"Approve",detail:"Human review required"},{name:"Simulate",detail:"No cloud commands run"},{name:"Audit",detail:"Saved in PostgreSQL"}].map((step,index)=><li key={step.name} className="workflow-step rounded-lg border p-3"><span className="step-number" aria-hidden="true">{index+1}</span><h3 className="mt-2 font-semibold">{step.name}<span className="ml-2 text-blue-600" aria-hidden="true">{index<6?"→":"✓"}</span></h3><p className="mt-1 text-xs">{step.detail}</p></li>)}</ol><details className="mt-5"><summary className="cursor-pointer font-semibold">Why Cloud Waste Exists</summary><p className="mt-2 max-w-3xl text-sm leading-6">Pay-as-you-go bills for allocated resources, not just useful work. A running VM can incur compute charges even when its CPU is idle. Allocated storage can incur charges even when unattached or rarely accessed. Stopping compute may leave storage charges, and commitments can affect savings. CloudSentry uses your supplied evidence and pricing to show estimates, not guaranteed savings.</p></details></section>
    <Dashboard />
    <ImportWorkspace />
  </main>;
}
