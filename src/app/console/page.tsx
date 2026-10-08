import { redirect } from "next/navigation";
import { currentOperator } from "@/lib/auth";
import { SignOut } from "./sign-out";
import { ImportWorkspace } from "@/components/stage3/workspace";
import { Dashboard } from "@/components/dashboard/dashboard";
export default async function Console() {
  let operator;
  try { operator = await currentOperator(); } catch { redirect("/login"); }
  if (!operator) redirect("/login");
  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">CloudSentry operator console</h1><SignOut /></div>
    <p className="mt-3 text-slate-400">Signed in as {operator.login}. Your session was verified against PostgreSQL.</p>
    <Dashboard />
    <ImportWorkspace />
  </main>;
}
