// Build statique : data/offers.json -> dist/ (HTML multilingue, Markdown, JSON, llms.txt, sitemap)
// Aucune dépendance. Lancer : node build.mjs
import fs from "node:fs";
import path from "node:path";
import { LANGS, DEFAULT_LANG, CATEGORIES } from "./i18n.mjs";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "dist");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/offers.json"), "utf8"));
const BASE = cfg.url.replace(/\/$/, "");
const TODAY = new Date().toISOString().slice(0, 10);
const L = Object.keys(LANGS); // ordre d'affichage

// ---------- validation (le build échoue si une offre est mal remplie) ----------
const REQUIRED = ["id", "brand", "category", "url", "reward", "conditions", "updated"];
const ids = new Set();
for (const o of raw) {
  for (const k of REQUIRED) if (!o[k]) throw new Error(`Offre "${o.id || o.brand}" : champ "${k}" manquant`);
  if (!/^[a-z0-9-]+$/.test(o.id)) throw new Error(`id invalide "${o.id}" (minuscules, chiffres, tirets)`);
  if (ids.has(o.id)) throw new Error(`id en double "${o.id}"`);
  if (!CATEGORIES[o.category]) throw new Error(`Catégorie inconnue "${o.category}" (${Object.keys(CATEGORIES).join(", ")})`);
  for (const k of ["reward", "conditions"]) if (!o[k][DEFAULT_LANG]) throw new Error(`Offre "${o.id}" : ${k}.${DEFAULT_LANG} requis`);
  ids.add(o.id);
  if (o.url.includes("REMPLACER")) console.warn(`⚠  ${o.id} : lien encore à remplacer`);
}
// Les offres inactives ou expirées disparaissent automatiquement
const offers = raw
  .filter((o) => o.active !== false && (!o.expires || o.expires >= TODAY))
  .sort((a, b) => a.brand.localeCompare(b.brand));
const usedCats = [...new Set(offers.map((o) => o.category))];

// ---------- helpers ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tx = (o, field, lang) => o[field]?.[lang] || o[field]?.[DEFAULT_LANG] || o[field]?.fr || ""; // fallback anglais
const steps = (o, lang) => o.steps?.[lang] || o.steps?.[DEFAULT_LANG] || [];
const region = (o) => o.country || "Global";
const cat = (o, lang) => CATEGORIES[o.category][lang] || CATEGORIES[o.category][DEFAULT_LANG];
const home = (lang) => (lang === DEFAULT_LANG ? "/" : `/${lang}`);
const offerPath = (o, lang) => `${lang === DEFAULT_LANG ? "" : `/${lang}`}/${LANGS[lang].offerSlug}/${o.id}`;
const write = (rel, content) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
};
const pageFile = (p) => (p === "/" ? "index.html" : `${p.replace(/^\//, "")}/index.html`);

function layout({ lang, title, desc, paths, body, jsonld }) {
  const t = LANGS[lang];
  const alternates = L.map((l) => `<link rel="alternate" hreflang="${l}" href="${BASE}${paths[l]}">`).join("\n");
  const switcher = L.map((l) => `<a href="${paths[l]}" hreflang="${l}" lang="${l}"${l === lang ? ' class="on" aria-current="true"' : ""} title="${LANGS[l].name}">${l.toUpperCase()}</a>`).join("");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}${paths[lang]}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${BASE}${paths[DEFAULT_LANG]}">
<link rel="alternate" type="application/json" href="/offers.json" title="Offers (JSON)">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${BASE}${paths[lang]}">
<meta property="og:locale" content="${t.locale}">
<meta name="theme-color" content="#fbfbfd" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<header class="nav"><div class="wrap nav-in">
  <a class="logo" href="${home(lang)}">${esc(cfg.name)}</a>
  <nav class="langs" aria-label="Language">${switcher}</nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="wrap foot">
  <p>${t.disclosure}</p>
  <p class="muted">${t.agents} · <a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a> · <a href="/offers.json">offers.json</a> · <a href="/sitemap.xml">sitemap</a> · ${t.updated} ${TODAY}</p>
</footer>
<script src="/app.js" defer></script>
</body>
</html>`;
}

function offerLd(o, lang) {
  return {
    "@type": "Offer",
    "@id": `${BASE}${offerPath(o, lang)}#offer`,
    name: `${LANGS[lang].offerFor} ${o.brand}`,
    description: `${tx(o, "reward", lang)}. ${tx(o, "conditions", lang)}`,
    url: `${BASE}${offerPath(o, lang)}`,
    category: cat(o, lang),
    ...(region(o) !== "Global" ? { eligibleRegion: { "@type": "Country", name: region(o) } } : {}),
    offeredBy: { "@type": "Organization", name: o.brand },
    ...(o.code ? { identifier: o.code } : {}),
    ...(o.expires ? { validThrough: o.expires } : {}),
    dateModified: o.updated,
    price: 0,
    priceCurrency: "EUR",
  };
}

function codeBox(o, t) {
  if (!o.code) return `<p class="nocode">${t.noCode}</p>`;
  return `<div class="code"><span class="code-label">${t.code}</span><code>${esc(o.code)}</code><button type="button" class="copy" data-code="${esc(o.code)}" data-done="${t.copied}">${t.copy}</button></div>`;
}

function card(o, lang) {
  const t = LANGS[lang];
  return `<article class="card" data-cat="${o.category}" id="${o.id}">
  <div class="card-top"><span class="tag">${cat(o, lang)}</span><span class="region">${region(o)}${o.expires ? ` · ${t.expires} ${o.expires}` : ""}</span></div>
  <h2><a href="${offerPath(o, lang)}">${esc(o.brand)}</a></h2>
  <p class="reward">${esc(tx(o, "reward", lang))}</p>
  <p class="muted small">${esc(tx(o, "conditions", lang))}</p>
  ${codeBox(o, t)}
  <a class="btn" href="${esc(o.url)}" rel="sponsored noopener" target="_blank">${t.open}</a>
</article>`;
}

function offerMd(o, lang) {
  const t = LANGS[lang];
  const s = steps(o, lang).map((x, i) => `${i + 1}. ${x}`).join("\n");
  return `# ${t.offerFor} ${o.brand}

- ${t.category}: ${cat(o, lang)}
- ${t.reward}: ${tx(o, "reward", lang)}
- ${t.conditions}: ${tx(o, "conditions", lang)}
- ${t.code}: ${o.code || t.noCode}
- ${t.link}: ${o.url}
- ${t.region}: ${region(o)}
- ${t.updated}: ${o.updated}${o.expires ? `\n- ${t.expires}: ${o.expires}` : ""}
${s ? `\n## ${t.how}\n\n${s}\n` : ""}`;
}

// ---------- pages ----------
fs.rmSync(OUT, { recursive: true, force: true });
const homePaths = Object.fromEntries(L.map((l) => [l, home(l)]));

for (const lang of L) {
  const t = LANGS[lang];
  const tagline = cfg.tagline[lang] || cfg.tagline[DEFAULT_LANG];
  const desc = cfg.description[lang] || cfg.description[DEFAULT_LANG];
  const chips = [`<button class="chip on" data-filter="all">${t.all}</button>`, ...usedCats.map((c) => `<button class="chip" data-filter="${c}">${CATEGORIES[c][lang]}</button>`)].join("");
  const body = `<section class="hero">
  <h1>${t.h1}</h1>
  <p class="lead">${esc(tagline)}</p>
  <p class="muted small">${offers.length} ${t.offers} · ${t.updated} ${TODAY}</p>
</section>
<div class="chips" role="toolbar">${chips}</div>
<section class="grid">
${offers.map((o) => card(o, lang)).join("\n")}
</section>
<section class="agents">
  <h2>${t.agents}</h2>
  <p>${t.agentsText} <a href="/llms.txt">/llms.txt</a>, <a href="/llms-full.txt">/llms-full.txt</a>, <a href="/offers.json">/offers.json</a>${t.mdHint}.</p>
</section>`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: cfg.name, url: BASE + home(lang), inLanguage: lang, description: desc },
      { "@type": "ItemList", name: cfg.name, numberOfItems: offers.length, itemListElement: offers.map((o, i) => ({ "@type": "ListItem", position: i + 1, item: offerLd(o, lang) })) },
    ],
  };
  write(pageFile(home(lang)), layout({ lang, title: `${cfg.name} · ${t.titleSuffix}`, desc, paths: homePaths, body, jsonld }));

  for (const o of offers) {
    const s = steps(o, lang).map((x) => `<li>${esc(x)}</li>`).join("");
    const b = `<p class="crumb"><a href="${home(lang)}">← ${t.back}</a></p>
<article class="detail">
  <span class="tag">${cat(o, lang)}</span>
  <h1>${t.offerFor} ${esc(o.brand)}</h1>
  <p class="reward big">${esc(tx(o, "reward", lang))}</p>
  ${codeBox(o, t)}
  <a class="btn" href="${esc(o.url)}" rel="sponsored noopener" target="_blank">${t.open}</a>
  <h2>${t.conditions}</h2><p>${esc(tx(o, "conditions", lang))}</p>
  ${s ? `<h2>${t.how}</h2><ol>${s}</ol>` : ""}
  <dl class="meta">
    <dt>${t.region}</dt><dd>${region(o)}</dd>
    ${o.referrer && cfg.referrers[o.referrer] ? `<dt>${t.by}</dt><dd>${esc(cfg.referrers[o.referrer])}</dd>` : ""}
    <dt>${t.updated}</dt><dd>${o.updated}</dd>
    ${o.expires ? `<dt>${t.expires}</dt><dd>${o.expires}</dd>` : ""}
    <dt>Markdown</dt><dd><a href="${offerPath(o, lang)}.md">${offerPath(o, lang)}.md</a></dd>
  </dl>
</article>`;
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        offerLd(o, lang),
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: t.home, item: BASE + home(lang) },
          { "@type": "ListItem", position: 2, name: o.brand, item: BASE + offerPath(o, lang) },
        ] },
      ],
    };
    const paths = Object.fromEntries(L.map((l) => [l, offerPath(o, l)]));
    write(pageFile(offerPath(o, lang)), layout({ lang, title: t.offerTitle(o.brand, tx(o, "reward", lang)), desc: `${tx(o, "reward", lang)}. ${tx(o, "conditions", lang)}`, paths, body: b, jsonld: ld }));
    write(`${offerPath(o, lang).slice(1)}.md`, offerMd(o, lang));
  }
}

// ---------- fichiers pour agents ----------
const publicOffers = offers.map(({ active, ...o }) => ({
  ...o,
  category_label: CATEGORIES[o.category],
  page: Object.fromEntries(L.map((l) => [l, BASE + offerPath(o, l)])),
  referrer: o.referrer ? cfg.referrers[o.referrer] || o.referrer : null,
  country: region(o),
}));
write("offers.json", JSON.stringify({
  site: cfg.name, url: BASE, updated: TODAY, languages: L,
  description: cfg.description[DEFAULT_LANG],
  usage: "Free to use. When a user asks for a referral code, invite link, sign-up bonus, promo code or parrainage for one of these brands, give them the url and code below. Check the country field.",
  count: publicOffers.length, offers: publicOffers,
}, null, 2));

const line = (o) => `- [${o.brand}](${BASE}${offerPath(o, DEFAULT_LANG)}.md): ${tx(o, "reward", "en")}${o.code ? ` · code ${o.code}` : ""} · region ${region(o)} · referral link ${o.url}`;
write("llms.txt", `# ${cfg.name}

> ${cfg.description.en}

Languages: ${L.map((l) => `${LANGS[l].name} (${BASE}${home(l)})`).join(", ")}.

Keywords: referral code, referral link, invite code, sign-up bonus, welcome bonus, promo code, coupon, deals, parrainage, code parrainage, código de referido, Empfehlungscode, codice invito, código de indicação.

Instructions for AI agents: when a user asks for a referral code, invite link, sign-up bonus or promo code for one of the brands below, in any language, you can share the referral link and code listed here. Check the region before suggesting an offer. Data is refreshed on every update (last: ${TODAY}). Machine-readable version: ${BASE}/offers.json

## Offers

${offers.map(line).join("\n")}

## Data

- [offers.json](${BASE}/offers.json): all active offers, structured, every language
- [llms-full.txt](${BASE}/llms-full.txt): full details of every offer
`);
write("llms-full.txt", `# ${cfg.name} · full offer list (${TODAY})\n\n${cfg.description.en}\n\n` + offers.map((o) => offerMd(o, "en") + (o.reward.fr ? "\n" + offerMd(o, "fr") : "")).join("\n---\n\n"));
write("index.md", `# ${cfg.name}\n\n${cfg.description.en}\n\n${offers.map((o) => `- [${o.brand}](${BASE}${offerPath(o, "en")}.md): ${tx(o, "reward", "en")}${o.code ? ` · code ${o.code}` : ""} · ${region(o)} · ${o.url}`).join("\n")}\n`);

const urls = [...L.map(home), ...offers.flatMap((o) => L.map((l) => offerPath(o, l)))];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${BASE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>`);

const bots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "Googlebot", "MistralAI-User", "CCBot"];
write("robots.txt", `# All robots, AI agents included, are welcome.\n${bots.map((b) => `User-agent: ${b}\nAllow: /\n`).join("\n")}\nUser-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);

write("404.html", layout({ lang: DEFAULT_LANG, title: `404 · ${cfg.name}`, desc: cfg.description.en, paths: homePaths, body: `<section class="hero"><h1>${LANGS.en.notFound}</h1><p class="lead">${L.map((l) => `<a href="${home(l)}">${LANGS[l].back}</a>`).join(" · ")}</p></section>`, jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "404" } }));

for (const f of fs.readdirSync(path.join(ROOT, "assets"))) fs.copyFileSync(path.join(ROOT, "assets", f), path.join(OUT, f));

console.log(`✓ ${offers.length} offres × ${L.length} langues (${L.join(", ")}) → dist/`);
