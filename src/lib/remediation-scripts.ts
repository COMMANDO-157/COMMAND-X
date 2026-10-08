import { createHash } from "node:crypto";

export class RemediationError extends Error { constructor(public status:number,message:string){super(message);} }
export type RemediationTarget={provider:"aws"|"azure"|"gcp";accountScope:string;region:string;type:"compute"|"block_storage";externalId:string;rule:string;metadata:Record<string,unknown>};
const quote=(value:string)=>`'${value.replace(/'/g,"'\\''")}'`;
function validated(value:unknown,pattern:RegExp,label:string){if(typeof value!=="string" || !pattern.test(value))throw new RemediationError(409,`A valid exact ${label} is required in resource evidence before generating remediation.`);return value;}
export function generateRemediation(target:RemediationTarget,format:"bash"|"terraform") {
  if(!["idle_compute","unattached_storage","overprovisioned_compute","consumption_spike"].includes(target.rule))throw new RemediationError(409,"This finding has no supported remediation action.");
  if(target.rule==="overprovisioned_compute")throw new RemediationError(409,"Rightsizing requires an exact compatible replacement configuration and migration plan; review the finding manually. No unsafe replacement script was generated.");
  const action=target.type==="compute"?"stop_compute":"delete_unattached_storage";
  let body:string;const id=target.externalId;
  if(target.provider==="aws"){
    const account=validated(target.accountScope,/^\d{12}$/, "AWS account ID"),region=validated(target.region,/^[a-z]{2}(?:-[a-z]+)+-\d$/, "AWS region"),resource=validated(id,target.type==="compute"?/^i-[0-9a-f]{8}(?:[0-9a-f]{9})?$/:/^vol-[0-9a-f]{8}(?:[0-9a-f]{9})?$/, "AWS resource ID");
    body=`ACCOUNT=${quote(account)}\nREGION=${quote(region)}\nRESOURCE=${quote(resource)}\n[[ "$(aws sts get-caller-identity --query Account --output text)" == "$ACCOUNT" ]] || { echo 'AWS account mismatch'; exit 1; }\n`;
    if(target.type==="compute")body+=`[[ "$(aws ec2 describe-instances --region "$REGION" --instance-ids "$RESOURCE" --query 'Reservations[0].Instances[0].State.Name' --output text)" == 'running' ]] || { echo 'Expected running instance'; exit 1; }\nconfirm\naws ec2 stop-instances --region "$REGION" --instance-ids "$RESOURCE"\n`;
    else body+=`[[ "$(aws ec2 describe-volumes --region "$REGION" --volume-ids "$RESOURCE" --query 'Volumes[0].State' --output text)" == 'available' ]] || { echo 'Storage is not available/unattached'; exit 1; }\n[[ "$(aws ec2 describe-volumes --region "$REGION" --volume-ids "$RESOURCE" --query 'length(Volumes[0].Attachments)' --output text)" == '0' ]] || { echo 'Attached storage cannot be deleted'; exit 1; }\nconfirm\naws ec2 delete-volume --region "$REGION" --volume-id "$RESOURCE"\n`;
  } else if(target.provider==="azure"){
    const subscription=validated(target.accountScope,/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/, "Azure subscription ID");
    const region=validated(target.region,/^[a-z0-9]+$/, "Azure region");
    const expectedType=target.type==="compute"?"virtualMachines":"disks";
    const resource=validated(id,new RegExp(`^/subscriptions/${subscription}/resourceGroups/[A-Za-z0-9_.()-]+/providers/Microsoft\\.Compute/${expectedType}/[A-Za-z0-9_.-]+$`,"i"), "full Azure resource ID");
    body=`SUBSCRIPTION=${quote(subscription)}\nREGION=${quote(region)}\nRESOURCE=${quote(resource)}\n[[ "$(az account show --query id -o tsv)" == "$SUBSCRIPTION" ]] || { echo 'Azure subscription mismatch'; exit 1; }\n[[ "$(az resource show --ids "$RESOURCE" --query location -o tsv)" == "$REGION" ]] || { echo 'Azure region mismatch'; exit 1; }\n`;
    if(target.type==="compute")body+=`az vm show --ids "$RESOURCE" >/dev/null\nconfirm\naz vm deallocate --ids "$RESOURCE"\n`;
    else body+=`[[ "$(az disk show --ids "$RESOURCE" --query diskState -o tsv)" == 'Unattached' ]] || { echo 'Disk must be unattached'; exit 1; }\n[[ -z "$(az disk show --ids "$RESOURCE" --query managedBy -o tsv)" ]] || { echo 'Disk attachment found'; exit 1; }\n[[ "$(az disk show --ids "$RESOURCE" --query 'length(managedByExtended || \`[]\`)' -o tsv)" == '0' ]] || { echo 'Shared disk attachment found'; exit 1; }\nconfirm\naz disk delete --ids "$RESOURCE" --yes\n`;
  }else{
    const project=validated(target.accountScope,/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/, "GCP project ID"),region=validated(target.region,/^[a-z]+-[a-z]+\d$/, "GCP region");
    const zone=validated(target.metadata.zone,new RegExp(`^${region}-[a-z]$`), "GCP zone");
    const kind=target.type==="compute"?"instances":"disks";
    const match=new RegExp(`^(?:https://www\\.googleapis\\.com/compute/v1/)?projects/${project}/zones/${zone}/${kind}/([a-z][a-z0-9-]{0,61}[a-z0-9])$`).exec(id);
    if(!match)throw new RemediationError(409,"GCP resource ID must include the exact project, zone, resource type and name; short/numeric IDs require a complete canonical identifier.");
    const name=match[1];body=`PROJECT=${quote(project)}\nZONE=${quote(zone)}\nREGION=${quote(region)}\nRESOURCE=${quote(id)}\nNAME=${quote(name)}\n[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT" ]] || { echo 'GCP project mismatch'; exit 1; }\ngcloud compute ${kind} describe "$NAME" --project "$PROJECT" --zone "$ZONE" >/dev/null\n`;
    if(target.type==="compute")body+=`[[ "$(gcloud compute instances describe "$NAME" --project "$PROJECT" --zone "$ZONE" --format='value(status)')" == 'RUNNING' ]] || { echo 'Expected running instance'; exit 1; }\nconfirm\ngcloud compute instances stop "$NAME" --project "$PROJECT" --zone "$ZONE"\n`;
    else body+=`[[ -z "$(gcloud compute disks describe "$NAME" --project "$PROJECT" --zone "$ZONE" --format='value(users)')" ]] || { echo 'Attached disk cannot be deleted'; exit 1; }\nconfirm\ngcloud compute disks delete "$NAME" --project "$PROJECT" --zone "$ZONE" --quiet\n`;
  }
  let scriptText:string;let originalConfiguration:Record<string,unknown>|null=null;
  if(format==="terraform"){
    const address=validated(target.metadata.terraform_address,/^(?:module\.[A-Za-z_][A-Za-z0-9_]*\.)*[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\])?$/, "existing Terraform resource address");
    const config=target.metadata.original_configuration;if(!config||typeof config!=="object"||Array.isArray(config)||!Object.keys(config).length)throw new RemediationError(409,"Terraform requires the supplied original configuration and existing resource address. No invented Terraform resource will be generated.");
    originalConfiguration=config as Record<string,unknown>;
    // A review plan is deliberately non-applying. It never destroys state or invents provider configuration.
    scriptText=`# CloudSentry Terraform REVIEW ONLY — application runs simulation only\n# Exact provider/account/region/resource: ${JSON.stringify([target.provider,target.accountScope,target.region,target.externalId])}\n# Existing address: ${address}\n# Recommended action: ${action}; stopping compute is provider-specific and requires an operator-reviewed configuration change.\n# Original configuration evidence (JSON):\n${JSON.stringify(config,null,2).split("\n").map(line=>`# ${line}`).join("\n")}\n# In the authenticated, original Terraform workspace, inspect the exact address:\n# terraform state show ${quote(address)}\n# Review the proposed change separately. This artifact contains no apply/destroy command.\n`;
  }else{
    const warning=target.type==="block_storage"?"IRREVERSIBLE storage deletion: back up data and verify retention requirements first.":"Stopping compute interrupts workloads; validate dependencies and obtain maintenance approval first.";
    scriptText=`#!/usr/bin/env bash\n# CloudSentry MANUAL REVIEW artifact — generated approval does not execute this file.\n# The application only simulates; running this downloaded file yourself changes real cloud resources.\n# ${warning}\nset -euo pipefail\nconfirm() {\n  local answer\n  printf 'Type the exact resource ID to confirm the real cloud action: '\n  read -r answer\n  [[ "$answer" == "$RESOURCE" ]] || { echo 'Confirmation did not match'; exit 1; }\n}\n${body}`;
  }
  return {action,format,scriptText,scriptHash:createHash("sha256").update(scriptText).digest("hex"),originalConfiguration};
}
export function assertDecisionTransition(status:string,storedHash:string,submittedHash:string,decision:"approve"|"reject"){if(storedHash!==submittedHash)throw new RemediationError(409,"Script changed or its hash does not match the reviewed artifact.");if(status!=="pending_approval")throw new RemediationError(409,"This remediation already has a decision. Generate a new proposal to review again.");return decision==="approve"?"approved":"rejected";}
export function assertSimulationTransition(status:string,storedHash:string,submittedHash:string,approvedHash:string|null){if(status!=="approved"||storedHash!==submittedHash||approvedHash!==storedHash)throw new RemediationError(409,"Simulation requires an approved decision for this exact script hash.");return "simulated_succeeded" as const;}
