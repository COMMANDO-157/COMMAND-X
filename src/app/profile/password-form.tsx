"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function PasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const currentPassword = String(fields.get("currentPassword") ?? "");
    const newPassword = String(fields.get("newPassword") ?? "");
    if (newPassword !== fields.get("confirmPassword")) { setError("New passwords do not match."); return; }
    setPending(true); setError("");
    try {
      const response = await fetch("/api/profile/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const result = await response.json();
      form.reset();
      if (!response.ok) { setError(result.error || "Password change failed."); return; }
      router.replace("/login"); router.refresh();
    } catch { form.reset(); setError("Connection failed. Try again."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="mt-4 grid max-w-xl gap-4">
    <label className="grid gap-1 text-sm font-medium">Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} className="rounded-lg border border-slate-300 bg-white p-3" /></label>
    <label className="grid gap-1 text-sm font-medium">New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} className="rounded-lg border border-slate-300 bg-white p-3" /></label>
    <label className="grid gap-1 text-sm font-medium">Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} className="rounded-lg border border-slate-300 bg-white p-3" /></label>
    <p className="text-sm text-slate-600">Use at least 12 characters and three of: lowercase, uppercase, numbers, symbols. Changing your password signs out every session.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={pending} className="w-fit rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{pending ? "Updating password…" : "Change password"}</button>
  </form>;
}
