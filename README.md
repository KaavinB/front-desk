# Front Desk

**Your Ring doorbell is your receptionist.**

Small offices (therapists, dentists, law and accounting firms, coworking spaces) have a locked
front door and nobody watching it. Front Desk listens to the Ring doorbell that's already there,
checks today's appointment calendar, and tells the right person:

> *Your 2:00, J. Lee, rang the bell.*

with a snapshot, a one-tap confirmation, a chime greeting for the visitor, and a visitor log that
writes itself. No kiosk, no iPad, no new hardware.

Built for the **Build, Ship, Shape: Amazon Developer Hackathon 2026**, Ring track
(access control, business systems). Mini challenges: AWS Builder, Open Source.

## How it works

```
Ring doorbell ──webhook v1.1──▶ POST /api/webhooks/ring
                                 verify HMAC (X-Signature) · dedupe meta.request_id · 200 in < 5 s
                                        │
                                        ▼
                                  lib/matcher.ts  (pure function, unit-tested)
                   button_press / motion.human ──▶ appointment window?  ──▶ "Your 2:00, J. Lee"
                   motion.package_delivery     ──▶ courier lane
                   outside office hours        ──▶ after-hours lane (logged, nobody paged)
                   two bookings in one slot    ──▶ "J. Lee? (Sam Rivera also booked)"  → host confirms
                                        │
                                        ▼
                     Slack notice · visitor log (data/events.json) · dashboard at /
```

Ambiguity is shown, never hidden: when two people are booked for the same slot the host picks
with one tap. Front Desk never identifies faces (Ring's computer-vision guidelines prohibit it);
it reasons from the calendar, the time, and a snapshot the host looks at.

## Run it

```bash
npm install
cp .env.example .env
npm run dev                 # http://localhost:3000
npm run simulate            # a Tuesday at the office, in ~20 seconds
npm test
```

The simulator posts HMAC-signed Ring webhook v1.1 payloads to the real receiver, so the demo
exercises the same verify → decide → notify path as production traffic. Edit
`data/appointments.json` to change the day's calendar.

### Real Ring API (Developers Playground)

1. Open the [Ring Developer Playground](https://developer.amazon.com/ring/console/playground) and click **Generate Token** (valid ~30 min).
2. Put it in `.env` as `RING_ACCESS_TOKEN`.
3. `npm run ring:probe` lists your devices, status and event history over the live API.

## Ring Partner API surface used

| Purpose | Endpoint |
|---|---|
| Real-time events | Webhook v1.1: `button_press`, `motion_detected` (`sub_type` human / package_delivery / vehicle), `device_online/offline` |
| Signature check | HMAC-SHA256 `X-Signature` over the raw body |
| Backfill / proof of API | `GET /v1/devices`, `GET /v1/devices/{id}/status`, `GET /v1/history/devices/{id}/events` |
| Snapshot for the host | `POST /v1/devices/{id}/media/image/download` |
| Greet the visitor | `POST /v1/devices/{id}/media/audio/playback` (Chime Controls) |

## Repo map

- `app/api/webhooks/ring/route.ts` — the receiver
- `lib/matcher.ts` — the decision logic; `tests/matcher.test.ts` covers it
- `lib/ring/` — webhook types, signature verification, API client
- `lib/calendar.ts` — appointment source (JSON now; calendar sync is the seam)
- `scripts/simulate.ts` — signed webhook simulator
- `docs/competitive-landscape.md` — what exists today and why this is different
- `docs/friction-log.md` — developer-experience notes for the Ring team

## License

MIT
