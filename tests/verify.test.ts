import { describe, expect, it } from "vitest";
import { signBody, verifySignature } from "../lib/ring/verify";

describe("webhook signature", () => {
  const key = "test-key";
  const body = '{"meta":{"version":"1.1"},"data":{"type":"button_press"}}';

  it("accepts a correct sha256= signature", () => {
    expect(verifySignature(body, signBody(body, key), key)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifySignature(body.replace("button_press", "motion_detected"), signBody(body, key), key)).toBe(false);
  });

  it("rejects a wrong key, missing header, and malformed header", () => {
    expect(verifySignature(body, signBody(body, "other"), key)).toBe(false);
    expect(verifySignature(body, null, key)).toBe(false);
    expect(verifySignature(body, "sha256=zz", key)).toBe(false);
  });

  it("verifies over raw bytes, so re-serialized JSON would not match", () => {
    const pretty = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifySignature(pretty, signBody(body, key), key)).toBe(false);
  });
});
