# CloudSentry · COMMAND X

PS-03, ZEPHORIA 2K26. Stage 3 ingestion, anomaly detection and cost intelligence.

## Scope

Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, and Zod. Operator authentication uses scrypt password hashes, signed random session cookies, database-backed sessions, exact-origin mutation protection, and a database-backed login attempt budget (five attempts across this single-operator application per 15 minutes). Passwords and connection strings never reach client components.

Stage 3 adds authenticated CSV/JSON upload, transactional persistence, semantic duplicate prevention, exact resource inspection, explainable anomaly findings and currency-separated 30-day projections. The full dashboard, script generation, approval decisions and remediation simulation await later approval. No cloud commands are executed. No fabricated resource metrics are shown.

The application is one shared operator workspace: every enabled operator is trusted to read workspace imports/resources; operator provisioning requires the administrative connection. Uploaded cloud account IDs are resource identities, not separate application tenants. This is not a multi-tenant authorization system.

## Stage 3 input and detection

See [canonical input format](docs/input-format.md) for required/optional fields and pricing/metadata conventions. Upload at `/console`; inspect saved import results and resource evidence there. JSON accepts an array or `{ "observations": [...], "demo": true }`; CSV requires headers. Maximum upload: 2 MiB, 5,000 rows. All rows validate before one transaction saves imports, resources, observations, findings, summaries and audit history.

Synthetic samples are available under `public/fixtures/`: spike CSV/JSON, idle compute, unattached storage, over-provisioned compute, malformed input and insufficient evidence. Both spike files normalize to the same semantic hash. Uploading the second format returns the original persisted import; it does not create duplicate observations. The synthetic EC2 ID is preserved exactly.

Each upload must include its complete qualifying evidence window. Identical content returns the original result. New content with observation intervals overlapping existing records is rejected and rolled back. Missing measurements stay null. Raw original rows, metadata, rate provenance and versioned findings persist in PostgreSQL.

- Idle: running compute, duration-weighted CPU p95 < 5% and memory p95 < 10%.
- Over-provisioned: running compute, CPU p95 < 20% and memory p95 < 40%, excluding idle.
- Unattached storage: explicit unattached state and zero attachments throughout the window.
- These three rules require at least a 24-hour span, 90% interval coverage and sufficient complete measurements. Missing replacement pricing produces an unpriced finding.
- Spike: latest actual USD hourly interval cost > 3× the exact median of at least six contiguous preceding hourly costs, with increase >= USD 1/hour. Spike evidence does not require 24 hours. No non-USD threshold or conversion is invented.

Financial calculations use integer/rational arithmetic and round only the final projected monetary amount to eight decimal places. Projections use 720 hours. Monthly GiB storage rates project the documented monthly amount directly; halfway-unit medians retain exact threshold comparisons. Current resource waste selects only the newest eligible finding. Potential spike excess and saved per-import estimates are shown separately; different currencies are never combined. Resource views show the latest 100 observations; all observations remain in PostgreSQL.

## Zero-cost policy

Additional infrastructure budget: ₹0. Use GitHub Free, Vercel Hobby, and Neon Free only. Do not enable billing, trials with a paid conversion, payment details, inference APIs, or paid resources. Check the account plan and available quota before provisioning. Free quotas are limits, not permission to enable paid overages.

Neon configuration is `defineConfig({})`: PostgreSQL only. `neon deploy` applies Neon configuration; it does not deploy this Next.js frontend.

## Local setup

Use Node.js 24 and the committed npm lockfile:

```text
npm ci
```

Copy `.env.example` to `.env.local` and set values securely. `DATABASE_URL` must use the restricted runtime role with a pooled connection. `DATABASE_ADMIN_URL` uses a separate direct administrative connection, for local migrations only. Both use `sslmode=verify-full`. Generate `SESSION_SECRET` from at least 32 random bytes. Set `APP_ORIGIN` to the exact canonical origin (`http://localhost:3000` locally).

```text
npm run db:inspect
npm run db:migrate
```

`db:configure` is a one-time setup for an empty, dedicated CloudSentry database after migration. It creates a restricted database role and a captain operator, generates random credentials and a session secret, and writes them to ignored local files. It refuses to replace an existing runtime role or credentials file. `credentials.local.txt` contains the initial operator login and password. Keep this file local; never upload or commit it. On Windows, file mode flags do not replace filesystem ACLs: keep the workspace in your own account's protected user directory.

For another operator, supply `OPERATOR_LOGIN` and `OPERATOR_BOOTSTRAP_PASSWORD` through a secure process environment and run `npm run operator:create`. The password must have 12–256 characters. No default production password exists in source code.

```text
npm run dev
```

Visit `/login`. Login and logout events are committed atomically with session creation/revocation. The console and operator API verify the live database session on every request.

## Database foundation

Tables: operators, sessions, auth_attempts, imports, resources, observations, findings, remediations, decisions, audit_events. SQL migrations live in `drizzle/` and are applied through Drizzle's migration journal.

- Identity includes cloud provider, account scope, region, and external ID.
- Monetary values use decimal columns; observations retain currency and rate provenance.
- Missing utilization remains null, not zero.
- Findings retain versioned rules, parameters, evidence windows, explanations, and cost inputs.
- Spike extrapolation is a separate estimate category and cannot enter the confirmed-waste total.
- A partial unique index permits only one selected waste estimate per resource.
- Decisions reference the exact remediation/script hash. Script content is immutable; changes require a new remediation version.
- Audit and decision updates/deletions are rejected. The application role also lacks truncate and schema-management privileges.
- All remediation records are constrained to simulation only.

Stage 3 implements validated whole-upload transactions, duplicate handling, sufficient-evidence classifications and import audit events. Future remediation modules must commit approval/state transitions and audit events atomically; schema constraints do not substitute for that remaining application logic.

## Checks

```text
npm run typecheck
npm run lint
npm test
npm run build
npm run db:verify
npm run test:http
npm run test:secrets
```

`db:verify` commits a clearly labeled test audit record, closes the connection, reads it through a fresh connection, and verifies update/delete rejection. It leaves the append-only test record as real verification evidence. `test:http` uses the ignored local operator credentials against a running application; set `VERIFY_BASE_URL` for the canonical HTTPS production origin. It checks protected routes, CSRF rejection, validation, wrong credentials, login, console access, logout and session revocation. Login tests consume the real five-attempt budget; avoid repeating them unnecessarily.

`test:secrets` checks configured secret values against source, migrations, tests, and generated browser bundles. This is a focused leakage check, not a guarantee against every possible form of exposure.

## Vercel

Deploy the project root as Next.js, using the personal Hobby scope. `vercel.json` places functions in Singapore near the supplied Neon project. Set production `DATABASE_URL`, `SESSION_SECRET`, and canonical `APP_ORIGIN` securely. Do not upload `DATABASE_ADMIN_URL`, `.env.local`, `credentials.local.txt`, `.neon`, or MCP API keys. Preview environments require separate data and credentials before enabling preview mutations.

The pool uses Vercel's lifecycle helper. Connection setup is lazy, so a build does not require live database access. Administrative scripts are never invoked by the build.

Captain's Logbook records are maintained separately by the operator. Portal submission remains manual. No telemetry submission automation is claimed.
