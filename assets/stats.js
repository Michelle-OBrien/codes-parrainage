// Page /stats : affiche les clics (lecture protégée par une clé, vérifiée côté Supabase).
const cfg = window.STATS_CONFIG;
const $ = (s) => document.querySelector(s);
const getKey = () => { try { return localStorage.getItem("statsKey") || ""; } catch { return ""; } };
const setKey = (k) => { try { localStorage.setItem("statsKey", k); } catch {} };

async function load(key) {
  $("#msg").textContent = "…";
  const r = await fetch(`${cfg.url}/rest/v1/rpc/get_click_stats`, {
    method: "POST",
    headers: { apikey: cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: key }),
  });
  if (!r.ok) { $("#msg").textContent = "Clé invalide."; return; }
  setKey(key);
  const rows = await r.json();
  $("#login").hidden = true;
  const total = rows.reduce((a, x) => a + Number(x.humans), 0);
  $("#msg").textContent = `${total} clics humains au total (les robots sont comptés à part).`;
  $("#tbody").innerHTML = rows.length
    ? rows.map((x) => `<tr><td>${cfg.names[x.offer_id] || x.offer_id}</td><td>${x.src}</td><td><b>${x.humans}</b></td><td>${x.last_7d}</td><td class="muted">${x.total - x.humans}</td><td class="muted">${x.last_click ? new Date(x.last_click).toLocaleString("fr-FR") : ""}</td></tr>`).join("")
    : `<tr><td colspan="6" class="muted">Aucun clic pour l'instant.</td></tr>`;
  $("#table").hidden = false;
}

$("#login").addEventListener("submit", (e) => { e.preventDefault(); load($("#key").value.trim()); });
const saved = getKey();
if (saved) load(saved);
