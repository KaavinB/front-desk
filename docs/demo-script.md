# Front Desk — demo video script (target 2:45, hard cap 3:00)

Judges aren't required to watch past 3:00, so the best material is in the first 90 seconds.
No third-party logos, product names, or music in the video (Devpost rule). Competitors are
described by category ("tablet kiosk systems"), not by name.

## Prep checklist (do before recording)

- [ ] `data/appointments.json` dated for the recording day, or point `CALENDAR_ICS_URL` at a Google Calendar with the same four appointments.
- [ ] Fresh Playground token in `.env` (30 min). Confirm the header badge reads **online · live Ring API**.
- [ ] Slack channel `#front-desk` open in a second window, notifications on.
- [ ] `BEDROCK_MODEL_ID` set, one test ring to confirm "written by Bedrock" appears.
- [ ] `curl -X DELETE localhost:3001/api/events` so the log starts empty.
- [ ] Browser at 125% zoom, dark mode, dashboard only (no tabs bar). Terminal font 18pt.
- [ ] Phone or second screen for the doorbell "press" cutaway (optional: a real Ring doorbell on any door).
- [ ] Record narration separately; cut to picture afterwards.

## Shot list

| Time | Picture | Narration | On-screen text |
|---|---|---|---|
| 0:00–0:12 | Close-up: a hand pressing a doorbell on a plain office door. Nobody answers. Cut to black. | "Every small office has a doorbell. Almost none of them has a receptionist." | **Front Desk** |
| 0:12–0:35 | Quick cuts: a therapist mid-session glancing at a phone; a courier walking away with a package; a client standing outside a locked glass door. | "Therapists, dentists, law firms, coworking spaces: a locked door and nobody watching it. Clients wait. Couriers give up. Staff get pulled out of sessions to squint at a camera feed. The tablet-kiosk systems built for this cost around three hundred dollars a month and need a lobby." | *~$300/mo + a lobby* |
| 0:35–0:45 | Dashboard, empty. Header badge: **Playground Device · online · live Ring API**. | "Front Desk turns the Ring doorbell the office already has into the receptionist. It reads the appointment calendar, and when the bell rings it tells the right person who's there." | *No kiosk. No new hardware.* |
| 0:45–1:00 | Terminal: `npm run simulate`. First card appears: **Your 9:00 AM, Maria Chen, rang the bell.** Snapshot loads. Slack notification slides in. | "Nine o'clock. Maria rings. Dr. Lee gets one line in Slack with a frame from the door: *Your 9:00, Maria Chen, is here. First visit.* No 'motion detected.' No guessing." | |
| 1:00–1:12 | Courier card: **A package was left at the front door at 9:55 AM.** Then Tom's card. | "A delivery is logged, nobody is paged. Tom at ten, same as Maria." | *Couriers logged, not paged* |
| 1:12–1:25 | Unexpected-visitor card (red stripe): **Someone rang the bell at 11:30 AM. Nothing is on the calendar.** | "Eleven-thirty: a ring with nothing on the calendar. That one goes to staff as a question, with the snapshot, so they decide before they open the door." | |
| 1:25–1:45 | Double-booking card: **Someone rang the bell for the 2:00 PM slot. J. Lee? (Sam Rivera also booked.)** Cursor taps **It's J. Lee**. Card shows ✓ Confirmed. | "Two people booked at two o'clock. Front Desk doesn't pretend to know. It shows both, the host looks at the frame and taps once. That tap is what makes the visitor log trustworthy, and it keeps us well clear of facial recognition, which Ring prohibits." | *Never identifies faces* |
| 1:45–1:55 | After-hours card (purple stripe), quiet. | "Seven p.m. ring: logged, nobody woken up." | |
| 1:55–2:15 | Architecture slide (one diagram, see below). | "Under the hood: Ring webhook, verified with the HMAC signature and acknowledged in milliseconds. A pure, unit-tested matcher checks the calendar window. Amazon Bedrock writes the sentence the host reads, and only the sentence; the model never decides who's at the door. Every snapshot you saw was pulled live from the Ring Partner API." | diagram |
| 2:15–2:30 | Split screen: Ring Developer Playground on the left, dashboard badge on the right. | "Honest note on the demo: Ring's Playground gives you a real virtual doorbell for the API, but no way to press it. So the doorbell events are our signed simulator, hitting the same endpoint Ring would. Everything else is the live API." | *Live API + signed simulator* |
| 2:30–2:45 | Visitor log scrolled, then the Ring Appstore business-apps angle: a one-line price card. | "Front Desk ships as a Ring Appstore subscription for the millions of small businesses with a locked door and no receptionist." | *Ring Appstore · access control · business systems* |
| 2:45–2:55 | Back to the doorbell close-up. The hand presses. This time a phone lights up: *Your 2:00, J. Lee, is here.* | "Your Ring doorbell already knows your two o'clock is here. Now it can say so." | **Front Desk** · repo URL |

## Architecture diagram (one slide, keep it this simple)

```
 Ring doorbell ──webhook v1.1──▶ verify HMAC · dedupe · 200 in <5 s
                                          │
                                          ▼
                                  matcher (pure, tested)
                 ring / human ──▶ calendar window? ──▶ appointment · unexpected · after-hours
                 package     ──▶ courier
                                          │
                                          ▼
            Bedrock writes the sentence ──▶ Slack · snapshot from Ring API · visitor log
```

## Lines to keep exactly

- "Every small office has a doorbell. Almost none of them has a receptionist."
- "Front Desk doesn't pretend to know."
- "Your Ring doorbell already knows your two o'clock is here. Now it can say so."

## Cut if over time (in this order)

1. The 1:45 after-hours beat (10 s).
2. The 0:12 problem montage, down to one sentence (10 s).
3. The 2:30 Appstore beat (fold its line into the closing).
