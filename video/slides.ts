/**
 * Full-screen slides for the demo video, styled to match the dashboard.
 * Rendered as data: URLs so the recorder needs no web server for them.
 */

const css = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 100%; height: 100%; }
  body {
    background: #111214; color: #eceae6;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    display: grid; place-items: center; overflow: hidden;
  }
  .wrap { width: 1440px; padding: 0 40px; animation: in .6s ease both; }
  @keyframes in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  .mark { display: inline-grid; place-items: center; width: 84px; height: 84px; border-radius: 22px;
          background: #4fb89c; color: #0d1412; margin-bottom: 40px; }
  .eyebrow { font-size: 26px; font-weight: 600; letter-spacing: .02em; color: #4fb89c; margin-bottom: 22px; }
  h1 { font-size: 86px; line-height: 1.06; font-weight: 750; letter-spacing: -0.035em; }
  h1 .dim { color: #85858a; }
  h2 { font-size: 60px; line-height: 1.1; font-weight: 720; letter-spacing: -0.03em; margin-bottom: 48px; }
  .list { display: grid; gap: 22px; }
  .item { display: flex; gap: 22px; align-items: baseline; font-size: 38px; color: #b9b8b4; }
  .item b { color: #eceae6; font-weight: 650; }
  .num { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
         font-size: 22px; font-weight: 700; background: #2a2b31; color: #eceae6; transform: translateY(-4px); }
  .price { margin-top: 56px; display: inline-flex; gap: 18px; align-items: center; font-size: 30px; color: #b9b8b4;
           border: 1px solid #3a2a24; background: #3a211b; padding: 16px 26px; border-radius: 16px; }
  .price b { color: #ec7b5e; }
  .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; margin-top: 8px; }
  .box { background: #1a1b1f; border: 1px solid #2a2b31; border-radius: 22px; padding: 30px 28px; min-height: 270px; }
  .box .k { font-size: 20px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; color: #4fb89c; margin-bottom: 14px; }
  .box .t { font-size: 32px; font-weight: 680; letter-spacing: -0.01em; margin-bottom: 14px; }
  .box .d { font-size: 22px; line-height: 1.45; color: #9a9ca3; }
  .arrow { color: #4fb89c; }
  .note { margin-top: 40px; font-size: 26px; color: #85858a; }
  .note b { color: #eceae6; font-weight: 600; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-top: 10px; }
  .card { background: #1a1b1f; border: 1px solid #2a2b31; border-radius: 22px; padding: 34px; }
  .card .k { font-size: 22px; font-weight: 650; color: #4fb89c; margin-bottom: 18px; }
  .card.sim .k { color: #d9a646; }
  .card ul { padding-left: 28px; font-size: 30px; line-height: 1.6; color: #b9b8b4; }
  .links { margin-top: 56px; display: flex; gap: 40px; font-size: 30px; color: #9a9ca3; }
  .links b { color: #eceae6; font-weight: 600; }
`;

const door = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.56v16.32a1 1 0 0 1-1.24.97L5 20V5.56a2 2 0 0 1 1.51-1.94l4-1A2 2 0 0 1 13 4.56Z"/></svg>`;

function page(body: string): string {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="wrap">${body}</div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export const slides = {
  title: page(`
    <div class="mark">${door}</div>
    <h1>Every small office has a doorbell.<br><span class="dim">Almost none has a receptionist.</span></h1>
  `),

  problem: page(`
    <div class="eyebrow">The problem</div>
    <h2>A locked front door, and nobody watching it.</h2>
    <div class="list">
      <div class="item"><span class="num">1</span><span><b>Clients wait outside</b>, pressing the bell.</span></div>
      <div class="item"><span class="num">2</span><span><b>Couriers give up</b> and take the package away.</span></div>
      <div class="item"><span class="num">3</span><span><b>Staff get pulled out of sessions</b> to squint at a camera.</span></div>
    </div>
    <div class="price">Kiosk visitor systems: <b>hundreds of dollars a month</b>, plus a lobby and an iPad.</div>
  `),

  architecture: page(`
    <div class="eyebrow">How it works</div>
    <h2>Deterministic where it matters.</h2>
    <div class="flow">
      <div class="box"><div class="k">Ring Partner API</div><div class="t">Signed webhook</div>
        <div class="d">button_press, motion_detected sub_type. HMAC-SHA256 verified, deduplicated on request_id, 200 in milliseconds.</div></div>
      <div class="box"><div class="k">Matcher</div><div class="t">Calendar window</div>
        <div class="d">A pure, unit-tested function. No model decides who is at the door. Ambiguity is shown, never guessed.</div></div>
      <div class="box"><div class="k">Amazon DynamoDB</div><div class="t">Visitor log</div>
        <div class="d">Conditional writes: a re-delivered webhook can never create a second card.</div></div>
      <div class="box"><div class="k">Out</div><div class="t">Slack + frame</div>
        <div class="d">One sentence to the right host, a snapshot from the Ring API, and a one-tap confirm.</div></div>
    </div>
    <p class="note"><b>Built on:</b> Ring Partner API · webhook v1.1 · image download · WHEP live view · Amazon DynamoDB · Next.js on Vercel · Slack</p>
  `),

  honest: page(`
    <div class="eyebrow">What's live, and what's simulated</div>
    <h2>The Playground has a doorbell, but no way to press it.</h2>
    <div class="split">
      <div class="card"><div class="k">Live Ring Partner API</div>
        <ul><li>Device discovery and status</li><li>Every door frame you saw</li><li>Live view (WHEP) sessions</li></ul></div>
      <div class="card sim"><div class="k">Our signed simulator</div>
        <ul><li>The doorbell rings themselves</li><li>Webhook v1.1 payloads, HMAC-signed like Ring's</li><li>Same endpoint Ring would call</li></ul></div>
    </div>
  `),

  close: page(`
    <div class="mark">${door}</div>
    <h1>Front Desk<br><span class="dim">Your Ring doorbell is your receptionist.</span></h1>
    <div class="links"><span><b>front-desk-sooty.vercel.app</b></span><span><b>github.com/KaavinB/front-desk</b></span></div>
  `),
};
