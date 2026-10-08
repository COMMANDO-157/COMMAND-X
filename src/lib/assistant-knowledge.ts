export const suggestions = [
  "What does CloudSentry do?",
  "What are the four detection rules?",
  "How is projected cost calculated?",
  "Summarize my saved data",
  "Why was resource i-0123456789abcdef0 flagged?",
  "Show recent audit activity",
];

export function resourceIdIn(question: string) {
  const explicit = question.match(/(?:resource\s+id|resource|id)\s*[:#]?\s+([A-Za-z0-9][A-Za-z0-9._:/-]{2,127})/i)?.[1];
  const cloudId = question.match(/\b(?:i-|vol-|disk-|vm-)[A-Za-z0-9._-]{5,120}\b/i)?.[0];
  return cloudId ?? (explicit && /[-_:/\d]/.test(explicit) ? explicit : null);
}

export function knowledgeAnswer(question: string): string | null {
  const q = question.toLowerCase();
  if (/aws compute optimizer|azure advisor|google cloud|other tool|different|compare/.test(q)) return "AWS Compute Optimizer, Azure Advisor, and Google Cloud Recommender use their own provider telemetry to offer optimization recommendations. CloudSentry instead analyzes CSV/JSON observations that you upload across AWS, Azure, and Google Cloud, stores explainable findings, and keeps a human-approved simulation audit trail. It does not claim live cloud access or replace provider-native recommendations. See each provider's current documentation for their supported services.";
  if (/four|rule|detect|anomal/.test(q)) return "CloudSentry has four rules: idle compute (running VM with low CPU and memory over sufficient coverage), unattached storage (no attachments over sufficient coverage), overprovisioned compute (low utilization with an eligible replacement rate for a priced estimate), and a consumption spike (latest hourly USD cost more than 3× the preceding contiguous-hour median and at least $1/hour higher). Findings store their thresholds and evidence; overlapping waste estimates are not double-counted.";
  if (/workflow|eight|steps|how cloudsentry works/.test(q)) return "Eight steps: Upload CSV/JSON → Analyze and validate observations → Detect anomalies → Calculate 30-day estimates → Generate an exact-target Bash script (or Terraform when enough configuration exists) → Approve or reject the immutable script → Simulate the approved remediation → Audit the persisted decision and state changes. No cloud command is executed.";
  if (/waste|pay.as.you.go|idle vm|storage charge/.test(q)) return "Pay-as-you-go means charges track allocated or consumed resources, not necessarily useful work. A running idle VM can continue to incur compute charges, while allocated storage can remain billable even without an attachment. CloudSentry estimates potential waste from uploaded evidence; it cannot prove a provider bill changed.";
  if (/project|cost|saving|leakage|spend|money|1,?296/.test(q) && !/my|saved|total|current|resource|import/.test(q)) return "A 30-day projection uses 720 hours. Idle compute/storage uses the observed or supplied rate × 720; overprovisioning uses an eligible replacement-rate difference × 720. Spike potential excess uses (latest hourly cost − baseline median hourly cost) × 720. Spike potential excess is separate from rule-supported avoidable-waste estimates. Neither is actual savings; a simulation does not change billing. Ask about a resource ID for its stored values.";
  if (/remedi|script|approv|reject|simulat|audit/.test(q) && !/my|saved|recent|resource/.test(q)) return "Generated scripts include exact provider, account, region, and resource targets. A human reviews and approves or rejects the immutable script hash. Only an approved script can be simulated. The simulation records state and audit events in PostgreSQL; CloudSentry never runs deletion or Terraform apply commands. Terraform output is offered only when the uploaded configuration supports an exact existing target.";
  if (/what.*cloudsentry|what.*do|help|capabilit/.test(q)) return "CloudSentry is a multi-cloud cost investigation workspace. It validates uploaded CSV/JSON utilization logs, identifies resource IDs and explainable anomalies, estimates 30-day waste or spike excess, and supports human-reviewed, simulated remediation with a persistent audit trail. It reads uploaded evidence, not live cloud accounts.";
  return null;
}
