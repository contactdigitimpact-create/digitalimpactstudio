/* =========================================================================
   Digit Impact Studio — version TÉLÉPHONE (application web installable)
   - Activée seulement sur téléphone (jamais dans l'application Mac / Windows).
   - Mêmes données, mêmes comptes et mêmes droits que sur ordinateur.
   - En-tête, barre d'onglets avec « + » central, écrans Factures / Finance / Gestion
     dans l'esprit des captures fournies.
   ========================================================================= */
(function () {
  "use strict";

  // Application installable : le « service worker » permet l'ouverture hors connexion et les notifications
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.digitDesktop) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  if (window.digitDesktop) return;
  const isPhone = window.matchMedia("(max-width: 820px)").matches || /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);
  if (!isPhone) return;
  document.body.classList.add("is-mobile");
  window.DIGIT_IS_PHONE = true;
  // Sortie matériel : petites miniatures par défaut sur téléphone (le bouton « Grandes Cartes » reste disponible)
  try { checkoutViewMode = "mini"; } catch (e) {}

  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const role = () => { try { return getCurrentRole(); } catch (e) { return "ADMIN"; } };
  const allowed = v => { try { return isViewAllowedForRole(v, role()); } catch (e) { return false; } };

  /* ---------- Icônes (style plein, comme sur les captures) ---------- */
  const I = {
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="10" rx="1.6"/><rect x="13" y="3" width="8" height="6" rx="1.6"/><rect x="13" y="11" width="8" height="10" rx="1.6"/><rect x="3" y="15" width="8" height="6" rx="1.6"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="6" width="14" height="12" rx="2.4"/><path d="M17 10.2 22 7v10l-5-3.2z"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v2H2V6a2 2 0 0 1 2-2zm-2 7h20v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm3 4v2h4v-2z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="6" r="1.8"/><circle cx="4" cy="12" r="1.8"/><circle cx="4" cy="18" r="1.8"/><rect x="8" y="4.8" width="14" height="2.4" rx="1.2"/><rect x="8" y="10.8" width="14" height="2.4" rx="1.2"/><rect x="8" y="16.8" width="14" height="2.4" rx="1.2"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3 21c0-4.4 4-7.5 9-7.5s9 3.1 9 7.5z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6v4.6L4.2 16a1 1 0 0 0 .9 1.5h13.8a1 1 0 0 0 .9-1.5L18 12.6V8a6 6 0 0 0-6-6zm-2.6 17a2.6 2.6 0 0 0 5.2 0z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V9h5.5zM8 13v2h8v-2zm0 4v2h6v-2z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 5h14a2 2 0 0 1 2 2v1h-6a4 4 0 0 0 0 8h6v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm10 5h8v4h-8a2 2 0 0 1 0-4z"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h9a1 1 0 0 1 1 1v17H3V4a1 1 0 0 1 1-1zm2 3v2h2V6zm4 0v2h2V6zM6 10v2h2v-2zm4 0v2h2v-2zM6 14v2h2v-2zm4 0v2h2v-2zm6-5h4a1 1 0 0 1 1 1v11h-5z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    clapper: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm.3-1.8L2.6 6.4a2 2 0 0 1 1.4-2.5l13.2-3.5a2 2 0 0 1 2.4 1.4l.5 1.9z"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3 6.5v11L12 22l9-4.5v-11zm0 2.3 6.4 3.2L12 10.7 5.6 7.5zM5 9.2l6 3v7.3l-6-3z"/></svg>',
    // v1.19
    pulse: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="12" width="4.5" height="9" rx="1.2"/><rect x="9.75" y="7" width="4.5" height="14" rx="1.2"/><rect x="16.5" y="3" width="4.5" height="18" rx="1.2"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zM5 10v9h14v-9z"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
    userMinus: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7.5" r="4.5"/><path d="M1 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z"/><rect x="16" y="9" width="7" height="2.6" rx="1.3"/></svg>'
    // v1.20 : flèches du calendrier maison
    , chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>'
    , chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>'
  };
  window.digitMobileIcons = I;

  /* ---------- Onglets selon le rôle ---------- */
  const BILLING = ["home", "add-client", "clients-folders", "client-detail", "flash-space", "project-empty", "quote-editor", "proforma-view", "m-factures"];
  const GESTION = ["m-menu", "management", "gestion-sub", "account", "param-templates", "param-profile", "param-db", "param-trash"];
  const TABS = {
    home: { label: "Accueil", icon: I.grid, go: () => navigate(allowed("dashboard") ? "dashboard" : "prod-projects"), views: ["dashboard", "ai-activity", "prod-projects", "kanban", "prod-calendar"] },
    materiel: { label: "Matériel", icon: I.camera, go: () => navigate("equip-checkout"), views: ["equip-checkout", "equip-reservations", "equip-inventory"] },
    finance: { label: "Finance", icon: I.card, go: () => navigate("m-factures"), views: [...BILLING, "m-balance", "m-tva", "finances", "expenses"] },
    factures: { label: "Factures", icon: I.doc, go: () => navigate("m-factures"), views: BILLING },
    balance: { label: "Finance", icon: I.card, go: () => navigate("m-balance"), views: ["dashboard", "m-balance", "m-tva", "finances"] },
    depenses: { label: "Dépenses", icon: I.wallet, go: () => navigate("expenses"), views: ["expenses"] },
    alertes: { label: "Alertes", icon: I.bell, go: () => openNotificationsModal(), views: [] },
    menu: { label: "Gestion", icon: I.list, go: () => navigate("m-menu"), views: GESTION }
  };
  function tabsForRole(r) {
    if (r === "COMPTABLE") return ["factures", "balance", "depenses", "menu"];
    if (r === "EDITEUR") return ["home", "materiel", "alertes", "menu"];
    return ["home", "materiel", "finance", "menu"];
  }

  // Onglets internes en haut de page (comme « Balance / Dépenses » sur les captures)
  function segmentsFor(view) {
    const r = role();
    if (r !== "COMPTABLE" && ["dashboard", "ai-activity", "prod-projects", "kanban", "prod-calendar"].includes(view)) {
      const s = allowed("dashboard") ? [["dashboard", "Résumé", I.pulse]] : [];
      if (r === "ADMIN" || r === "PDG") s.push(["ai-activity", "IA", I.bolt]);
      return [...s, ["prod-projects", "Projets", I.clapper], ["prod-calendar", "Agenda", I.calendar]];
    }
    if (["equip-checkout", "equip-reservations", "equip-inventory"].includes(view)) return [["equip-checkout", "Sorties", I.box], ["equip-reservations", "Réserver", I.calendar], ["equip-inventory", "Parc", I.camera]];
    if (r === "COMPTABLE" && ["dashboard", "m-balance", "m-tva"].includes(view)) return [["dashboard", "Résumé", I.pulse], ["m-balance", "Balance", I.card], ["m-tva", "TVA", I.doc]];
    if (r !== "COMPTABLE" && ["m-factures", "m-balance", "expenses"].includes(view)) {
      const s = [["m-factures", "Factures", I.doc]];
      if (allowed("finances")) s.push(["m-balance", "Balance", I.card]);
      if (allowed("expenses")) s.push(["expenses", "Dépenses", I.wallet]);
      return s.length > 1 ? s : null;
    }
    return null;
  }

  /* ---------- En-tête et barre d'onglets ---------- */
  const header = document.createElement("header");
  header.className = "m-header no-print";
  header.innerHTML = `
    <div class="m-brand" id="mBrand"><div class="exact-di-square"><span>DI</span></div><div class="m-brand-text"><div class="m-brand-main">Digit <span class="impact-red">Impact</span></div><div class="m-brand-sub">STUDIO</div></div></div>
    <div class="m-head-actions">
      <button type="button" class="m-icon-btn" id="mSearchBtn" aria-label="Rechercher">${I.search}</button>
      <button type="button" class="m-icon-btn" id="mBellBtn" aria-label="Notifications"><span style="width:22px;height:22px;display:flex;">${I.bell}</span><span class="m-badge" id="mBellBadge" style="display:none;">0</span></button>
      <button type="button" class="m-avatar-btn" id="mAvatarBtn" aria-label="Mon compte"></button>
    </div>`;
  document.body.appendChild(header);
  const tabbar = document.createElement("nav");
  tabbar.className = "m-tabbar no-print";
  document.body.appendChild(tabbar);
  $("mSearchBtn").onclick = () => openSearchModal();
  $("mBellBtn").onclick = () => openNotificationsModal();
  $("mAvatarBtn").onclick = () => openAccountSheet();
  $("mBrand").onclick = () => { const t = tabsForRole(role())[0]; TABS[t].go(); };

  let builtForRole = null;
  function buildTabbar() {
    const r = role();
    const keys = tabsForRole(r);
    const cell = k => `<button type="button" class="m-tab" data-tab="${k}">${TABS[k].icon}<span>${TABS[k].label}</span>${k === "alertes" ? '<span class="m-badge" id="mAlertBadge" style="display:none;">0</span>' : ''}</button>`;
    tabbar.innerHTML = cell(keys[0]) + cell(keys[1]) +
      `<div class="m-fab-slot"><button type="button" class="m-fab" id="mFab" aria-label="Créer">${I.plus}</button></div>` +
      cell(keys[2]) + cell(keys[3]);
    tabbar.querySelectorAll(".m-tab").forEach(b => b.onclick = () => TABS[b.dataset.tab].go());
    $("mFab").onclick = openPlusSheet;
    builtForRole = r;
  }
  function refreshChrome() {
    if (builtForRole !== role()) buildTabbar();
    const keys = tabsForRole(role());
    const activeKey = keys.find(k => TABS[k].views.includes(currentView));
    tabbar.querySelectorAll(".m-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === activeKey));
    try {
      const acc = getCurrentAccount();
      const av = $("mAvatarBtn");
      if (acc && av) av.innerHTML = acc.photoData ? `<img src="${acc.photoData}" alt="" />` : esc(acc.billingInitials || computeDefaultInitials(acc.name));
    } catch (e) {}
    refreshBadges();
  }
  function refreshBadges() {
    try {
      const { myKanbanTasks, myNotifs } = getMyUrgentTasksAndNotifications();
      const n = myKanbanTasks.length + myNotifs.length;
      [$("mBellBadge"), $("mAlertBadge")].forEach(b => { if (b) { b.style.display = n > 0 ? "flex" : "none"; b.textContent = n > 99 ? "99+" : n; } });
    } catch (e) {}
  }

  /* ---------- Onglets internes insérés en haut de la page ---------- */
  const main = $("mainView");
  function ensureSegbar() {
    const segs = segmentsFor(currentView);
    const old = main.querySelector(":scope > .m-segbar");
    if (!segs) { if (old) old.remove(); return; }
    if (old && old.dataset.for === currentView) return;
    if (old) old.remove();
    const bar = document.createElement("div");
    bar.className = "m-segbar";
    bar.dataset.for = currentView;
    bar.innerHTML = segs.map(([v, label, icon]) => `<button type="button" class="m-seg ${v === currentView ? 'active' : ''}" data-v="${v}"><span style="width:18px;height:18px;display:flex;">${icon}</span><span>${label}</span>${v === "ai-activity" && v !== currentView && typeof aiTodayCount === "function" && aiTodayCount() ? `<span class="m-seg-dot">${Math.min(99, aiTodayCount())}</span>` : ""}</button>`).join("");
    bar.querySelectorAll(".m-seg").forEach(b => b.onclick = () => navigate(b.dataset.v));
    main.insertBefore(bar, main.firstChild);
  }
  const segObserver = new MutationObserver(() => {
    segObserver.disconnect();
    try { ensureSegbar(); ensureBackbar(); moveCheckoutPanel(); } catch (e) {}
    segObserver.observe(main, { childList: true });
  });
  segObserver.observe(main, { childList: true });

  // Page d'accueil : la même que sur ordinateur (Admin et PDG : « Résumé » ; Comptable : Factures)

  /* ---------- Sortie matériel : le bloc « Valider la sortie » juste sous la sélection ---------- */
  function moveCheckoutPanel() {
    if (currentView !== "equip-checkout") return;
    const right = $("rightPanel");
    if (!right || !right.children.length) return;
    const logsTitle = Array.from(main.querySelectorAll("h2")).find(h => /Fiches de Sortie/i.test(h.textContent));
    const logsCard = logsTitle && logsTitle.closest(".card-container");
    if (!logsCard) return;
    const box = document.createElement("div");
    box.className = "card-container m-moved-checkout";
    while (right.firstChild) box.appendChild(right.firstChild);
    logsCard.parentNode.insertBefore(box, logsCard);
    right.className = "right-panel hidden";
  }
  new MutationObserver(() => { try { moveCheckoutPanel(); } catch (e) {} }).observe($("rightPanel"), { childList: true });

  /* ---------- Bouton « Retour » sur les écrans qui n'en ont pas ---------- */
  // Écrans d'onglet (accessibles par la barre du bas ou les onglets du haut) : pas besoin de retour
  const ROOT_VIEWS = ["dashboard", "ai-activity", "prod-projects", "kanban", "equip-checkout", "equip-reservations", "equip-inventory", "m-factures", "m-balance", "expenses", "m-menu"];
  // « TVA » est un écran d'onglet pour le comptable ; pour les autres on y arrive depuis la Balance (bouton Retour utile)
  // « Agenda » est un onglet de l'Accueil ; le comptable y arrive depuis Gestion
  const isRoot = v => ROOT_VIEWS.includes(v) || (v === "m-tva" && role() === "COMPTABLE") || (v === "prod-calendar" && role() !== "COMPTABLE");
  const history = [];
  let navigatingBack = false;
  function parentOf(view) {
    if (view === "absences" || view === "prod-calendar") return "m-menu";
    if (view === "param-journal") return role() === "ADMIN" ? "param-db" : "m-menu";
    if (view === "param-ia") return "m-menu";
    if (view === "account") return "m-menu";
    if (String(view).startsWith("param-")) return role() === "ADMIN" ? "account" : "m-menu";
    if (view === "finances" || view === "m-tva") return "m-balance";
    if (view === "gestion-sub") return "m-menu";
    return null;
  }
  function goBack() {
    while (history.length) {
      const prev = history.pop();
      if (prev.view !== currentView && (String(prev.view).startsWith("m-") || allowed(prev.view))) {
        navigatingBack = true;
        try { navigate(prev.view, prev.params); } finally { navigatingBack = false; }
        return;
      }
    }
    const p = parentOf(currentView);
    if (p) { navigatingBack = true; try { navigate(p); } finally { navigatingBack = false; } }
    else TABS[tabsForRole(role())[0]].go();
  }
  // V1.21 : retour en arrière en glissant depuis le bord gauche (comme sur iPhone)
  (function setupSwipeBack() {
    const EDGE = 24;
    let sx = 0, sy = 0, t0 = 0, active = false, moved = false;
    const overlayOpen = () => [...document.querySelectorAll('[class*="overlay"], .dcal-box')].some(el => el.offsetParent !== null && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden");
    const reset = () => { main.style.transition = "transform .2s ease-out"; main.style.transform = ""; setTimeout(() => { main.style.transition = ""; }, 220); };
    document.addEventListener("touchstart", e => {
      active = false; moved = false;
      if (e.touches.length !== 1 || isRoot(currentView)) return;
      const t = e.touches[0];
      if (t.clientX > EDGE || overlayOpen()) return;
      sx = t.clientX; sy = t.clientY; t0 = Date.now(); active = true;
    }, { passive: true });
    document.addEventListener("touchmove", e => {
      if (!active) return;
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (!moved) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { active = false; return; }
        if (dx > 10) { moved = true; main.style.transition = "none"; }
      }
      if (moved) { e.preventDefault(); main.style.transform = `translateX(${Math.max(0, dx)}px)`; }
    }, { passive: false });
    const end = e => {
      if (!active) return;
      active = false;
      if (!moved) return;
      const t = e.changedTouches && e.changedTouches[0], dx = t ? t.clientX - sx : 0, w = window.innerWidth;
      const fast = dx > 50 && dx / Math.max(1, Date.now() - t0) > 0.5;
      if (dx > w / 3 || fast) {
        main.style.transition = "transform .18s ease-out"; main.style.transform = `translateX(${w}px)`;
        setTimeout(() => { main.style.transition = ""; main.style.transform = ""; goBack(); }, 180);
      } else reset();
    };
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", () => { if (active && moved) reset(); active = false; }, { passive: true });
  })();
  function ensureBackbar() {
    const old = main.querySelector(":scope > .m-backbar");
    const needs = !isRoot(currentView) && !main.querySelector(".back-nav");
    if (!needs) { if (old) old.remove(); return; }
    if (old) return;
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "m-backbar";
    bar.innerHTML = `<span class="m-back-chev">‹</span><span>Retour</span>`;
    bar.onclick = goBack;
    main.insertBefore(bar, main.firstChild);
  }

  /* ---------- Navigation : écrans propres au téléphone (« m-... ») ---------- */
  const origNavigate = window.navigate;
  window.navigate = function (view, params = {}) {
    if (view === "home") view = "m-factures";          // accueil Facturation façon téléphone
    if (view === "management") view = "m-menu";        // cartes « Gestion »
    if (view === "tva") view = "m-tva";                // rubrique TVA de l'ordinateur → écran TVA du téléphone
    // Mémorise l'écran quitté pour le bouton « Retour » (sauf pour un retour, et sauf entre deux onglets)
    // (un bouton « ‹ » d'origine qui ramène à l'écran précédent compte comme un retour)
    if (!navigatingBack && history.length && history[history.length - 1].view === view) {
      history.pop();
    } else if (!navigatingBack && view !== currentView && currentView && !(isRoot(view) && isRoot(currentView))) {
      history.push({ view: currentView, params: { clientId: selectedClientId, projectId: selectedProjectId, isFlash: isCurrentDocFlash } });
      if (history.length > 30) history.shift();
    }
    if (isRoot(view) && !navigatingBack) history.length = 0;
    if (String(view).startsWith("m-")) {
      if (view === "m-factures" && !allowed("home")) return showToast("Accès restreint pour votre compte.", true);
      if (view === "m-balance" && !allowed("finances")) return showToast("Accès restreint pour votre compte.", true);
      if (view === "m-tva" && !allowed("finances")) return showToast("Accès restreint pour votre compte.", true);
      if (view !== currentView) tabSearchQuery = "";
      currentView = view;
      const right = $("rightPanel");
      if (right) { right.className = "right-panel hidden"; right.innerHTML = ""; }
      renderMobileView(view);
    } else {
      origNavigate(view, params);
    }
    refreshChrome();
    const ca = document.querySelector(".content-area");
    if (ca) ca.scrollTop = 0;
  };
  function renderMobileView(view) {
    if (view === "m-factures") renderFactures();
    else if (view === "m-balance") renderBalance();
    else if (view === "m-tva") renderTva();
    else if (view === "m-menu") renderMenu();
    ensureSegbar();
    ensureBackbar();
  }
  // Après une synchronisation (autre poste), on redessine aussi les écrans « téléphone »
  const origRefresh = window.refreshActiveViewAfterRemoteSync;
  window.refreshActiveViewAfterRemoteSync = function () {
    origRefresh.apply(this, arguments);
    try { if (String(currentView).startsWith("m-") && !isAnyModalOpenOrEditing()) renderMobileView(currentView); } catch (e) {}
    refreshBadges();
  };
  const origBadges = window.updateBadgesAndNotificationsUI;
  window.updateBadgesAndNotificationsUI = function () { origBadges.apply(this, arguments); refreshBadges(); };

  /* ---------- Écran « Factures » (dossiers + projets récents) ---------- */
  let factFilter = "ALL";
  function invoiceRows() {
    const q = String(searchQuery || "").toLowerCase();
    return [
      ...visibleProjects().map(p => ({ ...p, _isFlash: false })),          // Responsable : seulement ses factures
      ...visibleFlashQuotes().map(f => ({ ...f, _isFlash: true }))
    ].map(p => {
      const c = state.clients.find(x => x.id === p.clientId);
      return { p, client: p._isFlash ? (p.flashClientName || "Devis Flash") : (c ? c.name : "Client") };
    }).filter(({ p, client }) => {
      if (factFilter !== "ALL" && p.status !== factFilter) return false;
      if (!q) return true;
      return [p.name, client, formatDocNumber(p)].some(v => String(v || "").toLowerCase().includes(q));
    }).sort((a, b) => (typeof digitDocCmp === "function" ? digitDocCmp("mfact")(a.p, b.p) : String(parseAnyDateToYMD(b.p.date)).localeCompare(String(parseAnyDateToYMD(a.p.date)))));
  }
  function factListHTML() {
    const rows = invoiceRows();
    if (!rows.length) return `<div class="m-empty">Aucune facture${searchQuery ? " pour cette recherche" : ""}.<br/>Touchez « + » pour en créer une.</div>`;
    return rows.map(({ p, client }) => {
      const ok = p.status === "VALIDATED";
      return `<div class="m-list-row" data-id="${esc(p.id)}" data-flash="${p._isFlash ? 1 : 0}">
        <div class="l"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.date)}</div></div>
        <div class="r"><div class="t ${ok ? 'm-status-ok' : 'm-status-wait'}">${ok ? 'Proforma validée' : 'En cours de validation'}</div><div class="s">${esc(client)}</div></div>
      </div>`;
    }).join("");
  }
  function bindFactRows() {
    main.querySelectorAll(".m-list-row[data-id]").forEach(r => r.onclick = () => openAnyProject(r.dataset.id, r.dataset.flash === "1"));
  }
  function renderFactures() {
    const filterLabel = { ALL: "Tout", PENDING: "En cours", VALIDATED: "Validées" }[factFilter];
    main.innerHTML = `
      <div class="m-search">${I.search}<input type="search" id="mFactSearch" placeholder="Recherche" value="${esc(searchQuery || "")}" autocomplete="off" /></div>
      <div class="m-folders">
        <div class="folder-3d-item" id="mFolderClients">
          <div class="folder-3d-box"><div class="folder-papers"></div><div class="folder-front-glass"><div class="folder-mini-icon">${svgIcon("building", 18, "#ffffff")}</div><div class="folder-bottom-meta"><span>Clients (${state.clients.length})</span><span>DI</span></div></div></div>
          <div class="folder-title">Vos Clients</div>
        </div>
        <div class="folder-3d-item" id="mFolderFlash">
          <div class="folder-3d-box flash"><div class="folder-papers"></div><div class="folder-front-glass"><div class="folder-mini-icon">${svgIcon("bolt", 18, "#ffffff")}</div><div class="folder-bottom-meta"><span>Flash (${visibleFlashQuotes().length})</span><span>DI</span></div></div></div>
          <div class="folder-title">Devis Flash</div>
        </div>
      </div>
      <div class="m-sheet-card">
        <div class="m-grabber"></div>
        <div class="m-sheet-head"><h2>Projets récents</h2><div class="m-sheet-tools">${typeof digitSortDocsHTML === "function" ? digitSortDocsHTML("mfact") : ""}<button type="button" class="m-filter-btn" id="mFactFilter">${filterLabel} ${I.sliders}</button></div></div>
        <div id="mFactList">${factListHTML()}</div>
      </div>`;
    $("mFolderClients").onclick = () => navigate("clients-folders");
    $("mFolderFlash").onclick = () => navigate("flash-space");
    $("mFactFilter").onclick = () => { factFilter = factFilter === "ALL" ? "PENDING" : factFilter === "PENDING" ? "VALIDATED" : "ALL"; renderFactures(); };
    $("mFactSearch").oninput = e => { searchQuery = e.target.value; $("mFactList").innerHTML = factListHTML(); bindFactRows(); };
    bindFactRows();
  }

  /* ---------- Écran « Balance » (total masquable + TVA à reverser + historique) ---------- */
  // Montants cachés à chaque ouverture : on les voit seulement en touchant l'œil
  let hideAmounts = true;
  function renderBalance() {
    const tot = p => calcProjectTotals(p);
    const net = p => { const t = tot(p); return t.ttc - t.tva; };   // montant hors TVA : la TVA n'est pas un gain
    const invoices = [...(state.projects || []), ...(state.flashQuotes || [])];
    const valid = invoices.filter(p => p.status === "VALIDATED");
    const wait = invoices.filter(p => p.status !== "VALIDATED");
    const exps = (state.expenses || []).filter(e => typeof isExpenseApproved !== "function" || isExpenseApproved(e));
    const ca = revenueHTForPeriod("ALL", "ALL").net;   // avoirs déduits (calcul commun avec l'ordinateur)
    const dep = exps.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const pending = wait.reduce((s, p) => s + net(p), 0);
    // TVA : factures validées avec TVA, à reverser à l'État (part non retenue par la société cliente) — calcul commun (index.html)
    const tvaAll = tvaSums(tvaInvoicesAll());
    const tvaDue = tvaAll.due;
    const money = v => hideAmounts ? `<span class="m-masked">••••••</span>` : `${formatFCFA(v)} FCFA`;
    const hist = [
      ...valid.map(p => ({ d: parseAnyDateToYMD(p.date), t: p.name, s: "Facture validée (hors TVA)", v: net(p), cls: "m-status-ok", sign: "+" })),
      ...wait.map(p => ({ d: parseAnyDateToYMD(p.date), t: p.name, s: "Proforma en attente", v: net(p), cls: "m-status-wait", sign: "" })),
      ...exps.map(e => ({ d: parseAnyDateToYMD(e.date), t: e.name, s: e.category || "Dépense", v: Number(e.amount) || 0, cls: "m-status-ko", sign: "−" })),
      ...(state.creditNotes || []).filter(cn => cn && findInvoice(cn.invoiceId, cn.isFlash)).map(cn => ({ d: cn.date, t: "Avoir " + formatCreditNoteNumber(cn), s: "Avoir (hors TVA)", v: creditNoteTotals(cn).ht, cls: "m-status-ko", sign: "−" }))
    ].sort((a, b) => String(b.d).localeCompare(String(a.d))).slice(0, 40);
    const rcv = receivablesTotals(receivableEntries());
    main.innerHTML = `
      <div class="m-page-title">Finances</div>
      <div class="m-balance-card">
        <div class="m-balance-top">
          <div class="m-balance-label"><span>Total Balance</span><button type="button" class="m-eye" id="mEye" aria-label="Afficher / masquer">${I.eye}</button></div>
          <div class="m-balance-value">${money(ca - dep)}</div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:6px;">Hors TVA : la TVA est à reverser à l'État, ce n'est pas un bénéfice.</div>
        </div>
        <div class="m-balance-bottom">
          <div>Factures validées<strong>${money(ca)}</strong></div>
          <div style="text-align:center;">Dépenses<strong style="color:#ef4444;">${money(dep)}</strong></div>
          <div style="text-align:right;">En attente<strong>${money(pending)}</strong></div>
        </div>
      </div>
      <div class="m-tva-card" id="mTvaCard" style="cursor:pointer;">
        <div class="m-tva-head">
          <div><div class="m-tva-title">TVA à reverser à l'État</div>
          <div class="m-tva-note">${tvaAll.nDue} facture(s) à verser · touchez pour gérer la TVA ›</div></div>
          <div class="m-tva-total">${money(Math.max(0, tvaDue))}</div>
        </div>
      </div>
      <div class="m-tva-card m-rcv-card" id="mRcvCard" style="cursor:pointer;">
        <div class="m-tva-head">
          <div><div class="m-tva-title">À encaisser</div>
          <div class="m-tva-note">${rcv.count} facture(s) non soldée(s)${rcv.lateCount ? " · " + rcv.lateCount + " en retard" : ""} · touchez pour voir la liste ›</div></div>
          <div class="m-tva-total">${money(rcv.rest)}</div>
        </div>
      </div>
      <div class="m-sheet-card">
        <div class="m-grabber"></div>
        <div class="m-sheet-head"><h2>Historiques</h2><button type="button" class="m-filter-btn" id="mFinAll" style="color:var(--accent-btn); font-size:16px;">Tout</button></div>
        ${hist.length === 0 ? `<div class="m-empty">Aucun mouvement pour le moment.</div>` : hist.map(h => `
          <div class="m-list-row" style="cursor:default;">
            <div class="l"><div class="t">${esc(h.t)}</div><div class="s">${esc(formatYMDToFRDisplay(h.d))}</div></div>
            <div class="r"><div class="t ${h.cls}">${hideAmounts ? '••••' : h.sign + ' ' + formatFCFA(h.v) + ' FCFA'}</div><div class="s" style="text-transform:none;">${esc(h.s)}</div></div>
          </div>`).join("")}
      </div>`;
    $("mEye").onclick = () => { hideAmounts = !hideAmounts; renderBalance(); };
    $("mFinAll").onclick = () => navigate("finances");
    $("mTvaCard").onclick = () => navigate("m-tva");
    $("mRcvCard").onclick = () => navigate("fin-receivables");
  }

  /* ---------- Petite fenêtre de confirmation au style de l'application (remplace les fenêtres système) ---------- */
  function mDialog({ title, text, okLabel = "Confirmer", cancelLabel = "Annuler", danger = false, input = null }) {
    return new Promise(resolve => {
      const ov = document.createElement("div");
      ov.className = "m-sheet-overlay m-dialog-overlay no-print";
      ov.innerHTML = `
        <div class="m-sheet-panel m-dialog">
          <div class="m-grabber"></div>
          <div class="m-sheet-title">${esc(title)}</div>
          <div class="m-dialog-text">${esc(text)}</div>
          ${input ? `<div class="m-dialog-input"><input type="text" inputmode="decimal" value="${esc(input.value)}" /><span>${esc(input.suffix || "")}</span></div>` : ""}
          <div class="m-dialog-actions">
            <button type="button" class="m-dialog-btn cancel">${esc(cancelLabel)}</button>
            <button type="button" class="m-dialog-btn ok ${danger ? "danger" : ""}">${esc(okLabel)}</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      const field = ov.querySelector("input");
      if (field) setTimeout(() => { field.focus(); field.select(); }, 80);
      const done = v => { ov.remove(); resolve(v); };
      ov.addEventListener("click", e => { if (e.target === ov) done(input ? null : false); });
      ov.querySelector(".cancel").onclick = () => done(input ? null : false);
      ov.querySelector(".ok").onclick = () => done(input ? field.value : true);
      if (field) field.addEventListener("keydown", e => { if (e.key === "Enter") done(field.value); });
    });
  }

  window.digitMobileDialog = mDialog;

  /* ---------- Rubrique « TVA » (comptable) : TVA à reverser à l'État, versée ou non ---------- */
  let tvaFilter = "DUE";
  let tvaYear = String(new Date().getFullYear());
  function renderTva() {
    const tot = p => calcProjectTotals(p);
    // Calcul commun avec la rubrique TVA de l'ordinateur et la page Finances (index.html : computeTvaSummary)
    const S = computeTvaSummary(tvaYear);
    tvaYear = S.year;   // une année sans facture revient à « Toutes »
    const paidAmt = tvaPaidAmountOf;
    const { years, list, due, paid, recap } = S;
    const sumDue = Math.max(0, S.sums.due), sumPaid = S.sums.paid, sumRet = S.sums.ret;
    const shown = tvaFilter === "DUE" ? due : tvaFilter === "PAID" ? paid : list;
    const money = v => hideAmounts ? `<span class="m-masked">••••••</span>` : `${formatFCFA(v)} FCFA`;
    const num = v => hideAmounts ? "••••" : formatFCFA(v);
    const clientOf = tvaClientLabel;
    const row = p => {
      const t = tot(p), isPaid = !!p.tvaPaidDate;
      const e = invoiceTvaEffective(p);
      return `<div class="m-tva-item ${isPaid ? "paid" : ""}">
        <div class="m-tva-item-top">
          <div><div class="t">${esc(p.name)}</div><div class="s">${esc(clientOf(p))} · ${esc(formatYMDToFRDisplay(parseAnyDateToYMD(p.date)))}</div></div>
          <span class="m-tva-chip ${isPaid ? "ok" : "due"}">${isPaid ? "Versée" : "À verser"}</span>
        </div>
        <div class="m-tva-lines">
          <div><span>TVA de la facture (${esc(p.tvaPercent)} %)</span><b>${money(e.tva)}</b></div>
          ${e.creditTva ? `<div><span>dont avoirs déduits</span><b>− ${money(e.creditTva)}</b></div>` : ""}
          <div><span>Retenue et versée par la société${t.tvaRetenue > 0 ? " (" + esc(Number(p.tvaRetainedPercent)) + " %)" : ""}</span><b>${money(e.ret)}</b></div>
          <div class="big"><span>${isPaid ? "Versée par nous" : "À verser par nous"}</span><b>${money(isPaid ? paidAmt(p) : Math.max(0, e.aReverser))}</b></div>
          ${isPaid ? `<div class="s"><span>Versée le ${esc(formatYMDToFRDisplay(p.tvaPaidDate))}${p.tvaPaidBy ? " par " + esc(p.tvaPaidBy) : ""}</span></div>` : ""}
        </div>
        <div class="m-tva-actions">
          ${isPaid
            ? `<button type="button" class="m-tva-btn undo" data-act="undo" data-id="${esc(p.id)}">${I.undo}<span>Annuler le paiement</span></button>`
            : `<button type="button" class="m-tva-btn pay" data-act="pay" data-id="${esc(p.id)}">${I.check}<span>Marquer comme versée</span></button>
               <button type="button" class="m-tva-btn" data-act="ret" data-id="${esc(p.id)}">${I.percent}<span>Société retient : ${esc(Number(p.tvaRetainedPercent) || 0)} %</span></button>`}
        </div>
      </div>`;
    };
    main.innerHTML = `
      <div class="m-page-title">TVA</div>
      ${years.length ? `<div class="m-pills m-years">
        ${years.map(y => `<button type="button" class="m-pill ${tvaYear === y ? "active" : ""}" data-y="${esc(y)}">${esc(y)}</button>`).join("")}
        <button type="button" class="m-pill ${tvaYear === "ALL" ? "active" : ""}" data-y="ALL">Toutes</button>
      </div>` : ""}
      <div class="m-tva-card">
        <div class="m-tva-head">
          <div><div class="m-tva-title">Reste à verser à l'État${tvaYear === "ALL" ? "" : " — " + esc(tvaYear)}</div>
          <div class="m-tva-note">La TVA n'est pas un bénéfice : c'est de l'argent à reverser.</div></div>
          <button type="button" class="m-eye" id="mTvaEye" aria-label="Afficher / masquer">${I.eye}</button>
        </div>
        <div class="m-tva-total" style="font-size:28px; margin-top:8px;">${money(sumDue)}</div>
        <div class="m-tva-sums"><div>Déjà versée<strong>${money(sumPaid)}</strong></div><div style="text-align:right;">Retenue par les sociétés<strong>${money(sumRet)}</strong></div></div>
      </div>
      <div class="m-pills">
        ${[["DUE", "À verser", due.length], ["PAID", "Versées", paid.length], ["ALL", "Toutes", list.length]].map(([k, l, n]) => `<button type="button" class="m-pill ${tvaFilter === k ? "active" : ""}" data-f="${k}">${l} (${n})</button>`).join("")}
      </div>
      ${recap.length ? `<div class="m-tva-recap">
        <div class="m-tva-title" style="margin-bottom:8px;">Récapitulatif par année <span style="font-size:11px; color:var(--text-muted); font-weight:600;">(en FCFA)</span></div>
        <div class="m-tva-recap-grid m-tva-recap-head"><span>Année</span><span>TVA facturée</span><span>Retenue sociétés</span><span>Versée</span><span>Reste à verser</span></div>
        ${recap.map(r => `<div class="m-tva-recap-grid ${tvaYear === r.y ? "on" : ""}" data-y="${esc(r.y)}"><b>${esc(r.y)}</b><span>${num(r.tva)}</span><span>${num(r.ret)}</span><span>${num(r.paid)}</span><span class="due">${num(r.due)}</span></div>`).join("")}
      </div>` : ""}
      ${shown.length === 0 ? `<div class="m-empty">${list.length === 0 ? "Aucune facture validée avec TVA pour le moment." : tvaFilter === "DUE" ? "Rien à verser : toute la TVA est à jour." : "Aucune TVA versée pour le moment."}</div>` : shown.map(row).join("")}`;
    $("mTvaEye").onclick = () => { hideAmounts = !hideAmounts; renderTva(); };
    main.querySelectorAll(".m-pill[data-f]").forEach(b => b.onclick = () => { tvaFilter = b.dataset.f; renderTva(); });
    main.querySelectorAll("[data-y]").forEach(b => b.onclick = () => { tvaYear = b.dataset.y; renderTva(); });
    main.querySelectorAll("[data-act]").forEach(b => b.onclick = async () => {
      const p = list.find(x => String(x.id) === b.dataset.id);
      if (!p) return;
      const t = tot(p);
      if (b.dataset.act === "pay") {
        if (!(await mDialog({ title: "TVA versée à l'État ?", text: `Confirmez que la TVA de « ${p.name} » (${formatFCFA(Math.max(0, invoiceTvaEffective(p).aReverser))} FCFA) a bien été versée à l'État.`, okLabel: "Oui, elle est versée" }))) return;
        tvaMarkPaid(p);   // enregistre aussi p._updatedAt et sauvegarde
      } else if (b.dataset.act === "undo") {
        if (!(await mDialog({ title: "Annuler le paiement ?", text: `La TVA de « ${p.name} » redeviendra « à verser ».`, okLabel: "Annuler le paiement", cancelLabel: "Garder", danger: true }))) return;
        tvaUndoPaid(p);
      } else if (b.dataset.act === "ret") {
        const ans = await mDialog({ title: "Part retenue par la société", text: "Quel pourcentage de la TVA la société retient-elle (et verse elle-même à l'État) ? Exemple : 40. Mettez 0 si elle ne retient rien.", okLabel: "Enregistrer", input: { value: String(Number(p.tvaRetainedPercent) || 0), suffix: "%" } });
        if (ans === null) return;
        const v = tvaParsePercent(ans);
        if (v === null) { showToast("Entrez un nombre entre 0 et 100.", true); return; }
        tvaSetRetainedPercent(p, v);
      }
      renderTva();
    });
  }

  /* ---------- Écran « Gestion » (grandes cartes colorées + compte) ---------- */
  function renderMenu() {
    const r = role();
    const acc = getCurrentAccount();
    const cards = [];
    const add = (cls, icon, title, sub, fn) => cards.push({ cls, icon, title, sub, fn });
    if (r === "ADMIN") add("m-c1", svgIcon("users", 36, "#38bdf8"), "Personnels", "Gérez les membres de votre équipe", () => navigate("gestion-sub", { module: "accounts" }));
    if (allowed("clients-folders")) add("m-c2", svgIcon("building", 36, "#4ade80"), "Clients", "Suivez et organisez vos clients", () => navigate("clients-folders"));
    if (allowed("gestion-sub")) {
      add("m-c3", svgIcon("briefcase", 36, "#facc15"), "Prestataires", "Gérez vos partenaires externes", () => navigate("gestion-sub", { module: "prestataires" }));
      add("m-c4", svgIcon("wrench", 36, "#38bdf8"), "Fournisseurs", "Suivez vos fournisseurs", () => navigate("gestion-sub", { module: "fournisseurs" }));
      add("m-c7", svgIcon("template", 36, "#c084fc"), "Templates de prix", "Vos packs Mariage, Spot, Shooting...", () => navigate("gestion-sub", { module: "pricing-templates" }));
    }
    if (allowed("finances")) add("m-c6", svgIcon("calculator", 36, "#f59e0b"), "TVA à reverser", "Suivi de la TVA due à l'État", () => navigate("m-tva"));
    if (allowed("prod-projects")) add("m-c5", svgIcon("calendar", 36, "#818cf8"), "Planning", "Organisez mieux vos activités", () => navigate("prod-projects"));
    if (allowed("equip-inventory")) add("m-c8", svgIcon("camera", 36, "#e2e8f0"), "Parc matériel", "Appareils, états et QR codes", () => navigate("equip-inventory"));
    if (allowed("expenses") && r !== "COMPTABLE") add("m-c6", svgIcon("calculator", 36, "#fda4af"), "Dépenses", "Saisie et validation des dépenses", () => navigate("expenses"));
    if (r === "COMPTABLE") add("m-c6", svgIcon("calendar", 36, "#fda4af"), "Calendrier des tournages", "Tournages, livraisons et événements", () => navigate("prod-calendar"));
    add("m-c5", svgIcon("userX", 36, "#a5b4fc"), r === "ADMIN" || r === "PDG" ? "Absences de l'équipe" : "Mes absences", "Congés, missions et autres absences", () => navigate("absences"));
    if (allowed("param-journal")) add("m-c7", svgIcon("history", 36, "#c4b5fd"), "Journal des actions", r === "PDG" ? "Qui a fait quoi (lecture seule)" : "Qui a fait quoi et quand", () => navigate("param-journal"));
    if (r === "ADMIN" || r === "PDG") add("m-c8", svgIcon("link", 36, "#93c5fd"), "Connecteur IA", "Claude, ChatGPT et autres IA", () => navigate("param-ia"));
    if (r === "ADMIN") {
      add("m-c6", svgIcon("pen", 36, "#f43f5e"), "Logo, signatures & cachets", "Documents et cachets officiels", () => navigate("gestion-sub", { module: "signatures" }));
      add("m-c8", svgIcon("user", 36, "#e2e8f0"), "Paramètres du studio", "Coordonnées, RIB, modèles de factures", () => navigate("account"));
    }
    main.innerHTML = `
      <div class="m-page-title">Gestion</div>
      <div class="m-cards">
        ${cards.map((c, i) => `<button type="button" class="m-card ${c.cls}" data-i="${i}"><span class="ic">${c.icon}</span><span class="tx"><b>${esc(c.title)}</b><span>${esc(c.sub)}</span></span><span class="ch">›</span></button>`).join("")}
      </div>
      <div class="m-section-title">Mon compte</div>
      ${acc ? `<div class="m-profile">${renderEmployeeAvatarHTML(acc, 54)}<div><div style="font-size:17px; font-weight:800;">${esc(acc.name)}</div><div style="font-size:13px; color:var(--text-muted);">${esc(getRoleLabel(acc.accountType))} — ${esc(acc.jobTitle || '')}</div></div></div>` : ''}
      <button type="button" class="m-row-btn" id="mNotifBtn"><span>${svgIcon("bell", 18)} &nbsp;Notifications</span><span>›</span></button>
      <button type="button" class="m-row-btn" id="mNotifAllow"><span>${svgIcon("check", 18)} &nbsp;Activer les alertes sur ce téléphone</span><span>›</span></button>
      ${allowed("clients-folders") ? `<button type="button" class="m-row-btn" id="mVerifyBtn"><span>${svgIcon("shield", 18)} &nbsp;Vérifier un document</span><span>›</span></button>` : ''}
      <button type="button" class="m-row-btn" id="mThemeBtn"><span>${svgIcon("eye", 18)} &nbsp;Thème : ${state.theme === "light" ? "Clair" : "Noir"}</span><span>Changer</span></button>
      ${r === "ADMIN" ? `
        <button type="button" class="m-row-btn" id="mDbBtn"><span>${svgIcon("drive", 18)} &nbsp;Base de données & Cloud</span><span>›</span></button>
        <button type="button" class="m-row-btn" id="mTrashBtn"><span>${svgIcon("trash", 18)} &nbsp;Corbeille (${(state.trash || []).length})</span><span>›</span></button>` : ''}
      <button type="button" class="m-row-btn danger" id="mLogoutBtn"><span>${svgIcon("logout", 18, "#ef4444")} &nbsp;Déconnexion</span><span></span></button>
      <div style="text-align:center; font-size:11.5px; color:var(--text-muted); margin:14px 0 4px;">Digit Impact Studio — version téléphone</div>`;
    main.querySelectorAll(".m-card").forEach(b => b.onclick = () => cards[Number(b.dataset.i)].fn());
    $("mNotifBtn").onclick = () => openNotificationsModal();
    $("mNotifAllow").onclick = () => { try { requestOSNotificationAndSoundPermission(); } catch (e) {} };
    if ($("mVerifyBtn")) $("mVerifyBtn").onclick = () => openDocVerifyModal();
    $("mThemeBtn").onclick = () => { changeTheme(state.theme === "light" ? "black" : "light"); renderMenu(); };
    if ($("mDbBtn")) $("mDbBtn").onclick = () => navigate("param-db");
    if ($("mTrashBtn")) $("mTrashBtn").onclick = () => navigate("param-trash");
    $("mLogoutBtn").onclick = () => logoutCurrentUser();
  }

  /* ---------- Photo de profil : menu « Mon compte » (notifications, base de données, corbeille, déconnexion) ---------- */
  function openAccountSheet() {
    const old = document.getElementById("mAccountSheet");
    if (old) old.remove();
    const r = role();
    const acc = getCurrentAccount();
    const rows = [];
    const add = (id, icon, label, fn, cls) => rows.push({ id, icon, label, fn, cls });
    if (r === "ADMIN") add("profil", svgIcon("user", 18), "Mon compte, logo & coordonnées", () => navigate("param-profile"));
    add("notif", svgIcon("bell", 18), "Notifications", () => openNotificationsModal());
    add("allow", svgIcon("check", 18), "Activer les alertes sur ce téléphone", () => { try { requestOSNotificationAndSoundPermission(); } catch (e) {} });
    if (r === "ADMIN") {
      add("studio", svgIcon("template", 18), "Paramètres du studio", () => navigate("account"));
      add("db", svgIcon("drive", 18), "Base de données & Cloud", () => navigate("param-db"));
      add("trash", svgIcon("trash", 18), `Corbeille (${(state.trash || []).length})`, () => navigate("param-trash"));
    }
    add("logout", svgIcon("logout", 18, "#ef4444"), "Déconnexion", () => logoutCurrentUser(), "danger");
    const ov = document.createElement("div");
    ov.id = "mAccountSheet";
    ov.className = "m-sheet-overlay no-print";
    ov.innerHTML = `
      <div class="m-sheet-panel">
        <div class="m-grabber"></div>
        <div class="m-sheet-title">Mon compte</div>
        ${acc ? `<div class="m-profile" style="margin-bottom:12px;">${renderEmployeeAvatarHTML(acc, 54)}<div><div style="font-size:17px; font-weight:800;">${esc(acc.name)}</div><div style="font-size:13px; color:var(--text-muted);">${esc(getRoleLabel(acc.accountType))}${acc.jobTitle ? " — " + esc(acc.jobTitle) : ""}</div>${acc.username ? `<div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Identifiant : ${esc(acc.username)}</div>` : ""}</div></div>` : ""}
        ${rows.map(x => `<button type="button" class="m-row-btn ${x.cls || ""}" data-id="${x.id}"><span>${x.icon} &nbsp;${esc(x.label)}</span><span>${x.id === "logout" ? "" : "›"}</span></button>`).join("")}
        <button type="button" class="m-next-btn" id="mAccClose" style="margin-top:12px;">Fermer</button>
      </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    $("mAccClose").onclick = close;
    ov.querySelectorAll(".m-row-btn").forEach(b => b.onclick = () => { const x = rows.find(y => y.id === b.dataset.id); close(); if (x) x.fn(); });
  }

  /* ---------- Bouton « + » : « Que voulez-vous faire ? » ---------- */
  function openPlusSheet() {
    const r = role();
    const main2 = [], extra = [];
    if (allowed("add-client")) {
      main2.push({ id: "client", label: "Nouveau client", icon: I.building, run: () => navigate("add-client") });
      main2.push({ id: "flash", label: "Devis rapide", icon: I.bolt, run: () => openFlashModal() });
    }
    const ops = [];
    if (allowed("prod-projects")) ops.push({ id: "projet", label: "Nouveau projet", icon: I.clapper, run: () => { navigate("prod-projects"); openNewProdProjectModal(); } });
    if (allowed("equip-checkout")) ops.push({ id: "sortie", label: "Sortie matériel", icon: I.box, run: () => navigate("equip-checkout") });
    if (allowed("expenses")) ops.push({ id: "depense", label: "Nouvelle dépense", icon: I.wallet, run: () => { navigate("expenses"); toggleExpenseDrawer(true); setTimeout(() => { const el = $("rightPanel"); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 80); } });
    if (allowed("clients-folders")) ops.push({ id: "facture", label: "Facture d'un client", icon: I.doc, run: () => navigate("clients-folders") });
    if (allowed("equip-reservations")) ops.push({ id: "reserver", label: "Réserver du matériel", icon: I.calendar, run: () => { navigate("equip-reservations"); setTimeout(() => openReservationDialog(), 60); } });
    if (["ADMIN", "PDG", "COMPTABLE"].includes(r)) ops.push({ id: "encaisser", label: "Paiement reçu", icon: I.cash, run: () => navigate("fin-receivables") });
    if (r === "ADMIN" || r === "PDG") ops.push({ id: "absence", label: "Absence", icon: I.userMinus, run: () => { navigate("absences"); setTimeout(() => openAbsenceDialog(), 60); } });
    if (!main2.length) { main2.push(...ops.splice(0, 2)); extra.push(...ops); } else extra.push(...ops);
    const all = [...main2, ...extra];
    let selected = null;
    const ov = document.createElement("div");
    ov.className = "m-sheet-overlay no-print";
    ov.innerHTML = `
      <div class="m-sheet-panel">
        <div class="m-grabber"></div>
        <div class="m-sheet-title">Que voulez-vous faire ?</div>
        <div class="m-tiles">${main2.map(t => `<button type="button" class="m-tile" data-id="${t.id}">${t.icon}<span>${t.label}</span></button>`).join("")}</div>
        ${extra.length ? `<div class="m-sheet-sub">Autres actions</div><div class="m-tiles-small">${extra.map(t => `<button type="button" class="m-tile" data-id="${t.id}">${t.icon}<span>${t.label}</span></button>`).join("")}</div>` : ""}
        <button type="button" class="m-next-btn" id="mNextBtn">Suivant</button>
      </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    ov.querySelectorAll(".m-tile").forEach(b => b.onclick = () => {
      selected = b.dataset.id;
      ov.querySelectorAll(".m-tile").forEach(x => x.classList.toggle("selected", x === b));
      $("mNextBtn").classList.add("ready");
    });
    $("mNextBtn").onclick = () => {
      const t = all.find(x => x.id === selected);
      if (!t) return showToast("Choisissez d'abord une action.", true);
      close();
      t.run();
    };
  }

  /* ---------- Documents A4 : réduits pour tenir dans l'écran du téléphone ---------- */
  function setA4Zoom() {
    const z = Math.max(0.3, Math.min(1, (Math.min(window.innerWidth, 820) - 22) / 816));
    document.documentElement.style.setProperty("--m-a4-zoom", z.toFixed(3));
  }
  setA4Zoom();
  window.addEventListener("resize", setA4Zoom);
  // Pendant la fabrication du PDF, le document reprend sa vraie taille A4
  ["downloadElementAsCleanPDF", "digitSendDisplayedDocToWhatsApp"].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== "function") return;
    window[fn] = async function () {
      document.body.classList.add("pdf-capturing");
      try { return await orig.apply(this, arguments); }
      finally { document.body.classList.remove("pdf-capturing"); }
    };
  });

  /* ---------- Impression : on imprime LE PDF (le même que celui envoyé aux clients, identique au Mac) ---------- */
  // L'impression directe de la page laissait l'iPhone refaire la mise en page (2 pages, pied de page sur 4 lignes).
  // Ici, l'application fabrique le PDF A4, puis l'iPhone l'envoie à l'imprimante (Partager > Imprimer).
  const origPrintDocument = window.printDocument;
  window.printDocument = async function (blackAndWhite) {
    const src = document.getElementById("cleanPdfTarget") || document.getElementById("cleanCheckoutPdf") || document.getElementById("cleanQrSheetPdf");
    if (!src) return origPrintDocument.apply(this, arguments);
    // Même nom de fichier que le bouton « Télécharger »
    let filename = "Document.pdf";
    const dl = Array.from(document.querySelectorAll("#a4PrintContainer [onclick*='downloadElementAsCleanPDF']"))[0];
    const m = dl && String(dl.getAttribute("onclick")).match(/downloadElementAsCleanPDF\('[^']*',\s*'([^']+)'/);
    if (m) filename = m[1];
    try {
      showToast("Préparation du PDF pour l'impression...");
      const blob = await digitMakePdfBlob(src, filename, { grayscale: !!blackAndWhite });
      showPhoneShareSheet(new File([blob], filename, { type: "application/pdf" }), "", blob, filename, "print");
    } catch (e) { console.error(e); showToast("Impossible de préparer l'impression sur ce téléphone.", true); }
  };


  /* ---------- Notifications téléphone (Web Push) : activées d'elles-mêmes, reçues même écran éteint ---------- */
  // Clé PUBLIQUE (sans danger). La clé privée reste uniquement dans Supabase.
  const VAPID_PUBLIC_KEY = "BBHfjhSQi4gf83lHZB3uTOU1W0VxCjKEo1_I25fTc0f-umMlWKhNTuarBbSwKyA6qLAT6blOXwBP1tPuj5aqRx8";
  const PUSH_SAVED_KEY = "DIS_PUSH_SAVED_V1";
  let pushBusy = false, pushAsked = false;
  function b64ToBytes(b64) {
    const pad = "=".repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }
  function pushSupported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && /^https?:$/.test(location.protocol); }
  // Abonne ce téléphone aux notifications et l'enregistre dans Supabase pour le compte connecté
  async function ensurePushSubscription() {
    if (pushBusy || !pushSupported() || Notification.permission !== "granted") return false;
    const acc = getCurrentAccount();
    const cloud = window.DigitImpactCloud;
    const sb = cloud && cloud.getClient && cloud.getClient();
    if (!acc || !sb) return false;
    pushBusy = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
      window.__digitPushActive = true;
      const stamp = sub.endpoint + "|" + acc.name;
      let saved = ""; try { saved = localStorage.getItem(PUSH_SAVED_KEY) || ""; } catch (e) {}
      if (saved === stamp) return true;
      const { error } = await sb.from("push_subscriptions").upsert({ endpoint: sub.endpoint, account_name: acc.name, subscription: sub.toJSON(), updated_at: new Date().toISOString() });
      if (error) { console.warn("Notifications : enregistrement impossible (table push_subscriptions créée ?)", error.message); return false; }
      try { localStorage.setItem(PUSH_SAVED_KEY, stamp); } catch (e) {}
      return true;
    } catch (e) { console.warn("Notifications : abonnement impossible", e); return false; }
    finally { pushBusy = false; }
  }
  // Activation automatique : dès la première touche après la connexion, on demande l'autorisation (iPhone l'exige après un geste)
  function autoEnableNotifications() {
    if (!pushSupported() || pushAsked) return;
    if (!getCurrentAccount()) return;
    if (Notification.permission === "granted") { pushAsked = true; ensurePushSubscription(); return; }
    if (Notification.permission === "denied") { pushAsked = true; return; }
    pushAsked = true;
    const once = () => {
      document.removeEventListener("pointerup", once, true);
      try { requestOSNotificationAndSoundPermission(); } catch (e) {}
    };
    document.addEventListener("pointerup", once, true);
  }
  setInterval(autoEnableNotifications, 3000);
  // Le bouton « Activer les alertes » (et l'activation automatique) abonnent aussi le téléphone
  const origReqNotif = window.requestOSNotificationAndSoundPermission;
  if (typeof origReqNotif === "function") {
    window.requestOSNotificationAndSoundPermission = async function () {
      const r = await origReqNotif.apply(this, arguments);
      ensurePushSubscription().then(ok => { if (!ok && Notification.permission === "granted" && pushSupported()) console.info("Notifications locales actives ; le serveur de notifications n'est pas encore configuré."); });
      return r;
    };
  }
  // Si le téléphone est abonné au serveur, c'est lui qui affiche la notification (pas de doublon) : l'application ne fait que le son
  const origTrigger = window.triggerOSAndSoundNotification;
  if (typeof origTrigger === "function") {
    window.triggerOSAndSoundNotification = function (title, bodyText) {
      if (window.__digitPushActive) { try { playNotificationSound(); } catch (e) {} return; }
      return origTrigger.apply(this, arguments);
    };
  }
  // À la déconnexion, ce téléphone ne reçoit plus les notifications de ce compte
  const origLogout = window.logoutCurrentUser;
  if (typeof origLogout === "function") {
    window.logoutCurrentUser = async function () {
      try {
        const sb = window.DigitImpactCloud && window.DigitImpactCloud.getClient && window.DigitImpactCloud.getClient();
        const reg = pushSupported() && await navigator.serviceWorker.ready;
        const sub = reg && await reg.pushManager.getSubscription();
        if (sb && sub) await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        localStorage.removeItem(PUSH_SAVED_KEY);
      } catch (e) {}
      pushAsked = false;
      return origLogout.apply(this, arguments);
    };
  }

  buildTabbar();
  refreshChrome();
  // La page a parfois été dessinée avant le chargement de la version téléphone (base locale très rapide) :
  // on la redessine pour avoir les onglets du haut et la mise en page du téléphone
  try { if (getCurrentAccount() && currentView) navigate(currentView); } catch (e) {}
})();
