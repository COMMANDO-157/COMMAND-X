import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOperator } from "@/lib/auth";
import { ImportResults } from "@/components/stage3/workspace";
import { SignOut } from "../../sign-out";

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  let operator;
  try { operator = await currentOperator(); } catch { redirect("/login"); }
  if (!operator) redirect("/login");
  const { id } = await params;
  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-12"><nav className="flex items-center justify-between"><Link href="/console" className="text-emerald-300 underline">Back to imports</Link><SignOut /></nav><ImportResults key={id} id={id} /></main>;
}
