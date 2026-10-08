import Link from "next/link";
export default function Home() {
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
    <div className="mb-10 flex items-center gap-3"><span className="rounded-xl bg-emerald-400 p-3 font-bold text-slate-950">CS</span><span className="text-xl font-semibold tracking-tight">CloudSentry</span><span className="ml-auto rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">PS-03 · COMMAND-X</span></div>
    <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">Cloud cost intelligence</p>
    <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Clarity before<br />cloud action.</h1>
    <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">Import cloud utilization logs, inspect exact resource IDs, and review explainable findings with transparent 30-day cost projections.</p>
    <Link href="/login" className="mt-8 w-fit rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300">Operator sign in →</Link>
    <div className="mt-14 grid gap-4 sm:grid-cols-3">{[
      ["Persistent by design", "PostgreSQL schema for resources, findings, decisions, sessions, and audit history."],
      ["Human approval", "Review exact-target scripts and approve simulations. Every decision is tied to the script hash and retained in the audit trail."],
      ["Simulation only", "Cloud commands are never executed by this application."],
    ].map(([title, description]) => <section key={title} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"><h2 className="font-medium">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></section>)}</div>
    <p className="mt-8 text-xs text-slate-500">CSV / JSON ingestion · Synthetic fixtures labeled DEMO · No fabricated live metrics</p>
  </main>;
}
