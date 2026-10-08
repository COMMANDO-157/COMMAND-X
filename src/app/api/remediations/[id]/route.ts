import { z } from "zod";
import { currentOperator } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getRemediationDetail } from "@/lib/remediation-store";
export const runtime="nodejs";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){try{if(!await currentOperator())return jsonError("Authentication required.",401);const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)return jsonError("Invalid remediation identifier.",400);const detail=await getRemediationDetail(id);return detail?Response.json(detail,{headers:{"Cache-Control":"no-store"}}):jsonError("Remediation not found.",404);}catch{return jsonError("Remediation evidence is temporarily unavailable.",503);}}
