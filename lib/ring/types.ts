import { z } from "zod";

/**
 * Ring webhook v1.1 payload.
 * https://developer.amazon.com/docs/ring/api-documentation.html (Webhook v1.1 Payload Structure)
 *
 * `data.type` is the event type. `sub_type` on motion events is an open vocabulary
 * (motion | human | vehicle | package_delivery | other_motion | ...), so unknown values
 * are passed through, not rejected.
 */
export const RingWebhookSchema = z.object({
  meta: z.object({
    version: z.string(),
    time: z.string(),
    request_id: z.string(),
    account_id: z.string().optional(),
  }),
  data: z.object({
    id: z.string(),
    type: z.string(),
    attributes: z
      .object({
        source: z.string().optional(),
        source_type: z.string().optional(),
        timestamp: z.number().optional(),
        timestamp_readable: z.string().optional(),
        sub_type: z.string().optional(),
        component_ids: z.array(z.string()).optional(),
      })
      .passthrough(),
    relationships: z
      .object({
        devices: z
          .object({ links: z.object({ self: z.string() }).partial() })
          .partial()
          .optional(),
      })
      .passthrough()
      .optional(),
  }),
});

export type RingWebhook = z.infer<typeof RingWebhookSchema>;

export type RingEventType =
  | "button_press"
  | "motion_detected"
  | "device_online"
  | "device_offline"
  | (string & {});

export type MotionSubType =
  | "motion"
  | "human"
  | "vehicle"
  | "package_delivery"
  | "other_motion"
  | (string & {});
