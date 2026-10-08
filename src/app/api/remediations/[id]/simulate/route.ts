import { z } from "zod";
import { currentOperator } from "@/lib/auth";
import { boundedJson, checkOrigin, jsonError } from "@/lib/http";
import { simulateRemediation } from "@/lib/remediation-store";
import { RemediationError } from "@/lib/remediation-scripts";
export const runtime="nodejs";
const bodySchema=z.object({scriptHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const operator=await currentOperator();if(!operator)return jsonError("Authentication required.",401);if(!checkOrigin(request))return jsonError("Request origin denied.",403);const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)return jsonError("Invalid remediation identifier.",400);let body;try{body=bodySchema.parse(await boundedJson(request));}catch{return jsonError("Provide the exact reviewed scriptHash.",400);}return Response.json({remediation:await simulateRemediation(id,body.scriptHash,operator.id)},{headers:{"Cache-Control":"no-store"}});}catch(error){return error instanceof RemediationError?jsonError(error.message,error.status):jsonError("Simulation could not be committed. No cloud command ran and no partial records were saved.",503);}}
