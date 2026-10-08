import { redirect } from "next/navigation";
import { currentOperator } from "@/lib/auth";
import { SignOut } from "./sign-out";
export default async function Console() {
  let operator;
  try { operator = await currentOperator(); } catch { redirect("/login"); }
  if (!operator) redirect("/login");
  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">CloudSentry operator console</h1><SignOut /></div>
    <p className="mt-3 text-slate-400">Signed in as {operator.login}. Your session was verified against PostgreSQL.</p>
    <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-semibold text-emerald-400">Stage 2 foundation</h2><p className="mt-3 leading-7 text-slate-400">Operator authentication and audit persistence are configured. Cloud resource ingestion, findings, cost intelligence, and remediation remain pending Stage 3 approval.</p></section>
  </main>;
}
