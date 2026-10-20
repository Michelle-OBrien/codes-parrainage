// /go/<id> : enregistre le clic (sans IP) dans Supabase, puis redirige vers le lien de parrainage.
import fs from "node:fs";
import path from "node:path";

const read = (f) => JSON.parse(fs.readFileSync(path.join(process.cwd(), f), "utf8"));
const offers = read("data/offers.json");
const { tracking } = read("site.config.json");
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|curl|wget|python|headless|monitor|fetch/i;

export default async function handler(req, res) {
  const q = new URL(req.url, "https://local");
  const id = q.searchParams.get("id") || "";
  const offer = offers.find((o) => o.id === id && o.active !== false);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (!offer) {
    res.statusCode = 302;
    res.setHeader("Location", "/");
    return res.end();
  }

  const ua = String(req.headers["user-agent"] || "").slice(0, 300);
  let referer = "";
  try { referer = new URL(req.headers.referer).host.slice(0, 200); } catch {}
  const row = {
    offer_id: offer.id,
    src: (q.searchParams.get("src") || "direct").slice(0, 16),
    lang: (q.searchParams.get("lang") || "").slice(0, 8),
    country: String(req.headers["x-vercel-ip-country"] || "").slice(0, 8),
    referer,
    ua,
    is_bot: BOT.test(ua),
  };
  try {
    await fetch(`${tracking.supabaseUrl}/rest/v1/clicks`, {
      method: "POST",
      headers: { apikey: tracking.publishableKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // le suivi ne doit jamais bloquer la redirection
  }
  res.statusCode = 302;
  res.setHeader("Location", offer.url);
  res.end();
}
