"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { suggestions } from "@/lib/assistant-knowledge";
import { chooseEnglishVoice, recognitionErrorMessage } from "@/lib/speech";

type Message = { role: "you" | "assistant"; text: string };
type Recognition = {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function CloudAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [voiceHint, setVoiceHint] = useState("");
  const [speechInput, setSpeechInput] = useState(false);
  const [speechOutput, setSpeechOutput] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  const [locale, setLocale] = useState<"en-IN" | "en-US">("en-IN");
  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const speech = useRef<SpeechSynthesis | null>(null);
  const autoReadRef = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    const browser = window as VoiceWindow;
    setSpeechInput(Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    setSpeechOutput(Boolean(browser.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined"));
    speech.current = browser.speechSynthesis ?? null;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      recognition.current?.abort(); recognition.current = null;
      if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; }
      speech.current?.cancel();
    };
  }, []);

  function stopSpeaking() {
    if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; }
    speech.current?.cancel(); utterance.current = null; setSpeaking(false);
  }
  function speak(answer: string) {
    stopSpeaking();
    if (mutedRef.current || !speech.current || typeof SpeechSynthesisUtterance === "undefined") return;
    const output = new SpeechSynthesisUtterance(answer);
    output.lang = locale; output.rate = 1; output.pitch = 1;
    const installed = chooseEnglishVoice(speech.current.getVoices(), locale);
    if (installed) output.voice = installed;
    output.onstart = () => setSpeaking(true);
    output.onend = () => { utterance.current = null; setSpeaking(false); };
    output.onerror = () => { utterance.current = null; setSpeaking(false); setVoiceError("Your browser could not play this answer. The text remains available."); };
    utterance.current = output;
    try { speech.current.speak(output); }
    catch { utterance.current = null; setVoiceError("Your browser could not play this answer. The text remains available."); }
  }
  function stopListening() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    recognition.current?.stop(); recognition.current = null; setListening(false);
  }
  function startListening() {
    const browser = window as VoiceWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) { setVoiceError("Speech input is unavailable in this browser. Type your question instead."); return; }
    stopSpeaking(); stopListening(); setVoiceError(""); setVoiceHint("Requesting microphone access…");
    try {
      const input = new Constructor();
      recognition.current = input; input.lang = locale; input.interimResults = false; input.maxAlternatives = 1;
      let recognized = false; let failed = false;
      input.onresult = event => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) { recognized = true; setQuestion(transcript.slice(0, 500)); setVoiceHint("Recognized text is ready. Edit it, then choose Ask."); }
      };
      input.onerror = event => { failed = true; setVoiceError(recognitionErrorMessage(event.error)); setVoiceHint(""); };
      input.onend = () => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        if (recognition.current === input) recognition.current = null;
        setListening(false);
        if (!recognized && !failed) setVoiceHint("No speech was recognized. Try again or type your question.");
      };
      input.start(); setListening(true); setVoiceHint("Listening in English… speak now.");
      timer.current = setTimeout(() => {
        if (recognition.current === input) { setVoiceError("Listening timed out. Try again or type your question."); input.stop(); }
      }, 15000);
    } catch { recognition.current = null; setListening(false); setVoiceError("Microphone could not start. Check browser permission or type your question."); }
  }
  async function ask(value: string) {
    const query = value.trim();
    if (!query || pending) return;
    stopSpeaking(); stopListening();
    setMessages(history => [...history, { role: "you", text: query }]);
    setQuestion(""); setError(""); setPending(true);
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: query }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No answer is available right now.");
      setMessages(history => [...history, { role: "assistant", text: data.answer }]);
      if (autoReadRef.current && !mutedRef.current) speak(data.answer);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Assistant unavailable."); }
    finally { setPending(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(question); }
  return <section id="assistant" aria-labelledby="assistant-title" className="dashboard-card mt-6 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="hero-kicker">READ-ONLY GUIDANCE</p><h2 id="assistant-title" className="mt-1 text-xl font-bold text-slate-900">CloudSentry Assistant</h2><p className="mt-1 text-sm text-slate-600">Ask about the app or your saved cloud evidence.</p></div><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">Contextual guided assistant · no AI model</span></div>
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4" aria-live="polite" aria-relevant="additions text">
      {messages.length === 0 ? <p className="text-sm text-slate-600">Start with a suggested question, or enter an exact resource ID to inspect its saved findings. Answers use your authorized records.</p> : <ol className="max-h-96 space-y-3 overflow-y-auto" aria-label="Assistant conversation">{messages.map((message, index) => <li key={index} className={`max-w-prose rounded-xl p-3 text-sm leading-6 whitespace-pre-line ${message.role === "you" ? "ml-auto bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-800"}`}><span className="mb-1 block text-xs font-bold uppercase tracking-wide opacity-75">{message.role === "you" ? "You" : "Guided answer"}</span>{message.text}{message.role === "assistant" && speechOutput && <button type="button" onClick={() => speak(message.text)} disabled={muted} className="mt-2 block rounded-lg border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50" aria-label={`Speak assistant answer ${Math.ceil((index + 1) / 2)}`}>🔊 Speak</button>}</li>)}</ol>}
      {pending && <p role="status" className="mt-3 animate-pulse text-sm text-sky-800">Checking saved records…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} Your question remains above; try again.</p>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">{suggestions.map(prompt => <button key={prompt} type="button" onClick={() => void ask(prompt)} disabled={pending} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs font-medium text-sky-900 transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50">{prompt}</button>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Voice controls"><label htmlFor="assistant-locale" className="text-sm text-slate-700">English voice</label><select id="assistant-locale" value={locale} onChange={event => setLocale(event.target.value as "en-IN" | "en-US")} className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900"><option value="en-IN">English (India)</option><option value="en-US">English (US)</option></select><button type="button" onClick={listening ? stopListening : startListening} disabled={!speechInput || pending} aria-pressed={listening} className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-50">{listening ? "■ Stop listening" : "🎙 Speak question"}</button><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={autoRead} disabled={!speechOutput} onChange={event => { setAutoRead(event.target.checked); autoReadRef.current = event.target.checked; }} />Read answers aloud</label><button type="button" onClick={() => { const next = !muted; setMuted(next); mutedRef.current = next; if (next) stopSpeaking(); }} disabled={!speechOutput} aria-pressed={muted} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-50">{muted ? "Unmute" : "Mute"}</button><button type="button" onClick={stopSpeaking} disabled={!speaking} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-50">Stop speaking</button></div>
    {voiceHint && <p role="status" className={`mt-2 text-sm text-sky-800 ${listening ? "animate-pulse" : ""}`}>{voiceHint}</p>}
    {voiceError && <p role="alert" className="mt-2 text-sm text-red-700">{voiceError}</p>}
    {!speechInput && <p className="mt-2 text-xs text-slate-600">Microphone transcription is unavailable in this browser; text questions still work.</p>}
    {!speechOutput && <p className="mt-2 text-xs text-slate-600">Spoken playback is unavailable in this browser; answers remain readable.</p>}
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row"><label htmlFor="assistant-question" className="sr-only">Ask CloudSentry</label><input id="assistant-question" value={question} onChange={event => setQuestion(event.target.value)} minLength={2} maxLength={500} placeholder="Ask about a resource ID, cost, or audit event" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600" /><button type="submit" disabled={pending || listening || question.trim().length < 2} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50">Ask</button></form>
    <p className="mt-3 text-xs text-slate-500">Your browser handles microphone audio; CloudSentry does not receive or store it. Read-only answers use the existing authorized assistant. Conversation stays in this page session.</p>
  </section>;
}
