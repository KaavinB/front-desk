import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  BatchWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { LogEntry, Store } from "./types";

/**
 * Amazon DynamoDB backend. One table, on-demand billing, string partition key `pk`.
 *
 *   evt#<id>         → the visitor-log entry
 *   req#<requestId>  → a marker that makes webhook redelivery idempotent
 *
 * Both writes are conditional (`attribute_not_exists`), so two concurrent
 * deliveries of the same Ring event can never produce two cards. The table is
 * created by `npm run dynamo:setup`.
 */
export function dynamoStore(tableName: string, region = process.env.AWS_REGION ?? "us-east-1"): Store {
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const evtKey = (id: string) => `evt#${id}`;
  const reqKey = (requestId: string) => `req#${requestId}`;

  async function get(id: string): Promise<LogEntry | null> {
    const res = await doc.send(new GetCommand({ TableName: tableName, Key: { pk: evtKey(id) } }));
    return (res.Item?.entry as LogEntry | undefined) ?? null;
  }

  async function conditionalPut(item: Record<string, unknown>): Promise<boolean> {
    try {
      await doc.send(
        new PutCommand({ TableName: tableName, Item: item, ConditionExpression: "attribute_not_exists(pk)" }),
      );
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === "ConditionalCheckFailedException") return false;
      throw e;
    }
  }

  return {
    async listEntries() {
      const out: LogEntry[] = [];
      let ExclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const res = await doc.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: "begins_with(pk, :p)",
            ExpressionAttributeValues: { ":p": "evt#" },
            ExclusiveStartKey,
          }),
        );
        for (const item of res.Items ?? []) out.push(item.entry as LogEntry);
        ExclusiveStartKey = res.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return out.sort((a, b) => b.eventAt.localeCompare(a.eventAt));
    },

    async hasRequestId(requestId) {
      const res = await doc.send(new GetCommand({ TableName: tableName, Key: { pk: reqKey(requestId) } }));
      return Boolean(res.Item);
    },

    async appendEntry(entry) {
      const fresh = await conditionalPut({ pk: reqKey(entry.requestId), entryId: entry.id, at: entry.receivedAt });
      if (!fresh) return false;
      await conditionalPut({ pk: evtKey(entry.id), eventAt: entry.eventAt, entry });
      return true;
    },

    // Set only the patched fields, server-side, so concurrent background tasks
    // (snapshot, notice, greeting) can't overwrite each other's results.
    async updateEntry(id, patch) {
      const keys = Object.keys(patch).filter((k) => patch[k as keyof LogEntry] !== undefined);
      if (keys.length === 0) return get(id);
      const names: Record<string, string> = { "#e": "entry" };
      const values: Record<string, unknown> = {};
      const sets = keys.map((k, i) => {
        names[`#k${i}`] = k;
        values[`:v${i}`] = patch[k as keyof LogEntry];
        return `#e.#k${i} = :v${i}`;
      });
      try {
        const res = await doc.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk: evtKey(id) },
            UpdateExpression: `SET ${sets.join(", ")}`,
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ReturnValues: "ALL_NEW",
          }),
        );
        return (res.Attributes?.entry as LogEntry | undefined) ?? null;
      } catch (e) {
        if ((e as { name?: string }).name === "ConditionalCheckFailedException") return null;
        throw e;
      }
    },

    async clearEntries() {
      let ExclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const res = await doc.send(
          new ScanCommand({ TableName: tableName, ProjectionExpression: "pk", ExclusiveStartKey }),
        );
        const keys = (res.Items ?? []).map((i) => ({ DeleteRequest: { Key: { pk: i.pk } } }));
        for (let i = 0; i < keys.length; i += 25) {
          await doc.send(new BatchWriteCommand({ RequestItems: { [tableName]: keys.slice(i, i + 25) } }));
        }
        ExclusiveStartKey = res.LastEvaluatedKey;
      } while (ExclusiveStartKey);
    },
  };
}
