import { z } from "zod";
import { currentOperator } from "@/lib/auth";
import { boundedJson, checkOrigin, jsonError } from "@/lib/http";
import { answerAssistant } from "@/lib/assistant-store";

export const runtime = "nodejs";
const input = z.object({ question: z.string().trim().min(2).max(500) }).strict();
export async function POST(request: Request) {
  if (!checkOrigin(request)) return jsonError("Request origin denied.", 403);
  let body;
  try { body = input.parse(await boundedJson(request, 1024)); }
  catch { return jsonError("Enter a question of 2–500 characters.", 400); }
  try {
    const operator = await currentOperator();
    if (!operator) return jsonError("Authentication required.", 401);
    const answer = await answerAssistant(body.question, operator.id);
    return Response.json({ answer, mode: "guided" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Assistant records are temporarily unavailable.", 503); }
}
