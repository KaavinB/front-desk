import type { Decision } from "./matcher";
import { writeNoticeWithBedrock } from "./bedrock";

/**
 * The message the host sees: Bedrock's wording when configured, the template
 * otherwise. The template is always the fallback so the app works with no AWS
 * credentials, and the facts never come from the model.
 */
export async function composeNotice(d: Decision, officeName: string): Promise<{ text: string; writer: "bedrock" | "template" }> {
  const text = await writeNoticeWithBedrock(d, officeName);
  if (text) return { text, writer: "bedrock" };
  return { text: composeMessage(d, officeName), writer: "template" };
}

/** Deterministic template version of the notice. */
export function composeMessage(d: Decision, officeName: string): string {
  const lines = [d.headline];
  if (d.lane === "appointment" && d.candidate) {
    lines.push(`Host: ${d.candidate.host}${d.candidate.notes ? ` · ${d.candidate.notes}` : ""}`);
    if (d.alternatives.length) lines.push("Please confirm who it is on the Front Desk dashboard.");
  }
  if (d.lane === "unexpected") lines.push("Check the snapshot before letting them in.");
  if (d.lane === "after_hours") lines.push(`${officeName} is closed. Logged; nobody was paged.`);
  return lines.join("\n");
}

/** Post to a Slack Incoming Webhook. No-op when SLACK_WEBHOOK_URL is unset. */
export async function notifySlack(text: string): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.ok;
}
