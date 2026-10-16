/**
 * Creates the DynamoDB table Front Desk uses (on-demand billing, one string key).
 *
 *   npm run dynamo:setup            # uses DYNAMODB_TABLE from .env (default front-desk-visits)
 */
import "dotenv/config";
import { CreateTableCommand, DescribeTableCommand, DynamoDBClient, waitUntilTableExists } from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION ?? "us-east-1";
const TableName = process.env.DYNAMODB_TABLE || "front-desk-visits";
const client = new DynamoDBClient({ region });

async function main() {
  try {
    const existing = await client.send(new DescribeTableCommand({ TableName }));
    console.log(`Table ${TableName} already exists (${existing.Table?.TableStatus}).`);
  } catch (e) {
    if ((e as { name?: string }).name !== "ResourceNotFoundException") throw e;
    await client.send(
      new CreateTableCommand({
        TableName,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      }),
    );
    console.log(`Creating ${TableName} in ${region}…`);
    await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName });
    console.log("Ready.");
  }
  console.log(`\nSet DYNAMODB_TABLE=${TableName} in .env to use it.`);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
