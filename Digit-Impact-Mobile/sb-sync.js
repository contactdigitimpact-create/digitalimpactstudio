/* =========================================================================
   Digit Impact Studio — Synchronisation Supabase (temps réel)
   -------------------------------------------------------------------------
   Ce fichier REMPLACE l'ancienne synchronisation (Google Drive / Apps Script).
   Principe :
   - chaque élément (client, projet, dépense...) = 1 ligne dans la table app_data
   - on n'envoie que ce qui a changé (au lieu de toute la base)
   - les autres postes reçoivent les changements instantanément (Realtime)
   - connexion via un compte "entreprise" Supabase (sans lui, rien n'est lisible)
   - les mots de passe des employés sont stockés hachés (PBKDF2), jamais en clair
   ========================================================================= */
(function () {
  "use strict";

  const SB_URL = "https://pydirhnchnvcxmyeeamj.supabase.co";
  // Clé PUBLIQUE (publishable) : prévue pour être dans une application.
  const SB_KEY = "sb_publishable_n4wsVO8ErjKmcW1njd54EA_KKIfHu4A";
  const TABLE = "app_data";
  const SNAP_KEY = "DIGIT_IMPACT_SB_SNAPSHOT_V1";

  const COLLS = [
    "accounts", "notifications", "signatures", "pricingTemplates", "expenseTemplates",
    "projectTypes", "clientLogoTemplates", "clients", "projects", "flashQuotes",
    "prodProjects", "expenses", "equipments", "equipmentLogs", "prestataires",
    "fournisseurs", "trash",
    // v1.19 : un enregistrement par paiement, avoir, contrat, réservation, entretien, action du journal, absence, événement
    "payments", "creditNotes", "recurringInvoices", "equipmentReservations", "maintenanceLogs",
    "auditLog", "absences", "calendarEvents"
  ];
  const SETTINGS = [
    "selectedTemplate", "nextInvoiceSeq", "nextCheckoutSeq", "whatsappGroupLink",
    "companyInfo", "clientSectors", "equipmentCategories", "ownerAccountId", "expenseCollectiveThreshold", "docVerifySecret", "accountVaultKey",
    "nextCreditNoteSeq", "defaultPaymentDelayDays", "aiConnector", "aiConnectors"
  ];
  // Compteurs : on garde toujours le plus grand (deux postes ne peuvent jamais donner le même numéro deux fois de suite)
  const COUNTERS = ["nextInvoiceSeq", "nextCheckoutSeq", "nextCreditNoteSeq"];

  let client = null;
  let session = null;
  let channel = null;
  let bootPromise = null;
  let wasDown = false;
  let lastFullSync = 0;
  let snap = loadSnap();
  const pendingEcho = new Map();
  let chain = Promise.resolve();
  let uiTimer = null;

  /* ---------- petits outils ---------- */
  function canon(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined)
      .map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  function loadSnap() {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveSnap() {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(snap)); } catch (e) {}
  }
  function snapGet(c, id) { return snap[c] ? snap[c][id] : undefined; }
  function snapSet(c, id, h) { (snap[c] || (snap[c] = {}))[id] = h; }
  function snapDel(c, id) { if (snap[c]) delete snap[c][id]; }
  function enqueue(fn) {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  }
  function newer(a, b) { return (Number(a && a._updatedAt) || 0) > (Number(b && b._updatedAt) || 0); }
  function toast(msg, isErr) { try { showToast(msg, !!isErr); } catch (e) {} }
  function frError(err) {
    const m = String((err && err.message) || err || "");
    if (/invalid login/i.test(m)) return "E-mail ou mot de passe entreprise incorrect.";
    if (/failed to fetch|network|load failed/i.test(m)) return "Pas de connexion Internet (ou serveur injoignable).";
    return m || "Erreur inconnue.";
  }
  function setStatus(st) {
    try { cloudConnectedStatus = st; updateTopCloudSyncButtonUI(); } catch (e) {}
    try { if (currentView === "param-db") renderDatabaseAndServerHub(document.getElementById("mainView")); } catch (e) {}
  }
  function isOffByUser() { try { return isOnlineServerManuallyDisconnected(); } catch (e) { return false; } }

  /* ---------- mots de passe hachés ---------- */
  const HASH_PREFIX = "pbkdf2$";
  function b64(buf) { let s = ""; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b)); return btoa(s); }
  function unb64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  async function pbkdf2(plain, salt, iter) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), "PBKDF2", false, ["deriveBits"]);
    return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  }
  async function hashPassword(plain) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iter = 100000;
    return HASH_PREFIX + iter + "$" + b64(salt) + "$" + b64(await pbkdf2(plain, salt, iter));
  }
  async function verifyPassword(stored, plain) {
    stored = String(stored || "");
    if (!stored.startsWith(HASH_PREFIX)) return stored === plain;
    const [, iter, salt, expected] = stored.split("$");
    return b64(await pbkdf2(plain, unb64(salt), Number(iter))) === expected;
  }
  /* ---------- coffre des mots de passe (consultables par l'administrateur) ----------
     La connexion utilise toujours l'empreinte PBKDF2 (irréversible). En plus, une copie chiffrée (AES-GCM)
     permet à un administrateur d'afficher le mot de passe d'un membre de l'équipe. */
  const VAULT_PREFIX = "aesgcm$";
  function hexToBytes(h) { const u = new Uint8Array(h.length / 2); for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16); return u; }
  async function vaultKey(create) {
    if (!state.accountVaultKey && create) {
      state.accountVaultKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    }
    if (!state.accountVaultKey) return null;
    return crypto.subtle.importKey("raw", hexToBytes(state.accountVaultKey), "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  async function vaultEncrypt(plain) {
    const key = await vaultKey(true);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
    return VAULT_PREFIX + b64(iv) + "$" + b64(ct);
  }
  async function vaultDecrypt(enc) {
    if (!enc || !String(enc).startsWith(VAULT_PREFIX)) return null;
    const key = await vaultKey(false);
    if (!key) return null;
    const [, iv, ct] = String(enc).split("$");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
    return new TextDecoder().decode(pt);
  }

  async function ensurePasswordsHashed() {
    let changed = false;
    for (const a of (state.accounts || [])) {
      if (a && typeof a.password === "string" && a.password !== "" && !a.password.startsWith(HASH_PREFIX)) {
        try { a.passwordEnc = await vaultEncrypt(a.password); } catch (e) {}
        a.password = await hashPassword(a.password);
        a._updatedAt = Date.now();
        changed = true;
      }
    }
    return changed;
  }

  /* ---------- anti-devinette de mot de passe ---------- */
  const LOCK_KEY = "DIGIT_IMPACT_LOGIN_GUARD";
  function readGuard() { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function lockSecondsLeft() { const g = readGuard(); return g.until && g.until > Date.now() ? Math.ceil((g.until - Date.now()) / 1000) : 0; }
  function registerFailedLogin() {
    const g = readGuard(); g.fails = (g.fails || 0) + 1;
    if (g.fails >= 5) { g.until = Date.now() + Math.min(300000, 15000 * Math.pow(2, g.fails - 5)); }
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(g)); } catch (e) {}
  }
  function resetFailedLogins() { try { localStorage.removeItem(LOCK_KEY); } catch (e) {} }

  /* ---------- modèle local ---------- */
  function ensureIds() {
    COLLS.forEach(c => {
      (state[c] || []).forEach(it => {
        if (it && typeof it === "object" && !it.id) {
          it.id = c + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        }
      });
    });
  }
  // Données incomplètes (ancien fichier, autre poste) : on complète pour ne jamais bloquer l'écran.
  function normProd(p) {
    if (!p || typeof p !== "object") return p;
    if (!Array.isArray(p.stages)) p.stages = [];
    if (!Array.isArray(p.assignees)) p.assignees = [];
    if (typeof p.currentStageIndex !== "number" || isNaN(p.currentStageIndex)) p.currentStageIndex = 0;
    if (!p.stageNotes || typeof p.stageNotes !== "object") p.stageNotes = {};
    return p;
  }
  function cleanRemote(data) {
    try { return digitSanitizeDeep(data); } catch (e) { return data; }
  }

  function localModel() {
    ensureIds();
    const L = getSanitizedSharedState();
    const items = {};
    COLLS.forEach(c => {
      const map = new Map(); const order = [];
      (L[c] || []).forEach(it => {
        if (!it || typeof it !== "object" || !it.id || map.has(it.id)) return;
        map.set(it.id, { data: it, hash: hash(canon(it)) });
        order.push(it.id);
      });
      items[c] = { map, order };
    });
    const settings = {};
    SETTINGS.forEach(k => {
      if (L[k] !== undefined) {
        const data = { v: L[k] };
        settings[k] = { data, hash: hash(canon(data)) };
      }
    });
    return { items, settings };
  }
  function persistLocal() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(getSanitizedSharedState())); } catch (e) {}
    try {
      openIDB().then(db => {
        db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(getSanitizedSharedState(), "MAIN_STATE");
      }).catch(() => {});
    } catch (e) {}
  }

  /* ---------- envoi (uniquement ce qui a changé) ---------- */
  async function pushDiffInner() {
    if (!client || !session) throw new Error("Cloud non connecté");
    await ensurePasswordsHashed();
    const M = localModel();
    const up = [];
    COLLS.forEach(c => {
      M.items[c].map.forEach((v, id) => {
        if (snapGet(c, id) !== v.hash) up.push({ collection: c, id, data: v.data, _h: v.hash });
      });
      const oh = hash(M.items[c].order.join("|"));
      if (snapGet("_order", c) !== oh) up.push({ collection: "_order", id: c, data: { ids: M.items[c].order }, _h: oh });
    });
    Object.keys(M.settings).forEach(k => {
      if (snapGet("_settings", k) !== M.settings[k].hash) {
        up.push({ collection: "_settings", id: k, data: M.settings[k].data, _h: M.settings[k].hash });
      }
    });
    const dels = {};
    // Sécurité : on ne propage jamais de suppressions depuis une base locale vide.
    if (state.accounts && state.accounts.length > 0) {
      COLLS.forEach(c => {
        Object.keys(snap[c] || {}).forEach(id => {
          if (!M.items[c].map.has(id)) (dels[c] || (dels[c] = [])).push(id);
        });
      });
    }
    let batch = [], size = 0;
    const flush = async () => {
      if (!batch.length) return;
      const now = Date.now();
      batch.forEach(r => pendingEcho.set(r.collection + "|" + r.id + "|" + r._h, now + 15000));
      const payload = batch.map(r => ({ collection: r.collection, id: r.id, data: r.data }));
      const { error } = await client.from(TABLE).upsert(payload, { onConflict: "collection,id" });
      if (error) throw error;
      batch.forEach(r => snapSet(r.collection, r.id, r._h));
      saveSnap();
      batch = []; size = 0;
    };
    for (const r of up) {
      const len = JSON.stringify(r.data).length;
      if (batch.length && (size + len > 1500000 || batch.length >= 40)) await flush();
      batch.push(r); size += len;
    }
    await flush();
    for (const c of Object.keys(dels)) {
      for (let i = 0; i < dels[c].length; i += 100) {
        const ids = dels[c].slice(i, i + 100);
        const { error } = await client.from(TABLE).delete().eq("collection", c).in("id", ids);
        if (error) throw error;
        ids.forEach(id => snapDel(c, id));
        saveSnap();
      }
    }
    return { sent: up.length, deleted: Object.values(dels).reduce((n, a) => n + a.length, 0) };
  }

  /* ---------- réception complète + fusion ---------- */
  async function fetchAll() {
    const out = []; let from = 0; const size = 200;
    for (;;) {
      const { data, error } = await client.from(TABLE).select("collection,id,data")
        .order("collection").order("id").range(from, from + size - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < size) break;
      from += size;
    }
    return out;
  }

  function reconcileInner(rows) {
    const rem = {};
    rows.forEach(r => {
      r.data = cleanRemote(r.data);
      (rem[r.collection] || (rem[r.collection] = new Map())).set(r.id, { data: r.data, hash: hash(canon(r.data)) });
    });
    const M = localModel();
    const newSnap = {};
    const next = {};

    COLLS.forEach(c => {
      const remote = rem[c] || new Map();
      const s = snap[c] || {};
      const ns = (newSnap[c] = {});
      const loc = M.items[c].map;
      const out = new Map();
      const localFull = new Map((state[c] || []).filter(x => x && x.id).map(x => [x.id, x]));

      loc.forEach((lv, id) => {
        const rv = remote.get(id); const sh = s[id];
        if (!rv) {
          // Absent du serveur : nouveau ici, modifié ici, ou supprimé par un autre poste
          if (sh === undefined || sh !== lv.hash) {
            out.set(id, localFull.get(id) || lv.data);
            if (sh !== undefined) ns[id] = sh;
          }
          return;
        }
        if (rv.hash === lv.hash) { out.set(id, localFull.get(id) || lv.data); ns[id] = rv.hash; return; }
        let takeRemote;
        if (sh === undefined) takeRemote = !newer(lv.data, rv.data);
        else if (sh === lv.hash) takeRemote = true;
        else if (sh === rv.hash) takeRemote = false;
        else takeRemote = !newer(lv.data, rv.data);
        if (takeRemote) { out.set(id, rv.data); ns[id] = rv.hash; }
        else { out.set(id, localFull.get(id) || lv.data); if (sh !== undefined) ns[id] = sh; }
      });
      remote.forEach((rv, id) => {
        if (loc.has(id)) return;
        if (s[id] !== undefined) { ns[id] = s[id]; return; } // suppression locale en attente d'envoi
        out.set(id, rv.data); ns[id] = rv.hash;
      });

      const ro = rem._order && rem._order.get(c);
      const ids = ro && ro.data && Array.isArray(ro.data.ids) ? ro.data.ids : null;
      let arr = [...out.keys()];
      if (ids) {
        const pos = new Map(ids.map((id, i) => [id, i]));
        const known = arr.filter(id => pos.has(id)).sort((a, b) => pos.get(a) - pos.get(b));
        const fresh = arr.filter(id => !pos.has(id));
        arr = [...fresh, ...known];
        if (arr.join("|") === ids.join("|")) (newSnap._order || (newSnap._order = {}))[c] = ro.hash;
      }
      next[c] = arr.map(id => out.get(id));
    });

    const rs = rem._settings || new Map();
    const nss = (newSnap._settings = newSnap._settings || {});
    const nextSettings = {};
    SETTINGS.forEach(k => {
      const lv = M.settings[k]; const rv = rs.get(k); const sh = snapGet("_settings", k);
      if (!rv) { if (lv) { nextSettings[k] = state[k]; if (sh !== undefined) nss[k] = sh; } return; }
      if (lv && rv.hash === lv.hash) { nextSettings[k] = state[k]; nss[k] = rv.hash; return; }
      if (COUNTERS.includes(k)) {
        const m = Math.max(Number(state[k]) || 1, Number(rv.data.v) || 1);
        nextSettings[k] = m;
        if (m === Number(rv.data.v)) nss[k] = rv.hash;
        return;
      }
      const takeRemote = !lv || sh === undefined || sh === lv.hash || sh !== rv.hash;
      if (takeRemote) { nextSettings[k] = rv.data.v; nss[k] = rv.hash; }
      else { nextSettings[k] = state[k]; if (sh !== undefined) nss[k] = sh; }
    });

    Object.assign(state, next, nextSettings);
    mergeLoadedState(state, true, false); // remet les valeurs par défaut manquantes, sans rien ressusciter
    snap = newSnap;
    saveSnap();
    persistLocal();
  }

  function syncAll() {
    return enqueue(async () => {
      if (!client || !session) throw new Error("Cloud non connecté");
      const rows = await fetchAll();
      reconcileInner(rows);
      // Les vieilles notifications sont effacées du serveur pour ne pas remplir la base gratuite
      try { if (typeof pruneOldNotifications === "function" && pruneOldNotifications() > 0) persistLocal(); } catch (e) {}
      await pushDiffInner();
      lastFullSync = Date.now();
      quietUntil = Date.now() + 4000;
      state.lastDriveSync = new Date().toLocaleString("fr-FR");
      setStatus("CONNECTED");
    });
  }
  function pushNow() {
    return enqueue(async () => {
      const r = await pushDiffInner();
      state.lastDriveSync = new Date().toLocaleString("fr-FR");
      return r;
    });
  }

  /* ---------- temps réel ---------- */
  let quietUntil = 0;       // pas d'alerte pendant la synchronisation initiale
  let lastAlertAt = 0;
  function alertOnce(title, body) {
    const now = Date.now();
    if (now < quietUntil || now - lastAlertAt < 1200) return;
    lastAlertAt = now;
    try { triggerOSAndSoundNotification(title, body); } catch (e) {}
    try { showToast(title + (body ? " — " + body : "")); } catch (e) {}
    try { if (window.digitDesktop && window.digitDesktop.attention && !document.hasFocus()) window.digitDesktop.attention(); } catch (e) {}
  }
  function remoteAlert(c, type, data, prev) {
    let t = null, b = "";
    const role = (typeof getCurrentRole === "function") ? getCurrentRole() : "ADMIN";
    const isCompta = role === "COMPTABLE";
    if (c === "prodProjects" && type === "INSERT" && !isCompta) { t = "Nouveau projet"; b = [data.title, data.clientName].filter(Boolean).join(" — "); }
    else if (c === "projects" && type === "INSERT" && role !== "EDITEUR") { t = "Nouvelle facture / proforma"; b = data.name || ""; }
    else if (c === "flashQuotes" && type === "INSERT" && role !== "EDITEUR") { t = "Nouveau devis express"; b = data.name || ""; }
    else if (c === "clients" && type === "INSERT" && role !== "EDITEUR") { t = "Nouveau client"; b = data.name || ""; }
    else if (c === "expenses" && type === "INSERT" && (role === "ADMIN" || role === "PDG" || isCompta)) { t = data.approval === "PENDING" ? "Dépense à valider" : "Nouvelle dépense"; b = data.name || ""; }
    else if (c === "equipmentLogs" && !isCompta) {
      if (type === "INSERT") { t = "Sortie de matériel"; b = [data.employeeName, data.projectName].filter(Boolean).join(" — "); }
      else if (prev && prev.status !== data.status && data.status === "PENDING_ADMIN" && role !== "EDITEUR") { t = "Retour de matériel déclaré"; b = [data.employeeName, data.projectName].filter(Boolean).join(" — "); }
    }
    if (t) alertOnce(t, b);
  }

  function scheduleUiRefresh(notifItem) {
    persistLocal();
    if (uiTimer) clearTimeout(uiTimer);
    uiTimer = setTimeout(() => {
      uiTimer = null;
      try { checkAndNotifyOverdueProjects(true); } catch (e) {}
      try { refreshActiveViewAfterRemoteSync(); } catch (e) {}
    }, 150);
    if (notifItem) {
      try {
        const acc = getCurrentAccount();
        if (acc && (notifItem.targetAccountName || "").toLowerCase() === acc.name.toLowerCase() &&
            (notifItem.fromName || "").toLowerCase() !== acc.name.toLowerCase()) {
          alertOnce("Digit Impact Studio — " + notifItem.stageName, `Projet : ${notifItem.projectTitle} (par ${notifItem.fromName})`);
        }
      } catch (e) {}
    }
  }

  function onChange(payload) {
    try {
      const type = payload.eventType;
      const rec = type === "DELETE" ? payload.old : payload.new;
      if (!rec || !rec.collection) return;
      const c = rec.collection, id = rec.id;

      if (type === "DELETE") {
        if (snapGet(c, id) === undefined) return;
        // Auto-défense : le compte propriétaire et le compte connecté ne peuvent pas être supprimés à distance.
        if (c === "accounts" && (id === getOwnerAccountId() || id === state.currentUserId)) {
          snapDel(c, id); saveSnap(); pushNow().catch(() => {});
          return;
        }
        snapDel(c, id); saveSnap();
        if (COLLS.includes(c)) {
          state[c] = (state[c] || []).filter(x => !(x && x.id === id));
          scheduleUiRefresh();
        }
        return;
      }

      const data = cleanRemote(rec.data);
      if (c === "prodProjects") normProd(data);
      const h = hash(canon(data));
      const echoKey = c + "|" + id + "|" + h;
      const exp = pendingEcho.get(echoKey);
      if (exp && exp > Date.now()) return;               // écho de notre propre envoi
      if (snapGet(c, id) === h) return;                   // déjà à jour

      if (c === "_settings") {
        if (SETTINGS.includes(id)) {
          if (COUNTERS.includes(id)) state[id] = Math.max(Number(state[id]) || 1, Number(data.v) || 1);
          else if (id === "companyInfo") state[id] = Object.assign({}, defaultDatabase.companyInfo, data.v || {});
          else state[id] = data.v;
          snapSet(c, id, h); saveSnap();
          scheduleUiRefresh();
        }
        return;
      }
      if (c === "_order") {
        if (COLLS.includes(id) && data && Array.isArray(data.ids)) {
          const pos = new Map(data.ids.map((x, i) => [x, i]));
          const arr = state[id] || [];
          const fresh = arr.filter(x => x && !pos.has(x.id));
          const known = arr.filter(x => x && pos.has(x.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
          state[id] = [...fresh, ...known];
          snapSet(c, id, h); saveSnap();
          scheduleUiRefresh();
        }
        return;
      }
      if (!COLLS.includes(c)) return;

      const arr = state[c] || (state[c] = []);
      const idx = arr.findIndex(x => x && x.id === id);
      const prevItem = idx >= 0 ? Object.assign({}, arr[idx]) : null;
      if (idx >= 0) {
        // Modification locale pas encore envoyée ? On garde la version la plus récente.
        const lh = hash(canon(c === "equipmentLogs" ? getSanitizedSharedState().equipmentLogs.find(x => x.id === id) || arr[idx] : arr[idx]));
        const sh = snapGet(c, id);
        // Avals de dépense donnés au même moment sur deux postes : on garde les deux au lieu d'en perdre un
        if (c === "expenses" && arr[idx] && arr[idx].approvals && data.approvals) {
          const merged = Object.assign({}, arr[idx].approvals, data.approvals);
          if (Object.keys(merged).length > Object.keys(data.approvals).length) {
            data.approvals = merged;
            if (data.approval === "PENDING" && data.approvalMode === "COLLECTIVE") {
              const req = data.requiredApprovers || [];
              if (Object.values(merged).some(d => d.decision === "REJECTED")) data.approval = "REJECTED";
              else if (req.length && req.every(a => merged[a.id] && merged[a.id].decision === "APPROVED")) data.approval = "APPROVED";
            }
            data._updatedAt = Date.now();
            arr[idx] = data;
            scheduleUiRefresh();
            pushNow().catch(() => {});
            return;
          }
        }
        if (sh !== undefined && lh !== sh && newer(arr[idx], data)) return;
        arr[idx] = data;
      } else {
        arr.unshift(data);
      }
      snapSet(c, id, h); saveSnap();
      scheduleUiRefresh(c === "notifications" && type === "INSERT" ? data : null);
      if (c !== "notifications" && c !== "accounts") remoteAlert(c, type, data, prevItem);
    } catch (e) { /* un événement mal formé ne doit jamais bloquer l'app */ }
  }

  function subscribe() {
    if (channel || !client) return;
    channel = client.channel("digit-impact-live")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, onChange)
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          if (wasDown) { wasDown = false; syncAll().catch(() => {}); }
          setStatus("CONNECTED");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          wasDown = true;
          setStatus("DISCONNECTED");
        }
      });
  }
  function unsubscribe() {
    try { if (channel && client) client.removeChannel(channel); } catch (e) {}
    channel = null;
  }

  /* ---------- connexion ---------- */
  function ensureClient() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      const lib = window.supabase;
      if (!lib || !lib.createClient) throw new Error("Bibliothèque Supabase introuvable (dossier vendor).");
      client = lib.createClient(SB_URL, SB_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage, storageKey: "DIGIT_IMPACT_SB_AUTH" }
      });
      const { data } = await client.auth.getSession();
      session = data ? data.session : null;
      client.auth.onAuthStateChange((evt, s) => {
        session = s;
        if (evt === "SIGNED_OUT") { unsubscribe(); setStatus("DISCONNECTED"); }
      });
      return client;
    })();
    return bootPromise;
  }

  function markCloudConfigured() {
    state.googleDriveSyncUrl = SB_URL;
    state.googleDriveAutoSync = true;
    state.cloudUrl = SB_URL;
    state.onlineServerDisconnected = false;
    try { localStorage.removeItem("DIGIT_IMPACT_ONLINE_DISCONNECTED"); } catch (e) {}
  }

  async function connectWithSession() {
    markCloudConfigured();
    subscribe();
    await syncAll();
  }

  async function signIn(email, password) {
    await ensureClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    await connectWithSession();
  }

  async function signOut() {
    unsubscribe();
    try { if (client) await client.auth.signOut(); } catch (e) {}
    session = null;
  }

  async function startup() {
    try {
      await ensureClient();
      if (session && !isOffByUser()) {
        markCloudConfigured();
        subscribe();
        await syncAll();
      } else {
        setStatus("DISCONNECTED");
      }
    } catch (e) {
      setStatus(session ? "ERROR" : "DISCONNECTED");
    }
  }
  const hasSession = () => !!(client && session);

  /* ---------- interface : écran de connexion & écran Base de données ---------- */
  const PANEL_STYLE = "display:flex; flex-direction:column; gap:10px;";
  function loginFieldsHtml(prefix, compact) {
    const st = compact ? "font-size:12px; padding:8px 10px;" : "";
    return `
      <div class="form-group" style="margin-bottom:11px;">
        <label style="color:#93c5fd; font-weight:600;">E-mail du compte entreprise *</label>
        <input type="email" id="${prefix}Email" class="form-input" style="${st}" placeholder="studio@digitimpact.com" autocomplete="username" required />
      </div>
      <div class="form-group" style="margin-bottom:14px;">
        <label>Mot de passe du compte entreprise *</label>
        <input type="password" id="${prefix}Pass" class="form-input" style="${st}" placeholder="••••••••" autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn btn-full" style="background:#3b82f6; color:#ffffff; margin-bottom:0;">
        <span>Connecter le Cloud</span>
      </button>`;
  }

  function decorateAuth() {
    document.querySelectorAll('form[onsubmit*="connectCloudDatabaseFromAuthScreen"]').forEach(f => {
      if (f.getAttribute("data-sb") === "1") return;
      f.setAttribute("data-sb", "1");
      f.innerHTML = loginFieldsHtml("authSb", false);
    });
    // Écran de connexion des employés : aucun accès à la configuration du Cloud ni à l'import de base.
    if (document.getElementById("loginUser")) {
      document.querySelectorAll(".auth-local-btn").forEach(b => b.remove());
      if (hasSession()) {
        document.querySelectorAll(".auth-bottom-local-bar button").forEach(b => {
          if (/Configurer une connexion Cloud/.test(b.textContent)) b.remove();
        });
        document.querySelectorAll('form[onsubmit*="connectCloudDatabaseFromAuthScreen"]').forEach(f => f.remove());
      }
    }
  }
  const mayManageCloud = () => !state.accounts || state.accounts.length === 0 || isCurrentUserOwner();

  function decorateHub() {
    const f = document.querySelector('form[onsubmit*="saveCustomCloudCredentials"]');
    if (!f || f.getAttribute("data-sb") === "1") return;
    const connected = (typeof isCloudReallyConnected === "function") && isCloudReallyConnected();
    const email = (session && session.user && mayManageCloud()) ? session.user.email : "";
    const wrap = document.createElement("div");
    wrap.setAttribute("data-sb", "1");
    wrap.style.cssText = "max-width:100%;";
    if (connected) {
      wrap.innerHTML = `
        <div style="${PANEL_STYLE}">
          <div style="font-size:13px; line-height:1.6;">
            Serveur : <strong>Supabase (temps réel)</strong><br/>
            Compte entreprise : <strong>${email || "connecté"}</strong><br/>
            Dernière synchronisation : <strong>${state.lastDriveSync || "—"}</strong>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn" style="background:#3b82f6; color:#fff;" onclick="manualEmployeeCloudSync()"><span>Synchroniser maintenant</span></button>
            <button type="button" class="btn btn-secondary" onclick="pullFromCloudServerNow()"><span>Récupérer depuis le Cloud</span></button>
            ${mayManageCloud() ? `<button type="button" class="btn btn-secondary" style="color:#ef4444; border-color:rgba(239,68,68,0.45);" onclick="disconnectOnlineServer()"><span>Se déconnecter du Cloud</span></button>` : ""}
          </div>
        </div>`;
      f.replaceWith(wrap);
    } else {
      wrap.innerHTML = `
        <form onsubmit="saveCustomCloudCredentials(event)" style="max-width:420px;">
          ${loginFieldsHtml("hubSb", false)}
        </form>`;
      f.replaceWith(wrap);
    }
  }

  /* ---------- remplacement des anciennes fonctions ---------- */
  const g = window;

  g.getActiveCloudConfig = function () {
    const on = hasSession() || !!(state && state.googleDriveSyncUrl);
    return { url: on ? SB_URL : "", key: "" };
  };

  const _pushOld = g.pushStateToCloudUrl;
  g.pushStateToCloudUrl = async function (rawUrl, payload) {
    if (String(rawUrl || "").includes(".supabase.co")) {
      if (!hasSession()) throw new Error("Cloud non connecté");
      await pushNow();
      return true;
    }
    return _pushOld ? _pushOld(rawUrl, payload) : false;
  };
  const _pullOld = g.pullStateFromCloudUrl;
  g.pullStateFromCloudUrl = async function (rawUrl) {
    if (String(rawUrl || "").includes(".supabase.co")) {
      if (!hasSession()) throw new Error("Cloud non connecté");
      const rows = await fetchAll();
      const out = {};
      rows.forEach(r => {
        if (r.collection === "_settings") out[r.id] = r.data.v;
        else if (COLLS.includes(r.collection)) (out[r.collection] || (out[r.collection] = [])).push(r.data);
      });
      return out;
    }
    return _pullOld ? _pullOld(rawUrl) : null;
  };

  g.initCloudEngine = async function () { await startup(); return null; };

  g.silentPullFromGoogleDriveOnBoot = async function (isBackgroundPoll) {
    if (isOffByUser()) return;
    try {
      await ensureClient();
      if (!hasSession()) return;
      if (isBackgroundPoll) {
        // Le temps réel s'occupe de tout : on ne refait une lecture complète que très rarement.
        if (Date.now() - lastFullSync < 10 * 60 * 1000) return;
      } else if (Date.now() - lastFullSync < 3000) {
        return;
      }
      await syncAll();
      if (!isBackgroundPoll) { try { checkAuthenticationGate(); } catch (e) {} }
      else { try { refreshActiveViewAfterRemoteSync(); } catch (e) {} }
    } catch (e) { setStatus("ERROR"); }
  };

  g.manualEmployeeCloudSync = async function () {
    if (!hasSession()) { toast("Cloud non connecté. Connectez le compte entreprise.", true); try { navigate("param-db"); } catch (e) {} return; }
    try {
      toast("Synchronisation en cours...");
      await syncAll();
      toast("Synchronisation terminée avec succès !");
      try { refreshActiveViewAfterRemoteSync(); } catch (e) {}
    } catch (e) { setStatus("ERROR"); toast("Synchronisation impossible : " + frError(e), true); }
  };
  g.saveAndPushToGoogleDrive = g.manualEmployeeCloudSync;
  g.pullFromCloudServerNow = async function () {
    if (!hasSession()) return toast("Connectez d'abord le compte entreprise.", true);
    try {
      toast("Récupération des données depuis le Cloud...");
      await syncAll();
      await saveState();
      toast("Données récupérées depuis le Cloud !");
      try { refreshActiveViewAfterRemoteSync(); } catch (e) {}
    } catch (e) { setStatus("ERROR"); toast("Récupération impossible : " + frError(e), true); }
  };
  g.pullDatabaseFromGoogleDrive = g.pullFromCloudServerNow;

  g.connectCloudDatabaseFromAuthScreen = async function (e) {
    if (e) e.preventDefault();
    const email = (document.getElementById("authSbEmail") || {}).value || "";
    const pass = (document.getElementById("authSbPass") || {}).value || "";
    if (!email.trim() || !pass) return toast("Renseignez l'e-mail et le mot de passe du compte entreprise.", true);
    try {
      toast("Connexion au Cloud en cours...");
      await signIn(email.trim(), pass);
      if (state.accounts && state.accounts.length > 0) {
        showCloudLinkBoxOnLogin = false; showInitialAdminSetupForm = false;
        toast("Cloud connecté ! Saisissez vos identifiants.");
      } else {
        showInitialAdminSetupForm = true;
        toast("Cloud relié ! Créez maintenant le compte Administrateur.");
      }
      await saveState();
      checkAuthenticationGate();
    } catch (err) { setStatus("DISCONNECTED"); toast(frError(err), true); }
  };

  g.saveCustomCloudCredentials = async function (e) {
    if (e) e.preventDefault();
    if (hasSession() && !mayManageCloud()) return toast("Seul le propriétaire du studio peut modifier la connexion Cloud.", true);
    const email = (document.getElementById("hubSbEmail") || {}).value || "";
    const pass = (document.getElementById("hubSbPass") || {}).value || "";
    if (!email.trim() || !pass) return toast("Renseignez l'e-mail et le mot de passe du compte entreprise.", true);
    try {
      toast("Connexion au Cloud en cours...");
      await signIn(email.trim(), pass);
      await saveState();
      toast("Cloud connecté !");
    } catch (err) { setStatus("DISCONNECTED"); toast(frError(err), true); }
    try { if (currentView === "param-db") renderDatabaseAndServerHub(document.getElementById("mainView")); } catch (e2) {}
  };

  const _mlOrig = g.mergeLoadedState;
  g.mergeLoadedState = function (loaded) {
    try { if (loaded && typeof loaded === "object") { digitSanitizeDeep(loaded); (loaded.prodProjects || []).forEach(normProd); } } catch (e) {}
    const r = _mlOrig.apply(this, arguments);
    try { (state.prodProjects || []).forEach(normProd); } catch (e) {}
    return r;
  };

  const _disc = g.disconnectOnlineServer;
  g.disconnectOnlineServer = function () {
    if (hasSession() && !mayManageCloud()) { toast("Seul le propriétaire du studio peut déconnecter le Cloud.", true); return; }
    _disc && _disc();
    signOut();
  };
  g.clearCloudCredentials = function () { g.disconnectOnlineServer(); };

  const _check = g.checkAuthenticationGate;
  g.checkAuthenticationGate = function () { _check(); decorateAuth(); };
  const _hub = g.renderDatabaseAndServerHub;
  g.renderDatabaseAndServerHub = function (main) { _hub(main); decorateHub(); };

  // Import d'un fichier .json : on ajoute à la base partagée, on ne supprime jamais rien chez les autres.
  const _imp = g.handleImportDBFile;
  g.handleImportDBFile = function (ev) {
    if (state.accounts && state.accounts.length > 0 && !isCurrentUserOwner()) {
      toast("L'import d'une base est réservé au propriétaire du studio.", true);
      try { ev.target.value = ""; } catch (e) {}
      return;
    }
    snap = {}; saveSnap();
    return _imp(ev);
  };

  // Connexion des employés (mot de passe haché)
  g.handleUserLogin = async function (e) {
    e.preventDefault();
    // L'identifiant respecte les majuscules / minuscules, comme le mot de passe
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value;
    const found = (state.accounts || []).find(a => (a.username || "").trim() === u);
    const lockLeft = lockSecondsLeft();
    if (lockLeft > 0) {
      const el = document.getElementById("loginErrorMsg");
      if (el) { el.textContent = `Trop d'essais. Réessayez dans ${lockLeft} secondes.`; el.style.display = "block"; }
      return;
    }
    let ok = false;
    try { ok = !!found && await verifyPassword(found.password, p); } catch (err) { ok = false; }
    if (!ok) {
      registerFailedLogin();
      const el = document.getElementById("loginErrorMsg");
      if (el) { el.textContent = lockSecondsLeft() > 0 ? `Trop d'essais. Réessayez dans ${lockSecondsLeft()} secondes.` : "Identifiant ou mot de passe incorrect."; el.style.display = "block"; }
      return;
    }
    resetFailedLogins();
    state.currentUserId = found.id;
    // Comptes créés avant la v1.7 : la copie chiffrée est créée à leur prochaine connexion
    if (!found.passwordEnc && p) {
      try { found.passwordEnc = await vaultEncrypt(p); found._updatedAt = Date.now(); } catch (err) {}
    }
    try { await ensurePasswordsHashed(); } catch (err) {}
    saveState();
    checkAuthenticationGate();
  };
  // Affichage du mot de passe d'un membre : réservé aux administrateurs (et au propriétaire pour son propre compte / les autres admins)
  g.toggleAccountRowPassword = async function (accId, btnEl) {
    const sp = document.getElementById("accPwdSpan_" + accId);
    if (!sp) return;
    const shown = sp.getAttribute("data-shown") === "1";
    if (shown) { sp.textContent = "••••••"; sp.setAttribute("data-shown", "0"); return; }
    if (getCurrentRole() !== "ADMIN") return toast("Seul un administrateur peut voir les mots de passe.", true);
    if (typeof canModifyAccount === "function" && !canModifyAccount(accId)) return toast("Mot de passe réservé au propriétaire du studio.", true);
    const acc = (state.accounts || []).find(a => a.id === accId);
    if (!acc) return;
    let plain = null;
    if (acc.password && !String(acc.password).startsWith(HASH_PREFIX)) plain = acc.password;
    else { try { plain = await vaultDecrypt(acc.passwordEnc); } catch (e) { plain = null; } }
    if (plain === null) {
      sp.textContent = "visible après sa prochaine connexion";
      setTimeout(() => { if (sp.getAttribute("data-shown") !== "1") sp.textContent = "••••••"; }, 3500);
      return;
    }
    sp.textContent = plain;
    sp.setAttribute("data-shown", "1");
    // Masqué automatiquement au bout de 15 secondes
    setTimeout(() => { if (sp.getAttribute("data-shown") === "1") { sp.textContent = "••••••"; sp.setAttribute("data-shown", "0"); } }, 15000);
  };

  g.resetAccountPassword = function (accId) {
    if (getCurrentRole() !== "ADMIN") return toast("Seul un administrateur peut changer un mot de passe.", true);
    if (typeof canModifyAccount === "function" && !canModifyAccount(accId)) return toast("Action réservée au propriétaire du studio.", true);
    const acc = (state.accounts || []).find(a => a.id === accId);
    if (!acc) return;
    const old = document.getElementById("pwdResetOverlay");
    if (old) old.remove();
    const ov = document.createElement("div");
    ov.id = "pwdResetOverlay";
    ov.className = "stamp-adj-overlay no-print";
    ov.innerHTML = `
      <div class="stamp-adj-card" style="max-width:420px;">
        <div style="font-size:17px; font-weight:800;">Nouveau mot de passe</div>
        <div style="font-size:12px; color:var(--text-muted); margin:4px 0 14px;">Compte : <strong></strong></div>
        <input type="text" id="pwdResetInput" class="form-input" placeholder="8 caractères minimum" autocomplete="off" />
        <div style="display:flex; gap:9px; justify-content:flex-end; margin-top:16px;">
          <button type="button" class="btn btn-secondary" id="pwdResetCancel">Annuler</button>
          <button type="button" class="btn btn-primary" id="pwdResetSave">Enregistrer</button>
        </div>
      </div>`;
    ov.querySelector("strong").textContent = acc.name;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    document.getElementById("pwdResetCancel").onclick = close;
    document.getElementById("pwdResetSave").onclick = async () => {
      const v = document.getElementById("pwdResetInput").value;
      if (v.length < 8) return toast("Le mot de passe doit contenir au moins 8 caractères.", true);
      try { acc.passwordEnc = await vaultEncrypt(v); } catch (e) {}
      acc.password = await hashPassword(v);
      acc._updatedAt = Date.now();
      // Journal : on note le changement, jamais le mot de passe lui-même
      try { auditLog("ACCOUNT_PASSWORD", `Mot de passe de ${acc.name} changé par un administrateur`, "ACCOUNT", acc.id); } catch (e) {}
      await saveState();
      close();
      toast(`Mot de passe de ${acc.name} modifié.`);
      try { if (currentView === "gestion-sub") renderGestionSubModule(document.getElementById("mainView"), "accounts"); } catch (e) {}
    };
    setTimeout(() => { const el = document.getElementById("pwdResetInput"); if (el) el.focus(); }, 60);
  };

  // Au premier lancement, on propose d'abord l'onglet "Serveur Cloud".
  try { showInitialAdminSetupForm = false; if (!state.currentUserId) checkAuthenticationGate(); } catch (e) {}

  window.DigitImpactCloud = { signIn, signOut, syncAll, pushNow, hasSession, getClient: () => client, _debug: { get snap() { return snap; } } };
  setTimeout(() => { startup(); }, 120);
})();
