import { z } from "zod";
import { currentOperator } from "@/lib/auth";
import { boundedJson, checkOrigin, jsonError } from "@/lib/http";
import { createRemediation, listRemediations } from "@/lib/remediation-store";
import { RemediationError } from "@/lib/remediation-scripts";
export const runtime="nodejs";
const bodySchema=z.object({findingId:z.string().uuid(),format:z.enum(["bash","terraform"])}).strict();
export async function POST(request:Request){try{const operator=await currentOperator();if(!operator)return jsonError("Authentication required.",401);if(!checkOrigin(request))return jsonError("Request origin denied.",403);let body;try{body=bodySchema.parse(await boundedJson(request));}catch{return jsonError("Provide a valid findingId and bash or terraform format.",400);}return Response.json({remediation:await createRemediation(body.findingId,body.format,operator.id)},{status:201,headers:{"Cache-Control":"no-store"}});}catch(error){return error instanceof RemediationError?jsonError(error.message,error.status):jsonError("Remediation could not be saved. No partial records were committed.",503);}}
export async function GET(request:Request){try{if(!await currentOperator())return jsonError("Authentication required.",401);const findingId=new URL(request.url).searchParams.get("findingId");if(!z.string().uuid().safeParse(findingId).success)return jsonError("Provide a valid findingId.",400);return Response.json({remediations:await listRemediations(findingId!)},{headers:{"Cache-Control":"no-store"}});}catch{return jsonError("Remediation history is temporarily unavailable.",503);}}
