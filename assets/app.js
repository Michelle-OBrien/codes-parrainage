// Filtres par catégorie + copie du code. Le site fonctionne entièrement sans JS (lisible par les agents).
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const f = chip.dataset.filter;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
    document.querySelectorAll(".card").forEach((card) => { card.hidden = f !== "all" && card.dataset.cat !== f; });
  });
});
document.querySelectorAll(".copy").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const label = btn.textContent;
    try { await navigator.clipboard.writeText(btn.dataset.code); btn.textContent = btn.dataset.done + " ✓"; }
    catch { btn.textContent = btn.dataset.code; }
    setTimeout(() => (btn.textContent = label), 1600);
  });
});
