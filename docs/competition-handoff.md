# Competition handoff — PS-03 CloudSentry / COMMAND-X

Repository: https://github.com/COMMANDO-157/COMMAND-X
Production: https://cloudsentry-command-x.vercel.app

## Architecture and database

Browser → authenticated Next.js route handlers → Zod validation and deterministic analysis → Drizzle transactions → Neon PostgreSQL. Dashboard and inspection pages read persisted records. Secrets and administrative credentials stay on the server/local migration machine.

Ten tables cover operators, sessions, auth_attempts, imports, resources, observations, findings, remediations, decisions and audit_events. Resource identity includes provider, account, region and exact resource ID. Import transactions save evidence and findings atomically. Decisions reference immutable script hashes. Simulation and audit changes commit together. Audit and decisions are append-only; the runtime role cannot administer the schema.

## Rules and formulas

Idle compute: duration-weighted CPU p95 <5% and memory p95 <10%, running throughout. Overprovisioned: CPU p95 <20% and memory p95 <40%, excluding idle. Unattached storage: explicitly unattached with zero attachments throughout. All three require at least a 24-hour span, 90% coverage and sufficient observations/complete measurements.

USD spike: latest actual hourly cost exceeds three times the exact median of at least six contiguous preceding hourly costs, with at least USD 1/hour increase. Potential excess = (latest hourly cost − median baseline) ×720 hours. Demo: (2.00−0.20)×720 = USD 1,296. This is a projection, not measured avoidable waste or realized savings.

Idle waste = supplied hourly rate ×720. Rightsizing waste = positive difference between supplied current/replacement hourly rates ×720; missing replacement price stays unpriced. Unattached storage = supplied hourly storage cost ×720, or supplied monthly GiB rate ×size. Integer/rational arithmetic prevents intermediate decimal rounding; final amounts use eight decimals. Currency totals remain separate, and overlapping eligible waste estimates are not added twice.

## Remediation and security

Generated Bash validates exact scope and resource. Compute defaults to stop/deallocate; the explicit --delete mode contains exact-target deletion and requires both exact-ID and DELETE-plus-ID confirmations. It is irreversible, may delete attached disks, and requires independently verified backups/retention. Azure VM deletion can leave billable disks/network resources. Storage deletion requires live unattached checks. Do not run downloaded scripts in the competition demo.

The application executes no Bash, Terraform or cloud command. Human approval is required before a separately audited simulation, bound to the precise immutable script hash. Rejection prevents simulation. Existing proposals retain their original contents. Simulation does not change cloud observations or claim actual savings.

Passwords use scrypt; signed random cookies are HttpOnly, SameSite=Strict and Secure in production. Sessions, login attempts and revocations persist in PostgreSQL. Mutation endpoints require the exact configured origin. Every enabled operator shares one trusted workspace; this is not multi-tenant isolation.

## Three-minute demo

1. Before the timed demo, sign in and open /console; download public/fixtures/demo-cloud-spike.csv. Do not show credentials.
2. Upload the CSV and mark it synthetic DEMO. A repeat returns the persisted original import without duplicating records.
3. Inspect i-0123456789abcdef0, account 123456789012, region us-east-1. Explain USD 1,296 potential spike excess and zero confirmed waste for this fixture.
4. Generate Bash, show the exact target, deletion branch, warnings and script hash. Review it and approve simulation.
5. Run approved simulation. Refresh and show the persisted approval/execution audit trail. No cloud command runs.
6. If asked, generate a fresh proposal and reject it; simulation is unavailable for rejected proposals.

## Technical Q&A

- Why no paid AI? Deterministic, versioned thresholds are explainable and satisfy the sprint's zero-cost constraint. There is no paid inference or trained ML model.
- Why 720 hours? It is the explicit 30-day extrapolation assumption; projected excess is not a forecast with confidence intervals.
- Why preserve costs after simulation? Simulation does not prove actual consumption changed.
- How are duplicates handled? Canonical semantic hashes identify equivalent CSV/JSON. A different upload overlapping saved observations rolls back completely.
- How is approval safe? The approved hash references immutable script content; transactions and row locks enforce the decision and execution states.
- Why no Terraform apply? Exact resource address/original configuration is required; output is review-only comments. No provider state or rollback configuration is invented. Executable remediation is supplied through Bash.

## Free-tier setup and limitations

Existing GitHub Free repository, Vercel Hobby application and Neon Free PostgreSQL only; no new resources, paid inference, billing activation, payment details or purchases. Additional infrastructure purchases: ₹0. Plans/quotas must continue to be monitored manually; free capacity is limited.

Uploads require the complete evidence window; the engine does not assemble history across separate imports. Detection is restricted to supported compute/block-storage observations. Non-USD spikes have no invented conversion/threshold. Terraform is not executable; rightsizing requires manual compatible configuration. Cloud scripts are syntax/mock tested, not validated against real cloud resources. All demonstration resources are synthetic. Actual savings and real cloud execution are outside this application.

## Submission checklist

- [ ] Review the final production acceptance evidence and final commit hash in the separate Stage 7 report.
- [ ] Confirm repository visibility and deployment accessibility for judges.
- [ ] Prepare credentials privately and rehearse with the synthetic fixture.
- [ ] Explain Bash versus Terraform limitations and simulation accurately.
- [ ] Attach actual Captain's Logbook records; identify missing ten-minute coverage.
- [ ] Submit the repository/deployment links and required portal materials manually.

No competition portal submission is performed or claimed by the application or agent.
