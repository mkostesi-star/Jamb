// Yamb Café: opens a Polar checkout for Plus, for the signed-in player who asks.
// Supabase → Edge Functions → polar-checkout. Turn OFF "Verify JWT" for it: this function checks the player itself.
// Secrets it reads (Edge Functions → Secrets): POLAR_ACCESS_TOKEN, and later for real sales POLAR_SERVER=production
// and POLAR_PRODUCT_ID=<the real shop's product>. Until then it uses Polar's test shop.

const SANDBOX_PRODUCT = "a3309610-f502-4d25-94b7-65041f5bc4c6";
const env = (k: string) => (globalThis as any).Deno.env.get(k) ?? "";
const LIVE = env("POLAR_SERVER") === "production";
const API = LIVE ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";
const PRODUCT = env("POLAR_PRODUCT_ID") || SANDBOX_PRODUCT;
const SITES = ["https://yambcafe.com", "https://www.yambcafe.com"];
const okOrigin = (o: string) => SITES.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
const LANGS = ["en", "hr", "sr", "bs", "sl", "de"];

function publishableKey(): string {
  try { const k = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") || "{}"); if (k.default) return k.default; } catch (_) { /* older projects */ }
  return env("SUPABASE_ANON_KEY");
}

function reply(body: unknown, status: number, origin: string): Response {
  const h: Record<string, string> = { "Content-Type": "application/json", "Vary": "Origin" };
  if (okOrigin(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  return new Response(body == null ? null : JSON.stringify(body), { status, headers: h });
}

export async function handle(req: Request): Promise<Response> {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return reply(null, 204, origin);
  if (req.method !== "POST") return reply({ error: "method" }, 405, origin);
  if (origin && !okOrigin(origin)) return reply({ error: "origin" }, 403, origin);

  // who is asking: the player's own sign-in, checked with Supabase
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/.test(auth)) return reply({ error: "signin" }, 401, origin);
  const who = await fetch(env("SUPABASE_URL") + "/auth/v1/user", { headers: { Authorization: auth, apikey: publishableKey() } });
  if (!who.ok) return reply({ error: "signin" }, 401, origin);
  const user = await who.json();
  if (!user || !user.id) return reply({ error: "signin" }, 401, origin);

  let body: any = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  // the amount the player chose, in cents: from €4.99 up to €100
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 499 || amount > 10000) return reply({ error: "amount" }, 400, origin);
  const lang = LANGS.includes(body.lang) ? body.lang : "en";
  const site = okOrigin(origin) ? origin : SITES[0];

  const r = await fetch(API + "/v1/checkouts/", {
    method: "POST",
    headers: { Authorization: "Bearer " + env("POLAR_ACCESS_TOKEN"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      products: [PRODUCT],
      amount,
      external_customer_id: user.id,
      customer_email: user.email || undefined,
      metadata: { user_id: user.id },
      success_url: site + "/?plus=done&checkout_id={CHECKOUT_ID}",
      return_url: site + "/?plus=back",
      allow_discount_codes: true,
      locale: lang,
    }),
  });
  if (!r.ok) {
    console.error("polar checkout", r.status, (await r.text()).slice(0, 500));
    return reply({ error: "polar" }, 502, origin);
  }
  const c = await r.json();
  return reply({ url: c.url, test: !LIVE }, 200, origin);
}

(globalThis as any).Deno?.serve?.(handle);
