# Friction log

*Submissions with a friction log earn up to a 10% judging bonus. One entry per rough edge:
task, steps, expected vs. actual, severity, workaround, suggestion. Add entries as they happen.*

## F1 — Developers Playground does not deliver webhooks
- **Task:** Exercise the `button_press` webhook handler end to end without hardware.
- **Steps:** Generated a Playground token, read the webhook v1.1 docs, looked for a "send test event" control.
- **Expected:** A way to fire a signed `button_press` / `motion_detected` webhook at my URL.
- **Actual:** The Playground simulates live-view sessions only (secondhand reports from other developers; verify on first login). Event History shows `on_demand` events, not dings.
- **Severity:** High. The core event for any doorbell app cannot be produced officially.
- **Workaround:** `scripts/simulate.ts` builds v1.1 payloads and signs them with HMAC-SHA256, exactly as Ring does.
- **Suggestion:** Add "Send test webhook" buttons (button_press, motion_detected per sub_type, device_offline) to the Playground, pointed at a developer-entered URL.

## F2 — Snapshot download: the error hides the real problem
- **Task:** Download a snapshot for a visitor (`POST /v1/devices/{id}/media/image/download`).
- **Steps:** Sent `{}` → `403 REQUEST_FORBIDDEN "missing required timestamp fields"`. Sent `{"timestamp": <ms>}` → `400 "type is required"`. Sent `{"start","end"}` → 403 again. Only `{"type":"at_timestamp","timestamp":<ms>}` works (303 to a pre-signed URL).
- **Expected:** A 400 validation error naming the required fields (`type`, `timestamp`), or the body schema in the endpoint reference. The body shape is only shown inside the Multi-Camera section's code sample.
- **Actual:** A 403 "Cannot authorize" for what is a request-shape problem, so I first assumed the Playground token was read-only (several other developers wrote the same thing in their READMEs). It isn't: snapshots work on the Playground.
- **Severity:** Medium. Cost ~30 minutes and produced a wrong belief that is now spreading in community code.
- **Suggestion:** Return 400 with field names for missing body fields; document the `type: at_timestamp` body on the Image Snapshot endpoint itself; add a "Download snapshot" button to the Playground.

## F3 — 30-minute token, and a 30-minute lockout on regenerating it
- **Task:** Leave the dashboard running during a build session; reload the Playground page.
- **Steps:** Generated a token, pasted it into `.env`, reloaded the Playground later.
- **Expected:** The token keeps working for 30 minutes and I can get a new one whenever I need it.
- **Actual:** After a reload the page says "You have an active token. For security, it is not displayed. You can generate a new token in 22 minutes," and the Explore APIs / Simulate sections are greyed out with "Generate a token to get started." So if the token was copied in a previous page session, the Playground UI is unusable until the lockout ends, even though the token itself is still valid for API calls.
- **Severity:** Medium. Every page reload costs up to 30 minutes of Playground UI time.
- **Workaround:** Keep the token in `.env` and drive the API from code; use the Playground UI only when the lockout allows.
- **Suggestion:** Let the UI sections unlock when an active token exists (or show the token again); allow revoke-and-regenerate; offer a longer-lived developer token.
