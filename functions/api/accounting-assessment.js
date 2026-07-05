// Cloudflare Pages Function — Accounting Manager Skills Assessment.
// Receives a candidate submission, SCORES it server-side against the hidden
// answer key (the key never ships to the browser), and posts a graded card to
// Slack. Secrets come from the cfo-site Pages project env (SLACK_BOT_TOKEN).
// The candidate never sees a score — only a confirmation.

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ---- Hidden answer key + metadata (server-side only) --------------------
var KEY = {
  A1:"c", A2:"b", A3:"c", A4:"c",
  B1:"b", B2:"b", B3:"b", B4:"b", B5:"b",
  C1:"b", C2:"b", C3:"b", C4:"b",
  D1:"b", D2:"c", D3:"a", D4:"c",
  E1:"b", E2:"b", E3:"b", E4:"b", E5:"a",
  F1:"a", F2:"b",
  G1:"b", G2:"b", G3:"b", G4:"b"
};
var SECTION_NAME = {
  A:"Fundamentals", B:"QuickBooks", C:"Close & QC", D:"Payroll/1099/Tax",
  E:"Church/Nonprofit", F:"Exercises", G:"Judgment"
};
// short label + the correct answer's plain text (for the "missed" list)
var META = {
  A1:["Normal credit balance","Unearned/deferred revenue"],
  A2:["Supplies bought on account","Dr Supplies Exp / Cr Accounts Payable"],
  A3:["Accrual revenue recognition","When delivered / earned"],
  A4:["Prepaid insurance, Jan expense","$200 (2,400 / 12)"],
  B1:["Undeposited Funds purpose","Holds payments until grouped into a matching deposit"],
  B2:["Rec off by a check not on statement","Outstanding check — normal timing difference"],
  B3:["Owner paid biz expense personally","Record expense, offset to Owner Equity/Contribution"],
  B4:["Fix wrong category (books open)","Reclassify the existing transaction"],
  B5:["Bank-feed deposit already recorded","Match it (don't add — avoids double count)"],
  C1:["What 'closed' requires","Reconcile all accounts + review P&L/BS"],
  C2:["Negative A/R","Payments applied without matching, or double-recorded"],
  C3:["Dec bill paid in Jan (accrual)","Accrue expense + A/P in December"],
  C4:["Deposits 'added' not matched","Income overstated / double-counted"],
  D1:["Withheld taxes not yet remitted","A payroll liability"],
  D2:["Who needs a 1099-NEC","Unincorporated contractor, services, non-card"],
  D3:["IRS 1099-NEC threshold","$600"],
  D4:["Sales tax collected not remitted","A liability owed to the state"],
  E1:["$5k earmarked for building fund","Revenue with donor restriction"],
  E2:["Designated offering when spent","Released from restriction"],
  E3:["Program/Mgmt/Fundraising split","Statement of Functional Expenses"],
  E4:["Clergy housing allowance","Excl. from income wages; subject to SECA"],
  E5:["Benevolence pass-through","Record in & out as tracked pass-through"],
  F1:["Bank rec exercise","Yes — adjusted bank = $9,000 = books"],
  F2:["P&L gross-profit error","GP should be $30,000 (subtract, not add)"],
  G1:["Client wants personal expense hidden","Decline; refer to their CPA"],
  G2:["Unresolved $3k, deadline tomorrow","Flag to manager; don't plug/hide"],
  G3:["15 txns in Ask My Accountant","Review, recategorize, targeted client Qs"],
  G4:["Client asks a Q + wants pricing","Answer; acknowledge upsell; no price quote"]
};
var WRITTEN_LABEL = {
  W1:"Client email — upset church treasurer, late financials",
  W2:"Troubleshooting — $1,240 reconciliation difference",
  W3:"Their review / QC process"
};
var SECTION_ORDER = ["A","B","C","D","E","F","G"];

function bar(pct){
  var filled = Math.round(pct/10);
  if(filled<0)filled=0; if(filled>10)filled=10;
  return "█".repeat(filled) + "░".repeat(10-filled);
}
function clip(s, n){
  s = String(s || "");
  if(s.length<=n) return s;
  return s.slice(0,n) + " …[truncated]";
}

export async function onRequestPost({ request, env }) {
  var data;
  try { data = await request.json(); }
  catch (e) { return json({ ok:false, error:"bad json" }, 400); }

  var name  = clip((data && data.name)  || "Unknown candidate", 120);
  var email = clip((data && data.email) || "", 160);
  var answers = (data && data.answers && typeof data.answers === "object") ? data.answers : {};
  var written = (data && data.written && typeof data.written === "object") ? data.written : {};
  var elapsed = parseInt((data && data.elapsedSec) || 0, 10) || 0;
  var honor = !!(data && data.honor);

  // ---- score ----
  var perSec = {}; SECTION_ORDER.forEach(function(s){ perSec[s] = {c:0,t:0}; });
  var correct = 0, total = 0, missed = [];
  Object.keys(KEY).forEach(function(id){
    var sec = id.charAt(0);
    perSec[sec].t++; total++;
    var chosen = answers[id];
    if(chosen === KEY[id]){ correct++; perSec[sec].c++; }
    else {
      missed.push({ id:id, chose:(chosen||"—"),
        label:(META[id]?META[id][0]:id), correctText:(META[id]?META[id][1]:KEY[id]) });
    }
  });
  var pct = total ? Math.round(correct/total*100) : 0;

  var band, emoji;
  if(pct>=85){ band="STRONG — solid technical foundation"; emoji=":large_green_circle:"; }
  else if(pct>=70){ band="SOLID — coachable, minor gaps"; emoji=":large_yellow_circle:"; }
  else if(pct>=55){ band="DEVELOPING — notable gaps to probe"; emoji=":large_orange_circle:"; }
  else { band="BELOW BAR for this seat"; emoji=":red_circle:"; }

  // role-differentiator watch flags (church accounting + judgment)
  var flags = [];
  var ePct = perSec.E.t ? Math.round(perSec.E.c/perSec.E.t*100) : 100;
  var gPct = perSec.G.t ? Math.round(perSec.G.c/perSec.G.t*100) : 100;
  if(ePct < 60) flags.push("⚠️ Weak on *church / nonprofit* accounting — that's most of our book.");
  if(gPct < 60) flags.push("⚠️ Weak on *judgment / client handling* — the client-facing core of the seat.");
  if(!honor) flags.push("⚠️ Did not check the honesty statement.");

  var mm = Math.floor(elapsed/60), ss = elapsed%60;
  var timeStr = mm + "m " + (ss<10?"0":"") + ss + "s";

  // ---- build Slack text (mrkdwn) ----
  var L = [];
  L.push(":clipboard: *Accounting Manager assessment — new submission*");
  L.push("*" + name + "*  ·  " + (email||"no email") + "  ·  took " + timeStr);
  L.push("");
  L.push(emoji + "  *Score: " + correct + "/" + total + "  (" + pct + "%)*  —  " + band);
  L.push("");
  L.push("*By section*");
  SECTION_ORDER.forEach(function(s){
    var p = perSec[s], sp = p.t ? Math.round(p.c/p.t*100) : 0;
    L.push("`" + bar(sp) + "` " + p.c + "/" + p.t + "  " + SECTION_NAME[s]);
  });
  if(flags.length){ L.push(""); L.push(flags.join("\n")); }

  if(missed.length){
    L.push("");
    L.push("*Missed (" + missed.length + ")*");
    missed.forEach(function(m){
      L.push("• `" + m.id + "` " + m.label + " — chose *" + m.chose + "*; correct: " + m.correctText);
    });
  } else {
    L.push(""); L.push(":tada: *Perfect score on the objective section.*");
  }

  // written responses (Ricky grades these)
  L.push("");
  L.push("─────────  *Written responses (you grade)*  ─────────");
  ["W1","W2","W3"].forEach(function(w){
    L.push("");
    L.push("*" + w + " — " + WRITTEN_LABEL[w] + "*");
    var ans = clip(written[w] || "(left blank)", 1100);
    L.push(">>> " + ans.replace(/\n/g, "\n"));
  });

  var text = L.join("\n");

  var token = env.SLACK_BOT_TOKEN;
  var channel = env.ASSESSMENT_CHANNEL || env.SLACK_CHANNEL_ASSISTANTBOT || "C0AQVEW4KK8";
  if(!token){ return json({ ok:false, error:"not configured" }, 500); }

  var sd;
  try {
    var r = await fetch("https://slack.com/api/chat.postMessage", {
      method:"POST",
      headers:{ "Content-Type":"application/json; charset=utf-8", Authorization:"Bearer "+token },
      body: JSON.stringify({ channel:channel, text:text, unfurl_links:false, unfurl_media:false }),
    });
    sd = await r.json();
  } catch(err){
    return json({ ok:false, error:"slack unreachable" }, 502);
  }
  if(!sd || !sd.ok) return json({ ok:false, error:(sd && sd.error) || "slack error" }, 502);

  return json({ ok:true });
}

// Friendly GET so hitting the endpoint in a browser doesn't 405 confusingly.
export async function onRequestGet() {
  return json({ ok:true, service:"accounting-assessment", method:"POST to submit" });
}
