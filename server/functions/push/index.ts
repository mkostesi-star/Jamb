// Yamb Café: notifications (web push).
// Every minute the database checks whether anything is due (yamb.push_kick, run by pg_cron) and only then calls this
// function. It asks the database for the messages (push_due hands each one over once), sends them to the phones' push
// services, and reports the addresses that are gone (push_result). The game asks it for the public key (GET) when a
// player switches notifications on.
// Supabase → Edge Functions → push. Turn OFF "Verify JWT" for it: the database calls it without a sign-in. Nothing can
// be sent through it from outside: it only ever sends what the database itself has marked as due.
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC and VAPID_PRIVATE, the pair of keys that shows the push services the
// messages come from Yamb Café. Opened in a browser before they are set, this function's address shows a freshly made
// pair to copy there. The private one goes nowhere else.

const env = (k: string) => (globalThis as any).Deno?.env.get(k) ?? "";
const enc = new TextEncoder();
const SUBJECT = "https://yambcafe.com";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

export function b64u(a: Uint8Array): string {
  let s = ""; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64u(s: string): Uint8Array {
  const t = String(s || "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0; for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

// a new pair of VAPID keys: the public key as the browser wants it (65 bytes, base64url), the private one as its 32 bytes
export async function newKeys(): Promise<{ VAPID_PUBLIC: string; VAPID_PRIVATE: string }> {
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", k.privateKey);
  return { VAPID_PUBLIC: b64u(pub), VAPID_PRIVATE: String(jwk.d) };
}
export function signingKey(pub: string, priv: string): Promise<CryptoKey> {
  const p = unb64u(pub);
  if (p.length !== 65 || p[0] !== 4) throw new Error("VAPID_PUBLIC is not a P-256 public key");
  return crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), d: priv.trim(), ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
// RFC 8292: a short signed note, for this push service only, valid 12 hours
export async function vapidHeader(endpoint: string, pub: string, key: CryptoKey, now = Date.now()): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + claims)));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${pub}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bytes * 8));
}
// RFC 8291 (aes128gcm): the message is locked so that only the browser that switched notifications on can read it
export async function encrypt(p256dh: string, authSecret: string, text: string, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const ua = unb64u(p256dh), auth = unb64u(authSecret);
  if (ua.length !== 65 || ua[0] !== 4 || auth.length < 16) throw new Error("bad subscription keys");
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as any, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), ua, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(enc.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21 + asPub.length);
  head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPub.length; head.set(asPub, 21);
  return concat(head, ct);
}

// ---------------------------------------------------------------- the words, in the game's six languages
const T: Record<string, Record<string, string>> = {
  en: { dailyT: "Today's Daily Yamb is ready", dailyB: "Today's dice are on the table, the same for everyone.", dailyS: "{days} in a row. Today's dice are on the table.",
        duelT: "Your duel result is in", duelsT: "Duel results ({n})", duelB: "{name} {s} · you {m}.", won: "You win the duel.", lost: "{name} takes this one.",
        draw: "It's a draw.", friend: "A friend", testT: "Yamb Café", testB: "Notifications work. See you at the table!" },
  hr: { dailyT: "Dnevni Jamb te čeka", dailyB: "Današnje kocke su na stolu, iste za sve.", dailyS: "{days} zaredom. Današnje kocke su na stolu.",
        duelT: "Stigao je rezultat dvoboja", duelsT: "Rezultati dvoboja ({n})", duelB: "{name} {s} · ti {m}.", won: "Dvoboj je tvoj.", lost: "Ovaj put pobjeđuje {name}.",
        draw: "Neriješeno.", friend: "Prijatelj", testT: "Yamb Café", testB: "Obavijesti rade. Vidimo se za stolom!" },
  sr: { dailyT: "Dnevni Jamb te čeka", dailyB: "Današnje kocke su na stolu, iste za sve.", dailyS: "{days} zaredom. Današnje kocke su na stolu.",
        duelT: "Stigao je rezultat duela", duelsT: "Rezultati duela ({n})", duelB: "{name} {s} · ti {m}.", won: "Duel je tvoj.", lost: "Ovaj put pobeđuje {name}.",
        draw: "Nerešeno.", friend: "Prijatelj", testT: "Yamb Café", testB: "Obaveštenja rade. Vidimo se za stolom!" },
  bs: { dailyT: "Dnevni Jamb te čeka", dailyB: "Današnje kocke su na stolu, iste za sve.", dailyS: "{days} zaredom. Današnje kocke su na stolu.",
        duelT: "Stigao je rezultat duela", duelsT: "Rezultati duela ({n})", duelB: "{name} {s} · ti {m}.", won: "Duel je tvoj.", lost: "Ovaj put pobjeđuje {name}.",
        draw: "Neriješeno.", friend: "Prijatelj", testT: "Yamb Café", testB: "Obavještenja rade. Vidimo se za stolom!" },
  sl: { dailyT: "Dnevni Jamb te čaka", dailyB: "Današnje kocke so na mizi, enake za vse.", dailyS: "{days} zapored. Današnje kocke so na mizi.",
        duelT: "Prišel je rezultat dvoboja", duelsT: "Rezultati dvobojev ({n})", duelB: "{name} {s} · ti {m}.", won: "Dvoboj je tvoj.", lost: "Tokrat zmaga {name}.",
        draw: "Neodločeno.", friend: "Prijatelj", testT: "Yamb Café", testB: "Obvestila delujejo. Se vidimo za mizo!" },
  de: { dailyT: "Dein Tages-Yamb wartet", dailyB: "Die Würfel von heute liegen auf dem Tisch, für alle dieselben.", dailyS: "{days} in Folge. Die Würfel von heute liegen bereit.",
        duelT: "Dein Duell-Ergebnis ist da", duelsT: "Duell-Ergebnisse ({n})", duelB: "{name} {s} · du {m}.", won: "Du gewinnst das Duell.", lost: "Diesmal gewinnt {name}.",
        draw: "Unentschieden.", friend: "Jemand", testT: "Yamb Café", testB: "Benachrichtigungen funktionieren. Bis gleich am Tisch!" },
};
export function days(lang: string, n: number): string {
  const a = n % 10, b = n % 100;
  if (lang === "hr" || lang === "sr" || lang === "bs") return n + (a === 1 && b !== 11 ? " dan" : " dana");
  if (lang === "sl") return n + (b === 1 ? " dan" : b === 2 ? " dneva" : b === 3 || b === 4 ? " dnevi" : " dni");
  if (lang === "de") return n + (n === 1 ? " Tag" : " Tage");
  return n + (n === 1 ? " day" : " days");
}
const fill = (s: string, v: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
export function message(x: any): { title: string; body: string; url: string; tag: string } {
  const L = T[x.lang] || T.en;
  if (x.kind === "daily") return { title: L.dailyT, body: x.streak >= 2 ? fill(L.dailyS, { days: days(x.lang, x.streak) }) : L.dailyB, url: "/?d=daily", tag: "daily" };
  if (x.kind === "duel") {
    const name = String(x.name || "").trim() || L.friend, s = Number(x.score) || 0, m = Number(x.mine) || 0;
    const end = m > s ? L.won : m < s ? fill(L.lost, { name }) : L.draw;
    return { title: x.n > 1 ? fill(L.duelsT, { n: x.n }) : L.duelT, body: fill(L.duelB, { name, s, m }) + " " + end, url: "/?d=duels", tag: "duel" };
  }
  return { title: L.testT, body: L.testB, url: "/", tag: "test" };
}
// how long a push service keeps trying a phone that is off: a reminder is stale after a few hours, a duel result is not
const TTL: Record<string, number> = { daily: 4 * 3600, duel: 2 * 86400, test: 600 };

export async function sendOne(x: any, pub: string, key: CryptoKey): Promise<"ok" | "gone" | "failed"> {
  try {
    const body = await encrypt(x.p256dh, x.auth, JSON.stringify(message(x)));
    const r = await fetch(x.endpoint, { method: "POST", body, headers: {
      Authorization: await vapidHeader(x.endpoint, pub, key), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
      TTL: String(TTL[x.kind] ?? 3600), Urgency: x.kind === "test" ? "high" : "normal", Topic: String(x.kind || "yamb"),
    } });
    try { await r.arrayBuffer(); } catch (_) { /* nothing to read */ }
    if (r.status === 404 || r.status === 410) return "gone";
    if (!r.ok) console.warn("push", new URL(x.endpoint).host, r.status);
    return r.ok ? "ok" : "failed";
  } catch (e) {
    console.warn("push", String(e));
    return "failed";
  }
}

function secretKey(): string {
  try { const k = JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}"); if (k.default) return k.default; } catch (_) { /* older projects */ }
  return env("SUPABASE_SERVICE_ROLE_KEY");
}
function db(fn: string, args: unknown): Promise<Response> {
  const key = secretKey();
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;   // the old service_role key is a JWT
  return fetch(env("SUPABASE_URL") + "/rest/v1/rpc/" + fn, { method: "POST", headers, body: JSON.stringify(args) });
}
const json = (o: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...CORS, ...extra } });

export async function handle(req: Request): Promise<Response> {
  const pub = env("VAPID_PUBLIC").trim(), priv = env("VAPID_PRIVATE").trim();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") {
    if (!pub || !priv) return json({ setup: "Notifications are not set up yet. Copy these two into Edge Functions → Secrets, with exactly these names. Keep the private one there only.", ...(await newKeys()) }, 200, { "Cache-Control": "no-store" });
    return json({ key: pub }, 200, { "Cache-Control": "public, max-age=3600" });
  }
  if (req.method !== "POST") return new Response("method", { status: 405, headers: CORS });
  if (!pub || !priv) return json({ error: "VAPID keys missing" }, 503);
  let key: CryptoKey;
  try { key = await signingKey(pub, priv); } catch (e) { console.error("VAPID", String(e)); return json({ error: "VAPID keys do not fit" }, 500); }
  const r = await db("push_due", {});
  if (!r.ok) { console.error("push_due", r.status, (await r.text()).slice(0, 300)); return json({ error: "database" }, 500); }
  const list: any[] = await r.json();
  const out: Record<"ok" | "gone" | "failed", string[]> = { ok: [], gone: [], failed: [] };
  for (let i = 0; i < list.length; i += 8) {   // eight at a time
    const part = list.slice(i, i + 8);
    const res = await Promise.all(part.map((x) => sendOne(x, pub, key)));
    res.forEach((v, j) => out[v].push(part[j].endpoint));
  }
  if (list.length) {
    const w = await db("push_result", { p: out });
    if (!w.ok) console.error("push_result", w.status);
    else await w.arrayBuffer();
  }
  console.log("push", JSON.stringify({ due: list.length, sent: out.ok.length, gone: out.gone.length, failed: out.failed.length }));
  return json({ due: list.length, sent: out.ok.length, gone: out.gone.length, failed: out.failed.length });
}

(globalThis as any).Deno?.serve?.(handle);
