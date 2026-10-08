export function recognitionErrorMessage(code: string) {
  switch (code) {
    case "not-allowed": case "service-not-allowed": return "Microphone permission was denied. Allow microphone access in your browser, or type your question.";
    case "audio-capture": return "No microphone was available. Check your audio device, or type your question.";
    case "no-speech": return "No speech was detected. Try again or type your question.";
    case "network": return "Your browser's speech recognition service is unavailable. Type your question instead.";
    case "aborted": return "Listening stopped. You can still type your question.";
    default: return "Speech recognition stopped unexpectedly. Type your question or try again.";
  }
}

type EnglishVoice = { lang: string; name: string; localService?: boolean };
export function chooseEnglishVoice<T extends EnglishVoice>(voices: T[], locale: "en-IN" | "en-US") {
  const english = voices.filter(voice => /^en(?:-|$)/i.test(voice.lang));
  const score = (voice: T) =>
    (voice.lang.toLowerCase() === locale.toLowerCase() ? 4 : 0) +
    (voice.localService ? 2 : 0) +
    (/natural|neural|enhanced|premium/i.test(voice.name) ? 1 : 0);
  return english.sort((a, b) => score(b) - score(a))[0] ?? null;
}
