/* =========================================================================
   Digit Impact Studio — finitions : macOS, flèches des champs nombre, écran de connexion animé,
   réglage des cachets
   ========================================================================= */
(function () {
  "use strict";
  const D = window.digitDesktop || null;

  /* ---------- 1. Intégration macOS ---------- */
  if (D && D.platform === "darwin") {
    document.body.classList.add("mac-desktop");
    const strip = document.createElement("div");
    strip.className = "mac-drag-strip";
    document.body.appendChild(strip);
  }

  /* ---------- 2. Barre latérale : se replie seule quand la fenêtre est étroite ---------- */
  let autoCollapsed = false;
  function autoSidebar() {
    const sb = document.getElementById("sidebar");
    if (!sb) return;
    if (window.innerWidth < 1180 && window.innerWidth > 900) {
      if (!sb.classList.contains("collapsed")) { sb.classList.add("collapsed"); autoCollapsed = true; }
    } else if (autoCollapsed && window.innerWidth >= 1180) {
      sb.classList.remove("collapsed"); autoCollapsed = false;
    }
  }
  window.addEventListener("resize", autoSidebar);
  autoSidebar();

  /* ---------- 3. Champs nombre : flèches haut / bas cliquables et propres ---------- */
  document.addEventListener("pointerdown", e => {
    const el = e.target;
    if (!el || !el.matches || !el.matches('input[type="number"]') || el.disabled || el.readOnly) return;
    const r = el.getBoundingClientRect();
    if (e.clientX < r.right - 26) return;
    e.preventDefault();
    const up = e.clientY < r.top + r.height / 2;
    try { up ? el.stepUp() : el.stepDown(); } catch (err) {}
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
  }, true);

  /* ---------- 4. Écran de connexion animé (multimédia) ---------- */
  const ICONS = {
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    film: '<rect x="2" y="2" width="20" height="20" rx="2.2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
    clap: '<path d="M3 11h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 11 5.2 4.8l15.8 4.2"/><path d="M7.6 3.9l2 4.9M12.3 5.2l2 4.9M17 6.5l2 4.9"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
    headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
    aperture: '<circle cx="12" cy="12" r="10"/><line x1="14.31" y1="8" x2="20.05" y2="17.94"/><line x1="9.69" y1="8" x2="21.17" y2="8"/><line x1="7.38" y1="12" x2="13.12" y2="2.06"/><line x1="9.69" y1="16" x2="3.95" y2="6.06"/><line x1="14.31" y1="16" x2="2.83" y2="16"/><line x1="16.62" y1="12" x2="10.88" y2="21.94"/>',
    play: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  };
  // [icône, gauche %, haut %, taille px, couleur, durée s, retard s, dx, dy]
  const LAYOUT = [
    ["camera", 6, 12, 84, "", 15, 0, 22, -28], ["clap", 82, 10, 78, "red", 17, -3, -26, 22],
    ["film", 12, 66, 70, "blue", 19, -6, 18, -22], ["mic", 90, 62, 60, "", 13, -2, -14, -26],
    ["headphones", 24, 30, 58, "gold", 16, -9, 20, 18], ["aperture", 70, 78, 82, "", 21, -4, -22, -20],
    ["play", 46, 6, 52, "red", 14, -7, 16, 24], ["image", 4, 40, 54, "", 18, -1, 24, 16],
    ["music", 94, 36, 50, "blue", 12, -5, -18, 20], ["scissors", 36, 82, 56, "", 17, -8, 20, -18],
    ["monitor", 60, 24, 62, "", 20, -10, -20, 18], ["zap", 18, 88, 44, "gold", 11, -3, 12, -22],
    ["sliders", 76, 44, 46, "", 15, -6, -16, -16], ["video", 50, 90, 64, "red", 18, -2, 22, -18],
    ["camera", 40, 48, 40, "blue", 13, -11, -12, 20], ["film", 88, 88, 48, "", 16, -7, -18, -20],
  ];
  function buildMultimediaBg() {
    const host = document.getElementById("authScreen");
    if (!host || host.querySelector(".mm-bg")) return;
    const bg = document.createElement("div");
    bg.className = "mm-bg";
    bg.setAttribute("aria-hidden", "true");
    let html = '<div class="mm-orb o1"></div><div class="mm-orb o2"></div><div class="mm-orb o3"></div><div class="mm-strip"></div>';
    LAYOUT.forEach((l, i) => {
      html += `<div class="mm-ico ${l[4]}" style="left:${l[1]}%; top:${l[2]}%; width:${l[3]}px; height:${l[3]}px; --d:${l[5]}s; --delay:${l[6]}s; --dx:${l[7]}px; --dy:${l[8]}px; --r0:${(i % 2 ? -1 : 1) * 6}deg; --r1:${(i % 2 ? 1 : -1) * 9}deg;"><svg viewBox="0 0 24 24">${ICONS[l[0]]}</svg></div>`;
    });
    html += '<div class="mm-rec"><i></i><span>REC</span><span id="mmTimecode">00:00:00:00</span></div><div class="mm-vignette"></div>';
    bg.innerHTML = html;
    host.insertBefore(bg, host.firstChild);
    const t0 = Date.now();
    const tc = bg.querySelector("#mmTimecode");
    const tick = () => {
      if (!document.body.contains(bg)) return;
      if (host.classList.contains("active")) {
        const ms = Date.now() - t0, f = Math.floor((ms % 1000) / 40);
        const s = Math.floor(ms / 1000), p = n => String(n).padStart(2, "0");
        tc.textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(f)}`;
      }
      setTimeout(tick, 80);
    };
    tick();
  }
  buildMultimediaBg();

  /* ---------- 5. Réglage du cachet (taille / position / rotation) ---------- */
  window.openStampAdjustModal = function (accId) {
    const acc = (state.accounts || []).find(a => a.id === accId);
    if (!acc || !acc.signatureDataUrl) return showToast("Ajoutez d'abord un cachet pour ce poste.", true);
    if (typeof canModifyAccount === "function" && !canModifyAccount(accId)) return showToast("Action réservée au propriétaire du studio.", true);
    const cur = Object.assign({ s: 100, x: 0, y: 0, r: 0 }, acc.stampAdjust || {});
    const old = document.getElementById("stampAdjOverlay");
    if (old) old.remove();
    const ov = document.createElement("div");
    ov.id = "stampAdjOverlay";
    ov.className = "stamp-adj-overlay no-print";
    const row = (id, label, min, max, step, unit) => `
      <div class="stamp-adj-row"><label for="${id}">${label}</label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" />
        <output id="${id}Out"></output></div>`;
    ov.innerHTML = `
      <div class="stamp-adj-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div><div style="font-size:17px; font-weight:800;">Ajuster le cachet</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Poste : ${String(acc.jobTitle || acc.name).replace(/[<>"]/g, "")}</div></div>
          <button type="button" id="saClose" style="border:none; background:transparent; color:var(--text-muted); font-size:22px; cursor:pointer;">×</button>
        </div>
        <div class="stamp-adj-preview"><div class="stamp-adj-box"><img id="saImg" alt="" style="max-width:100%; max-height:100%; object-fit:contain; display:block;" /></div></div>
        ${row("saS", "Taille", 20, 220, 1)}${row("saX", "Horizontal", -90, 90, 1)}${row("saY", "Vertical", -60, 60, 1)}${row("saR", "Rotation", -35, 35, 1)}
        <div style="font-size:11.5px; color:var(--text-muted); margin:6px 0 14px;">Le cachet reste toujours à l'intérieur de son cadre sur la facture : il ne peut pas déborder.</div>
        <div style="display:flex; gap:9px; justify-content:flex-end; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" id="saReset"><span>Réinitialiser</span></button>
          <button type="button" class="btn btn-secondary" id="saCancel"><span>Annuler</span></button>
          <button type="button" class="btn" id="saSave" style="background:#ea1d2c; color:#fff;"><span>Enregistrer</span></button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const $ = id => document.getElementById(id);
    $("saImg").src = acc.signatureDataUrl;
    const apply = () => {
      const s = Number($("saS").value), x = Number($("saX").value), y = Number($("saY").value), r = Number($("saR").value);
      $("saImg").style.transform = `translate(${x}px, ${y}px) scale(${s / 100}) rotate(${r}deg)`;
      $("saSOut").textContent = s + " %"; $("saXOut").textContent = x + " px"; $("saYOut").textContent = y + " px"; $("saROut").textContent = r + "°";
    };
    const set = v => { $("saS").value = v.s; $("saX").value = v.x; $("saY").value = v.y; $("saR").value = v.r; apply(); };
    set(cur);
    ["saS", "saX", "saY", "saR"].forEach(id => $(id).addEventListener("input", apply));
    const close = () => ov.remove();
    $("saClose").onclick = close; $("saCancel").onclick = close;
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    $("saReset").onclick = () => set({ s: 100, x: 0, y: 0, r: 0 });
    $("saSave").onclick = () => {
      const v = { s: Number($("saS").value), x: Number($("saX").value), y: Number($("saY").value), r: Number($("saR").value) };
      acc.stampAdjust = (v.s === 100 && !v.x && !v.y && !v.r) ? null : v;
      acc._updatedAt = Date.now();
      saveState();
      showToast("Réglage du cachet enregistré.");
      close();
      try { if (currentView === "gestion-sub") renderGestionSubModule(document.getElementById("mainView"), "accounts"); } catch (e) {}
    };
  };

  // Ancien numéro WhatsApp mémorisé par l'envoi automatique (retiré en v1.4)
  try { localStorage.removeItem("DIGIT_WA_PHONE"); localStorage.removeItem("DIGIT_WA_ENTER"); } catch (e) {}
})();
