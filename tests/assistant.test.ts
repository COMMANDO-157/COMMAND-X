import test from "node:test";
import assert from "node:assert/strict";
import { knowledgeAnswer, resourceIdIn, suggestions } from "../src/lib/assistant-knowledge";

test("assistant recognizes exact resource IDs without guessing unrelated questions", () => {
  assert.equal(resourceIdIn("Why was resource i-0123456789abcdef0 flagged?"), "i-0123456789abcdef0");
  assert.equal(resourceIdIn("Show resource vol-0a1b2c3d4e5f"), "vol-0a1b2c3d4e5f");
  assert.equal(resourceIdIn("What does CloudSentry do?"), null);
});

test("guided answers distinguish estimates from actual savings and forbid execution claims", () => {
  assert.match(knowledgeAnswer("How is projected cost calculated?") ?? "", /720 hours/);
  assert.match(knowledgeAnswer("How do approval and simulation work?") ?? "", /never runs deletion/);
  assert.match(knowledgeAnswer("What are the four detection rules?") ?? "", /consumption spike/);
  assert.equal(knowledgeAnswer("unrelated astrophysics question"), null);
  assert.ok(suggestions.some(question => question.includes("resource")));
});
