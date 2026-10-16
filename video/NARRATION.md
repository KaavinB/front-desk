# Front Desk demo: narration script

Record each line as its own clip and save it in `video/voice/` with the file name shown
(`.m4a` from QuickTime or Voice Memos is fine; `.wav` and `.mp3` work too). Then run
`npm run video`. The video is re-timed to your clips, so speak naturally: pauses and pace are yours.

Tips: quiet room, laptop mic about a forearm's length away, one or two takes per line,
a beat of silence before and after is fine (it's trimmed). Any line you skip uses the computer voice.
Rephrase freely, but keep the facts.

## 1. `01-title.m4a`

*On screen:* Title slide: “Every small office has a doorbell.”

> Every small office has a doorbell. Almost none of them has a receptionist.

## 2. `02-problem.m4a`

*On screen:* Problem slide: three numbered pains and the kiosk price

> Therapists, dentists, law firms. A locked front door, and nobody watching it. Clients wait outside, couriers give up, and staff get pulled out of sessions to check a camera. The kiosk systems built for this cost hundreds of dollars a month, and need a lobby and an iPad.

## 3. `03-intro.m4a`

*On screen:* The dashboard appears, empty, with the live Ring status in the top right

> Front Desk turns the Ring doorbell an office already has into its receptionist. It reads today's appointment calendar, and when the bell rings, it tells the right person who is there.

## 4. `04-maria.m4a`

*On screen:* Maria Chen's card appears at the top

> Nine o'clock. Maria rings. Front Desk matches her booking, pulls a frame from the door through the Ring API, and tells Doctor Lee in Slack: your nine o'clock, Maria Chen, rang the bell.

## 5. `05-courier.m4a`

*On screen:* A Delivery card appears

> A package is dropped off. Ring tags it as a delivery, so it's logged, and nobody is interrupted.

## 6. `06-tom.m4a`

*On screen:* Tom Okafor's card appears

> Ten o'clock. Tom. Same thing.

## 7. `07-unexpected.m4a`

*On screen:* A red-outlined “Not on the calendar” card appears

> Eleven thirty. Someone rings, and nothing is on the calendar. That one is flagged, with the frame, so staff can decide before they open the door.

## 8. `08-double.m4a`

*On screen:* The 2:00 double-booking card appears; about 5 s later “It's J. Lee” is clicked

> Two o'clock is double booked. Front Desk doesn't pretend to know who it is. It shows both names, and the host confirms with one tap. That keeps the visitor log honest, and it means no facial recognition, which Ring prohibits.

## 9. `09-after.m4a`

*On screen:* A purple After hours card appears

> And a ring at seven in the evening is logged quietly. Nobody is woken up.

## 10. `10-sidebar.m4a`

*On screen:* Hold on the dashboard; the sidebar shows who has arrived

> On the right, today's appointments update as people arrive, and the latest frame from the front door is always one glance away.

## 11. `11-arch.m4a`

*On screen:* How-it-works slide: four boxes

> Under the hood, Ring sends a signed webhook. We verify the signature, drop duplicates, and reply in milliseconds. A small, unit tested matcher checks the calendar. No AI model ever decides who is at the door. The visitor log lives in Amazon DynamoDB, with conditional writes, so a re-delivered webhook can never create a second card.

## 12. `12-honest.m4a`

*On screen:* “What's live, and what's simulated” slide

> One honest note. Ring's developer Playground gives us a real virtual doorbell for the API, but no way to press it. So the rings in this demo come from our own simulator, signed exactly like Ring's webhooks, and sent to the same endpoint. The device status and every door frame you saw came from the live Ring Partner API.

## 13. `13-close.m4a`

*On screen:* Closing slide with the live URL and repo

> Front Desk. Your Ring doorbell already knows your two o'clock is here. Now it can say so.
