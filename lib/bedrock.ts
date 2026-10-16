import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import type { Decision } from "./matcher";

/**
 * Amazon Bedrock writes the one-line notice the host reads. It only rewrites what
 * the deterministic matcher already decided; it never decides who is at the door.
 * Enabled when BEDROCK_MODEL_ID is set and AWS credentials are available; every
 * failure path returns null so the caller falls back to the template.
 */
let client: AnthropicBedrockMantle | null = null;

export function bedrockEnabled(): boolean {
  return Boolean(process.env.BEDROCK_MODEL_ID);
}

function getClient(): AnthropicBedrockMantle {
  client ??= new AnthropicBedrockMantle({ awsRegion: process.env.AWS_REGION ?? "us-east-1" });
  return client;
}

const SYSTEM = `You write the one-line notice a small office's staff receive when someone is at the front door.
The facts come from a doorbell event already matched against the appointment calendar. Rewrite them as one warm,
plain sentence a receptionist would say, then at most one short second sentence with the useful detail (host,
first visit, needs a decision). Never guess identities beyond what the facts state; if the facts show a question
mark or alternatives, keep the uncertainty and ask the host to confirm. No emojis, no greetings, under 40 words.`;

export async function writeNoticeWithBedrock(d: Decision, officeName: string): Promise<string | null> {
  if (!bedrockEnabled()) return null;
  const facts = {
    office: officeName,
    lane: d.lane,
    headline: d.headline,
    candidate: d.candidate
      ? { visitor: d.candidate.visitor, host: d.candidate.host, start: d.candidate.start, notes: d.candidate.notes }
      : null,
    alternatives: d.alternatives.map((a) => ({ visitor: a.visitor, host: a.host })),
  };
  try {
    const res = await getClient().messages.create({
      model: process.env.BEDROCK_MODEL_ID!,
      max_tokens: 256,
      system: SYSTEM,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: `Facts:\n${JSON.stringify(facts, null, 2)}` }],
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    console.error("bedrock notice failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
