import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 5000;
const identifier = z.string().trim().min(1).max(256).refine(v => ![...v].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127), "Control characters are forbidden");
const money = z.union([z.string(), z.number()]).transform(String).refine(v => /^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/.test(v), "Use nonnegative decimal prices with at most 8 decimal places");
const numericInput = (v: unknown) => typeof v === "string" ? /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v) ? Number(v) : NaN : v;
const nullableNumber = (max: number) => z.preprocess(v => v === "" || v === undefined ? null : numericInput(v), z.number().finite().min(0).max(max).nullable());
const optionalMoney = z.preprocess(v => v === "" || v === undefined ? null : v, money.nullable());
function safeConfiguration(value:unknown,depth=0):boolean {if(depth>8)return false;if(value===null||typeof value==="string"||typeof value==="boolean")return true;if(typeof value==="number")return Number.isFinite(value);if(Array.isArray(value))return value.every(v=>safeConfiguration(v,depth+1));if(typeof value==="object")return Object.entries(value).every(([key,v])=>!["__proto__","constructor","prototype"].includes(key)&&safeConfiguration(v,depth+1));return false;}
const metadataSchema = z.object({eligible_replacement_rate: money.optional(), pricing_source: identifier.optional(), replacement_pricing_source: identifier.optional(), storage_gib: z.number().finite().positive().max(1000000).refine(v => Math.abs(v*1000000-Math.round(v*1000000))<0.000001,"Use at most six decimal places for GiB").optional(), monthly_rate_per_gib: money.optional(), demo: z.boolean().optional(),terraform_address:identifier.optional(),resource_name:identifier.optional(),zone:identifier.optional(),project_id:identifier.optional(),subscription_id:identifier.optional(),original_configuration:z.record(z.string(),z.unknown()).refine(v=>safeConfiguration(v)&&JSON.stringify(v).length<=16384,"Configuration must be safe JSON up to depth 8 and 16 KiB").optional()}).strict();
const schema = z.object({
  provider: z.enum(["aws", "azure", "gcp"]), account_id: identifier, region: identifier, resource_id: identifier,
  resource_type: z.enum(["compute", "block_storage"]),
  timestamp: z.string().datetime({offset: true}).transform(v => new Date(v).toISOString()),
  interval_hours: z.preprocess(numericInput,z.number().finite().min(1/3600).max(168).refine(v => Math.abs(v*3600-Math.round(v*3600))<0.000000001, "Interval must represent a positive whole number of seconds")),
  cpu_percent: nullableNumber(100), memory_percent: nullableNumber(100),
  state: z.preprocess(v => v === "" || v === undefined ? null : v, z.enum(["running", "stopped", "unattached", "attached"]).nullable()),
  attachment_count: nullableNumber(1000000).refine(v => v === null || Number.isInteger(v), "Attachment count must be an integer"),
  hourly_rate: optionalMoney, interval_cost: optionalMoney, currency: z.string().regex(/^[A-Z]{3}$/),
  metadata: metadataSchema.optional().default({}),
}).strict();
export type Observation = z.infer<typeof schema> & {raw: Record<string, unknown>};
export function resourceIdentity(row: Pick<Observation,"provider"|"account_id"|"region"|"resource_id">) { return JSON.stringify([row.provider,row.account_id,row.region,row.resource_id]); }
export function decimalUnits(value: string): bigint { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * BigInt(100000000) + BigInt(fraction.padEnd(8,"0")); }
export function decimalString(value: bigint): string { const scale = BigInt(100000000); return `${value / scale}.${(value % scale).toString().padStart(8,"0")}`; }
// Strict CSV state machine supports RFC 4180 escaped quotes and embedded newlines.
export function parseCsv(text: string): Record<string,unknown>[] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
  const fieldEnd = () => { row.push(field); field = ""; closed = false; };
  const rowEnd = () => { fieldEnd(); if (row.some(v => v !== "")) rows.push(row); row = []; };
  text = text.replace(/^\uFEFF/, "");
  for (let i=0; i<text.length; i++) { const c=text[i];
    if (quoted) { if(c === '"') { if(text[i+1] === '"') {field+='"';i++;} else {quoted=false;closed=true;} } else field+=c; continue; }
    if(c === '"') {if(field || closed) throw new Error("Malformed CSV quotation");quoted=true;}
    else if(c === ',') fieldEnd();
    else if(c === '\n' || c === '\r') {rowEnd();if(c === '\r' && text[i+1] === '\n') i++;}
    else {if(closed) throw new Error("Unexpected text after CSV closing quote");field+=c;}
  }
  if(quoted) throw new Error("Unterminated CSV quoted field"); if(field || row.length || closed) rowEnd();
  const headers=rows.shift(); if(!headers || !headers.length) throw new Error("CSV headers are required");
  if(new Set(headers).size !== headers.length || headers.some(h => !h)) throw new Error("CSV headers must be unique and nonempty");
  return rows.map((cells,index) => {if(cells.length !== headers.length) throw new Error(`CSV row ${index+2} has an incorrect field count`);return Object.fromEntries(headers.map((h,i) => [h,h === "metadata" ? cells[i] ? JSON.parse(cells[i]) : {} : cells[i]]));});
}
export function parseUpload(text: string, format: "csv"|"json") {
  if(Buffer.byteLength(text,"utf8") > MAX_UPLOAD_BYTES) throw new Error("Upload exceeds 2 MiB");
  let input: unknown = format === "csv" ? parseCsv(text) : JSON.parse(text.replace(/^\uFEFF/, ""));
  let wrapperDemo=false;
  if(!Array.isArray(input) && input && typeof input === "object") {const wrapper=z.object({observations:z.array(z.unknown()),demo:z.boolean().optional()}).strict().parse(input);input=wrapper.observations;wrapperDemo=wrapper.demo ?? false;}
  if(!Array.isArray(input) || input.length === 0 || input.length > MAX_ROWS) throw new Error("Provide between 1 and 5000 observations");
  const observations: Observation[]=input.map((raw,index) => {const result=schema.safeParse(raw);if(!result.success) throw new Error(`Observation ${index+1}: ${result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);return {...result.data,raw:raw as Record<string,unknown>};});
  const identities = new Map<string, Observation[]>();
  for(const observation of observations) {const key=resourceIdentity(observation);const group=identities.get(key) ?? [];if(group.some(v => v.resource_type !== observation.resource_type)) throw new Error("A resource identity cannot have conflicting resource types");group.push(observation);identities.set(key,group);}
  for(const group of identities.values()) {group.sort((a,b) => Date.parse(a.timestamp)-Date.parse(b.timestamp));for(let i=1;i<group.length;i++) if(Date.parse(group[i].timestamp)<Date.parse(group[i-1].timestamp)+group[i-1].interval_hours*3600000) throw new Error("Duplicate or overlapping observation intervals for a resource");}
  const canonical=observations.map(row => ({provider:row.provider,account_id:row.account_id,region:row.region,resource_id:row.resource_id,resource_type:row.resource_type,timestamp:row.timestamp,interval_hours:row.interval_hours,cpu_percent:row.cpu_percent,memory_percent:row.memory_percent,state:row.state,attachment_count:row.attachment_count,currency:row.currency,hourly_rate:row.hourly_rate === null ? null : decimalString(decimalUnits(row.hourly_rate)), interval_cost:row.interval_cost === null ? null : decimalString(decimalUnits(row.interval_cost)),metadata:Object.fromEntries(Object.entries(row.metadata).sort(([a],[b])=>a.localeCompare(b)))})).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {observations,contentHash:createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),isDemo:wrapperDemo || observations.every(r => r.metadata.demo === true)};
}
