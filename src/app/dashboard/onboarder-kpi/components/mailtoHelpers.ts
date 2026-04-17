import type { OnboardingClient, OnboardingStatus } from "@/types/onboarder-kpi";

const STAGE_SUBJECTS: Record<string, string> = {
  new: "Welcome — Your Claim Has Been Assigned",
  step_2: "Follow-Up — Checking In on Your Claim",
  step_3: "Second Follow-Up — Action Needed",
  final_step: "Final Notice — Please Respond",
};

const STAGE_BODIES: Record<string, string> = {
  new: `Hi,\n\nThank you for reaching out. Your claim has been assigned and we're ready to get started.\n\nPlease review the attached contract and let us know if you have any questions.\n\nBest regards`,
  step_2: `Hi,\n\nJust checking in — we sent over your contract and wanted to make sure you received it.\n\nPlease let us know if you have any questions or need anything from us.\n\nBest regards`,
  step_3: `Hi,\n\nWe've been trying to reach you regarding your claim. We want to make sure everything is moving forward.\n\nPlease give us a call or reply to this email at your earliest convenience.\n\nBest regards`,
  final_step: `Hi,\n\nThis is our final attempt to reach you regarding your claim. If we don't hear back, we'll need to close out the onboarding.\n\nPlease reply or call us to keep your claim active.\n\nBest regards`,
};

function buildSubject(client: OnboardingClient, stage: OnboardingStatus): string {
  const base = STAGE_SUBJECTS[stage] || "Regarding Your Claim";
  const parts = [base];
  if (client.file_number) parts.push(`[${client.file_number}]`);
  return parts.join(" — ");
}

function buildCCList(client: OnboardingClient): string[] {
  const cc: string[] = [];
  if (client.contractor_email) cc.push(client.contractor_email);
  if (client.source_email) cc.push(client.source_email);
  return cc;
}

export function buildEmailMailto(client: OnboardingClient, stage: OnboardingStatus): string {
  const to = encodeURIComponent(client.email || "");
  const subject = encodeURIComponent(buildSubject(client, stage));
  const body = encodeURIComponent(STAGE_BODIES[stage] || "");
  const cc = buildCCList(client);
  const ccParam = cc.length > 0 ? `&cc=${encodeURIComponent(cc.join(","))}` : "";
  return `mailto:${to}?subject=${subject}&body=${body}${ccParam}`;
}

export function buildTextMailto(client: OnboardingClient): string {
  const to = encodeURIComponent(client.email || "");
  const subject = encodeURIComponent(
    `Quick update on your claim${client.file_number ? ` [${client.file_number}]` : ""}`
  );
  return `mailto:${to}?subject=${subject}`;
}
