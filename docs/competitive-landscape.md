# Front Desk — competitive landscape & positioning

*Researched 2026-10-15 for the Amazon Developer Hackathon (Ring track). Reuse in the Devpost
"Potential Impact" section and the demo video.*

## The problem today

Small offices (therapists, dentists, law and accounting firms, coworking, small warehouses) have a
locked front door and nobody watching it. Clients wait outside pressing the bell, couriers give up,
staff get pulled out of sessions to check a camera feed.

## What exists, and where each falls short

| Current solution | What it does | Limitation |
|---|---|---|
| **iPad kiosk visitor management** — [Envoy](https://envoy.com/pricing), [Greetly](https://www.greetly.com/features/alerts-notifications), [The Receptionist for iPad](https://www.yarooms.com/guides/best-visitor-management-systems), SwipedOn, Vizito | Visitor types their name on a tablet; host gets Slack/SMS/email | Needs a lobby, a mounted iPad, and a visitor willing to self-register. Envoy is the only one that reads the calendar; it is ~$109/location/mo plus ~$199/mo for the video "Virtual Front Desk" add-on (third-party pricing). Built for 50+ person offices. |
| **Commercial video intercoms** — Swiftlane, Verkada, DoorBird | "Visitor is here" alert, two-way talk, remote unlock | New hardware and installation; no appointment awareness. A [2026 buyer's guide](https://getsafeandsound.com/blog/commercial-intercom-systems/) lists calendar integration as something buyers want, none of the results show it shipped. |
| **IFTTT "post to Slack when Ring is pressed"** ([applet](https://ifttt.com/applets/LvtfimNF-post-to-slack-when-ring-doorbell-is-pressed)) | Dumb relay of the button press | No calendar, no snapshot, no visitor log, no greeting. A [Node-RED thread](https://discourse.nodered.org/t/ring-doorbell-amazon-alexa-node-red/47804) reports newer Ring doorbells no longer work with IFTTT. |
| **DIY** — [DOOR8ELL](https://medium.com/@mcreed/door8ell-15b7226a8953) | One office built its own Slack doorbell | Proof the need exists; not a product. |
| **Ring Appstore business apps** — Lumeo, StoreTraffic, QueueFlow, ProxView, Ring's own Cheer Chime ([TechCrunch](https://techcrunch.com/2026/03/31/ring-app-store-bets-on-ai-to-go-beyond-home-security/)) | People counting, queues, loitering, POS tip alerts | All analytics / loss prevention. No reception, visitor, or appointment app in the store. Cheer Chime (a Toast POS integration) shows Ring itself wants front-of-house integrations. |

## Why Front Desk is better

1. **Zero new hardware.** Uses the Ring doorbell the office already has (Ring for Business sells them for exactly this door).
2. **The visitor does nothing.** Kiosks make the visitor identify themselves. Front Desk infers from the appointment calendar plus a snapshot, and the host confirms with one tap.
3. **Appointment-aware, not motion-aware.** "Your 2:00, J. Lee, is at the door" instead of "Motion detected."
4. **Greets through the chime.** The visitor hears "Welcome, someone will be right with you" via Ring chime audio playback, so they stop re-ringing.
5. **A visitor log for free.** Every arrival, courier, and after-hours ring is recorded with a timestamp and snapshot (compliance and dispute value for healthcare/legal offices).
6. **Price point.** Envoy-class capability for offices that could never justify $300/month and an iPad.

## Objections judges will raise, and the answer

- **"Two appointments in the same window / a courier at 2:01."** We never claim certainty. The notice says "Someone's at the door for the 2:00 slot (J. Lee?)" with the snapshot; the host confirms or corrects in one tap. Also keeps us clear of Ring's facial-recognition ban (Ring's [computer vision guidelines](https://developer.amazon.com/docs/ring/computer-vision-guidelines.html) prohibit biometric identification).
- **"Envoy could ship this."** Yes, at enterprise pricing for companies with lobbies. We are for the small businesses with a locked door and no receptionist.
- **"Ring's own app already notifies on a ring."** It says *someone* rang. It doesn't know who was expected, doesn't tell the right staff member, doesn't greet the visitor, and doesn't keep a log.

## TODO before submission
- [ ] Source a count of US small businesses / professional offices without reception staff.
- [ ] Verify Envoy pricing on envoy.com (third-party figures above).
