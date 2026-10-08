import "server-only";
import { and, desc, eq, gt, like, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, authAttempts, operators, sessions } from "@/db/schema";
import { hashPassword, strongPassword, verifyPassword } from "./security";
import type { currentOperator } from "./auth";

type OperatorSession = NonNullable<Awaited<ReturnType<typeof currentOperator>>>;

export async function profileFor(operator: OperatorSession) {
  const db = getDb();
  const [account] = await db.select({ id: operators.id, login: operators.login, createdAt: operators.createdAt })
    .from(operators).where(and(eq(operators.id, operator.id), eq(operators.disabled, false))).limit(1);
  if (!account) return null;
  const activity = await db.select({ id: auditEvents.id, action: auditEvents.action, createdAt: auditEvents.createdAt })
    .from(auditEvents).where(and(eq(auditEvents.operatorId, operator.id), like(auditEvents.action, "operator.%")))
    .orderBy(desc(auditEvents.createdAt)).limit(10);
  return { account, activity };
}

export async function changePassword(operator: OperatorSession, currentPassword: string, newPassword: string) {
  if (!strongPassword(newPassword)) return "weak" as const;
  return getDb().transaction(async (tx) => {
    // Lock the account while checking its current hash and revoking sessions.
    const [account] = await tx.select({ passwordHash: operators.passwordHash }).from(operators)
      .where(and(eq(operators.id, operator.id), eq(operators.disabled, false))).for("update").limit(1);
    const [active] = await tx.select({ id: sessions.id }).from(sessions)
      .where(and(eq(sessions.tokenHash, operator.tokenHash), eq(sessions.operatorId, operator.id), gt(sessions.expiresAt, new Date()))).limit(1);
    if (!account || !active) return "session_expired" as const;
    // A database lock makes the five attempts / 15 minutes limit durable across instances.
    await tx.execute(sql`select pg_advisory_xact_lock(710033)`);
    const key = `password_change:${operator.id}`;
    const [attempts] = await tx.select({ count: sql<number>`count(*)::int` }).from(authAttempts)
      .where(and(eq(authAttempts.key, key), gt(authAttempts.createdAt, new Date(Date.now() - 15 * 60 * 1000))));
    if (attempts.count >= 5) return "rate_limited" as const;
    await tx.insert(authAttempts).values({ key });
    if (!await verifyPassword(currentPassword, account.passwordHash)) return "invalid" as const;
    if (await verifyPassword(newPassword, account.passwordHash)) return "same" as const;
    const passwordHash = await hashPassword(newPassword);
    await tx.update(operators).set({ passwordHash }).where(eq(operators.id, operator.id));
    await tx.delete(sessions).where(eq(sessions.operatorId, operator.id));
    await tx.insert(auditEvents).values({ operatorId: operator.id, action: "operator.password_changed", previousState: "authenticated", nextState: "signed_out", outcome: "success", details: { sessionsRevoked: true } });
    return "changed" as const;
  });
}
