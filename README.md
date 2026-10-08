# CloudSentry · COMMAND X

PS-03, ZEPHORIA 2K26. Stage 2 infrastructure and application foundation.

## Scope

Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, and Zod. Operator authentication uses scrypt password hashes, signed random session cookies, database-backed sessions, exact-origin mutation protection, and a database-backed login attempt budget (five attempts across this single-operator application per 15 minutes). Passwords and connection strings never reach client components.

Stage 3 modules are intentionally pending approval: ingestion, anomaly detection, cost calculation, dashboard analytics, script generation, approval decisions, and remediation simulation. No cloud commands are executed. No fabricated resource metrics are shown.

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

Stage 3 must implement validated whole-upload transactions, duplicate handling, sufficient-evidence classifications, atomic approved state transitions, and audit events. These schema constraints support that work but do not substitute for the remaining application logic.

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
