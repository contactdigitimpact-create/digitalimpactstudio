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

  /* ---------- 5. Réglage du cachet : taille, position, rotation + retouche de l'image (v1.33) ----------
     Recadrer les bords vides, agrandir (image plus grande et plus nette), adoucir les contours.
     L'image d'origine est toujours gardée : « Réinitialiser » y revient. */
  const STAMP_BOXES = { S: [150, 92, "Petit"], M: [195, 120, "Moyen"], L: [245, 150, "Grand"], XL: [295, 182, "Très grand"], XXL: [350, 216, "Maximum"] };
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  // Bords vides = transparents ou presque blancs
  async function stampTrim(src) {
    const im = await loadImg(src);
    const w = im.naturalWidth, h = im.naturalHeight;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let k = 0; k < w; k++) {
      const i = (y * w + k) * 4;
      if (d[i + 3] > 24 && !(d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232)) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return src;
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL("image/webp", 0.92);
  }
  // Agrandit l'image (lissage de haute qualité, par étapes) puis adoucit les contours
  async function stampResample(src, target, soft) {
    const im = await loadImg(src);
    let w = im.naturalWidth, h = im.naturalHeight;
    const k = Math.min(4, Math.max(1, target / Math.max(w, h)));
    let cur = document.createElement("canvas"); cur.width = w; cur.height = h; cur.getContext("2d").drawImage(im, 0, 0);
    const W = Math.round(w * k), H = Math.round(h * k);
    while (cur.width < W) {
      const n = document.createElement("canvas"); n.width = Math.min(W, cur.width * 2); n.height = Math.min(H, Math.round(cur.height * n.width / cur.width));
      const x = n.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, n.width, n.height);
      cur = n;
    }
    if (soft > 0) {
      const n = document.createElement("canvas"); n.width = cur.width; n.height = cur.height;
      const x = n.getContext("2d"); x.filter = `blur(${(soft * Math.max(1, k) * 0.5).toFixed(2)}px)`; x.drawImage(cur, 0, 0);
      cur = n;
    }
    return cur.toDataURL("image/webp", 0.92);
  }
  const stampKeyOf = u => { u = String(u || ""); return u.length + ":" + u.slice(-48); };

  function openStampEditor({ title, sub, image, original, adjust, onSave }) {
    const base = original || image;
    const cur = Object.assign({ s: 100, x: 0, y: 0, r: 0, box: "M" }, adjust || {});
    const proc0 = Object.assign({ trim: false, up: false, soft: 0 }, cur.proc || {});
    let box = STAMP_BOXES[cur.box] ? cur.box : "M";
    let proc = Object.assign({}, proc0);
    let result = image, busy = 0;
    const old = document.getElementById("stampAdjOverlay");
    if (old) old.remove();
    const ov = document.createElement("div");
    ov.id = "stampAdjOverlay";
    ov.className = "stamp-adj-overlay no-print";
    const row = (id, label, min, max, step) => `
      <div class="stamp-adj-row"><label for="${id}">${label}</label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" />
        <output id="${id}Out"></output></div>`;
    const tog = (id, label) => `<button type="button" class="btn btn-secondary" id="${id}" style="padding:6px 11px; font-size:11.5px;">${label}</button>`;
    ov.innerHTML = `
      <div class="stamp-adj-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div><div style="font-size:17px; font-weight:800;">${title}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">${sub}</div></div>
          <button type="button" id="saClose" style="border:none; background:transparent; color:var(--text-muted); font-size:22px; cursor:pointer;">×</button>
        </div>
        <div class="stamp-adj-preview"><div class="stamp-adj-box"><img id="saImg" alt="" style="max-width:100%; max-height:100%; object-fit:contain; display:block;" /></div></div>
        <div class="stamp-adj-row"><label>Retouche</label><div style="display:flex; gap:6px; flex-wrap:wrap;">${tog("saTrim", "Recadrer les bords vides")}${tog("saUp", "Agrandir l'image (plus nette)")}</div></div>
        ${row("saSoft", "Adoucir", 0, 3, 0.5)}
        <div class="stamp-adj-row"><label>Cadre sur la facture</label><div id="saBox" style="display:flex; gap:6px; flex-wrap:wrap;">${Object.keys(STAMP_BOXES).map(k => `<button type="button" class="btn btn-secondary" data-box="${k}" style="padding:5px 10px; font-size:11.5px;">${STAMP_BOXES[k][2]}</button>`).join("")}</div></div>
        ${row("saS", "Taille", 20, 500, 1)}${row("saX", "Horizontal", -120, 120, 1)}${row("saY", "Vertical", -80, 80, 1)}${row("saR", "Rotation", -35, 35, 1)}
        <div id="saBusy" style="font-size:11.5px; color:var(--text-muted); min-height:16px; margin:4px 0 10px;">Le cadre fixe la place du cachet sur la facture ; la taille agrandit ou réduit l'image dans ce cadre, sans jamais déborder.</div>
        <div style="display:flex; gap:9px; justify-content:flex-end; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" id="saReset"><span>Réinitialiser</span></button>
          <button type="button" class="btn btn-secondary" id="saCancel"><span>Annuler</span></button>
          <button type="button" class="btn" id="saSave" style="background:#ea1d2c; color:#fff;"><span>Enregistrer</span></button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const $ = id => document.getElementById(id);
    $("saImg").src = image;
    const onOff = (el, on) => { el.style.background = on ? "#ea1d2c" : ""; el.style.color = on ? "#fff" : ""; el.style.borderColor = on ? "#ea1d2c" : ""; };
    const apply = () => {
      const b = ov.querySelector(".stamp-adj-box");
      if (b) { b.style.width = STAMP_BOXES[box][0] + "px"; b.style.height = STAMP_BOXES[box][1] + "px"; }
      ov.querySelectorAll("#saBox [data-box]").forEach(x => onOff(x, x.dataset.box === box));
      onOff($("saTrim"), proc.trim); onOff($("saUp"), proc.up);
      const s = Number($("saS").value), x = Number($("saX").value), y = Number($("saY").value), r = Number($("saR").value);
      $("saImg").style.transform = `translate(${x}px, ${y}px) scale(${s / 100}) rotate(${r}deg)`;
      $("saSOut").textContent = s + " %"; $("saXOut").textContent = x + " px"; $("saYOut").textContent = y + " px"; $("saROut").textContent = r + "°";
      $("saSoftOut").textContent = Number($("saSoft").value) ? Number($("saSoft").value).toString().replace(".", ",") : "Non";
    };
    // Recalcule l'image retouchée à partir de l'original (jamais à partir d'une copie déjà retouchée)
    const rebuild = async () => {
      const my = ++busy;
      proc.soft = Number($("saSoft").value) || 0;
      if (!proc.trim && !proc.up && !proc.soft) { result = base; $("saImg").src = base; return; }
      $("saBusy").textContent = "Retouche en cours...";
      try {
        let img = base;
        let small = false;
        if (proc.trim) { img = await stampTrim(img); const t0 = await loadImg(img); small = Math.max(t0.naturalWidth, t0.naturalHeight) < 500; }
        // Un cachet recadré trop petit est agrandi d'office (sinon il deviendrait flou une fois grossi)
        if (proc.up || proc.soft || small) img = await stampResample(img, proc.up ? 900 : (small ? 700 : 0), proc.soft);
        if (my !== busy) return;
        result = img; $("saImg").src = img;
        $("saBusy").textContent = "Retouche appliquée. Vous pouvez encore agrandir avec « Taille ».";
      } catch (e) { $("saBusy").textContent = "Cette image ne peut pas être retouchée."; }
    };
    const set = v => { box = STAMP_BOXES[v.box] ? v.box : "M"; $("saS").value = v.s; $("saX").value = v.x; $("saY").value = v.y; $("saR").value = v.r; apply(); };
    $("saSoft").value = proc.soft;
    set(cur);
    ["saS", "saX", "saY", "saR"].forEach(id => $(id).addEventListener("input", apply));
    $("saSoft").addEventListener("input", apply);
    $("saSoft").addEventListener("change", rebuild);
    $("saTrim").onclick = () => { proc.trim = !proc.trim; apply(); rebuild(); };
    $("saUp").onclick = () => { proc.up = !proc.up; apply(); rebuild(); };
    ov.querySelectorAll("#saBox [data-box]").forEach(x => x.addEventListener("click", () => { box = x.dataset.box; apply(); }));
    const close = () => ov.remove();
    $("saClose").onclick = close; $("saCancel").onclick = close;
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    $("saReset").onclick = () => { proc = { trim: false, up: false, soft: 0 }; $("saSoft").value = 0; set({ s: 100, x: 0, y: 0, r: 0, box: "M" }); rebuild(); };
    $("saSave").onclick = async () => {
      if ($("saBusy").textContent === "Retouche en cours...") return;
      const v = { s: Number($("saS").value), x: Number($("saX").value), y: Number($("saY").value), r: Number($("saR").value), box, proc: { trim: !!proc.trim, up: !!proc.up, soft: Number(proc.soft) || 0 } };
      const plain = v.s === 100 && !v.x && !v.y && !v.r && box === "M" && !v.proc.trim && !v.proc.up && !v.proc.soft;
      onSave({ adjust: plain ? null : v, image: result, original: result === base ? "" : base, changed: result !== image });
      saveState();
      showToast("Cachet enregistré.");
      close();
      try { rerenderCurrentView(); } catch (e) {}
    };
  }

  // Cachet d'un compte (Personnels, postes signataires)
  window.openStampAdjustModal = function (accId) {
    const acc = (state.accounts || []).find(a => a.id === accId);
    if (!acc || !acc.signatureDataUrl) return showToast("Ajoutez d'abord un cachet pour ce poste.", true);
    if (typeof canModifyAccount === "function" && !canModifyAccount(accId)) return showToast("Action réservée au propriétaire du studio.", true);
    openStampEditor({
      title: "Ajuster le cachet", sub: "Poste : " + String(acc.jobTitle || acc.name).replace(/[<>"]/g, ""),
      image: acc.signatureDataUrl, original: acc.signatureOriginalDataUrl, adjust: acc.stampAdjust,
      onSave: ({ adjust, image, original, changed }) => {
        if (changed) { acc.stampOldKeys = [...new Set([...(acc.stampOldKeys || []), stampKeyOf(acc.signatureDataUrl)])].slice(-20); acc.signatureDataUrl = image; }
        acc.signatureOriginalDataUrl = original || "";
        acc.stampAdjust = adjust;
        acc._updatedAt = Date.now();
      }
    });
  };
  // Cachet de la bibliothèque (Signatures & Cachets enregistrés)
  window.openLibraryStampAdjust = function (sigId) {
    const sig = (state.signatures || []).find(x => x.id === sigId);
    if (!sig || !sig.dataUrl) return;
    if (typeof getCurrentRole === "function" && getCurrentRole() !== "ADMIN") return showToast("Réservé à l'Administrateur.", true);
    openStampEditor({
      title: "Ajuster le cachet", sub: String(sig.title || "Cachet").replace(/[<>"]/g, ""),
      image: sig.dataUrl, original: sig.originalDataUrl, adjust: sig.adjust,
      onSave: ({ adjust, image, original, changed }) => {
        if (changed) {
          const prev = sig.dataUrl;
          sig.oldKeys = [...new Set([...(sig.oldKeys || []), stampKeyOf(prev)])].slice(-20);
          sig.dataUrl = image;
          if (state.companyInfo.customStampDataUrl === prev) { state.companyInfo.customStampDataUrl = image; state.companyInfo._updatedAt = Date.now(); }
        }
        sig.originalDataUrl = original || "";
        sig.adjust = adjust;
        sig._updatedAt = Date.now();
      }
    });
  };

  // Ancien numéro WhatsApp mémorisé par l'envoi automatique (retiré en v1.4)
  try { localStorage.removeItem("DIGIT_WA_PHONE"); localStorage.removeItem("DIGIT_WA_ENTER"); } catch (e) {}
})();
