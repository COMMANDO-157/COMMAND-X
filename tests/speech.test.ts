import test from "node:test";
import assert from "node:assert/strict";
import { chooseEnglishVoice, recognitionErrorMessage } from "../src/lib/speech";

test("speech failures provide a text fallback without masking permission denial", () => {
  assert.match(recognitionErrorMessage("not-allowed"), /permission was denied/i);
  assert.match(recognitionErrorMessage("no-speech"), /No speech was detected/);
  assert.match(recognitionErrorMessage("network"), /Type your question instead/);
});

test("spoken answers choose an installed English voice when available", () => {
  const voices = [
    { lang: "fr-FR", name: "Français", localService: true },
    { lang: "en-US", name: "US Basic", localService: false },
    { lang: "en-IN", name: "India Natural", localService: true },
  ];
  assert.equal(chooseEnglishVoice(voices, "en-IN")?.name, "India Natural");
  assert.equal(chooseEnglishVoice([{ lang: "fr-FR", name: "French" }], "en-US"), null);
});
