# Devpost submission answers (source of truth)

Paste from here if the form ever loses its contents.

- **Project name:** Front Desk
- **Elevator pitch:** Your Ring doorbell is your receptionist. Appointment-aware visitor alerts for small offices, built on the Ring Partner API, Amazon DynamoDB and Slack.
- **Try it out:** https://front-desk-sooty.vercel.app
- **Repo:** https://github.com/KaavinB/front-desk
- **Primary track:** Ring
- **New or existing:** New
- **Built with:** ring, amazon-dynamodb, next.js, typescript, slack, vercel, amazon-web-services
- **Open Source mini challenge:** No
- **Friction log:** https://github.com/KaavinB/front-desk/blob/master/docs/friction-log.md
- **Submitter:** Individual · Organization N/A · United States · Canada province N/A
- **Project testing link:** https://front-desk-sooty.vercel.app
- **AI tools leveraged:** Claude Code (Anthropic): idea research and competitive analysis, Ring Partner API exploration, writing and testing the code, deployment, and browser automation for setup tasks. Ring Appstore MCP server: documentation search from the editor.
- **Level of learning:** Significant · **AI value for career:** Yes

## AWS Builder Mini Challenge — which AWS services and how

Amazon DynamoDB (us-east-2) is the visitor log: one on-demand table, keys evt#<id> for entries and req#<ring request_id> for idempotency markers, both written with conditional puts (attribute_not_exists) so a redelivered Ring webhook can never create two visitor cards; background tasks (snapshot, notice, greeting) update only their own fields with UpdateExpression SET so they can't overwrite each other; reads via Scan filtered on the evt# prefix; created by npm run dynamo:setup using @aws-sdk/client-dynamodb and @aws-sdk/lib-dynamodb (lib/store/dynamo.ts). Amazon Bedrock is integrated as the notice writer (lib/bedrock.ts, Anthropic Bedrock SDK, Claude Haiku 5.5): it rewrites the deterministic matcher's decision into the one sentence the host reads, behind a template fallback; on our new Free-plan AWS account Bedrock invocation is blocked (model not available for this account / zero daily quota), so it is wired and documented but off in the live deployment.

## Feedback 1 — Which developer tools, APIs, and SDKs did you use and for what?

Ring Partner API (api.amazonvision.com): webhook v1.1 as the real-time event source (button_press, motion_detected with sub_type human/vehicle/package_delivery, device_online/offline) with HMAC-SHA256 X-Signature verification and meta.request_id deduplication; GET /v1/devices, /status, /capabilities, /configurations and /history/devices/{id}/events for device inventory, health and backfill; POST /media/image/download (type at_timestamp) for the snapshot attached to each visitor card; POST /media/streaming/whep/sessions to open a live view; POST /media/audio/playback for the chime greeting. Ring Developers Playground: 30-minute tokens and the virtual Doorbell Pro, used for every real API call in the demo. Ring Appstore MCP server (knowledge.appstore-mcp.ring.amazon.dev) for documentation lookups while coding. Amazon DynamoDB for the visitor log and Amazon Bedrock (Anthropic Bedrock SDK) for notice wording. Also Next.js 15/TypeScript, Vercel, Slack incoming webhooks.

## Feedback 2 — What worked well?

Ring Partner API: the JSON:API shapes are consistent and the device, status, capabilities, configurations and history endpoints all worked first try with a Playground token. Webhook v1.1 is well designed: a stable meta.request_id for idempotency, epoch-ms timestamps, the open-ended sub_type vocabulary (package_delivery was exactly what our courier lane needed), and the explicit 5-second/200 contract made the receiver easy to get right. Snapshot download returning a 303 to a pre-signed URL is a clean pattern once you know the body shape. Opening a WHEP session from a server with a minimal SDP offer worked and produced an on_demand history event, which let us automate frame capture. Playground: generating a token with no app registration, OAuth or identity verification is the fastest onboarding of any device platform we have used. The release notes are detailed and dated. DynamoDB: conditional puts gave us idempotent webhook handling in a few lines.

## Feedback 3 — What needs work?

Ring: (1) The Playground cannot produce the one event every doorbell app is built around. Its Simulate section only starts live views (Package/Vehicle/Motion all land as on_demand with empty cv_detections) and there is nowhere to enter a webhook URL, so button_press and motion webhooks cannot be exercised without hardware; every team ends up writing its own signed simulator. (2) The snapshot endpoint returns 403 Cannot authorize for a malformed body; only {type:'at_timestamp', timestamp} works and that shape is documented only inside the multi-camera code sample. The misleading 403 led us (and several other teams, per their READMEs) to believe the Playground token was read-only. (3) Token lifetime is 30 minutes and regeneration is locked for 30 minutes; after a page reload the Playground UI greys out even though the token still works. (4) Event History has no time-range parameters; only a cursor. (5) Snapshots 416 unless media exists near the timestamp, which is undocumented. (6) The chime audio playback body shape and the fact that chimes are only identifiable via capabilities.audio.customizable_slots deserve a dedicated section. AWS: new Free-plan accounts are silently region-restricted by an SCP (us-east-1 denied, us-east-2 allowed) and Bedrock returns 'not available for this account' with no path other than contacting sales; the retired model-access page points nowhere.

## Feedback 4 — Onboarding experience

Ring Playground onboarding was excellent: sign in, Generate token, call the API, under five minutes. The getting-started guide and API reference are thorough, though the reference is one very long page and the key request-body shapes (snapshot, chime playback) are easy to miss. Full developer registration (government ID verification, app configuration, certification) is heavier, and we did not need it for the hackathon thanks to the Playground. The Ring Appstore MCP server was a useful way to search the docs from the editor. AWS onboarding on a brand-new account was the roughest part of the week: the Free-plan restrictions are not explained in the console, errors arrive as generic AccessDenied with a service control policy ARN, and Bedrock's retired Model access page says access is automatic while invocation is in fact blocked.

## Feedback 5 — Would you build with these again?

Yes. The Ring Partner API is a solid foundation and the Appstore distribution and subscription model make a real product like Front Desk viable; we would ship on it. We would want a Playground that can fire signed test webhooks before taking a product to certification. DynamoDB, yes without reservation. Bedrock, yes once the account can invoke it; the SDK integration took minutes, the account gating took the evening.

## Feature requests

1. Critical: Playground 'Send test webhook' buttons (button_press, motion_detected per sub_type, device_offline, contact_sensor_faulted) delivered to a developer-entered HTTPS URL with a real X-Signature. 2. Important: document the snapshot and video download request bodies (type: at_timestamp / time_range) on the endpoints themselves, and return 400 with field names instead of 403 Cannot authorize for malformed bodies. 3. Important: a longer-lived developer token (24h) or refresh for Playground tokens, and let the Playground UI unlock when an active token exists. 4. Nice-to-have: start/end time-range filters on Event History. 5. Nice-to-have: a simulated Ring Chime with audio slots in the Playground so chime playback can be demonstrated.
