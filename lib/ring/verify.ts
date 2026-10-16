import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ring signs each webhook with HMAC-SHA256 over the raw request body and sends it as
 * `X-Signature: sha256=<hex>`. Verify against the raw bytes, never re-serialized JSON.
 */
export function signBody(rawBody: string | Buffer, key: string): string {
  const hex = createHmac("sha256", key).update(rawBody).digest("hex");
  return `sha256=${hex}`;
}

export function verifySignature(
  rawBody: string | Buffer,
  header: string | null | undefined,
  key: string,
): boolean {
  if (!header) return false;
  const expected = Buffer.from(signBody(rawBody, key));
  const actual = Buffer.from(header.trim());
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
