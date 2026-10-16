/**
 * Finds a Bedrock model ID that answers, using the same client the app uses.
 *
 *   npm run bedrock:probe                      # tries common IDs for the configured model
 *   npm run bedrock:probe -- us.anthropic.claude-haiku-5-5   # try one ID
 */
import "dotenv/config";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";

const client = new AnthropicBedrockMantle({ awsRegion: process.env.AWS_REGION ?? "us-east-1" });
const base = (process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-haiku-5-5").replace(/^(us|global|eu|apac)\./, "");
const candidates = process.argv[2] ? [process.argv[2]] : [base, `us.${base}`, `global.${base}`];

async function main() {
  for (const model of candidates) {
    const t0 = Date.now();
    try {
      const res = await client.messages.create({
        model,
        max_tokens: 64,
        messages: [{ role: "user", content: "Reply with the single word: ready" }],
      });
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      console.log(`OK    ${model}  (${Date.now() - t0} ms)  → "${text}"  in=${res.usage.input_tokens} out=${res.usage.output_tokens}`);
      console.log(`\nSet BEDROCK_MODEL_ID=${model}`);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`FAIL  ${model}  ${msg.slice(0, 160)}`);
    }
  }
  process.exit(1);
}

main();
