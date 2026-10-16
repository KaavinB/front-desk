/**
 * Proves the real Ring Partner API connection with a Developers Playground token.
 * Lists devices, their status, and recent event history.
 *
 *   RING_ACCESS_TOKEN=eyJ... npm run ring:probe
 */
import "dotenv/config";
import { getDeviceStatus, getEventHistory, listDevices, RingApiError } from "../lib/ring/client";

async function main() {
  const devices = await listDevices();
  console.log(`${devices.length} device(s)`);
  for (const d of devices) {
    console.log(`\n${d.id}  (${d.type})`);
    console.log("  attributes:", JSON.stringify(d.attributes));
    try {
      console.log("  status:", JSON.stringify(await getDeviceStatus(d.id)));
    } catch (e) {
      console.log("  status: failed", e instanceof RingApiError ? e.status : e);
    }
    try {
      const history = await getEventHistory(d.id, { maxPages: 1 });
      console.log(`  history: ${history.length} event(s)`);
      for (const h of history.slice(0, 10)) {
        console.log(`    ${new Date(h.attributes.start).toISOString()}  ${h.attributes.event_type}`);
      }
    } catch (e) {
      console.log("  history: failed", e instanceof RingApiError ? `${e.status} ${e.body}` : e);
    }
  }
}

main().catch((e) => {
  if (e instanceof RingApiError && e.status === 401) {
    console.error("401: token expired or missing. Generate a new one at https://developer.amazon.com/ring/console/playground");
  } else {
    console.error(e);
  }
  process.exit(1);
});
