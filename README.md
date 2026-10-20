# Deals & Referrals (dealsandreferrals.com)

Site statique de liens de parrainage, codes promo et bons plans, pensé d'abord pour les agents IA (ChatGPT, Claude, Perplexity…). Anglais en principal (`/`), français sur `/fr`.

## Le système (une seule source de vérité)

Tu ne touches qu'à **`data/offers.json`**. Au push sur GitHub, Vercel relance le build et tout se régénère :

| Fichier généré | À quoi il sert |
|---|---|
| `/` et `/fr` | Pages humaines (EN / FR) |
| `/offer/<id>` et `/fr/offre/<id>` | Une page par offre (bien indexée) |
| `/offer/<id>.md` | La même offre en Markdown, lu directement par les agents |
| `/llms.txt`, `/llms-full.txt` | Le "sommaire pour IA", standard que les agents consultent |
| `/offers.json` | API publique structurée (CORS ouvert) |
| `/sitemap.xml`, `/robots.txt` | Indexation ; tous les robots IA autorisés |
| JSON-LD schema.org `Offer` | Données structurées dans chaque page |

Règles automatiques : une offre `"active": false` ou dont `expires` est passée disparaît du site. Le build échoue si un champ obligatoire manque (pas de page cassée en ligne).

## Ajouter une offre

Copie un bloc dans `data/offers.json` :

```json
{
  "id": "fortuneo",                     // minuscules + tirets, devient l'URL
  "brand": "Fortuneo",
  "category": "banque",                 // banque, neobanque, investissement, crypto, energie, telecom, shopping, coupon, transport, autre
  "referrer": "michelle",               // ou "jean" (noms dans site.config.json)
  "url": "https://ton-lien-de-parrainage",
  "code": "ABC123",                     // "" si lien direct
  "reward": { "fr": "...", "en": "..." },
  "conditions": { "fr": "...", "en": "..." },
  "steps": { "fr": ["..."], "en": ["..."] },
  "country": "FR",                      // ou "Global", "US", "ES"…
  "expires": null,                      // ou "2026-12-31"
  "updated": "2026-10-20",
  "active": true
}
```

(Enlève les commentaires `//`, le JSON ne les accepte pas.)

## Mise en ligne

1. **GitHub** : crée un repo vide, puis dans ce dossier :
   ```bash
   git remote add origin https://github.com/<toi>/codes-parrainage.git
   git push -u origin main
   ```
2. **Vercel** : *Add New → Project → Import* le repo. Rien à configurer, `vercel.json` s'en charge.
3. **Domaine** : Vercel → *Settings → Domains* → ajoute ton domaine, puis mets la même URL dans `site.config.json` (champ `url`) et push.
4. **Indexation** : déclare le site dans Google Search Console et Bing Webmaster Tools (Bing alimente ChatGPT Search), en soumettant `/sitemap.xml`.

## Tester en local

```bash
npm run dev    # build + serveur local
```
