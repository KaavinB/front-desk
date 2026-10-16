import { dynamoStore } from "./store/dynamo";
import { fileStore } from "./store/file";
import type { LogEntry, Store } from "./store/types";

export type { LogEntry, Store } from "./store/types";

/**
 * The visitor log. Amazon DynamoDB when DYNAMODB_TABLE is set (deployed), the
 * local JSON file otherwise. Same four operations either way.
 */
let store: Store | null = null;

export function getStore(): Store {
  if (!store) {
    const table = process.env.DYNAMODB_TABLE;
    store = table ? dynamoStore(table) : fileStore();
  }
  return store;
}

export const listEntries = (): Promise<LogEntry[]> => getStore().listEntries();
export const hasRequestId = (requestId: string): Promise<boolean> => getStore().hasRequestId(requestId);
export const appendEntry = (entry: LogEntry): Promise<boolean> => getStore().appendEntry(entry);
export const updateEntry = (id: string, patch: Partial<LogEntry>): Promise<LogEntry | null> =>
  getStore().updateEntry(id, patch);
export const clearEntries = (): Promise<void> => getStore().clearEntries();
