import { redirect } from "next/navigation";
import { currentOperator } from "@/lib/auth";
import { SignOut } from "./sign-out";
import { ImportWorkspace } from "@/components/stage3/workspace";
import { Dashboard } from "@/components/dashboard/dashboard";
import { CloudGuide } from "@/components/dashboard/guide";
export default async function Console() {
  let operator;
  try { operator = await currentOperator(); } catch { redirect("/login"); }
  if (!operator) redirect("/login");
  return <main className="console-shell mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">CloudSentry operator console</h1><SignOut /></div>
    <p className="mt-3 text-slate-400">Signed in as {operator.login}. Your session was verified against PostgreSQL.</p>
    <nav aria-label="Console sections" className="console-nav mt-5 flex flex-wrap gap-2"><a href="#dashboard-title">Overview</a><a href="#resource-inventory">Resources</a><a href="#approval-queue">Approvals</a><a href="#audit-timeline">Audit trail</a><a href="#upload-title">Upload logs</a></nav>
    <CloudGuide />
    <Dashboard />
    <ImportWorkspace />
  </main>;
}
