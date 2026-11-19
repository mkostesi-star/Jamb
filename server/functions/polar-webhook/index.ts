// Yamb Café: Polar tells us here when Plus is paid for or refunded.
// Supabase → Edge Functions → polar-webhook. Turn OFF "Verify JWT" for it: Polar signs each message instead, and
// this function checks that signature with POLAR_WEBHOOK_SECRET (Edge Functions → Secrets) before believing anything.
// In Polar: Settings → Webhooks → this function's address, format Raw, events order.paid and order.refunded.

const SANDBOX_PRODUCT = "a3309610-f502-4d25-94b7-65041f5bc4c6";
const env = (k: string) => (globalThis as any).Deno.env.get(k) ?? "";
const LIVE = env("POLAR_SERVER") === "production";
const PRODUCT = env("POLAR_PRODUCT_ID") || SANDBOX_PRODUCT;
const enc = new TextEncoder();

function b64(bytes: ArrayBuffer): string {
  let s = ""; const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
}
function unb64(s: string): Uint8Array | null {
  try { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  catch (_) { return null; }
}
async function hmac(key: Uint8Array, text: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", k, enc.encode(text)));
}
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Standard Webhooks: HMAC-SHA256 of "id.timestamp.body". Polar signs with the secret's own bytes; the standard reads the
// part after "whsec_" as base64. Either way of keying is accepted, so the check holds whichever Polar uses.
export async function verify(secret: string, id: string, ts: string, sig: string, body: string, now = Date.now()): Promise<boolean> {
  if (!secret || !id || !ts || !sig) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300) return false;
  const keys: Uint8Array[] = [enc.encode(secret)];
  const m = secret.match(/^(?:whsec_|polar_whs_)?(.+)$/);
  const raw = m ? unb64(m[1]) : null;
  if (raw && raw.length > 0) keys.push(raw);
  const given = sig.split(" ").map((p) => p.split(",")).filter((p) => p[0] === "v1" && p[1]).map((p) => p[1]);
  for (const k of keys) {
    const want = await hmac(k, `${id}.${Math.floor(t)}.${body}`);
    if (given.some((g) => same(g, want))) return true;
  }
  return false;
}

function secretKey(): string {
  try { const k = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); if (k.default) return k.default; } catch (_) { /* older projects */ }
  return env("SUPABASE_SERVICE_ROLE_KEY");
}

export async function handle(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const body = await req.text();
  const h = req.headers;
  const good = await verify(env("POLAR_WEBHOOK_SECRET"), h.get("webhook-id") ?? "", h.get("webhook-timestamp") ?? "", h.get("webhook-signature") ?? "", body);
  if (!good) return new Response("bad signature", { status: 403 });

  let ev: any;
  try { ev = JSON.parse(body); } catch (_) { return new Response("bad json", { status: 400 }); }
  const type = ev && ev.type;
  if (type !== "order.paid" && type !== "order.refunded" && type !== "order.updated") return new Response("ignored", { status: 202 });
  const o = ev.data || {};
  const product = o.product_id || (o.product && o.product.id);
  if (product !== PRODUCT) return new Response("other product", { status: 202 });
  if (type === "order.updated" && o.status !== "refunded" && o.status !== "partially_refunded") return new Response("ignored", { status: 202 });

  const key = secretKey();
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;   // the old service_role key is a JWT
  const r = await fetch(env("SUPABASE_URL") + "/rest/v1/rpc/yamb_order", {
    method: "POST", headers, body: JSON.stringify({ p_order: o, p_env: LIVE ? "live" : "sandbox" }),
  });
  if (!r.ok) {
    console.error("yamb_order", r.status, (await r.text()).slice(0, 500));
    return new Response("database", { status: 500 });   // Polar tries again later
  }
  const out = await r.json();
  console.log(type, o.id, JSON.stringify(out));
  return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
}

(globalThis as any).Deno?.serve?.(handle);
