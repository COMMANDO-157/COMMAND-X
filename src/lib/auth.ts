import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { authAttempts, auditEvents, operators, sessions } from "@/db/schema";
import { createSessionToken, readSessionToken, verifyPassword } from "./security";

export const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-cloudsentry_session" : "cloudsentry_session";
export const SESSION_SECONDS = 8 * 60 * 60;
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: SESSION_SECONDS };
export async function currentOperator() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;
  const hash = readSessionToken(value, process.env.SESSION_SECRET ?? "");
  if (!hash) return null;
  const [row] = await getDb().select({ id: operators.id, login: operators.login, tokenHash: sessions.tokenHash })
    .from(sessions).innerJoin(operators, eq(sessions.operatorId, operators.id))
    .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, new Date()), eq(operators.disabled, false))).limit(1);
  return row ?? null;
}
export async function loginOperator(login: string, password: string) {
  const db = getDb();
  // A global database-backed budget suits this single-operator sprint. Serialize
  // requests so concurrent functions cannot bypass the five-attempt window.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(710032)`);
    const [attempts] = await tx.select({ count: sql<number>`count(*)::int` }).from(authAttempts)
      .where(and(eq(authAttempts.key, "operator_login"), gt(authAttempts.createdAt, new Date(Date.now() - 15 * 60 * 1000))));
    if (attempts.count >= 5) throw new Error("LOGIN_RATE_LIMIT");
    await tx.insert(authAttempts).values({ key: "operator_login" });
  });
  const [operator] = await db.select().from(operators).where(eq(operators.login, login)).limit(1);
  // Perform the same expensive derivation when the operator is unknown.
  const dummyHash = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
  const matches = await verifyPassword(password, operator?.passwordHash ?? dummyHash);
  if (!operator || operator.disabled || !matches) return null;
  const token = createSessionToken(process.env.SESSION_SECRET ?? "");
  await db.transaction(async (tx) => {
    await tx.insert(sessions).values({ operatorId: operator.id, tokenHash: token.hash, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
    await tx.insert(auditEvents).values({ operatorId: operator.id, action: "operator.login", nextState: "authenticated", outcome: "success" });
  });
  return token.cookie;
}
export async function logoutOperator(operator: NonNullable<Awaited<ReturnType<typeof currentOperator>>>) {
  await getDb().transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.tokenHash, operator.tokenHash));
    await tx.insert(auditEvents).values({ operatorId: operator.id, action: "operator.logout", previousState: "authenticated", nextState: "signed_out", outcome: "success" });
  });
}
