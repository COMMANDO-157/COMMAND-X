"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SignOut() {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) { setError("Sign out failed. Please retry."); return; }
      router.replace("/login"); router.refresh();
    } catch { setError("Connection failed."); } finally { setPending(false); }
  }
  return <div><button disabled={pending} onClick={logout} className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">{pending ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}</div>;
}
