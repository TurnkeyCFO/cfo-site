// Cloudflare Pages Function: receives the Northpoint onboarding cheat-sheet
// submission and posts it to Slack server-side. Secrets come from the cfo-site
// Pages project env vars (SLACK_BOT_TOKEN secret + NP_ONBOARDING_CHANNEL).
// No credentials ever reach the client.

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: "bad json" }, 400);
  }

  const entries = Array.isArray(data && data.entries) ? data.entries : [];
  if (!entries.length) return json({ ok: false, error: "no entries" }, 400);

  const token = env.SLACK_BOT_TOKEN;
  const channel = env.NP_ONBOARDING_CHANNEL;
  if (!token || !channel) return json({ ok: false, error: "not configured" }, 500);

  const client = (data.client || "Northpoint Church").toString().slice(0, 120);
  const when = (data.submittedAt || "").toString().slice(0, 40);

  const lines = entries.slice(0, 60).map(function (e) {
    const tag = (e && e.tag ? String(e.tag) : "Entry").slice(0, 40);
    const q = (e && e.q ? String(e.q) : "").slice(0, 300);
    const a = (e && e.a ? String(e.a) : "").slice(0, 1500).replace(/\n/g, "\n      ");
    return "• *" + q + "*  _(" + tag + ")_\n      " + a;
  });

  const text =
    ":memo: *" + client + " — onboarding checklist & cheat sheet submitted*\n" +
    (when ? "_" + when + "_\n" : "") +
    "\n" + lines.join("\n");

  let sd;
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ channel: channel, text: text, unfurl_links: false }),
    });
    sd = await r.json();
  } catch (err) {
    return json({ ok: false, error: "slack unreachable" }, 502);
  }

  if (!sd || !sd.ok) return json({ ok: false, error: (sd && sd.error) || "slack error" }, 502);
  return json({ ok: true });
}
