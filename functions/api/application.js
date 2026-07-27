// Cloudflare Pages Function — Request a Consultation (client application).
//
// Receives an application from /request-consultation/, RE-SCORES it server-side
// (the browser's lane is advisory only — never trusted), stores it in KV, and
// posts a card to Slack. Secrets come from the cfo-site Pages project env.
//
// Bindings reused from the existing cfo-site functions:
//   ONBOARDING_KV        — storage (this function namespaces every key "app:")
//   SLACK_BOT_TOKEN      — bot token
//   SLACK_CHANNEL_ASSISTANTBOT — fallback channel
// Optional, add later without a code change:
//   APPLICATION_CHANNEL  — dedicated channel id (e.g. #leads)

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ---- scoring (mirrors request-consultation/index.html CONFIG.weights) -----
var W = {
  entity:  { church:25, nonprofit:22, multi:20, single:10, soleprop:-10 },
  revenue: { "under-250k":-15, "250k-1m":5, "1m-3m":20, "3m-10m":25, "over-10m":25 },
  behind:  { current:10, "1-3":5, "4-12":0, "over-12":-5 },
  who:     { nobody:10, owner:10, leaving:15, inhouse:5, firm:8 },
  urgency: { asap:10, quarter:4, exploring:-8 },
  referral:40,
  triggerDetail:10,
};
var TH = { green:55, amber:25 };

// Annual income arrives as a real number. The score works off bands, so the
// band is derived HERE from the number rather than trusting what the browser
// sent alongside it.
var REV_BANDS = [
  [250000,   "under-250k"],
  [1000000,  "250k-1m"   ],
  [3000000,  "1m-3m"     ],
  [10000000, "3m-10m"    ],
];
function revBand(n) {
  if (!(typeof n === "number" && isFinite(n) && n > 0)) return "";
  for (var i = 0; i < REV_BANDS.length; i++) if (n < REV_BANDS[i][0]) return REV_BANDS[i][1];
  return "over-10m";
}
function money(n) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function scoreOf(a) {
  var t = 0;
  t += W.entity[a.entity] || 0;
  t += W.revenue[revBand(a.revenue_amount)] || 0;
  t += W.behind[a.behind] || 0;
  t += W.who[a.who] || 0;
  t += W.urgency[a.urgency] || 0;
  var referred = !!(a.referral && String(a.referral).trim().length > 1);
  if (referred) t += W.referral;
  if (a.trigger && String(a.trigger).trim().length > 15) t += W.triggerDetail;

  var lane = t >= TH.green ? "green" : t >= TH.amber ? "amber" : "red";
  var reason = "score";
  if (referred && lane !== "green") { lane = "green"; reason = "override: referral"; }
  if (a.entity === "soleprop" && revBand(a.revenue_amount) === "under-250k") {
    lane = "red"; reason = "override: no entity + under $250K";
  }
  return { total: t, lane: lane, reason: reason };
}

var LABEL = {
  entity:  { church:"Church", nonprofit:"Nonprofit", multi:"Business, multi-entity", single:"Business, single entity", soleprop:"Sole proprietor" },
  revenue: { "under-250k":"Under $250K", "250k-1m":"$250K–$1M", "1m-3m":"$1M–$3M", "3m-10m":"$3M–$10M", "over-10m":"Over $10M" },
  behind:  { current:"Current", "1-3":"1–3 months", "4-12":"4–12 months", "over-12":"Over a year" },
  who:     { owner:"Owner does it", nobody:"Nobody", inhouse:"In-house", firm:"Another firm", leaving:"Bookkeeper leaving" },
  urgency: { asap:"ASAP", quarter:"This quarter", exploring:"Just exploring" },
};
var lab = function (k, v) { return (LABEL[k] && LABEL[k][v]) || v || "—"; };

// Strip control characters (keep newlines and tabs), trim, and cap length.
// Written without regex escapes on purpose — an escaped char-class here has
// been silently normalized by tooling before, which quietly ate hyphens.
var clean = function (v, max) {
  var s = String(v == null ? "" : v);
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c === 10 || c === 9) { out += "\n"; continue; }
    if (c < 32 || c === 127) continue;
    out += s[i];
  }
  return out.trim().slice(0, max || 500);
};

export async function onRequestPost(context) {
  var env = context.env;
  var a;
  try { a = await context.request.json(); }
  catch (e) { return json({ ok: false, error: "bad_json" }, 400); }

  if (!a || !a.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(a.email))) {
    return json({ ok: false, error: "bad_email" }, 400);
  }

  var rec = {
    name: clean(a.name, 120), org: clean(a.org, 160), email: clean(a.email, 160),
    phone: clean(a.phone, 60), referral: clean(a.referral, 160),
    entity: clean(a.entity, 40),
    revenue_amount: (typeof a.revenue_amount === "number" && isFinite(a.revenue_amount) && a.revenue_amount > 0)
      ? Math.round(a.revenue_amount) : null,
    behind: clean(a.behind, 40), who: clean(a.who, 40), urgency: clean(a.urgency, 40),
    pain: clean(a.pain, 2000), trigger: clean(a.trigger, 2000),
    ctx: clean(a.ctx, 40) || "general",
    consent: !!a.consent,
    ua: clean(context.request.headers.get("user-agent"), 300),
    ts: new Date().toISOString(),
  };

  rec.revenue_band = revBand(rec.revenue_amount);

  var s = scoreOf(rec);
  rec.score = s.total; rec.lane = s.lane; rec.lane_reason = s.reason;

  // ---- store (never block the applicant on a storage failure) ------------
  var key = "app:" + rec.ts + ":" + Math.random().toString(36).slice(2, 8);
  try {
    if (env.ONBOARDING_KV) await env.ONBOARDING_KV.put(key, JSON.stringify(rec));
  } catch (e) { /* fall through to Slack, which is the real alert path */ }

  // ---- Slack ------------------------------------------------------------
  var channel = env.APPLICATION_CHANNEL || env.SLACK_CHANNEL_ASSISTANTBOT;
  var diag = { has_token: !!env.SLACK_BOT_TOKEN, token_len: (env.SLACK_BOT_TOKEN||"").length,
               channel: channel || null, kv: !!env.ONBOARDING_KV, slack: null };
  if (env.SLACK_BOT_TOKEN && channel) {
    var head = { green: ":white_check_mark: GREEN — booking now",
                 amber: ":large_orange_diamond: AMBER — needs your review within 24h",
                 red:   ":no_entry: RED — auto-declined, no action needed" }[rec.lane];

    var lines = [
      "*New consultation application* · " + head,
      "*" + (rec.org || "—") + "* — " + (rec.name || "—"),
      "<mailto:" + rec.email + "|" + rec.email + ">" + (rec.phone ? " · " + rec.phone : ""),
      "",
      "*Score* " + rec.score + " (" + rec.lane_reason + ")" + (rec.ctx !== "general" ? " · via " + rec.ctx : ""),
      lab("entity", rec.entity) +
        " · " + (rec.revenue_amount ? money(rec.revenue_amount) + "/yr" : "income not given") +
        " · books " + lab("behind", rec.behind).toLowerCase() +
        " · " + lab("who", rec.who) + " · " + lab("urgency", rec.urgency),
    ];
    if (rec.referral) lines.push("*Referred by* " + rec.referral);
    if (rec.pain) lines.push("", "*What's not working*\n>" + rec.pain.replace(/\n/g, "\n>"));
    if (rec.trigger) lines.push("*Why now*\n>" + rec.trigger.replace(/\n/g, "\n>"));

    try {
      var sraw = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: "Bearer " + env.SLACK_BOT_TOKEN,
        },
        body: JSON.stringify({ channel: channel, text: lines.join("\n"), unfurl_links: false }),
      });
      var sres = await sraw.json();
      diag.slack = (sres && sres.ok) ? "ok" : ("error:" + (sres && sres.error));
    } catch (e) { diag.slack = "throw:" + (e && e.message); }
  }

  // The browser decides what to render from its own scoring; this confirms the
  // authoritative lane so the two can never silently disagree.
  return json({ ok: true, lane: rec.lane, score: rec.score, _diag: diag });
}
