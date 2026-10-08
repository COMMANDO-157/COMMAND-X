"use client";

import { useState, type FormEvent } from "react";
import { suggestions } from "@/lib/assistant-knowledge";

type Message = { role: "you" | "assistant"; text: string };

export function CloudAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function ask(value: string) {
    const query = value.trim();
    if (!query || pending) return;
    setMessages(history => [...history, { role: "you", text: query }]);
    setQuestion(""); setError(""); setPending(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: query }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No answer is available right now.");
      setMessages(history => [...history, { role: "assistant", text: data.answer }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Assistant unavailable."); }
    finally { setPending(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(question); }
  return <section id="assistant" aria-labelledby="assistant-title" className="dashboard-card mt-6 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="hero-kicker">READ-ONLY GUIDANCE</p><h2 id="assistant-title" className="mt-1 text-xl font-bold text-slate-900">CloudSentry Assistant</h2><p className="mt-1 text-sm text-slate-600">Ask about the app or your saved cloud evidence.</p></div><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">Contextual guided assistant · no AI model</span></div>
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4" aria-live="polite" aria-relevant="additions text">
      {messages.length === 0 ? <p className="text-sm text-slate-600">Start with a suggested question, or enter an exact resource ID to inspect its saved findings. Answers use your authorized records.</p> : <ol className="max-h-96 space-y-3 overflow-y-auto" aria-label="Assistant conversation">{messages.map((message, index) => <li key={index} className={`max-w-prose rounded-xl p-3 text-sm leading-6 whitespace-pre-line ${message.role === "you" ? "ml-auto bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-800"}`}><span className="mb-1 block text-xs font-bold uppercase tracking-wide opacity-75">{message.role === "you" ? "You" : "Guided answer"}</span>{message.text}</li>)}</ol>}
      {pending && <p role="status" className="mt-3 animate-pulse text-sm text-sky-800">Checking saved records…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} Your question remains above; try again.</p>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">{suggestions.map(prompt => <button key={prompt} type="button" onClick={() => void ask(prompt)} disabled={pending} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs font-medium text-sky-900 transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50">{prompt}</button>)}</div>
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row"><label htmlFor="assistant-question" className="sr-only">Ask CloudSentry</label><input id="assistant-question" value={question} onChange={event => setQuestion(event.target.value)} minLength={2} maxLength={500} placeholder="Ask about a resource ID, cost, or audit event" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600" /><button type="submit" disabled={pending || question.trim().length < 2} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50">Ask</button></form>
    <p className="mt-3 text-xs text-slate-500">Read-only. No approvals, cloud commands, or private credentials. Conversation stays in this page session.</p>
  </section>;
}
