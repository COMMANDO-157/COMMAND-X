import Link from "next/link";
import { LoginForm } from "./form";
export default function Login() {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
    <Link href="/" className="mb-10 text-sm text-emerald-400">← CloudSentry</Link>
    <h1 className="text-3xl font-semibold tracking-tight">Operator sign in</h1>
    <p className="mt-3 text-sm leading-6 text-slate-400">Use the operator account created during database setup. Access stays unavailable until the server and database are configured.</p>
    <LoginForm />
  </main>;
}
