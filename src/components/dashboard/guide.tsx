const steps = [
  { name: "Upload", detail: "Bring CSV or JSON logs", icon: "M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5" },
  { name: "Analyze", detail: "Validate your evidence", icon: "M5 3h10l4 4v14H5zM9 11h6M9 15h6M15 3v5h4" },
  { name: "Detect", detail: "Find idle resources & spikes", icon: "M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0" },
  { name: "Calculate", detail: "Project 30-day costs", icon: "M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7" },
  { name: "Generate", detail: "Create an exact-target script", icon: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20" },
  { name: "Approve", detail: "You review and decide", icon: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6zM8 12l3 3 5-6" },
  { name: "Simulate", detail: "Preview; no cloud execution", icon: "M4 3h16v18H4zM9 8l7 4-7 4z" },
  { name: "Audit", detail: "Keep the saved decision trail", icon: "M6 4h12v18H6zM9 2h6v4H9zM9 10h6M9 14h6M9 18h3" },
] as const;

export function CloudGuide() {
  return <>
    <section className="console-hero mt-6 rounded-2xl border p-5 sm:p-7" aria-labelledby="cloudsentry-overview">
      <div className="hero-kicker">CLOUD INTELLIGENCE · HUMAN CONTROL</div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl"><h2 id="cloudsentry-overview" className="text-2xl font-bold sm:text-3xl">Know where your cloud spend goes.</h2><p className="mt-3 leading-7 text-slate-400"><strong className="text-slate-900">What is CloudSentry?</strong> Your cloud cost investigation workspace. Upload utilization logs, find waste and unusual spending, then review a resource-specific response with a saved audit trail.</p></div>
        <a href="#upload-title" className="console-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold">Upload cloud logs <span aria-hidden="true">↗</span></a>
      </div>
      <div className="mt-5 flex flex-wrap gap-2"><span className="guide-badge" title="Resource information comes from your uploaded observations, not a live cloud account connection.">Your uploaded evidence</span><span className="guide-badge" title="Human approval is required for the exact saved script hash before simulation.">Human approval</span><span className="guide-badge" title="The application never runs Bash, Terraform or cloud deletion commands.">Simulation only</span></div>
    </section>
    <section className="console-guide mt-5 rounded-2xl border p-5 sm:p-6" aria-labelledby="how-it-works">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="how-it-works" className="text-xl font-bold">How CloudSentry Works</h2><span className="text-sm text-slate-400">From evidence to a recorded decision</span></div>
      <ol className="workflow-grid mt-5">{steps.map((step,index)=><li key={step.name} className="workflow-step relative rounded-xl border p-3" title={step.detail}><div className="flex items-center justify-between"><span className="workflow-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={step.icon}/></svg></span><span className="workflow-number" aria-hidden="true">{String(index+1).padStart(2,"0")}</span></div><h3 className="mt-3 font-semibold">{step.name}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{step.detail}</p></li>)}</ol>
      <p className="mt-4 text-xs text-slate-400">Every saved import, approval, rejection and simulation is backed by PostgreSQL. A simulation does not change your cloud resources.</p>
    </section>
    <section className="mt-5 grid gap-4 md:grid-cols-2" aria-label="Understanding cloud costs">
      <article className="explanation-card rounded-xl border p-5"><span className="explanation-icon" aria-hidden="true">↗</span><h2 className="mt-3 text-lg font-bold">Why pay-as-you-go can still waste money</h2><p className="mt-2 text-sm leading-6 text-slate-400">You pay for allocated resources, not just useful work. Running idle VMs can incur compute charges. Unattached or unused storage can still incur storage charges.</p><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Does stopping a VM stop every charge?</summary><p className="mt-2 text-sm leading-6 text-slate-400">Not necessarily. Disks and other allocated resources can remain billable. Contracts, commitments and retention needs can affect the cost you actually avoid.</p></details></article>
      <article className="explanation-card rounded-xl border p-5"><span className="explanation-icon" aria-hidden="true">≈</span><h2 className="mt-3 text-lg font-bold">Projected waste is not confirmed savings</h2><p className="mt-2 text-sm leading-6 text-slate-400">A projection estimates 30 days at the supplied rate. Spike excess is potential extra spend; avoidable waste is a rule-based estimate. Neither is money already saved.</p><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">What does a simulation prove?</summary><p className="mt-2 text-sm leading-6 text-slate-400">It records your approved workflow without running cloud commands. Actual savings would require evidence of changed consumption and billing; CloudSentry does not claim measured savings.</p></details></article>
    </section>
  </>;
}
