import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOperator } from "@/lib/auth";
import { profileFor } from "@/lib/profile";
import { PasswordForm } from "./password-form";

export default async function Profile() {
  const operator = await currentOperator();
  if (!operator) redirect("/login");
  const profile = await profileFor(operator);
  if (!profile) redirect("/login");
  const friendly = (action: string) => action === "operator.login" ? "Signed in" : action === "operator.logout" ? "Signed out" : action === "operator.password_changed" ? "Password changed" : action.replace("operator.", "").replaceAll("_", " ");
  return <main className="console-shell mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-6">
    <nav aria-label="Profile navigation" className="console-nav flex flex-wrap gap-2"><Link href="/console">← Dashboard</Link><Link href="/profile" aria-current="page">Profile</Link></nav>
    <header className="mt-7"><p className="hero-kicker">OPERATOR ACCOUNT</p><h1 className="mt-2 text-3xl font-bold">Your profile</h1><p className="mt-2 text-slate-600">Your account details and recent sign-in activity.</p></header>
    <section className="dashboard-card mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-semibold">Account details</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-slate-600">Login ID</dt><dd className="font-semibold">{profile.account.login}</dd></div><div><dt className="text-sm text-slate-600">Account created (UTC)</dt><dd className="font-semibold">{profile.account.createdAt.toISOString()}</dd></div></dl><p className="mt-4 text-sm text-slate-600">This account does not have an email or editable display name on file.</p></section>
    <section className="dashboard-card mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-semibold">Change password</h2><PasswordForm /></section>
    <section className="dashboard-card mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-semibold">Recent account activity</h2>{profile.activity.length === 0 ? <p className="mt-4 text-slate-600">No account activity recorded yet.</p> : <ol className="mt-4 space-y-3">{profile.activity.map(event => <li key={event.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3"><span className="font-medium">{friendly(event.action)}</span><time dateTime={event.createdAt.toISOString()} className="text-sm text-slate-600">{event.createdAt.toISOString()}</time></li>)}</ol>}</section>
  </main>;
}
