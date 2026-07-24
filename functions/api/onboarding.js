/**
 * /api/onboarding — shared persistence for Turnkey CFO onboarding checklist drafts.
 *
 * Canonical source lives here (engagement-letter-builder/functions/onboarding.js);
 * the deployed copy is committed to TurnkeyCFO/cfo-site at
 * functions/api/onboarding.js (Cloudflare Pages Function). Backed by the KV
 * namespace bound as ONBOARDING_KV on the cfo-site Pages project
 * (namespace: cfo-onboarding-state).
 *
 * Contract (used by templates/checklist_template.html):
 *   GET  /api/onboarding?key=<storage_key>
 *        -> 200 {"state": {...}, "updatedAt": "..."} | 200 {"state": null}
 *   POST /api/onboarding   body: {"key": "<storage_key>", "state": {...}}
 *        -> 200 {"ok": true, "updatedAt": "..."}
 *
 * Keys are the checklist storage keys, e.g. "cornerstone-church-atx-onboarding-v1".
 * Last-write-wins; the client merges remote/local by updatedAt before saving.
 * No auth by design — the checklist is a link-shared internal draft and the
 * state holds no secrets/PII beyond names typed into role fields.
 */
const KEY_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;
const MAX_BYTES = 256 * 1024; // generous for checks + roles + notes

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function bad(status, msg) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: JSON_HEADERS,
  });
}

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!KEY_RE.test(key)) return bad(400, "bad key");
  const raw = await env.ONBOARDING_KV.get("state:" + key);
  if (!raw) {
    return new Response(JSON.stringify({ state: null }), { headers: JSON_HEADERS });
  }
  return new Response(raw, { headers: JSON_HEADERS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) return bad(413, "too large");
    body = JSON.parse(text);
  } catch (e) {
    return bad(400, "bad json");
  }
  const key = body && body.key;
  const state = body && body.state;
  if (typeof key !== "string" || !KEY_RE.test(key)) return bad(400, "bad key");
  if (!state || typeof state !== "object" || Array.isArray(state)) return bad(400, "bad state");
  const updatedAt = new Date().toISOString();
  const record = JSON.stringify({ state, updatedAt });
  if (record.length > MAX_BYTES) return bad(413, "too large");
  await env.ONBOARDING_KV.put("state:" + key, record);
  return new Response(JSON.stringify({ ok: true, updatedAt }), { headers: JSON_HEADERS });
}
