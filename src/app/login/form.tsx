"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: fields.get("login"), password: fields.get("password") }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Sign in failed."); return; }
      form.reset(); router.replace("/console"); router.refresh();
    } catch { setError("Connection failed. Please try again."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="mt-8 space-y-5">
    <div><label htmlFor="login" className="mb-2 block text-sm">Operator login</label><input id="login" name="login" autoComplete="username" required maxLength={80} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-400" /></div>
    <div><label htmlFor="password" className="mb-2 block text-sm">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-400" /></div>
    {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50">{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}
