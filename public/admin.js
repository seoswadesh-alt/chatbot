(function () {
  const loginScreen = document.getElementById("login-screen");
  const dash = document.getElementById("dash");
  const topBar = document.getElementById("top-bar");
  const passEl = document.getElementById("admin-pass");
  const adminIdEl = document.getElementById("admin-id");
  const loginBtn = document.getElementById("admin-login-btn");
  const loginMsg = document.getElementById("login-msg");
  const logoutBtn = document.getElementById("logout-btn");
  const paymentsEl = document.getElementById("payments");
  const usersEl = document.getElementById("users");
  const usersCount = document.getElementById("users-count");
  const liveSyncMeta = document.getElementById("live-sync-meta");
  const usersPager = document.getElementById("users-pager");
  const usersPageLabel = document.getElementById("users-page-label");
  const usersPrevBtn = document.getElementById("users-prev");
  const usersNextBtn = document.getElementById("users-next");
  const usersPageSizeEl = document.getElementById("users-page-size");
  const statusFilter = document.getElementById("status-filter");
  const paySearch = document.getElementById("pay-search");
  const paymentsCount = document.getElementById("payments-count");
  const userFilter = document.getElementById("user-filter");
  const refreshBtn = document.getElementById("refresh-btn");
  const refreshUsersBtn = document.getElementById("refresh-users-btn");
  const tabUsers = document.getElementById("tab-users");
  const tabPayments = document.getElementById("tab-payments");
  const tabSupport = document.getElementById("tab-support");
  const tabReports = document.getElementById("tab-reports");
  const tabPaySetup = document.getElementById("tab-pay-setup");
  const usersView = document.getElementById("users-view");
  const paymentsView = document.getElementById("payments-view");
  const supportView = document.getElementById("support-view");
  const reportsView = document.getElementById("reports-view");
  const paySetupView = document.getElementById("pay-setup-view");
  const supportThreadList = document.getElementById("support-thread-list");
  const supportThreadTitle = document.getElementById("support-thread-title");
  const supportThreadMeta = document.getElementById("support-thread-meta");
  const supportAdminMessages = document.getElementById("support-admin-messages");
  const supportAdminCompose = document.getElementById("support-admin-compose");
  const supportAdminInput = document.getElementById("support-admin-input");
  const supportAdminSend = document.getElementById("support-admin-send");
  const supportAdminOfferBtn = document.getElementById("support-admin-offer-btn");
  const supportAdminFile = document.getElementById("support-admin-file");
  const supportAdminUploadText = document.getElementById("support-admin-upload-text");
  const supportAdminUploadLabel = document.getElementById("support-admin-upload-label");
  const supportAdminPreview = document.getElementById("support-admin-preview");
  const supportCloseThreadBtn = document.getElementById("support-close-thread-btn");
  const supportBackBtn = document.getElementById("support-back-btn");
  const supportCount = document.getElementById("support-count");
  const refreshSupportBtn = document.getElementById("refresh-support-btn");
  let supportThreadsCache = [];
  let openSupportUserId = "";
  let supportFilterMode = "all"; // all | pay-leads
  let supportPollId = null;

  function setSupportMobileMode(mode) {
    if (!supportView) return;
    supportView.classList.toggle("is-thread", mode === "thread");
    if (supportBackBtn) {
      supportBackBtn.classList.toggle("hidden", mode !== "thread");
    }
  }

  function closeSupportThreadView() {
    openSupportUserId = "";
    setSupportMobileMode("list");
    if (supportThreadTitle) supportThreadTitle.textContent = "Select a user";
    if (supportThreadMeta) supportThreadMeta.textContent = "";
    if (supportCloseThreadBtn) supportCloseThreadBtn.classList.add("hidden");
    if (supportAdminCompose) supportAdminCompose.classList.add("hidden");
    if (supportAdminMessages) {
      supportAdminMessages.innerHTML =
        "<div class='empty'>Pick a support thread from the list.</div>";
    }
    renderSupportThreadList(supportThreadsCache);
  }
  const reportsList = document.getElementById("reports-list");
  const reportsDigest = document.getElementById("reports-digest");
  const reportsCount = document.getElementById("reports-count");
  const downloadReportsBtn = document.getElementById("download-reports-btn");
  const clearReportsBtn = document.getElementById("clear-reports-btn");
  const refreshReportsBtn = document.getElementById("refresh-reports-btn");
  let reportsCache = [];
  let reportsDigestCache = null;
  const statUsers = document.getElementById("stat-users");
  const statPending = document.getElementById("stat-pending");
  const statPayLeads = document.getElementById("stat-pay-leads");
  const statHours = document.getElementById("stat-hours");
  const statMoney = document.getElementById("stat-money");
  const statMoneyToday = document.getElementById("stat-money-today");
  const statMoneyWeek = document.getElementById("stat-money-week");
  const statPaid = document.getElementById("stat-paid");
  const statPaidShare = document.getElementById("stat-paid-share");
  const statTrialOnly = document.getElementById("stat-trial-only");
  const statConvertToday = document.getElementById("stat-convert-today");
  const statFunnelTodaySub = document.getElementById("stat-funnel-today-sub");
  const statActive = document.getElementById("stat-active");
  const statAppOpen = document.getElementById("stat-app-open");
  const statTrialLeads = document.getElementById("stat-trial-leads");
  const statHoursSold = document.getElementById("stat-hours-sold");
  const statMsgs = document.getElementById("stat-msgs");
  const statReports = document.getElementById("stat-reports");
  const statToday = document.getElementById("stat-today");
  const statUniqueToday = document.getElementById("stat-unique-today");
  const statRepeatToday = document.getElementById("stat-repeat-today");
  let analyticsSeriesCache = [];
  let analyticsTrendMetric = "signups";
  const userSearch = document.getElementById("user-search");
  const chatDrawer = document.getElementById("chat-drawer");
  const chatDrawerTitle = document.getElementById("chat-drawer-title");
  const chatDrawerMeta = document.getElementById("chat-drawer-meta");
  const chatDrawerBody = document.getElementById("chat-drawer-body");
  const chatSessionTabs = document.getElementById("chat-session-tabs");
  const chatDeleteBtn = document.getElementById("chat-delete-btn");
  const drawerTabChat = document.getElementById("drawer-tab-chat");
  const drawerTabPhotos = document.getElementById("drawer-tab-photos");
  const purgeOldChatsBtn = document.getElementById("purge-old-chats-btn");
  let openChatUserId = "";
  let drawerTab = "chat";
  const setUpiId = document.getElementById("set-upi-id");
  const setUpiName = document.getElementById("set-upi-name");
  const setTrialMinutes = document.getElementById("set-trial-minutes");
  const setOneIdDevice = document.getElementById("set-one-id-device");
  const setWinbackEnabled = document.getElementById("set-winback-enabled");
  const setWinbackPack = document.getElementById("set-winback-pack");
  const setWinbackPrice = document.getElementById("set-winback-price");
  const setWinbackSummary = document.getElementById("set-winback-summary");
  const setWinbackSaveBtn = document.getElementById("set-winback-save-btn");
  const setWinbackSaveMsg = document.getElementById("set-winback-save-msg");
  const setWinbackQrPreview = document.getElementById("set-winback-qr-preview");
  const setWinbackQrFile = document.getElementById("set-winback-qr-file");
  const setWinbackQrUploadBtn = document.getElementById("set-winback-qr-upload-btn");
  const setWinbackQrClearBtn = document.getElementById("set-winback-qr-clear-btn");
  const setWinbackQrMsg = document.getElementById("set-winback-qr-msg");
  const setBustCacheBtn = document.getElementById("set-bust-cache-btn");
  let savedWinbackPackageId = "";
  let winbackPackCache = [];
  let winbackPackPrevId = "";
  let winbackPricesByPack = {};

  function offerPriceForPack(packId, pack) {
    const id = String(packId || "");
    if (id && winbackPricesByPack[id] != null) {
      const n = Math.round(Number(winbackPricesByPack[id]));
      if (Number.isFinite(n) && n > 0) return n;
    }
    if (pack && pack.priceInr != null) {
      return Math.round(Number(pack.priceInr));
    }
    return null;
  }
  const setCacheMeta = document.getElementById("set-cache-meta");
  const setQrPreview = document.getElementById("set-qr-preview");
  const setQrFile = document.getElementById("set-qr-file");
  const setQrUploadBtn = document.getElementById("set-qr-upload-btn");
  const setQrClearBtn = document.getElementById("set-qr-clear-btn");
  const setQrMsg = document.getElementById("set-qr-msg");
  const setPackages = document.getElementById("set-packages");
  const setPkgAdd = document.getElementById("set-pkg-add");
  const setSaveBtn = document.getElementById("set-save-btn");
  const setSaveMsg = document.getElementById("set-save-msg");

  function paintCacheMeta(s) {
    if (!setCacheMeta) return;
    const key = s && s.clientCacheKey != null ? s.clientCacheKey : "—";
    const at = s && s.clientCacheUpdatedAt ? new Date(s.clientCacheUpdatedAt) : null;
    setCacheMeta.textContent = at
      ? "Cache v" + key + " · cleared " + at.toLocaleString()
      : "Cache v" + key;
  }

  let token = localStorage.getItem("adminToken") || "";

  function syncPhotoAuthCookie(value) {
    var t = value != null ? String(value) : String(token || "");
    var secure = window.location.protocol === "https:" ? "; Secure" : "";
    if (!t) {
      document.cookie = "dc_img=; Path=/; SameSite=Lax; Max-Age=0" + secure;
      return;
    }
    document.cookie =
      "dc_img=" +
      encodeURIComponent(t) +
      "; Path=/; SameSite=Lax; Max-Age=2592000" +
      secure;
  }

  function photoSrc(url) {
    var raw = String(url || "");
    var m = raw.match(/\/generated\/([df][a-f0-9]+\.(?:jpg|jpeg|png|webp))/i);
    if (!m) return raw;
    return "/api/photos/file/" + m[1];
  }
  syncPhotoAuthCookie();
  let usersCache = [];
  let paymentsCache = [];
  let pendingQrBase64 = null;
  let pendingWinbackQrBase64 = null;
  const expandedUserIds = new Set();
  let usersPage = 1;
  let softRefreshBusy = false;
  let softRefreshQueued = false;
  let lastLiveSyncAt = 0;

  const USER_CHEVRON =
    "<svg class='user-card-chevron' viewBox='0 0 20 20' fill='none' aria-hidden='true'>" +
    "<path d='M5 7.5L10 12.5L15 7.5' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/>" +
    "</svg>";

  function toast(message, type) {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type ? " toast-" + type : "");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add("toast-out");
      setTimeout(function () {
        el.remove();
      }, 280);
    }, 2800);
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    };
  }

  function setMsg(text, type) {
    loginMsg.textContent = text || "";
    loginMsg.className = "msg" + (type ? " " + type : "");
  }

  function showLogin() {
    loginScreen.classList.remove("hidden");
    dash.classList.add("hidden");
    topBar.classList.add("hidden");
  }

  function showDash() {
    loginScreen.classList.add("hidden");
    dash.classList.remove("hidden");
    topBar.classList.remove("hidden");
  }

  function logout() {
    token = "";
    localStorage.removeItem("adminToken");
    syncPhotoAuthCookie("");
    showLogin();
    setMsg("Logged out.", "ok");
  }

  function hideAllTabs() {
    tabUsers.classList.remove("active");
    tabPayments.classList.remove("active");
    if (tabSupport) tabSupport.classList.remove("active");
    if (tabReports) tabReports.classList.remove("active");
    if (tabPaySetup) tabPaySetup.classList.remove("active");
    usersView.classList.add("hidden");
    paymentsView.classList.add("hidden");
    if (supportView) supportView.classList.add("hidden");
    if (reportsView) reportsView.classList.add("hidden");
    if (paySetupView) paySetupView.classList.add("hidden");
    if (supportPollId) {
      clearInterval(supportPollId);
      supportPollId = null;
    }
  }

  function showUsersTab() {
    hideAllTabs();
    tabUsers.classList.add("active");
    usersView.classList.remove("hidden");
  }

  function showPaymentsTab() {
    hideAllTabs();
    tabPayments.classList.add("active");
    paymentsView.classList.remove("hidden");
  }

  function showSupportTab() {
    hideAllTabs();
    if (tabSupport) tabSupport.classList.add("active");
    if (supportView) supportView.classList.remove("hidden");
    setSupportMobileMode(openSupportUserId ? "thread" : "list");
    loadSupportThreads();
    if (supportPollId) clearInterval(supportPollId);
    supportPollId = setInterval(function () {
      if (document.hidden) return;
      if (!supportView || supportView.classList.contains("hidden")) return;
      loadSupportThreads(true);
      if (openSupportUserId) openSupportThread(openSupportUserId, true);
    }, 15000);
  }

  function showReportsTab() {
    hideAllTabs();
    if (tabReports) tabReports.classList.add("active");
    if (reportsView) reportsView.classList.remove("hidden");
    loadReports();
  }

  function showPaySetupTab() {
    hideAllTabs();
    if (tabPaySetup) tabPaySetup.classList.add("active");
    if (paySetupView) paySetupView.classList.remove("hidden");
    loadPaySettings();
  }

  function renderPackageEditor(packages) {
    if (!setPackages) return;
    const list = packages && packages.length ? packages : [];
    if (!list.length) {
      setPackages.innerHTML =
        "<div class='empty'>No packs yet. Tap + Add pack.</div>";
      fillWinbackPackSelect([]);
      return;
    }
    setPackages.innerHTML = list
      .map(function (p, i) {
        const sell = p.priceInr != null ? p.priceInr : "";
        const listP =
          p.listPriceInr != null ? p.listPriceInr : p.priceInr != null ? p.priceInr : "";
        const qrUrl = p.qrImageUrl || "";
        const qrSrc = qrUrl || "/upi-qr.svg";
        return (
          '<article class="pkg-card" data-i="' +
          i +
          '" data-pkg-id="' +
          String(p.id || "").replace(/"/g, "&quot;") +
          '">' +
          '<div class="pkg-card-head">' +
          "<strong>Pack " +
          (i + 1) +
          (sell !== "" ? " · ₹" + sell : "") +
          "</strong>" +
          '<button type="button" class="btn-danger btn-sm" data-del-pkg="' +
          i +
          '">Delete</button>' +
          "</div>" +
          '<label class="pkg-field"><span>Name (shown to user)</span>' +
          '<input data-f="label" type="text" value="' +
          String(p.label || "").replace(/"/g, "&quot;") +
          '" placeholder="e.g. 1 Hour" /></label>' +
          '<div class="pkg-field-row">' +
          '<label class="pkg-field"><span>Hours</span>' +
          '<input data-f="hours" type="number" min="0.1" step="0.1" inputmode="decimal" value="' +
          p.hours +
          '" /></label>' +
          '<label class="pkg-field"><span>Sell price ₹</span>' +
          '<input data-f="priceInr" type="number" min="0" step="1" inputmode="numeric" value="' +
          sell +
          '" /></label>' +
          "</div>" +
          '<div class="pkg-field-row">' +
          '<label class="pkg-field"><span>Old / list price ₹</span>' +
          '<input data-f="listPriceInr" type="number" min="0" step="1" inputmode="numeric" value="' +
          listP +
          '" /></label>' +
          '<label class="pkg-field"><span>Badge text</span>' +
          '<input data-f="badge" type="text" value="' +
          String(p.badge || "").replace(/"/g, "&quot;") +
          '" placeholder="e.g. Save 8%" /></label>' +
          "</div>" +
          '<label class="pkg-pop">' +
          '<input data-f="popular" type="checkbox" ' +
          (p.popular ? "checked" : "") +
          "/> Mark as Popular</label>" +
          '<input data-f="id" type="hidden" value="' +
          String(p.id || "").replace(/"/g, "&quot;") +
          '" />' +
          '<input data-f="qrImageUrl" type="hidden" value="' +
          String(qrUrl).replace(/"/g, "&quot;") +
          '" />' +
          '<div class="pkg-qr-block">' +
          "<p class='pkg-qr-label'>QR for this pack" +
          (sell !== "" ? " (₹" + sell + ")" : "") +
          "</p>" +
          '<img class="pkg-qr-preview" alt="Pack QR" src="' +
          String(qrSrc).replace(/"/g, "&quot;") +
          '" />' +
          '<div class="row-actions pkg-qr-actions">' +
          '<label class="btn-ghost btn-sm file-label">Choose QR' +
          '<input type="file" accept="image/*" data-pkg-qr-file hidden /></label>' +
          '<button type="button" class="btn btn-sm" data-pkg-qr-upload>Upload QR</button>' +
          '<button type="button" class="btn-danger btn-sm" data-pkg-qr-clear>Clear</button>' +
          "</div>" +
          '<p class="meta pkg-qr-msg">' +
          (qrUrl ? "Pack QR set" : "No pack QR yet — fallback QR will show") +
          "</p>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
    fillWinbackPackSelect(list);
  }

  function fillWinbackPackSelect(packages, selectedId) {
    if (!setWinbackPack) return;
    const list = packages && packages.length ? packages : [];
    winbackPackCache = list;
    const cur =
      (selectedId != null && String(selectedId).trim()
        ? String(selectedId).trim()
        : "") ||
      savedWinbackPackageId ||
      (setWinbackPack.value || "");
    setWinbackPack.innerHTML = list
      .map(function (p) {
        const id = String(p.id || "");
        const listP = p.priceInr != null ? Math.round(Number(p.priceInr)) : null;
        const offer = offerPriceForPack(id, p);
        let label = "Unlock: " + (p.label || id);
        if (listP != null) label += " (list ₹" + listP;
        if (offer != null && offer !== listP) {
          label += " · offer ₹" + offer;
        }
        if (listP != null) label += ")";
        else if (offer != null) label += " (offer ₹" + offer + ")";
        return (
          '<option value="' +
          id.replace(/"/g, "&quot;") +
          '">' +
          String(label).replace(/</g, "&lt;") +
          "</option>"
        );
      })
      .join("");
    if (
      cur &&
      list.some(function (p) {
        return String(p.id) === cur;
      })
    ) {
      setWinbackPack.value = cur;
      savedWinbackPackageId = cur;
    } else if (list[0]) {
      setWinbackPack.value = String(list[0].id);
      savedWinbackPackageId = String(list[0].id);
    }
    winbackPackPrevId = setWinbackPack.value || "";
    paintWinbackSummary();
  }

  function paintWinbackSummary() {
    if (!setWinbackSummary) return;
    const id = setWinbackPack ? setWinbackPack.value : "";
    const pack = winbackPackCache.filter(function (p) {
      return String(p.id) === String(id);
    })[0];
    const pay =
      setWinbackPrice && setWinbackPrice.value !== ""
        ? Math.round(Number(setWinbackPrice.value))
        : null;
    if (!pack) {
      setWinbackSummary.textContent =
        "Choose a pack they unlock, and the ₹ they pay (offer price). Then tap Save win-back.";
      return;
    }
    const listP =
      pack.priceInr != null ? Math.round(Number(pack.priceInr)) : null;
    if (pay && Number.isFinite(pay) && pay > 0) {
      setWinbackSummary.textContent =
        "Offer: pay ₹" +
        pay +
        " → unlock " +
        (pack.label || pack.id) +
        (listP ? " (normal ₹" + listP + ")" : "") +
        ". Tap Save win-back — this pack keeps its own offer ₹.";
    } else {
      setWinbackSummary.textContent =
        "Set offer price (what they pay). Pack list ₹ is only the normal price — not the offer.";
    }
  }

  async function saveWinbackSettingsOnly() {
    if (setWinbackSaveMsg) setWinbackSaveMsg.textContent = "Saving…";
    if (setWinbackSaveBtn) setWinbackSaveBtn.disabled = true;
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          winbackEnabled: setWinbackEnabled ? !!setWinbackEnabled.checked : false,
          winbackPackageId: setWinbackPack ? setWinbackPack.value : "day",
          winbackPriceInr: setWinbackPrice ? setWinbackPrice.value : 50,
        }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        if (setWinbackSaveMsg) {
          setWinbackSaveMsg.textContent = data.error || "Save failed";
        }
        toast(data.error || "Win-back save failed", "err");
        return;
      }
      const s = data.settings || {};
      if (setWinbackEnabled) setWinbackEnabled.checked = !!s.winbackEnabled;
      if (s.winbackPricesByPack) {
        winbackPricesByPack = Object.assign({}, s.winbackPricesByPack);
      }
      if (setWinbackPrice && s.winbackPriceInr != null) {
        setWinbackPrice.value = String(s.winbackPriceInr);
      }
      savedWinbackPackageId = s.winbackPackageId || savedWinbackPackageId;
      if (s.packages) {
        fillWinbackPackSelect(s.packages, s.winbackPackageId || "");
      }
      // Keep the price we just saved for this pack (don't lose it on rebuild)
      if (setWinbackPrice && s.winbackPriceInr != null) {
        setWinbackPrice.value = String(s.winbackPriceInr);
      }
      paintWinbackSummary();
      const pay = s.winbackPriceInr != null ? s.winbackPriceInr : "";
      if (setWinbackSaveMsg) {
        setWinbackSaveMsg.textContent = "Saved · pay ₹" + pay;
      }
      toast("Win-back saved · pay ₹" + pay, "ok");
    } catch (e) {
      if (setWinbackSaveMsg) setWinbackSaveMsg.textContent = "Network error";
      toast("Network error", "err");
    } finally {
      if (setWinbackSaveBtn) setWinbackSaveBtn.disabled = false;
    }
  }

  function collectPackagesFromEditor() {
    const rows = setPackages
      ? setPackages.querySelectorAll(".pkg-card, .pkg-row")
      : [];
    const out = [];
    rows.forEach(function (row) {
      const get = function (f) {
        return row.querySelector('[data-f="' + f + '"]');
      };
      const idEl = get("id");
      const labelEl = get("label");
      const hoursEl = get("hours");
      const priceEl = get("priceInr");
      const listEl = get("listPriceInr");
      const badgeEl = get("badge");
      const popEl = get("popular");
      const qrEl = get("qrImageUrl");
      if (!labelEl || !hoursEl || !priceEl) return;
      out.push({
        id: idEl ? idEl.value : "",
        label: labelEl.value,
        hours: Number(hoursEl.value),
        priceInr: Number(priceEl.value),
        listPriceInr: Number(listEl ? listEl.value : priceEl.value),
        badge: badgeEl ? badgeEl.value : "",
        popular: popEl ? popEl.checked : false,
        qrImageUrl: qrEl ? qrEl.value : "",
      });
    });
    return out;
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadPackQr(card) {
    if (!card) return;
    const idEl = card.querySelector('[data-f="id"]');
    const pkgId = idEl ? String(idEl.value || "").trim() : "";
    if (!pkgId) {
      toast("Save pack first (Save UPI & prices), then upload QR", "err");
      return;
    }
    const fileInput = card.querySelector("[data-pkg-qr-file]");
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      toast("Choose a QR image first", "err");
      return;
    }
    const msg = card.querySelector(".pkg-qr-msg");
    if (msg) msg.textContent = "Uploading…";
    try {
      const b64 = await fileToDataUrl(file);
      const res = await fetch(
        "/api/admin/settings/packages/" + encodeURIComponent(pkgId) + "/qr",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ imageBase64: b64 }),
        }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        if (msg) msg.textContent = data.error || "Upload failed";
        toast(data.error || "Pack QR upload failed", "err");
        return;
      }
      toast("Pack QR uploaded", "ok");
      if (data.settings && data.settings.packages) {
        renderPackageEditor(data.settings.packages);
      }
    } catch (e) {
      toast("Network error", "err");
    }
  }

  async function clearPackQr(card) {
    if (!card) return;
    const idEl = card.querySelector('[data-f="id"]');
    const pkgId = idEl ? String(idEl.value || "").trim() : "";
    if (!pkgId) return;
    if (!confirm("Clear QR for this pack?")) return;
    try {
      const res = await fetch(
        "/api/admin/settings/packages/" + encodeURIComponent(pkgId) + "/qr",
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Clear failed", "err");
        return;
      }
      toast("Pack QR cleared", "ok");
      if (data.settings && data.settings.packages) {
        renderPackageEditor(data.settings.packages);
      }
    } catch (e) {
      toast("Network error", "err");
    }
  }

  async function loadPaySettings() {
    if (!paySetupView) return;
    try {
      const res = await fetch("/api/admin/settings", { headers: authHeaders() });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Failed to load settings", "err");
        return;
      }
      const s = data.settings || {};
      if (setUpiId) setUpiId.value = s.upiId || "";
      if (setUpiName) setUpiName.value = s.upiName || "";
      if (setTrialMinutes) {
        setTrialMinutes.value =
          s.trialMinutes != null && s.trialMinutes !== ""
            ? String(s.trialMinutes)
            : "5";
      }
      if (setOneIdDevice) setOneIdDevice.checked = !!s.oneIdPerDevice;
      if (setWinbackEnabled) setWinbackEnabled.checked = !!s.winbackEnabled;
      savedWinbackPackageId = s.winbackPackageId || "";
      winbackPricesByPack = Object.assign({}, s.winbackPricesByPack || {});
      // Seed active pack into map if missing
      if (
        s.winbackPackageId &&
        s.winbackPriceInr != null &&
        winbackPricesByPack[s.winbackPackageId] == null
      ) {
        winbackPricesByPack[s.winbackPackageId] = Math.round(
          Number(s.winbackPriceInr)
        );
      }
      paintCacheMeta(s);
      if (setQrPreview) {
        setQrPreview.src = s.qrImageUrl || "/upi-qr.svg";
      }
      if (setWinbackQrPreview) {
        setWinbackQrPreview.src =
          s.winbackQrImageUrl || s.qrImageUrl || "/upi-qr.svg";
      }
      if (setWinbackQrMsg) {
        setWinbackQrMsg.textContent = s.winbackQrImageUrl
          ? "Win-back QR set — used in Support offer"
          : "No win-back QR yet — will use pack / fallback QR";
      }
      pendingQrBase64 = null;
      pendingWinbackQrBase64 = null;
      renderPackageEditor(s.packages || []);
      fillWinbackPackSelect(s.packages || [], s.winbackPackageId || "");
      // Restore this pack's offer price AFTER pack list rebuild
      if (setWinbackPrice) {
        const pack = (s.packages || []).filter(function (p) {
          return String(p.id) === String(s.winbackPackageId || "");
        })[0];
        const offer = offerPriceForPack(s.winbackPackageId, pack);
        setWinbackPrice.value =
          offer != null
            ? String(offer)
            : s.winbackPriceInr != null
              ? String(s.winbackPriceInr)
              : "50";
      }
      if (setWinbackSaveMsg) setWinbackSaveMsg.textContent = "";
      paintWinbackSummary();
    } catch (e) {
      toast("Network error loading settings", "err");
    }
  }

  function handleAuthFail(res) {
    if (res.status !== 401) return false;
    logout();
    setMsg("Session expired. Login again.", "err");
    return true;
  }

  async function login() {
    const adminId = String((adminIdEl && adminIdEl.value) || "").trim();
    const password = String(passEl.value || "").trim();
    if (!adminId || !password) {
      setMsg("Admin ID aur password dono likho.", "err");
      return;
    }
    loginBtn.disabled = true;
    setMsg("Checking...", "");
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: adminId, password: password }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        setMsg(data.error || "Wrong ID or password", "err");
        return;
      }
      if (!data.token) {
        setMsg("Login failed (no token).", "err");
        return;
      }
      token = data.token;
      localStorage.setItem("adminToken", token);
      syncPhotoAuthCookie(token);
      passEl.value = "";
      setMsg("");
      showDash();
      await refreshAll();
    } catch (e) {
      setMsg("Network error — is server running?", "err");
    } finally {
      loginBtn.disabled = false;
    }
  }

  function inr(n) {
    return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
  }

  function pctWidth(part, total) {
    const t = Number(total) || 0;
    const p = Number(part) || 0;
    if (t <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((p / t) * 1000) / 10));
  }

  function renderTrendChart(series, metric) {
    const el = document.getElementById("analytics-trend-chart");
    const foot = document.getElementById("analytics-trend-foot");
    if (!el) return;
    const days = Array.isArray(series) ? series : [];
    const key =
      metric === "money" ? "moneyInr" : metric === "actives" ? "actives" : "signups";
    const max = Math.max(
      1,
      ...days.map(function (d) {
        return Number(d[key]) || 0;
      })
    );
    el.innerHTML = days
      .map(function (d) {
        const v = Number(d[key]) || 0;
        const h = Math.max(4, Math.round((v / max) * 100));
        const label =
          metric === "money" ? "₹" + Math.round(v).toLocaleString("en-IN") : String(v);
        return (
          '<div class="trend-col' +
          (d.isToday ? " is-today" : "") +
          '" title="' +
          (d.label || "") +
          ": " +
          label +
          '">' +
          '<div class="trend-bar-wrap"><span class="trend-bar" style="height:' +
          h +
          '%"></span></div>' +
          '<span class="trend-val">' +
          label +
          "</span>" +
          '<span class="trend-day">' +
          (d.label || "") +
          "</span>" +
          "</div>"
        );
      })
      .join("");
    if (foot) {
      foot.textContent =
        metric === "money"
          ? "Approved ₹ by IST day"
          : metric === "actives"
            ? "Users active by IST day"
            : "New signups by IST day";
    }
  }

  function renderAnalyticsVisuals(a) {
    const total = Number(a.usersTotal) || 0;
    const paid = Number(a.paidUsers) || 0;
    const trial = Number(a.trialOnly != null ? a.trialOnly : Math.max(0, total - paid));
    const withTime = Number(a.withTimeLeft) || 0;
    const inChat = Number(a.sessionActive) || 0;
    const appOpen = Number(a.appOpen) || 0;

    if (statMoneyToday) {
      statMoneyToday.textContent = inr(a.moneyToday != null ? a.moneyToday : 0);
    }
    if (statMoneyWeek) {
      statMoneyWeek.textContent =
        inr(a.moneyWeek != null ? a.moneyWeek : 0) + " this week";
    }
    if (statPaidShare) {
      statPaidShare.textContent =
        (a.paidSharePct != null ? a.paidSharePct : pctWidth(paid, total)) + "%";
    }
    if (statTrialOnly) statTrialOnly.textContent = String(trial);
    if (statConvertToday) {
      const opens = Number(a.payOpensToday) || 0;
      if (opens <= 0) {
        statConvertToday.textContent = "—";
      } else {
        statConvertToday.textContent =
          (a.convertTodayPct != null ? a.convertTodayPct : 0) + "%";
      }
    }
    if (statFunnelTodaySub) {
      const opens = Number(a.payOpensToday) || 0;
      const wins = Number(a.paySuccessToday) || 0;
      statFunnelTodaySub.textContent =
        opens <= 0
          ? "No checkout opens yet"
          : opens + " opens · " + wins + " paid";
    }

    const mixPaidLabel = document.getElementById("mix-paid-label");
    const mixTimeLabel = document.getElementById("mix-time-label");
    const mixLiveLabel = document.getElementById("mix-live-label");
    const mixPaidFill = document.getElementById("mix-paid-fill");
    const mixTimeFill = document.getElementById("mix-time-fill");
    const mixChatFill = document.getElementById("mix-chat-fill");
    const mixAppFill = document.getElementById("mix-app-fill");
    if (mixPaidLabel) mixPaidLabel.textContent = paid + " / " + total;
    if (mixTimeLabel) mixTimeLabel.textContent = withTime + " / " + total;
    if (mixLiveLabel) {
      mixLiveLabel.textContent = inChat + " chat · " + appOpen + " app";
    }
    if (mixPaidFill) mixPaidFill.style.width = pctWidth(paid, total) + "%";
    if (mixTimeFill) mixTimeFill.style.width = pctWidth(withTime, total) + "%";
    if (mixChatFill) mixChatFill.style.width = pctWidth(inChat, total) + "%";
    if (mixAppFill) {
      const appOnly = Math.max(0, appOpen - inChat);
      mixAppFill.style.width = pctWidth(appOnly, total) + "%";
    }

    const leads = Number(a.payLeadsOpen) || 0;
    const abandon = Number(a.payAbandonedOpen) || 0;
    const discount = Number(a.discountAsksOpen) || 0;
    const trialLeads = Number(a.trialLeads) || 0;
    const funnelMax = Math.max(1, leads, abandon, discount, trialLeads);
    const setFunnel = function (id, barId, n) {
      const el = document.getElementById(id);
      const bar = document.getElementById(barId);
      if (el) el.textContent = String(n);
      if (bar) bar.style.width = pctWidth(n, funnelMax) + "%";
    };
    setFunnel("funnel-leads", "funnel-bar-leads", leads);
    setFunnel("funnel-abandon", "funnel-bar-abandon", abandon);
    setFunnel("funnel-discount", "funnel-bar-discount", discount);
    setFunnel("funnel-trial", "funnel-bar-trial", trialLeads);

    analyticsSeriesCache = Array.isArray(a.seriesDays) ? a.seriesDays : [];
    renderTrendChart(analyticsSeriesCache, analyticsTrendMetric);
  }

  function updateStats(users, allPayments, analytics) {
    const a = analytics || {};
    const list = users || [];
    const pays = allPayments || [];
    if (statUsers) {
      statUsers.textContent = String(
        a.usersTotal != null ? a.usersTotal : list.length
      );
    }
    if (statPending) {
      statPending.textContent = String(
        a.paymentsPending != null
          ? a.paymentsPending
          : pays.filter(function (p) {
              return p.status === "pending";
            }).length
      );
    }
    if (statPayLeads) {
      statPayLeads.textContent = String(
        a.payLeadsOpen != null
          ? a.payLeadsOpen
          : Number(a.discountAsksOpen || 0) + Number(a.payAbandonedOpen || 0)
      );
    }
    if (statHours) {
      const hours =
        a.hoursLive != null
          ? a.hoursLive
          : list.reduce(function (sum, u) {
              return sum + Number(u.hoursBalance || 0);
            }, 0);
      statHours.textContent = Number(hours).toFixed(1);
    }
    if (statMoney) {
      const collected =
        a.moneyInr != null
          ? a.moneyInr
          : pays
              .filter(function (p) {
                return p.status === "approved";
              })
              .reduce(function (sum, p) {
                return sum + Number(p.amountInr || 0);
              }, 0);
      statMoney.textContent = inr(collected);
    }
    if (statPaid) {
      statPaid.textContent = String(
        a.paidUsers != null
          ? a.paidUsers
          : list.filter(function (u) {
              return u.hasPaid;
            }).length
      );
    }
    if (statActive) {
      statActive.textContent = String(
        a.sessionActive != null
          ? a.sessionActive
          : list.filter(function (u) {
              return u.sessionActive;
            }).length
      );
    }
    if (statAppOpen) {
      statAppOpen.textContent = String(
        a.appOpen != null
          ? a.appOpen
          : list.filter(function (u) {
              return u.appOpen;
            }).length
      );
    }
    if (statTrialLeads) {
      if (a.trialLeads != null) {
        statTrialLeads.textContent = String(a.trialLeads);
      } else {
        const todayMs = startOfTodayIstMs();
        statTrialLeads.textContent = String(
          list.filter(function (u) {
            return (
              !u.hasPaid &&
              Number(u.hoursBalance || 0) <= 0.0001 &&
              userActivityAt(u) >= todayMs
            );
          }).length
        );
      }
    }
    if (statHoursSold) {
      statHoursSold.textContent = String(
        a.hoursSold != null ? a.hoursSold : "—"
      );
    }
    if (statMsgs) {
      statMsgs.textContent = String(
        a.chatMessages != null
          ? a.chatMessages.toLocaleString("en-IN")
          : list.reduce(function (sum, u) {
              return sum + Number(u.chatMsgCount || 0);
            }, 0)
      );
    }
    if (statReports) {
      statReports.textContent = String(a.aiReports != null ? a.aiReports : "—");
    }
    if (statToday) {
      statToday.textContent = String(
        a.usersNewToday != null
          ? a.usersNewToday
          : a.usersToday != null
            ? a.usersToday
            : "—"
      );
    }
    if (statUniqueToday) {
      statUniqueToday.textContent = String(
        a.usersUniqueToday != null ? a.usersUniqueToday : "—"
      );
    }
    if (statRepeatToday) {
      statRepeatToday.textContent = String(
        a.usersRepeatToday != null ? a.usersRepeatToday : "—"
      );
    }
    renderAnalyticsVisuals(a);
  }

  async function loadAnalytics() {
    try {
      const res = await fetch("/api/admin/analytics", { headers: authHeaders() });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return null;
        return null;
      }
      return data.analytics || null;
    } catch (e) {
      return null;
    }
  }

  function renderVeniceCredits(data) {
    const box = document.getElementById("venice-credits");
    const usdEl = document.getElementById("venice-credits-usd");
    const subEl = document.getElementById("venice-credits-sub");
    if (!box || !usdEl) return;
    if (!data || !data.ok) {
      box.classList.remove("is-ok", "is-low");
      usdEl.textContent = "—";
      if (subEl) {
        subEl.textContent = (data && data.error) || "Could not load Venice credits";
      }
      return;
    }
    const usd = data.usd != null ? Number(data.usd) : null;
    const diem = data.diem != null ? Number(data.diem) : null;
    if (usd != null && Number.isFinite(usd)) {
      usdEl.textContent =
        "$" +
        usd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
    } else {
      usdEl.textContent = "—";
    }
    box.classList.toggle("is-low", usd != null && usd < 2);
    box.classList.toggle("is-ok", usd != null && usd >= 2);
    const parts = [];
    if (diem != null && Number.isFinite(diem) && diem > 0) {
      parts.push(
        "DIEM " +
          diem.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })
      );
    }
    if (data.tier) parts.push(String(data.tier));
    if (data.accessPermitted === false) parts.push("blocked");
    else if (data.accessPermitted) parts.push("OK");
    if (data.nextEpochBegins) {
      try {
        const d = new Date(data.nextEpochBegins);
        if (!isNaN(d.getTime())) {
          parts.push("epoch " + d.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }));
        }
      } catch (e) {}
    }
    if (subEl) subEl.textContent = parts.length ? parts.join(" · ") : "Remaining balance";
  }

  async function loadVeniceCredits(opts) {
    const force = !!(opts && opts.force);
    try {
      const res = await fetch(
        "/api/admin/venice-credits" + (force ? "?fresh=1" : ""),
        { headers: authHeaders() }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return null;
        renderVeniceCredits({
          ok: false,
          error: data.error || "Venice credits failed",
        });
        return null;
      }
      renderVeniceCredits(data);
      return data;
    } catch (e) {
      renderVeniceCredits({ ok: false, error: "Network error" });
      return null;
    }
  }

  function renderGpuStatus(data) {
    const box = document.getElementById("gpu-status");
    const mainEl = document.getElementById("gpu-status-main");
    const subEl = document.getElementById("gpu-status-sub");
    if (!box || !mainEl) return;
    if (!data || !data.comfyConfigured) {
      box.classList.remove("is-ok", "is-low");
      mainEl.textContent = "Off";
      if (subEl) {
        subEl.textContent =
          (data && data.backend === "venice"
            ? "Venice is painting photos. Set COMFYUI_URL for RunPod."
            : "Set COMFYUI_URL in .env to use the RunPod ComfyUI GPU.");
      }
      return;
    }
    const ready = !!data.ok;
    box.classList.toggle("is-ok", ready);
    box.classList.toggle("is-low", !ready);
    mainEl.textContent = ready ? "Ready" : "Wait";
    const models = data.models || {};
    const bits = [];
    if (data.backend) bits.push(String(data.backend));
    if (ready && models.clip && /uncensored|heretic/i.test(String(models.clip))) {
      bits.push("uncensored CLIP");
    } else if (ready && data.clipHint) {
      bits.push("official CLIP — modest");
    }
    if (ready && models.unet) bits.push(String(models.unet).replace(/\.safetensors$/i, ""));
    else if (data.error) bits.push(String(data.error));
    if (subEl) {
      subEl.textContent = bits.join(" · ") || (ready ? "Qwen-Image-Edit" : "Pod not ready");
      if (data.clipHint) subEl.title = data.clipHint;
    }
  }

  async function loadGpuStatus() {
    try {
      const res = await fetch("/api/admin/gpu-status", { headers: authHeaders() });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return null;
        renderGpuStatus({
          ok: false,
          comfyConfigured: true,
          error: data.error || "GPU status failed",
        });
        return null;
      }
      renderGpuStatus(data);
      return data;
    } catch (e) {
      renderGpuStatus({ ok: false, comfyConfigured: true, error: "Network error" });
      return null;
    }
  }
  function startOfTodayIstMs() {
    const now = Date.now();
    const istOffsetMin = 330;
    const shifted = new Date(now + istOffsetMin * 60000);
    return (
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate()
      ) -
      istOffsetMin * 60000
    );
  }

  function userActivityAt(u) {
    return Math.max(
      Number(u && u.lastSeenAt) || 0,
      Number(u && u.lastTickAt) || 0,
      Number(u && u.createdAt) || 0
    );
  }

  function formatRelativeShort(ts) {
    const t = Number(ts) || 0;
    if (!t) return "never";
    const diff = Date.now() - t;
    if (diff < 0) return "just now";
    if (diff < 45000) return "just now";
    if (diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + "m ago";
    if (diff < 86400000) return Math.max(1, Math.round(diff / 3600000)) + "h ago";
    if (diff < 7 * 86400000) return Math.max(1, Math.round(diff / 86400000)) + "d ago";
    return new Date(t).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  }

  function formatShortLeft(hoursBalance) {
    const totalSec = Math.max(0, Math.floor(Number(hoursBalance || 0) * 3600));
    if (totalSec <= 0) return "0";
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return h + "h " + m + "m";
    if (m > 0) return m + "m";
    return s + "s";
  }

  /** Trial + paid: chip shows time left or ended (same clock rules). */
  function accessStatusChip(u) {
    const left = Number(u.hoursBalance || 0);
    const hasTime = left > 0.0001;
    const paid = !!u.hasPaid;
    if (paid) {
      return hasTime
        ? { key: "paid", text: "Paid · " + formatShortLeft(left) }
        : { key: "ended", text: "Paid · ended" };
    }
    return hasTime
      ? { key: "trial", text: "Trial · " + formatShortLeft(left) }
      : { key: "ended", text: "Unpaid · ended" };
  }

  /** Compact visit/pay labels for list rows + expand panel (IST day). */
  function userVisitInsight(u) {
    const todayMs = startOfTodayIstMs();
    const created = Number(u.createdAt || 0);
    const lastAt = userActivityAt(u);
    const newToday = created >= todayMs;
    const activeToday = lastAt >= todayMs;
    const pending = Number(u.pendingPayments || 0) > 0;
    const paid = !!u.hasPaid;
    const approved = Number(u.approvedPayments || 0);
    const hasTime = Number(u.hoursBalance || 0) > 0.0001;

    let visitKey = "idle";
    let visitLabel = "Quiet";
    if (newToday) {
      visitKey = "new";
      visitLabel = "New today";
    } else if (activeToday) {
      visitKey = "repeat";
      visitLabel = "Repeat today";
    } else if (created > 0 && lastAt > created + 12 * 3600000) {
      visitKey = "returning";
      visitLabel = "Returning";
    }

    const chips = [];
    if (visitKey === "new") {
      chips.push({ key: "new", text: "New" });
    } else if (visitKey === "repeat") {
      chips.push({ key: "repeat", text: "Repeat" });
    }
    if (pending) chips.push({ key: "pay-wait", text: "Pay?" });
    else if (paid && hasTime) chips.push({ key: "paid", text: "Paid" });
    else if (paid) chips.push({ key: "ended", text: "Ended" });
    else if (hasTime) chips.push({ key: "trial", text: "Trial" });
    else chips.push({ key: "ended", text: "Ended" });

    const parts = [];
    if (visitKey === "new") parts.push("Signed up today");
    else if (visitKey === "repeat") parts.push("Came back today");
    else if (visitKey === "returning") parts.push("Has visited before");
    else parts.push("No activity today");

    if (pending) parts.push("payment waiting review");
    else if (paid) {
      parts.push(
        hasTime
          ? approved > 1
            ? approved + " approved pays · time left"
            : "paid · time left"
          : "paid · time ended"
      );
    } else {
      parts.push(hasTime ? "free trial running" : "trial ended · unpaid");
    }

    if (lastAt) parts.push("last seen " + formatRelativeShort(lastAt));

    return {
      visitKey: visitKey,
      visitLabel: visitLabel,
      newToday: newToday,
      activeToday: activeToday,
      pending: pending,
      paid: paid,
      chips: chips.slice(0, 2),
      blurb: parts.join(" · "),
      lastAt: lastAt,
    };
  }

  function filterUsersList(list) {
    const q = String((userSearch && userSearch.value) || "")
      .trim()
      .toLowerCase();
    const f = (userFilter && userFilter.value) || "all";
    const todayMs = startOfTodayIstMs();
    return list.filter(function (u) {
      const created = Number(u.createdAt || 0);
      const activeToday = userActivityAt(u) >= todayMs;
      const newToday = created >= todayMs;
      if (f === "online" && !u.sessionActive) return false;
      if (f === "app-open" && !u.appOpen) return false;
      if (f === "trial-leads") {
        if (u.hasPaid) return false;
        if (Number(u.hoursBalance || 0) > 0.0001) return false;
        if (!activeToday) return false;
      }
      if (f === "idle" && u.appOpen) return false;
      if (f === "paid" && !u.hasPaid) return false;
      if (f === "unpaid" && u.hasPaid) return false;
      if (f === "has-time" && Number(u.hoursBalance || 0) <= 0.0001) return false;
      if (f === "no-time" && Number(u.hoursBalance || 0) > 0.0001) return false;
      if (f === "today" && !newToday) return false;
      if (f === "unique-today" && !activeToday) return false;
      if (f === "repeat-today" && !(activeToday && !newToday)) return false;
      if (!q) return true;
      const insight = userVisitInsight(u);
      const presenceLabel = u.sessionActive
        ? "in chat online"
        : u.appOpen
          ? "app open browsing"
          : "idle";
      const hay = [
        u.userId,
        u.pin,
        u.characterName,
        u.botRole,
        u.userRole,
        u.sceneNote,
        u.resistance,
        u.activeMood,
        u.hasPaid ? "paid" : "unpaid trial",
        Number(u.storyModeTotalUses || 0) > 0
          ? "story " + u.storyModeTotalUses
          : "",
        presenceLabel,
        insight.visitLabel,
        insight.newToday ? "new today" : "",
        insight.activeToday && !insight.newToday ? "repeat today" : "",
        insight.pending ? "pending pay" : "",
        insight.blurb,
      ]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function syncStatActive(action, userFilterValue, payStatus) {
    const hosts = document.querySelectorAll(".stats-wrap");
    hosts.forEach(function (host) {
      host
        .querySelectorAll(".stat, .analytics-kpi, .funnel-step")
        .forEach(function (el) {
          const a = el.getAttribute("data-stat-action") || "";
          const uf = el.getAttribute("data-user-filter") || "";
          const ps = el.getAttribute("data-pay-status") || "";
          let on = false;
          if (action === "users" && a === "users" && uf === userFilterValue) on = true;
          if (action === "payments" && a === "payments" && ps === payStatus) on = true;
          if (action === "reports" && a === "reports") on = true;
          if (action === "support" && a === "support") on = true;
          el.classList.toggle("is-active", on);
        });
    });
  }

  function applyStatClick(btn) {
    const action = btn.getAttribute("data-stat-action") || "users";
    const uf = btn.getAttribute("data-user-filter") || "all";
    const payStatus = btn.getAttribute("data-pay-status") || "all";
    const supportFilter = btn.getAttribute("data-support-filter") || "all";

    if (action === "reports") {
      syncStatActive("reports");
      showReportsTab();
      return;
    }
    if (action === "support") {
      supportFilterMode = supportFilter === "pay-leads" ? "pay-leads" : "all";
      syncStatActive("support");
      showSupportTab();
      return;
    }
    if (action === "payments") {
      if (statusFilter) statusFilter.value = payStatus;
      syncStatActive("payments", "", payStatus);
      showPaymentsTab();
      renderPayments(paymentsCache);
      return;
    }

    supportFilterMode = "all";
    if (userFilter) userFilter.value = uf;
    if (userSearch) userSearch.value = "";
    usersPage = 1;
    syncStatActive("users", uf);
    showUsersTab();
    renderUsers(usersCache);
  }

  function filterPaymentsList(list) {
    const status = (statusFilter && statusFilter.value) || "all";
    const q = String((paySearch && paySearch.value) || "")
      .trim()
      .toLowerCase();
    return list.filter(function (p) {
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
      const hay = [
        p.userId,
        p.paymentId,
        p.packageId,
        p.upiNote,
        p.status,
        p.amountInr,
        p.hours,
      ]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function formatClock(hoursBalance) {
    const totalSec = Math.max(0, Math.floor(Number(hoursBalance || 0) * 3600));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  function markLiveSync(ok) {
    lastLiveSyncAt = Date.now();
    if (!liveSyncMeta) return;
    liveSyncMeta.textContent = ok === false ? "Sync failed · retrying…" : "Live · just now";
    liveSyncMeta.classList.toggle("is-err", ok === false);
  }

  function paintLiveSyncAge() {
    if (!liveSyncMeta || !lastLiveSyncAt) return;
    if (liveSyncMeta.classList.contains("is-err")) return;
    const sec = Math.max(0, Math.round((Date.now() - lastLiveSyncAt) / 1000));
    if (sec < 3) liveSyncMeta.textContent = "Live · just now";
    else liveSyncMeta.textContent = "Live · " + sec + "s ago";
  }

  /** Tick remaining clocks locally between server polls (wall-clock always runs). */
  function paintLiveClocks() {
    if (!usersEl) return;
    const cards = usersEl.querySelectorAll(".user-card[data-hours]");
    cards.forEach(function (card) {
      const base = Number(card.getAttribute("data-hours") || 0);
      const fetchedAt = Number(card.getAttribute("data-fetched-at") || 0);
      let hours = base;
      if (fetchedAt > 0) {
        hours = Math.max(0, base - (Date.now() - fetchedAt) / 3600000);
      }
      const clock = card.querySelector(".user-card-clock");
      if (clock) clock.textContent = formatClock(hours);
      const detailClock = card.querySelector(".uc-time-clock");
      if (detailClock) detailClock.textContent = formatClock(hours);
      const detailHrs = card.querySelector(".uc-time-hours");
      if (detailHrs) detailHrs.textContent = hours.toFixed(2) + "h left";
      const accessChip = card.querySelector(".user-card-facts .uc-chip[data-access]");
      if (accessChip) {
        const paid = accessChip.getAttribute("data-access") === "paid";
        if (hours <= 0.0001) {
          accessChip.className = "uc-chip ended";
          accessChip.setAttribute("data-access", paid ? "paid" : "trial");
          accessChip.textContent = paid ? "Paid · ended" : "Unpaid · ended";
        } else {
          accessChip.className = "uc-chip " + (paid ? "paid" : "trial");
          accessChip.textContent =
            (paid ? "Paid · " : "Trial · ") + formatShortLeft(hours);
        }
      }
    });
    paintLiveSyncAge();
  }

  async function softRefreshNow() {
    if (!token) return;
    if (document.hidden) return;
    if (softRefreshBusy) {
      softRefreshQueued = true;
      return;
    }
    softRefreshBusy = true;
    try {
      await refreshAll({ soft: true });
      markLiveSync(true);
    } catch (e) {
      markLiveSync(false);
    } finally {
      softRefreshBusy = false;
      if (softRefreshQueued) {
        softRefreshQueued = false;
        softRefreshNow();
      }
    }
  }

  function usersPageSize() {
    const n = Number(usersPageSizeEl && usersPageSizeEl.value);
    return n === 10 || n === 50 ? n : 20;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function closeChatDrawer() {
    if (!chatDrawer) return;
    chatDrawer.classList.add("hidden");
    chatDrawer.setAttribute("aria-hidden", "true");
    openChatUserId = "";
    if (chatDeleteBtn) chatDeleteBtn.classList.add("hidden");
    if (chatSessionTabs) {
      chatSessionTabs.classList.add("hidden");
      chatSessionTabs.innerHTML = "";
    }
  }

  function extractAdminSceneInfo(session) {
    const form = (session && session.form) || {};
    const setup = String((session && session.rpSetup) || "");
    let brief = String(form.note || "").trim();
    if (!brief) {
      const m = setup.match(/USER RP BRIEF[^:\n]*:\s*([^\n]+)/i);
      if (m) {
        brief = m[1]
          .trim()
          .replace(
            /\.\s*(Start vibe|Pace|Resistance|All adults|Scene rule|ACTIVE MOOD|Identity lock|Default shy).*/i,
            ""
          )
          .trim();
        if (/^none\b/i.test(brief)) brief = "";
      }
    }
    const moodMatch = setup.match(/ACTIVE MOOD:\s*([^\n.]+)/i);
    return {
      characterName:
        form.characterName ||
        (session &&
          session.selectedCharacter &&
          session.selectedCharacter.name) ||
        "—",
      botRole: form.botRole || "—",
      userRole: form.userRole || "—",
      resistance: form.resistance || "—",
      vibe: form.vibe || "—",
      pace: form.pace || "—",
      language: form.language || "—",
      brief: brief || "",
      mood: moodMatch ? moodMatch[1].trim() : "",
      rpSetup: setup,
    };
  }

  function renderSessionMessages(session, source, keepDays) {
    if (!session || !Array.isArray(session.history) || !session.history.length) {
      chatDrawerMeta.textContent = "No saved chat yet for this user.";
      chatDrawerBody.innerHTML =
        "<div class='empty'>Empty — user has not chatted, or history was never saved.</div>";
      return;
    }

    const info = extractAdminSceneInfo(session);
    const when = session.updatedAt || session.archivedAt;
    chatDrawerMeta.textContent =
      (source === "archived" ? "Archived · " : "Live · ") +
      "Kept " +
      (keepDays || 5) +
      " days · Character: " +
      info.characterName +
      " · Role: " +
      info.botRole +
      " · You: " +
      info.userRole +
      (when ? " · " + new Date(when).toLocaleString() : "");

    const sceneRows = [
      ["AI", info.characterName + " (" + info.botRole + ")"],
      ["You are", info.userRole],
      ["Resistance", info.resistance],
      ["Vibe", info.vibe],
      ["Pace", info.pace],
      ["Language", info.language],
    ];
    if (info.mood) sceneRows.push(["Mood", info.mood]);
    if (info.brief) sceneRows.push(["User scene / RP notes", info.brief]);
    else sceneRows.push(["User scene / RP notes", "(none — user left notes empty)"]);

    const sceneHtml =
      "<div class='admin-scene-box'>" +
      "<div class='admin-scene-title'>User-defined scene (updates when they Save settings)</div>" +
      "<dl class='admin-scene-dl'>" +
      sceneRows
        .map(function (row) {
          return (
            "<div class='admin-scene-row'><dt>" +
            escapeHtml(row[0]) +
            "</dt><dd>" +
            escapeHtml(row[1]) +
            "</dd></div>"
          );
        })
        .join("") +
      "</dl>" +
      (info.rpSetup
        ? "<details class='admin-scene-raw'><summary>Full setup text</summary><pre>" +
          escapeHtml(info.rpSetup) +
          "</pre></details>"
        : "") +
      "</div>";

    const msgs = session.history.filter(function (m) {
      return (
        m &&
        m.content &&
        !/^Setup locked for this chat:/i.test(String(m.content))
      );
    });

    if (!msgs.length) {
      chatDrawerBody.innerHTML =
        sceneHtml +
        "<div class='empty'>Only setup data — no dialogue yet.</div>";
      return;
    }

    chatDrawerBody.innerHTML =
      sceneHtml +
      msgs
        .map(function (m) {
          const who = m.role === "user" ? "User" : "AI";
          const cls = m.role === "user" ? "user" : "ai";
          return (
            "<div class='chat-bubble " +
            cls +
            "'><span class='chat-who'>" +
            who +
            "</span><p>" +
            escapeHtml(m.content) +
            "</p></div>"
          );
        })
        .join("");
  }

  function renderChatSessions(sessions, keepDays) {
    if (!chatSessionTabs) return;
    if (!sessions || sessions.length <= 1) {
      chatSessionTabs.classList.add("hidden");
      chatSessionTabs.innerHTML = "";
      return;
    }
    chatSessionTabs.classList.remove("hidden");
    chatSessionTabs.innerHTML = sessions
      .map(function (item, idx) {
        const s = item.session || {};
        const when = s.updatedAt || s.archivedAt;
        const label =
          (item.source === "live" ? "Live" : "Old") +
          (when ? " · " + new Date(when).toLocaleString() : "") +
          " · #" +
          (idx + 1);
        return (
          "<button type='button' class='chat-session-tab" +
          (idx === 0 ? " active" : "") +
          "' data-session-idx='" +
          idx +
          "'>" +
          escapeHtml(label) +
          "</button>"
        );
      })
      .join("");

    chatSessionTabs.onclick = function (e) {
      const btn = e.target.closest("[data-session-idx]");
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-session-idx"));
      const item = sessions[idx];
      if (!item) return;
      Array.prototype.forEach.call(
        chatSessionTabs.querySelectorAll(".chat-session-tab"),
        function (el) {
          el.classList.toggle(
            "active",
            el.getAttribute("data-session-idx") === String(idx)
          );
        }
      );
      renderSessionMessages(item.session, item.source, keepDays);
    };
  }

  async function openUserChat(userId) {
    if (!chatDrawer) return;
    openChatUserId = String(userId || "");
    setDrawerTab("chat");
    chatDrawer.classList.remove("hidden");
    chatDrawer.setAttribute("aria-hidden", "false");
    chatDrawerTitle.textContent = "User " + userId;
    chatDrawerMeta.textContent = "Loading chat…";
    chatDrawerBody.innerHTML = "<p class='meta'>Loading…</p>";
    if (chatDeleteBtn) chatDeleteBtn.classList.remove("hidden");
    if (chatSessionTabs) {
      chatSessionTabs.classList.add("hidden");
      chatSessionTabs.innerHTML = "";
    }

    try {
      const res = await fetch(
        "/api/admin/users/" + encodeURIComponent(userId) + "/chat",
        { headers: authHeaders() }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        chatDrawerMeta.textContent = "";
        chatDrawerBody.innerHTML =
          "<div class='empty'>" +
          escapeHtml(data.error || "Could not load chat") +
          "</div>";
        return;
      }

      const sessions =
        Array.isArray(data.sessions) && data.sessions.length
          ? data.sessions
          : data.session
            ? [{ source: data.source || "live", session: data.session }]
            : [];
      const keepDays = data.keepDays || 5;

      if (!sessions.length) {
        chatDrawerMeta.textContent = "No saved chat yet for this user.";
        chatDrawerBody.innerHTML =
          "<div class='empty'>Empty — user has not chatted, or history was never saved.</div>";
        return;
      }

      renderChatSessions(sessions, keepDays);
      renderSessionMessages(
        sessions[0].session,
        sessions[0].source,
        keepDays
      );
    } catch (e) {
      chatDrawerMeta.textContent = "";
      chatDrawerBody.innerHTML = "<div class='empty'>Network error</div>";
    }
  }

  function setDrawerTab(name) {
    drawerTab = name === "photos" ? "photos" : "chat";
    if (drawerTabChat) drawerTabChat.classList.toggle("active", drawerTab === "chat");
    if (drawerTabPhotos) drawerTabPhotos.classList.toggle("active", drawerTab === "photos");
    var kicker = document.querySelector(".chat-drawer-head .brand-kicker");
    if (kicker) kicker.textContent = drawerTab === "photos" ? "User photos" : "User chat";
    if (chatDeleteBtn) {
      chatDeleteBtn.classList.toggle("hidden", drawerTab !== "chat" || !openChatUserId);
    }
    if (chatSessionTabs && drawerTab !== "chat") {
      chatSessionTabs.classList.add("hidden");
    }
  }

  function renderUserPhotos(data) {
    const looks = (data && data.looks) || [];
    const usage = (data && data.usage) || {};
    chatDrawerMeta.textContent =
      "Photos kept " +
      (data.keepDays || 5) +
      " days · " +
      Number(usage.usedHour || 0) +
      "/" +
      Number(usage.cap || 25) +
      " this hour · extra " +
      Number(usage.bonus || 0) +
      " · " +
      looks.length +
      " saved";
    if (!looks.length) {
      chatDrawerBody.innerHTML =
        "<div class='empty'>No generated photos saved yet for this user.</div>";
      return;
    }
    chatDrawerBody.innerHTML =
      "<div class='admin-photo-grid'>" +
      looks
        .map(function (look) {
          const when = look.createdAt
            ? new Date(look.createdAt).toLocaleString()
            : "";
          const prompt = look.prompt || look.caption || "(no prompt)";
          const src = photoSrc(String(look.url || ""));
          return (
            "<figure class='admin-photo-look'>" +
            (src
              ? "<img src='" +
                escapeHtml(src) +
                "' alt='' data-open-src='" +
                escapeHtml(src) +
                "'>"
              : "") +
            "<figcaption>" +
            "<span class='who'>" +
            (look.iterate ? "Edit" : "New photo") +
            (when ? " · " + escapeHtml(when) : "") +
            "</span>" +
            "<p>" +
            escapeHtml(prompt) +
            "</p>" +
            "</figcaption></figure>"
          );
        })
        .join("") +
      "</div>";
  }

  async function openUserPhotos(userId) {
    if (!chatDrawer) return;
    openChatUserId = String(userId || "");
    setDrawerTab("photos");
    chatDrawer.classList.remove("hidden");
    chatDrawer.setAttribute("aria-hidden", "false");
    chatDrawerTitle.textContent = "User " + userId;
    chatDrawerMeta.textContent = "Loading photos…";
    chatDrawerBody.innerHTML = "<p class='meta'>Loading…</p>";
    if (chatSessionTabs) {
      chatSessionTabs.classList.add("hidden");
      chatSessionTabs.innerHTML = "";
    }
    try {
      const res = await fetch(
        "/api/admin/users/" + encodeURIComponent(userId) + "/photos",
        { headers: authHeaders() }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        chatDrawerMeta.textContent = "";
        chatDrawerBody.innerHTML =
          "<div class='empty'>" +
          escapeHtml(data.error || "Could not load photos") +
          "</div>";
        return;
      }
      renderUserPhotos(data);
    } catch (e) {
      chatDrawerMeta.textContent = "";
      chatDrawerBody.innerHTML = "<div class='empty'>Network error</div>";
    }
  }

  async function adjustPhotoCredits(userId, n) {
    const res = await fetch(
      "/api/admin/users/" + encodeURIComponent(userId) + "/photo-credits",
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ add: n }),
      }
    );
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      if (handleAuthFail(res)) return;
      toast(data.error || "Failed", "err");
      return;
    }
    const extra =
      data.usage && data.usage.bonus != null
        ? data.usage.bonus + " extra looks now"
        : "updated";
    toast("Photo credits: " + extra, "ok");
    await refreshAll();
    if (openChatUserId === String(userId) && drawerTab === "photos") {
      openUserPhotos(userId);
    }
  }

  function renderUsers(list, soft) {
    const scrollParent = usersEl;
    const prevScroll = soft && scrollParent ? scrollParent.scrollTop : 0;
    const filtered = filterUsersList(list || []).slice().sort(function (a, b) {
      const ao = a.sessionActive ? 2 : a.appOpen ? 1 : 0;
      const bo = b.sessionActive ? 2 : b.appOpen ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
    const pageSize = usersPageSize();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
    if (usersPage > totalPages) usersPage = totalPages;
    if (usersPage < 1) usersPage = 1;
    const start = (usersPage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    usersCount.textContent =
      filtered.length +
      " shown · " +
      list.length +
      " total · page " +
      usersPage +
      "/" +
      totalPages;

    if (usersPager) {
      const showPager = filtered.length > pageSize;
      usersPager.classList.toggle("hidden", !showPager);
      if (usersPageLabel) {
        usersPageLabel.textContent =
          "Page " + usersPage + " of " + totalPages;
      }
      if (usersPrevBtn) usersPrevBtn.disabled = usersPage <= 1;
      if (usersNextBtn) usersNextBtn.disabled = usersPage >= totalPages;
    }

    if (!list.length) {
      usersEl.innerHTML =
        "<div class='empty'>No users yet.<br/>Open chat → New ID to create one.</div>";
      if (usersPager) usersPager.classList.add("hidden");
      return;
    }
    if (!filtered.length) {
      usersEl.innerHTML = "<div class='empty'>No users match your search / filter.</div>";
      if (usersPager) usersPager.classList.add("hidden");
      return;
    }

    const cards = pageItems
      .map(function (u) {
        const clock = formatClock(u.hoursBalance);
        const insight = userVisitInsight(u);
        const chatLabel = u.chatMsgCount
          ? u.chatMsgCount +
            (u.chatSessionCount > 1 ? " / " + u.chatSessionCount + " chats" : "") +
            (u.chatArchived && !u.chatLive ? " (old)" : "")
          : "No chats";
        const scene =
          (u.characterName || "—") +
          (u.botRole ? " · " + u.botRole : "") +
          (u.userRole ? " ↔ " + u.userRole : "");
        const sceneBrief = u.sceneNote
          ? String(u.sceneNote).length > 70
            ? String(u.sceneNote).slice(0, 67) + "…"
            : String(u.sceneNote)
          : "";
        const presenceClass = u.sessionActive
          ? "online"
          : u.appOpen
            ? "app-open"
            : "";
        const presenceLabel = u.sessionActive
          ? "in chat"
          : u.appOpen
            ? "app open"
            : "idle";
        const onlineBadge =
          "<span class='badge " +
          presenceClass +
          " user-card-status'>" +
          presenceLabel +
          "</span>";
        const signalChips = insight.chips
          .map(function (c) {
            return (
              "<span class='uc-chip " +
              escapeHtml(c.key) +
              "'>" +
              escapeHtml(c.text) +
              "</span>"
            );
          })
          .join("");
        const detailChips = [
          {
            key: insight.visitKey === "new" ? "new" : insight.visitKey === "repeat" ? "repeat" : "quiet",
            text: insight.visitLabel,
          },
          insight.pending
            ? { key: "pay-wait", text: "Payment pending" }
            : accessStatusChip(u),
        ];
        if (Number(u.storyModeTotalUses || 0) > 0) {
          detailChips.push({
            key: "story",
            text:
              "Story ×" +
              Number(u.storyModeTotalUses || 0) +
              (u.hasPaid
                ? ""
                : " (" +
                  Number(u.storyModeFreeUsed || 0) +
                  "/" +
                  Number(u.storyModeFreeLimit || 2) +
                  " free)"),
          });
        }
        if (Number(u.photoLookCount || 0) > 0 || Number(u.photoBonus || 0) > 0) {
          detailChips.push({
            key: "photos",
            text:
              "Photos " +
              Number(u.photoUsedHour || 0) +
              "/" +
              Number(u.photoCap || 25) +
              "h" +
              (Number(u.photoLookCount || 0)
                ? " · " + Number(u.photoLookCount) + " saved"
                : "") +
              (Number(u.photoBonus || 0) ? " · +" + Number(u.photoBonus) + " extra" : ""),
          });
        }
        if (u.photoCreditRequested) {
          detailChips.push({ key: "photo-ask", text: "Asked extra photos" });
        }
        const tileFactChips = [
          insight.pending
            ? { key: "pay-wait", text: "Pay wait" }
            : accessStatusChip(u),
        ];
        if (Number(u.storyModeTotalUses || 0) > 0) {
          tileFactChips.push({
            key: "story",
            text:
              "Story ×" +
              Number(u.storyModeTotalUses || 0) +
              (u.hasPaid
                ? ""
                : " (" +
                  Number(u.storyModeFreeUsed || 0) +
                  "/" +
                  Number(u.storyModeFreeLimit || 2) +
                  " free)"),
          });
        }
        const tileFactsHtml = tileFactChips
          .map(function (c) {
            return (
              "<span class='uc-chip " +
              escapeHtml(c.key) +
              "'" +
              (c.key === "paid" || c.key === "trial" || c.key === "ended"
                ? " data-access='" +
                  (u.hasPaid ? "paid" : "trial") +
                  "'"
                : "") +
              ">" +
              escapeHtml(c.text) +
              "</span>"
            );
          })
          .join("");
        const detailChipsHtml = detailChips
          .map(function (c) {
            return (
              "<span class='uc-chip " +
              escapeHtml(c.key) +
              "'>" +
              escapeHtml(c.text) +
              "</span>"
            );
          })
          .join("");
        const pays =
          "P " +
          (u.pendingPayments || 0) +
          " · A " +
          (u.approvedPayments || 0) +
          (u.rejectedPayments ? " · R " + u.rejectedPayments : "");
        const isOpen = expandedUserIds.has(String(u.userId));
        const uid = escapeHtml(u.userId);

        return (
          "<article class='user-card" +
          (u.sessionActive ? " is-online" : "") +
          (u.appOpen && !u.sessionActive ? " is-app-open" : "") +
          (Number(u.pendingPayments || 0) > 0 ? " has-pending" : "") +
          (insight.newToday ? " is-new-today" : "") +
          (insight.visitKey === "repeat" ? " is-repeat-today" : "") +
          (isOpen ? " is-open" : "") +
          "' data-user-id='" +
          uid +
          "' data-hours='" +
          Number(u.hoursBalance || 0) +
          "' data-online='" +
          (u.sessionActive ? "1" : "0") +
          "' data-app-open='" +
          (u.appOpen ? "1" : "0") +
          "' data-fetched-at='" +
          Date.now() +
          "'>" +
          "<div class='user-card-summary'>" +
          "<button type='button' class='id-pill id-link' title='Open chat' data-view-chat='" +
          uid +
          "'>" +
          uid +
          "</button>" +
          "<button type='button' class='user-card-toggle' data-toggle-user='" +
          uid +
          "' aria-expanded='" +
          (isOpen ? "true" : "false") +
          "' aria-label='User " +
          uid +
          " details'>" +
          "<span class='user-card-clock'>" +
          clock +
          "</span>" +
          "<span class='user-card-facts' aria-hidden='false'>" +
          tileFactsHtml +
          "</span>" +
          "<span class='user-card-signals'>" +
          signalChips +
          onlineBadge +
          "</span>" +
          USER_CHEVRON +
          "</button>" +
          "</div>" +
          "<div class='user-card-detail'>" +
          "<div class='user-card-insights'>" +
          "<div class='user-card-insight-chips'>" +
          detailChipsHtml +
          "</div>" +
          "<p class='user-card-insight-blurb'>" +
          escapeHtml(insight.blurb) +
          "</p>" +
          "</div>" +
          "<div class='user-card-meta'>" +
          "<div><span class='uc-label'>PIN</span> <b class='pin-cell'>" +
          escapeHtml(u.pin || "—") +
          "</b></div>" +
          "<div class='uc-time-block" +
          (Number(u.hoursBalance || 0) <= 0.0001 ? " is-empty" : "") +
          "'>" +
          "<span class='uc-label'>Access</span>" +
          "<div class='uc-time-main'>" +
          "<strong class='uc-time-clock'>" +
          clock +
          "</strong>" +
          "<span class='uc-time-hours'>" +
          Number(u.hoursBalance || 0).toFixed(2) +
          "h left</span>" +
          "</div>" +
          (Number(u.accessExpiresAt) > Date.now()
            ? "<span class='uc-time-until'>Ends " +
              escapeHtml(new Date(Number(u.accessExpiresAt)).toLocaleString()) +
              "</span>"
            : "<span class='uc-time-until muted'>" +
              (u.hasPaid ? "Paid access ended" : "Trial ended") +
              "</span>") +
          "</div>" +
          "<div><span class='uc-label'>Seen</span> " +
          escapeHtml(formatRelativeShort(insight.lastAt)) +
          (insight.lastAt
            ? " · " + escapeHtml(new Date(insight.lastAt).toLocaleString())
            : "") +
          "</div>" +
          "<div><span class='uc-label'>Joined</span> " +
          new Date(u.createdAt).toLocaleString() +
          "</div>" +
          "<div><span class='uc-label'>Story</span> " +
          (Number(u.storyModeTotalUses || 0) > 0
            ? "<b>" +
              Number(u.storyModeTotalUses || 0) +
              "</b> uses" +
              (u.hasPaid
                ? " · paid unlimited"
                : " · free " +
                  Number(u.storyModeFreeUsed || 0) +
                  "/" +
                  Number(u.storyModeFreeLimit || 2)) +
              (u.storyModeLastAt
                ? " · last " +
                  escapeHtml(formatRelativeShort(u.storyModeLastAt))
                : "")
            : u.hasPaid
              ? "Paid · not used yet"
              : "Free " +
                Number(u.storyModeFreeUsed || 0) +
                "/" +
                Number(u.storyModeFreeLimit || 2) +
                " unused") +
          "</div>" +
          "<div><span class='uc-label'>Scene</span> " +
          escapeHtml(scene) +
          "</div>" +
          (sceneBrief
            ? "<div class='user-card-brief'><span class='uc-label'>Notes</span> " +
              escapeHtml(sceneBrief) +
              "</div>"
            : "") +
          (u.resistance || u.activeMood
            ? "<div><span class='uc-label'>Pace</span> " +
              escapeHtml(
                [u.resistance, u.activeMood ? "mood:" + u.activeMood : ""]
                  .filter(Boolean)
                  .join(" · ")
              ) +
              "</div>"
            : "") +
          "<div><span class='uc-label'>Pays</span> " +
          pays +
          "</div>" +
          "</div>" +
          "<button type='button' class='user-card-chat' data-view-chat='" +
          uid +
          "'>" +
          "View chat · " +
          escapeHtml(chatLabel) +
          "</button>" +
          "<button type='button' class='user-card-chat' data-view-photos='" +
          uid +
          "'>" +
          "View photos · " +
          (Number(u.photoLookCount || 0)
            ? Number(u.photoLookCount) + " saved"
            : "none yet") +
          " · " +
          Number(u.photoUsedHour || 0) +
          "/" +
          Number(u.photoCap || 25) +
          " this hour" +
          (Number(u.photoBonus || 0) ? " · +" + Number(u.photoBonus) + " extra" : "") +
          "</button>" +
          "<div class='user-card-actions'>" +
          "<div class='uc-action-group'>" +
          "<p class='uc-action-label'>Add access</p>" +
          "<div class='uc-action-row uc-action-row-add'>" +
          "<button type='button' class='btn-ghost btn-sm' title='Add 10 minutes' data-add-hours-10m='" +
          uid +
          "'>+10m</button>" +
          "<button type='button' class='btn-ghost btn-sm' title='Add 30 minutes' data-add-hours-30m='" +
          uid +
          "'>+30m</button>" +
          "<button type='button' class='btn btn-sm' title='Add 1 hour' data-add-hours='" +
          uid +
          "'>+1h</button>" +
          "<button type='button' class='btn-ghost btn-sm' title='Add 5 hours' data-add-hours5='" +
          uid +
          "'>+5h</button>" +
          "<button type='button' class='btn btn-sm' title='Add 1 full day (24 hours)' data-add-hours-day='" +
          uid +
          "'>+1 day</button>" +
          "<button type='button' class='btn btn-sm uc-btn-month' title='Add 30 days (month)' data-add-hours-month='" +
          uid +
          "'>+30 days</button>" +
          "</div>" +
          "</div>" +
          "<div class='uc-action-group'>" +
          "<p class='uc-action-label'>Adjust / clear</p>" +
          "<div class='uc-action-row uc-action-row-adjust'>" +
          "<button type='button' class='btn-ghost btn-sm' title='Remove 30 minutes' data-sub-hours-m='" +
          uid +
          "'>−30m</button>" +
          "<button type='button' class='btn-ghost btn-sm' title='Remove 1 hour' data-sub-hours='" +
          uid +
          "'>−1h</button>" +
          "<button type='button' class='btn-ghost btn-sm' title='Set exact time left' data-set-hours='" +
          uid +
          "'>Set…</button>" +
          "<button type='button' class='btn-danger btn-sm' title='Reset time to zero' data-clear-hours='" +
          uid +
          "'>Clear</button>" +
          "</div>" +
          "</div>" +
          "<div class='uc-action-group'>" +
          "<p class='uc-action-label'>Photo looks (25/hour + extra)</p>" +
          "<div class='uc-action-row uc-action-row-add'>" +
          "<button type='button' class='btn-ghost btn-sm' data-add-photos='" +
          uid +
          "' data-photo-n='5'>+5 looks</button>" +
          "<button type='button' class='btn btn-sm' data-add-photos='" +
          uid +
          "' data-photo-n='10'>+10 looks</button>" +
          "<button type='button' class='btn-ghost btn-sm' data-add-photos='" +
          uid +
          "' data-photo-n='25'>+25 looks</button>" +
          "</div>" +
          "</div>" +
          "<div class='uc-action-group'>" +
          "<p class='uc-action-label'>Account</p>" +
          "<div class='uc-action-row uc-action-row-account'>" +
          "<button type='button' class='btn btn-sm' data-msg-user='" +
          uid +
          "'>Support</button>" +
          "<button type='button' class='btn-ghost btn-sm' data-reset-pin='" +
          uid +
          "'>PIN</button>" +
          "<button type='button' class='btn-ghost btn-sm' data-delete-chats='" +
          uid +
          "'>Del chats</button>" +
          "<button type='button' class='btn-ghost btn-sm' title='Allow this phone to create one new ID (does not delete user)' data-unlink-device='" +
          uid +
          "'>Unlink device</button>" +
          "<button type='button' class='btn-danger btn-sm' data-delete-user='" +
          uid +
          "'>Delete</button>" +
          (u.isLegacy || u.needsFourDigit
            ? "<button type='button' class='btn btn-sm' data-migrate='" +
              uid +
              "'>→ 4-digit</button>"
            : "") +
          "</div>" +
          "</div>" +
          "</div>" +
          (Number(u.supportUnseen || 0) > 0
            ? "<p class='user-notice-flag unread'>Support: waiting for user (" +
              u.supportUnseen +
              ")</p>"
            : "") +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    usersEl.innerHTML = "<div class='users-cards'>" + cards + "</div>";
    if (soft && scrollParent) scrollParent.scrollTop = prevScroll;
  }

  function renderPayments(list, soft) {
    const scrollParent = paymentsEl;
    const prevScroll = soft && scrollParent ? scrollParent.scrollTop : 0;
    const filtered = filterPaymentsList(list || []);
    const approvedSum = (list || [])
      .filter(function (p) {
        return p.status === "approved";
      })
      .reduce(function (s, p) {
        return s + Number(p.amountInr || 0);
      }, 0);
    const filteredApproved = filtered
      .filter(function (p) {
        return p.status === "approved";
      })
      .reduce(function (s, p) {
        return s + Number(p.amountInr || 0);
      }, 0);

    if (paymentsCount) {
      paymentsCount.textContent =
        filtered.length + " shown · " + (list || []).length + " total";
    }
    const moneyLine = document.getElementById("pay-money-line");
    if (moneyLine) {
      moneyLine.textContent =
        "Collected (approved): ₹" +
        Math.round(approvedSum).toLocaleString("en-IN") +
        (statusFilter && statusFilter.value !== "all"
          ? " · This view approved: ₹" +
            Math.round(filteredApproved).toLocaleString("en-IN")
          : "");
    }

    if (!(list || []).length) {
      paymentsEl.innerHTML =
        "<div class='empty'>No payments yet.<br/>User: Chat → Pay → submit screenshot.</div>";
      return;
    }
    if (!filtered.length) {
      paymentsEl.innerHTML =
        "<div class='empty'>No payments match this search / status.</div>";
      return;
    }

    paymentsEl.innerHTML = "";
    filtered.forEach(function (p) {
      const card = document.createElement("article");
      card.className = "pay-card";
      card.innerHTML =
        "<div class='pay-card-head'>" +
        "<span class='id-pill'>" +
        escapeHtml(p.userId) +
        "</span>" +
        "<span class='badge " +
        escapeHtml(p.status) +
        "'>" +
        escapeHtml(p.status) +
        "</span>" +
        "</div>" +
        "<div class='pay-amount'>₹" +
        p.amountInr +
        "</div>" +
        "<div class='meta'>" +
        escapeHtml(p.packageId) +
        " · " +
        p.hours +
        "h<br/>" +
        escapeHtml(p.paymentId) +
        "<br/>Remark: <b>" +
        escapeHtml(p.upiNote || "—") +
        "</b><br/>" +
        new Date(p.createdAt).toLocaleString() +
        "</div>" +
        (p.screenshotUrl
          ? "<a href='" +
            escapeHtml(p.screenshotUrl) +
            "' target='_blank' rel='noopener'><img class='shot' src='" +
            escapeHtml(p.screenshotUrl) +
            "' alt='payment screenshot' /></a>"
          : "") +
        (p.status === "pending"
          ? "<div class='actions'>" +
            "<button type='button' class='btn btn-sm' data-approve='" +
            escapeHtml(p.paymentId) +
            "'>Approve · unlock hours</button>" +
            "<button type='button' class='btn-danger btn-sm' data-reject='" +
            escapeHtml(p.paymentId) +
            "'>Reject</button>" +
            "</div>"
          : p.rejectReason
            ? "<div class='meta'>Reason: " +
              escapeHtml(p.rejectReason) +
              "</div>"
            : "");
      paymentsEl.appendChild(card);
    });
    if (soft && scrollParent) scrollParent.scrollTop = prevScroll;
  }

  async function loadUsers(opts) {
    const soft = !!(opts && opts.soft);
    if (!soft) {
      usersEl.innerHTML = "<p class='meta'>Loading users...</p>";
    }
    try {
      const res = await fetch("/api/admin/users", { headers: authHeaders() });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return [];
        if (!soft) {
          usersEl.innerHTML =
            "<div class='empty'>" + (data.error || "Failed to load users") + "</div>";
        }
        return soft ? usersCache : [];
      }
      usersCache = data.users || [];
      renderUsers(usersCache, soft);
      return usersCache;
    } catch (e) {
      if (!soft) usersEl.innerHTML = "<div class='empty'>Network error</div>";
      return soft ? usersCache : [];
    }
  }

  async function loadPayments(opts) {
    const soft = !!(opts && opts.soft);
    if (!soft) {
      paymentsEl.innerHTML = "<p class='meta'>Loading payments...</p>";
    }
    try {
      const res = await fetch("/api/admin/payments?status=all", {
        headers: authHeaders(),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return [];
        if (!soft) {
          paymentsEl.innerHTML =
            "<div class='empty'>" + (data.error || "Failed") + "</div>";
        }
        return soft ? paymentsCache : [];
      }
      paymentsCache = data.payments || [];
      renderPayments(paymentsCache, soft);
      return paymentsCache;
    } catch (e) {
      if (!soft) paymentsEl.innerHTML = "<div class='empty'>Network error</div>";
      return soft ? paymentsCache : [];
    }
  }

  async function refreshAll(opts) {
    const soft = !!(opts && opts.soft);
    const users = await loadUsers({ soft: soft });
    const allPays = await loadPayments({ soft: soft });
    const analytics = await loadAnalytics();
    updateStats(users, allPays, analytics);
    loadVeniceCredits({ force: !soft });
    loadGpuStatus();
    if (!soft) markLiveSync(true);
  }

  async function adjustHours(userId, hours, mode) {
    const res = await fetch(
      "/api/admin/users/" + encodeURIComponent(userId) + "/hours",
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ hours: hours, mode: mode || "add" }),
      }
    );
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      if (handleAuthFail(res)) return;
      toast(data.error || "Failed", "err");
      return;
    }
    const left =
      data.user && data.user.hoursBalance != null
        ? Number(data.user.hoursBalance).toFixed(2) + "h left"
        : "updated";
    const until =
      data.user && data.user.accessExpiresAt > Date.now()
        ? " · ends " + new Date(data.user.accessExpiresAt).toLocaleString()
        : "";
    toast("Access " + left + until, "ok");
    await refreshAll();
  }

  usersEl.addEventListener("click", async function (e) {
    const toggleBtn = e.target.closest
      ? e.target.closest("[data-toggle-user]")
      : null;
    if (toggleBtn) {
      const id = String(toggleBtn.getAttribute("data-toggle-user") || "");
      if (!id) return;
      if (expandedUserIds.has(id)) expandedUserIds.delete(id);
      else expandedUserIds.add(id);
      const card = toggleBtn.closest(".user-card");
      if (card) {
        const open = expandedUserIds.has(id);
        card.classList.toggle("is-open", open);
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
      }
      return;
    }

    const t = e.target.closest
      ? e.target.closest(
          "[data-view-chat], [data-view-photos], [data-add-photos], [data-msg-user], [data-add-hours], [data-add-hours5], [data-add-hours-10m], [data-add-hours-30m], [data-add-hours-day], [data-add-hours-month], [data-sub-hours], [data-sub-hours-m], [data-set-hours], [data-clear-hours], [data-reset-pin], [data-migrate], [data-delete-chats], [data-unlink-device], [data-delete-user]"
        )
      : e.target;
    if (!t) return;

    const viewChat = t.getAttribute("data-view-chat");
    if (viewChat) {
      openUserChat(viewChat);
      return;
    }
    const viewPhotos = t.getAttribute("data-view-photos");
    if (viewPhotos) {
      openUserPhotos(viewPhotos);
      return;
    }
    if (t.getAttribute("data-add-photos")) {
      const n = Number(t.getAttribute("data-photo-n") || 10);
      adjustPhotoCredits(t.getAttribute("data-add-photos"), n);
      return;
    }
    const msgUser = t.getAttribute("data-msg-user");
    if (msgUser) {
      const text = prompt(
        "Support message / offer for User " +
          msgUser +
          "\n(They get a popup; can Got it or Reply in Support)"
      );
      if (text == null) return;
      if (!String(text).trim()) {
        toast("Empty message", "err");
        return;
      }
      const res = await fetch("/api/admin/support/" + encodeURIComponent(msgUser) + "/reply", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text: String(text).trim() }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) toast(data.error || "Send failed", "err");
      else toast("Sent in Support · popup on user", "ok");
      await refreshAll();
      if (typeof showSupportTab === "function") {
        showSupportTab();
        if (typeof openSupportThread === "function") openSupportThread(msgUser);
      }
      return;
    }
    if (t.getAttribute("data-add-hours-10m")) {
      adjustHours(t.getAttribute("data-add-hours-10m"), 10 / 60, "add");
    }
    if (t.getAttribute("data-add-hours-30m")) {
      adjustHours(t.getAttribute("data-add-hours-30m"), 0.5, "add");
    }
    if (t.getAttribute("data-add-hours")) {
      adjustHours(t.getAttribute("data-add-hours"), 1, "add");
    }
    if (t.getAttribute("data-add-hours5")) {
      adjustHours(t.getAttribute("data-add-hours5"), 5, "add");
    }
    if (t.getAttribute("data-add-hours-day")) {
      adjustHours(t.getAttribute("data-add-hours-day"), 24, "add");
    }
    if (t.getAttribute("data-add-hours-month")) {
      adjustHours(t.getAttribute("data-add-hours-month"), 720, "add");
    }
    if (t.getAttribute("data-sub-hours-m")) {
      adjustHours(t.getAttribute("data-sub-hours-m"), -0.5, "add");
    }
    if (t.getAttribute("data-sub-hours")) {
      adjustHours(t.getAttribute("data-sub-hours"), -1, "add");
    }
    if (t.getAttribute("data-set-hours")) {
      const id = t.getAttribute("data-set-hours");
      const card = t.closest(".user-card");
      const current = card
        ? Number(card.getAttribute("data-hours") || 0)
        : 0;
      const raw = prompt(
        "Set hours left for " +
          id +
          " (wall-clock from now).\nExamples: 1 = 1h, 24 = 1 day, 720 = 30 days.\nCurrent ≈ " +
          current.toFixed(2) +
          "h",
        String(Math.max(0, Math.round(current * 100) / 100))
      );
      if (raw == null) return;
      const val = Number(String(raw).trim());
      if (!Number.isFinite(val) || val < 0) {
        toast("Enter a number ≥ 0", "err");
        return;
      }
      adjustHours(id, val, "set");
    }
    if (t.getAttribute("data-clear-hours")) {
      const id = t.getAttribute("data-clear-hours");
      if (
        !confirm(
          "Reset time to 0 for " +
            id +
            "?\n\nEnds their live session (chat copy kept in admin archive)."
        )
      ) {
        return;
      }
      adjustHours(id, 0, "set");
    }
    const deleteChats = t.getAttribute("data-delete-chats");
    if (deleteChats) {
      if (
        !confirm(
          "Delete ALL chats for " +
            deleteChats +
            "?\n\nLive + archived chats removed forever (not recoverable)."
        )
      ) {
        return;
      }
      const res = await fetch(
        "/api/admin/users/" + encodeURIComponent(deleteChats) + "/chats",
        { method: "DELETE", headers: authHeaders() }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Delete chats failed", "err");
      } else {
        toast(
          "Chats deleted (" + (data.removedSessions || 0) + " sessions)",
          "ok"
        );
        if (openChatUserId === deleteChats) closeChatDrawer();
      }
      await refreshAll();
      return;
    }
    const unlinkDevice = t.getAttribute("data-unlink-device");
    if (unlinkDevice) {
      if (
        !confirm(
          "Unlink device for " +
            unlinkDevice +
            "?\n\nLets that phone create one new ID after wipe/clear. Does NOT delete this user."
        )
      ) {
        return;
      }
      const res = await fetch(
        "/api/admin/users/" +
          encodeURIComponent(unlinkDevice) +
          "/unlink-device",
        { method: "POST", headers: authHeaders(), body: "{}" }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Unlink failed", "err");
      } else {
        toast(
          "Device unlinked (" +
            (data.devicesUnlinked || 0) +
            ") — phone can Create ID once",
          "ok"
        );
      }
      return;
    }
    const deleteUser = t.getAttribute("data-delete-user");
    if (deleteUser) {
      if (
        !confirm(
          "DELETE ACCOUNT " +
            deleteUser +
            " forever?\n\nRemoves user, chats, login tokens, and payment records/screenshots."
        )
      ) {
        return;
      }
      if (
        !confirm(
          "Final confirm: permanently delete user " + deleteUser + "?"
        )
      ) {
        return;
      }
      const res = await fetch(
        "/api/admin/users/" + encodeURIComponent(deleteUser),
        { method: "DELETE", headers: authHeaders() }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Delete account failed", "err");
      } else {
        toast("Account " + deleteUser + " deleted", "ok");
        if (openChatUserId === deleteUser) closeChatDrawer();
      }
      await refreshAll();
      return;
    }
    const resetPin = t.getAttribute("data-reset-pin");
    if (resetPin) {
      const res = await fetch(
        "/api/admin/users/" + encodeURIComponent(resetPin) + "/reset-pin",
        { method: "POST", headers: authHeaders(), body: "{}" }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) toast(data.error || "Reset failed", "err");
      else toast("New PIN for " + resetPin + ": " + data.pin, "ok");
      await refreshAll();
    }
    const migrate = t.getAttribute("data-migrate");
    if (migrate) {
      const res = await fetch(
        "/api/admin/users/" + encodeURIComponent(migrate) + "/migrate-id",
        { method: "POST", headers: authHeaders(), body: "{}" }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) toast(data.error || "Migrate failed", "err");
      else
        toast(
          "Old " +
            data.oldId +
            " → ID " +
            data.userId +
            " · PIN " +
            data.pin,
          "ok"
        );
      await refreshAll();
    }
  });

  if (chatDeleteBtn) {
    chatDeleteBtn.addEventListener("click", async function () {
      if (!openChatUserId) return;
      if (
        !confirm(
          "Delete ALL chats for " +
            openChatUserId +
            "?\n\nRemoved forever from server."
        )
      ) {
        return;
      }
      const res = await fetch(
        "/api/admin/users/" + encodeURIComponent(openChatUserId) + "/chats",
        { method: "DELETE", headers: authHeaders() }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Delete chats failed", "err");
        return;
      }
      toast("Chats deleted", "ok");
      closeChatDrawer();
      await refreshAll();
    });
  }

  if (purgeOldChatsBtn) {
    purgeOldChatsBtn.addEventListener("click", async function () {
      if (
        !confirm(
          "Purge chats older than 5 days?\n\nFrees store space. Newer chats stay."
        )
      ) {
        return;
      }
      const res = await fetch("/api/admin/chats/purge-old", {
        method: "POST",
        headers: authHeaders(),
        body: "{}",
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Purge failed", "err");
        return;
      }
      toast(
        "Purged live " +
          (data.removedLive || 0) +
          " · archived " +
          (data.removedArchived || 0),
        "ok"
      );
      await refreshAll();
    });
  }
  paymentsEl.addEventListener("click", async function (e) {
    const approveId = e.target.getAttribute("data-approve");
    const rejectId = e.target.getAttribute("data-reject");
    if (approveId) {
      e.target.disabled = true;
      const res = await fetch("/api/admin/payments/" + approveId + "/approve", {
        method: "POST",
        headers: authHeaders(),
        body: "{}",
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) toast(data.error || "Approve failed", "err");
      else toast("Payment approved · hours unlocked", "ok");
      await refreshAll();
    }
    if (rejectId) {
      const reason = prompt("Reject reason (optional)") || "";
      const res = await fetch("/api/admin/payments/" + rejectId + "/reject", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reason: reason }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) toast(data.error || "Reject failed", "err");
      else toast("Payment rejected", "ok");
      await refreshAll();
    }
  });

  const smsCreditInput = document.getElementById("sms-credit-input");
  const smsCreditBtn = document.getElementById("sms-credit-btn");
  const smsCreditResult = document.getElementById("sms-credit-result");
  if (smsCreditBtn) {
    smsCreditBtn.addEventListener("click", async function () {
      const smsText = smsCreditInput ? smsCreditInput.value.trim() : "";
      if (!smsText) {
        toast("Paste a credit SMS first", "err");
        return;
      }
      smsCreditBtn.disabled = true;
      if (smsCreditResult) smsCreditResult.textContent = "Matching…";
      try {
        const res = await fetch("/api/admin/sms-credit", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ smsText: smsText }),
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          toast(data.error || "SMS match failed", "err");
          if (smsCreditResult) smsCreditResult.textContent = data.error || "Failed";
          return;
        }
        const action = data.action || "?";
        const reason = data.reason || "";
        if (smsCreditResult) {
          smsCreditResult.textContent =
            action.toUpperCase() +
            (data.parsed && data.parsed.amountInr ? " · ₹" + data.parsed.amountInr : "") +
            (data.payment && data.payment.userId ? " · user " + data.payment.userId : "") +
            " — " +
            reason;
        }
        if (action === "approve") {
          toast("Auto-approved · hours unlocked", "ok");
          if (smsCreditInput) smsCreditInput.value = "";
          await refreshAll();
        } else if (action === "needs_review") {
          toast("Needs review — open pending list", "err");
          await refreshAll();
        } else {
          toast(reason || action, "ok");
        }
      } catch (err) {
        toast("Network error", "err");
        if (smsCreditResult) smsCreditResult.textContent = "Network error";
      } finally {
        smsCreditBtn.disabled = false;
      }
    });
  }

  loginBtn.addEventListener("click", login);
  passEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") login();
  });
  if (adminIdEl) {
    adminIdEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") login();
    });
  }
  logoutBtn.addEventListener("click", logout);
  refreshBtn.addEventListener("click", refreshAll);
  refreshUsersBtn.addEventListener("click", refreshAll);
  const veniceCreditsRefresh = document.getElementById("venice-credits-refresh");
  if (veniceCreditsRefresh) {
    veniceCreditsRefresh.addEventListener("click", async function () {
      veniceCreditsRefresh.disabled = true;
      await loadVeniceCredits({ force: true });
      veniceCreditsRefresh.disabled = false;
    });
  }
  const gpuStatusRefresh = document.getElementById("gpu-status-refresh");
  if (gpuStatusRefresh) {
    gpuStatusRefresh.addEventListener("click", async function () {
      gpuStatusRefresh.disabled = true;
      await loadGpuStatus();
      gpuStatusRefresh.disabled = false;
    });
  }
  statusFilter.addEventListener("change", function () {
    renderPayments(paymentsCache);
  });
  if (paySearch) {
    paySearch.addEventListener("input", function () {
      renderPayments(paymentsCache);
    });
  }
  if (userFilter) {
    userFilter.addEventListener("change", function () {
      usersPage = 1;
      syncStatActive("users", userFilter.value || "all");
      renderUsers(usersCache);
    });
  }
  const adminStatsWrap = document.querySelector(".stats-wrap");
  if (adminStatsWrap) {
    adminStatsWrap.addEventListener("click", function (e) {
      const btn = e.target.closest
        ? e.target.closest("[data-stat-action]")
        : null;
      if (!btn || !adminStatsWrap.contains(btn)) return;
      applyStatClick(btn);
    });
  }
  const statsMoreBtn = document.getElementById("stats-more-btn");
  const statsMore = document.getElementById("admin-stats");
  if (statsMoreBtn && statsMore) {
    statsMoreBtn.addEventListener("click", function () {
      statsMore.classList.toggle("hidden");
      const open = !statsMore.classList.contains("hidden");
      if (open) statsMore.removeAttribute("hidden");
      else statsMore.setAttribute("hidden", "");
      statsMoreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      statsMoreBtn.textContent = open ? "Hide analytics ▴" : "Show analytics ▾";
    });
  }
  const trendToggle = document.querySelector(".trend-toggle");
  if (trendToggle) {
    trendToggle.addEventListener("click", function (e) {
      const tab = e.target.closest ? e.target.closest(".trend-tab") : null;
      if (!tab || !trendToggle.contains(tab)) return;
      const metric = tab.getAttribute("data-trend") || "signups";
      analyticsTrendMetric = metric;
      Array.prototype.forEach.call(
        trendToggle.querySelectorAll(".trend-tab"),
        function (btn) {
          btn.classList.toggle(
            "is-active",
            btn.getAttribute("data-trend") === metric
          );
        }
      );
      renderTrendChart(analyticsSeriesCache, analyticsTrendMetric);
    });
  }
  if (usersPageSizeEl) {
    usersPageSizeEl.addEventListener("change", function () {
      usersPage = 1;
      renderUsers(usersCache);
    });
  }
  if (usersPrevBtn) {
    usersPrevBtn.addEventListener("click", function () {
      if (usersPage <= 1) return;
      usersPage -= 1;
      renderUsers(usersCache);
    });
  }
  if (usersNextBtn) {
    usersNextBtn.addEventListener("click", function () {
      usersPage += 1;
      renderUsers(usersCache);
    });
  }
  tabUsers.addEventListener("click", showUsersTab);
  tabPayments.addEventListener("click", showPaymentsTab);
  if (tabSupport) {
    tabSupport.addEventListener("click", function () {
      supportFilterMode = "all";
      showSupportTab();
    });
  }
  if (tabReports) tabReports.addEventListener("click", showReportsTab);
  if (tabPaySetup) tabPaySetup.addEventListener("click", showPaySetupTab);

  function renderSupportThreadList(list) {
    if (!supportThreadList) return;
    var rows = list || [];
    if (supportFilterMode === "pay-leads") {
      rows = rows.filter(function (t) {
        return (
          t.payLead ||
          (t.payFunnel && (t.payFunnel.discountAsked || t.payFunnel.abandoned)) ||
          /\[DISCOUNT_ASK\]|\[PAY_LEAD\]/i.test(String(t.lastText || ""))
        );
      });
    }
    if (!rows.length) {
      supportThreadList.innerHTML =
        supportFilterMode === "pay-leads"
          ? "<div class='empty'>No pay / discount leads yet.<br/>Shows when users leave checkout or ask for a discount.</div>"
          : "<div class='empty'>No support messages yet.<br/>Users open Settings → Support.</div>";
      return;
    }
    supportThreadList.innerHTML = rows
      .map(function (t) {
        const active = String(t.userId) === String(openSupportUserId) ? " active" : "";
        const needs = t.needsAdmin ? " needs-admin" : "";
        const when = t.updatedAt ? new Date(t.updatedAt).toLocaleString() : "";
        const badgeClass = t.needsAdmin
          ? "pending"
          : t.awaitingUserSeen
            ? "pending"
            : t.status === "closed"
              ? ""
              : "approved";
        const badgeText = t.needsAdmin
          ? "new"
          : t.awaitingUserSeen
            ? "unseen by user"
            : escapeHtml(t.status || "open");
        const leadChip = t.payLead
          ? "<span class='badge pending' style='margin-left:6px'>discount?</span>"
          : t.photoCredit
            ? "<span class='badge pending' style='margin-left:6px'>photo credits</span>"
            : t.payFunnel && t.payFunnel.abandoned
            ? "<span class='badge' style='margin-left:6px'>left pay @" +
              escapeHtml(t.payFunnel.stage || "?") +
              "</span>"
            : "";
        const funnelHint =
          t.payFunnel && (t.payFunnel.stage || t.payFunnel.packageId)
            ? " · left @" +
              escapeHtml(t.payFunnel.stage || "?") +
              (t.payFunnel.packageId
                ? " · " + escapeHtml(String(t.payFunnel.packageId))
                : "") +
              (t.payFunnel.amountInr != null
                ? " ₹" + escapeHtml(String(t.payFunnel.amountInr))
                : "")
            : "";
        return (
          "<button type='button' class='support-thread-card" +
          active +
          needs +
          "' data-support-user='" +
          escapeHtml(t.userId) +
          "'>" +
          "<div class='sth-top'>" +
          "<span class='id-pill'>" +
          escapeHtml(t.userId) +
          "</span>" +
          "<span class='badge " +
          badgeClass +
          "'>" +
          badgeText +
          "</span>" +
          leadChip +
          "</div>" +
          "<div class='sth-preview'>" +
          escapeHtml(t.lastText || "—") +
          "<br/><span class='meta'>" +
          (t.messageCount || 0) +
          " msgs · " +
          escapeHtml(when) +
          escapeHtml(funnelHint) +
          "</span></div>" +
          "</button>"
        );
      })
      .join("");
  }

  async function loadSupportThreads(quiet) {
    if (!supportThreadList) return;
    if (!quiet) {
      supportThreadList.innerHTML = "<p class='meta'>Loading…</p>";
    }
    try {
      const res = await fetch("/api/admin/support", { headers: authHeaders() });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        supportThreadList.innerHTML =
          "<div class='empty'>" +
          escapeHtml(data.error || "Could not load support") +
          "</div>";
        return;
      }
      supportThreadsCache = data.threads || [];

      // Merge checkout abandons that never opened Support yet
      if (supportFilterMode === "pay-leads") {
        try {
          const lr = await fetch("/api/admin/pay-leads", {
            headers: authHeaders(),
          });
          const ld = await lr.json().catch(function () {
            return {};
          });
          if (lr.ok && Array.isArray(ld.leads)) {
            const byId = {};
            supportThreadsCache.forEach(function (t) {
              byId[String(t.userId)] = t;
            });
            ld.leads.forEach(function (lead) {
              const id = String(lead.userId || "");
              if (!id) return;
              if (byId[id]) {
                byId[id].payFunnel = lead;
                byId[id].payLead = byId[id].payLead || !!lead.discountAsked;
              } else {
                byId[id] = {
                  userId: id,
                  status: "open",
                  updatedAt: lead.updatedAt || lead.abandonedAt || 0,
                  needsAdmin: !!lead.discountAsked,
                  awaitingUserSeen: false,
                  messageCount: 0,
                  lastFrom: "user",
                  lastText: lead.discountAsked
                    ? "[DISCOUNT_ASK] waiting in Support"
                    : "[PAY_LEAD] Left after " +
                      (lead.stage || "?") +
                      (lead.packageId ? " · " + lead.packageId : "") +
                      (lead.amountInr != null ? " · ₹" + lead.amountInr : ""),
                  lastAt: lead.abandonedAt || lead.updatedAt || 0,
                  payLead: !!lead.discountAsked,
                  payFunnel: lead,
                };
                supportThreadsCache.push(byId[id]);
              }
            });
          }
        } catch (e) {}
      }

      if (supportCount) {
        const waiting = supportThreadsCache.filter(function (t) {
          return t.needsAdmin;
        }).length;
        supportCount.textContent =
          supportThreadsCache.length +
          " thread" +
          (supportThreadsCache.length === 1 ? "" : "s") +
          (waiting ? " · " + waiting + " waiting" : "") +
          (supportFilterMode === "pay-leads" ? " · pay leads filter" : "");
      }
      renderSupportThreadList(supportThreadsCache);
    } catch (e) {
      supportThreadList.innerHTML = "<div class='empty'>Network error</div>";
    }
  }

  function renderSupportAdminMessages(thread) {
    if (!supportAdminMessages) return;
    const msgs = (thread && thread.messages) || [];
    if (!msgs.length) {
      supportAdminMessages.innerHTML =
        "<div class='empty'>No messages in this thread yet.</div>";
      return;
    }
    supportAdminMessages.innerHTML = msgs
      .map(function (m) {
        const cls = m.from === "admin" ? "admin" : "user";
        const who = m.from === "admin" ? "Admin" : "User " + (thread.userId || "");
        const img = m.screenshotUrl
          ? "<a href='" +
            escapeHtml(m.screenshotUrl) +
            "' target='_blank' rel='noopener'><img src='" +
            escapeHtml(m.screenshotUrl) +
            "' alt='attachment' /></a>"
          : "";
        return (
          "<div class='support-admin-bubble " +
          cls +
          "'><span class='who'>" +
          escapeHtml(who) +
          "</span>" +
          escapeHtml(m.text || "") +
          img +
          "</div>"
        );
      })
      .join("");
    supportAdminMessages.scrollTop = supportAdminMessages.scrollHeight;
  }

  async function openSupportThread(userId, quiet) {
    openSupportUserId = String(userId || "");
    setSupportMobileMode("thread");
    if (!quiet) renderSupportThreadList(supportThreadsCache);
    if (supportThreadTitle) {
      supportThreadTitle.textContent = "User ID " + openSupportUserId;
    }
    if (supportThreadMeta) supportThreadMeta.textContent = "Loading…";
    if (supportCloseThreadBtn) supportCloseThreadBtn.classList.remove("hidden");
    if (supportAdminCompose) supportAdminCompose.classList.remove("hidden");
    try {
      const res = await fetch(
        "/api/admin/support/" + encodeURIComponent(openSupportUserId),
        { headers: authHeaders() }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        if (supportThreadMeta) supportThreadMeta.textContent = "";
        supportAdminMessages.innerHTML =
          "<div class='empty'>" +
          escapeHtml(data.error || "Could not load thread") +
          "</div>";
        return;
      }
      const thread = data.thread || {};
      if (supportThreadMeta) {
        supportThreadMeta.textContent =
          (thread.status || "open") +
          " · " +
          ((thread.messages && thread.messages.length) || 0) +
          " messages";
      }
      renderSupportAdminMessages(thread);
    } catch (e) {
      supportAdminMessages.innerHTML = "<div class='empty'>Network error</div>";
    }
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function compressImageFile(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type)) {
        resolve(null);
        return;
      }
      if (file.size < 900000) {
        fileToBase64(file)
          .then(resolve)
          .catch(function () {
            resolve(null);
          });
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const maxW = 1280;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        fileToBase64(file)
          .then(resolve)
          .catch(function () {
            resolve(null);
          });
      };
      img.src = url;
    });
  }

  function clearAdminSupportAttachment() {
    if (supportAdminFile) supportAdminFile.value = "";
    if (supportAdminPreview) {
      supportAdminPreview.classList.add("hidden");
      supportAdminPreview.removeAttribute("src");
    }
    if (supportAdminUploadText) {
      supportAdminUploadText.textContent = "Attach photo from device";
    }
    if (supportAdminUploadLabel) {
      supportAdminUploadLabel.classList.remove("has-file");
    }
  }

  async function sendAdminSupportReply() {
    if (!openSupportUserId) return;
    const text = supportAdminInput ? supportAdminInput.value.trim() : "";
    const file =
      supportAdminFile && supportAdminFile.files && supportAdminFile.files[0];
    if (!text && !file) {
      toast("Write a reply or attach a photo", "err");
      return;
    }
    if (supportAdminSend) supportAdminSend.disabled = true;
    try {
      let b64 = null;
      if (file) {
        b64 = (await compressImageFile(file)) || (await fileToBase64(file));
      }
      const res = await fetch(
        "/api/admin/support/" + encodeURIComponent(openSupportUserId) + "/reply",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            text: text,
            screenshotBase64: b64,
          }),
        }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Reply failed", "err");
        return;
      }
      if (supportAdminInput) supportAdminInput.value = "";
      clearAdminSupportAttachment();
      renderSupportAdminMessages(data.thread);
      toast(file ? "Reply + photo sent" : "Reply sent", "ok");
      loadSupportThreads(true);
    } catch (e) {
      toast("Network error", "err");
    } finally {
      if (supportAdminSend) supportAdminSend.disabled = false;
    }
  }

  if (supportThreadList) {
    supportThreadList.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-support-user]");
      if (!btn) return;
      openSupportThread(btn.getAttribute("data-support-user"));
    });
  }
  if (supportBackBtn) {
    supportBackBtn.addEventListener("click", closeSupportThreadView);
  }
  if (supportAdminSend) {
    supportAdminSend.addEventListener("click", sendAdminSupportReply);
  }
  if (supportAdminOfferBtn) {
    supportAdminOfferBtn.addEventListener("click", async function () {
      if (!openSupportUserId) {
        toast("Pick a support thread first", "err");
        return;
      }
      supportAdminOfferBtn.disabled = true;
      try {
        const threadMeta = (supportThreadsCache || []).find(function (t) {
          return String(t.userId) === String(openSupportUserId);
        });
        const packId =
          (threadMeta &&
            threadMeta.payFunnel &&
            (threadMeta.payFunnel.leadPackageId ||
              threadMeta.payFunnel.packageId)) ||
          "";
        const res = await fetch(
          "/api/admin/support/" +
            encodeURIComponent(openSupportUserId) +
            "/winback-offer",
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ packageId: packId || undefined }),
          }
        );
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          if (handleAuthFail(res)) return;
          toast(
            (data.winback && data.winback.reason) ||
              data.error ||
              data.reason ||
              "Offer send failed",
            "err"
          );
          return;
        }
        if (data.winback && data.winback.skipped) {
          toast("Offer skipped: " + (data.winback.reason || "unknown"), "err");
        } else {
          const pay =
            data.winback &&
            data.winback.offer &&
            data.winback.offer.priceInr != null
              ? data.winback.offer.priceInr
              : "";
          toast("QR offer sent" + (pay !== "" ? " · ₹" + pay : ""), "ok");
        }
        if (data.thread) {
          renderSupportAdminMessages(data.thread);
        } else {
          openSupportThread(openSupportUserId, true);
        }
        loadSupportThreads(true);
      } catch (e) {
        toast("Network error", "err");
      } finally {
        supportAdminOfferBtn.disabled = false;
      }
    });
  }
  if (supportAdminFile) {
    supportAdminFile.addEventListener("change", function () {
      const file =
        supportAdminFile.files && supportAdminFile.files[0];
      if (!file) {
        clearAdminSupportAttachment();
        return;
      }
      if (supportAdminUploadText) {
        supportAdminUploadText.textContent = file.name || "Photo selected";
      }
      if (supportAdminUploadLabel) {
        supportAdminUploadLabel.classList.add("has-file");
      }
      if (supportAdminPreview) {
        const url = URL.createObjectURL(file);
        supportAdminPreview.src = url;
        supportAdminPreview.classList.remove("hidden");
      }
    });
  }
  if (refreshSupportBtn) {
    refreshSupportBtn.addEventListener("click", function () {
      loadSupportThreads();
      if (openSupportUserId) openSupportThread(openSupportUserId);
    });
  }
  if (supportCloseThreadBtn) {
    supportCloseThreadBtn.addEventListener("click", async function () {
      if (!openSupportUserId) return;
      try {
        const res = await fetch(
          "/api/admin/support/" +
            encodeURIComponent(openSupportUserId) +
            "/close",
          { method: "POST", headers: authHeaders(), body: "{}" }
        );
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          toast(data.error || "Could not close", "err");
          return;
        }
        toast("Thread marked closed", "ok");
        loadSupportThreads();
        openSupportThread(openSupportUserId, true);
      } catch (e) {
        toast("Network error", "err");
      }
    });
  }

  function renderReportsDigest(digest) {
    if (!reportsDigest) return;
    if (!digest) {
      reportsDigest.innerHTML = "";
      return;
    }
    const themes = digest.themes || [];
    const byRole = digest.byRole || [];
    const themeHtml = themes.length
      ? themes
          .map(function (t) {
            return (
              "<li><strong>" +
              escapeHtml(t.label) +
              "</strong> ×" +
              Number(t.count || 0) +
              "<br/><span class='meta'>" +
              escapeHtml(t.hint || "") +
              "</span></li>"
            );
          })
          .join("")
      : "<li class='meta'>No themes yet — defaults still inject into agent.</li>";
    const roleHtml = byRole.length
      ? byRole
          .map(function (r) {
            return (
              "<span class='id-pill'>" +
              escapeHtml(r.role) +
              " · " +
              Number(r.count || 0) +
              "</span>"
            );
          })
          .join(" ")
      : "<span class='meta'>No role breakdown</span>";
    reportsDigest.innerHTML =
      "<div class='digest-card'>" +
      "<div class='digest-head'>" +
      "<strong>Weekly AI report digest</strong>" +
      "<span class='meta'>last " +
      Number(digest.days || 7) +
      "d · " +
      Number(digest.total || 0) +
      " reports · themes auto-feed prompts</span>" +
      "</div>" +
      "<ul class='digest-themes'>" +
      themeHtml +
      "</ul>" +
      "<div class='digest-roles'>" +
      roleHtml +
      "</div>" +
      "</div>";
  }

  async function loadReportsDigest() {
    if (!reportsDigest) return;
    try {
      const res = await fetch("/api/admin/reports/digest?days=7", {
        headers: authHeaders(),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        reportsDigest.innerHTML =
          "<p class='meta'>Digest unavailable: " +
          escapeHtml(data.error || "error") +
          "</p>";
        return;
      }
      reportsDigestCache = data.digest || null;
      renderReportsDigest(reportsDigestCache);
    } catch (e) {
      reportsDigest.innerHTML = "<p class='meta'>Digest network error</p>";
    }
  }

  async function loadReports() {
    if (!reportsList) return;
    reportsList.innerHTML = "<p class='meta'>Loading reports…</p>";
    loadReportsDigest();
    try {
      const res = await fetch("/api/admin/reports", { headers: authHeaders() });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        reportsList.innerHTML =
          "<div class='empty'>" +
          escapeHtml(data.error || "Could not load reports") +
          "</div>";
        return;
      }
      reportsCache = data.reports || [];
      if (reportsCount) {
        reportsCount.textContent =
          reportsCache.length +
          " report" +
          (reportsCache.length === 1 ? "" : "s");
      }
      if (!reportsCache.length) {
        reportsList.innerHTML =
          "<div class='empty'>No AI reports yet.<br/>Users tap Report on a bad reply.</div>";
        return;
      }
      reportsList.innerHTML = reportsCache
        .map(function (r) {
          const when = r.createdAt
            ? new Date(r.createdAt).toLocaleString()
            : "—";
          const scene =
            (r.characterName || "—") +
            " · " +
            (r.botRole || "?") +
            " → " +
            (r.userRole || "?");
          return (
            "<article class='report-item'>" +
            "<div class='report-item-head'>" +
            "<span class='id-pill'>" +
            escapeHtml(r.userId || "") +
            "</span>" +
            "<span class='badge'>" +
            escapeHtml(r.reason || "bad reply") +
            "</span>" +
            "<span class='meta'>" +
            escapeHtml(when) +
            "</span>" +
            "</div>" +
            "<p class='meta'>" +
            escapeHtml(scene) +
            (r.botGender ? " · AI " + escapeHtml(r.botGender) : "") +
            "</p>" +
            (r.note
              ? "<p class='report-note'>" + escapeHtml(r.note) + "</p>"
              : "") +
            "<pre class='report-ai'>" +
            escapeHtml(String(r.aiMessage || "").slice(0, 600)) +
            (String(r.aiMessage || "").length > 600 ? "…" : "") +
            "</pre>" +
            "</article>"
          );
        })
        .join("");
    } catch (e) {
      reportsList.innerHTML = "<div class='empty'>Network error</div>";
    }
  }

  if (downloadReportsBtn) {
    downloadReportsBtn.addEventListener("click", async function () {
      try {
        const res = await fetch("/api/admin/reports/download", {
          headers: { Authorization: "Bearer " + token },
        });
        if (!res.ok) {
          if (handleAuthFail(res)) return;
          const data = await res.json().catch(function () {
            return {};
          });
          toast(data.error || "Download failed", "err");
          return;
        }
        const blob = await res.blob();
        const dispo = res.headers.get("Content-Disposition") || "";
        const match = dispo.match(/filename=\"?([^\";]+)\"?/i);
        const filename = match
          ? match[1]
          : "ai-reports.json";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast("Reports downloaded", "ok");
      } catch (e) {
        toast("Download failed", "err");
      }
    });
  }

  if (clearReportsBtn) {
    clearReportsBtn.addEventListener("click", async function () {
      if (
        !confirm(
          "Clear ALL AI reports?\n\nDownload first if you still need them."
        )
      ) {
        return;
      }
      const res = await fetch("/api/admin/reports", {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (handleAuthFail(res)) return;
        toast(data.error || "Clear failed", "err");
        return;
      }
      toast("Cleared " + (data.cleared || 0) + " reports", "ok");
      loadReports();
    });
  }

  if (refreshReportsBtn) {
    refreshReportsBtn.addEventListener("click", loadReports);
  }

  if (setPackages) {
    setPackages.addEventListener("click", function (e) {
      const t = e.target;
      if (!t) return;
      const del = t.getAttribute("data-del-pkg");
      if (del != null) {
        const packs = collectPackagesFromEditor();
        packs.splice(Number(del), 1);
        renderPackageEditor(packs);
        return;
      }
      if (t.getAttribute("data-pkg-qr-upload") != null) {
        const card = t.closest(".pkg-card");
        uploadPackQr(card);
        return;
      }
      if (t.getAttribute("data-pkg-qr-clear") != null) {
        const card = t.closest(".pkg-card");
        clearPackQr(card);
      }
    });
    setPackages.addEventListener("change", function (e) {
      const t = e.target;
      if (!t || !t.getAttribute("data-pkg-qr-file")) return;
      const card = t.closest(".pkg-card");
      const preview = card && card.querySelector(".pkg-qr-preview");
      const file = t.files && t.files[0];
      if (!file || !preview) return;
      const url = URL.createObjectURL(file);
      preview.src = url;
      const msg = card.querySelector(".pkg-qr-msg");
      if (msg) msg.textContent = "Ready — tap Upload QR";
    });
  }
  if (setPkgAdd) {
    setPkgAdd.addEventListener("click", function () {
      const packs = collectPackagesFromEditor();
      packs.push({
        id: "pack-" + Date.now(),
        label: "New pack",
        hours: 1,
        priceInr: 130,
        listPriceInr: 130,
        badge: "",
        popular: false,
        qrImageUrl: "",
      });
      renderPackageEditor(packs);
    });
  }
  if (setWinbackPack) {
    setWinbackPack.addEventListener("change", function () {
      const nextId = setWinbackPack.value || "";
      const packChanged = nextId !== winbackPackPrevId;
      savedWinbackPackageId = nextId;
      winbackPackPrevId = nextId;
      const pack = winbackPackCache.filter(function (p) {
        return String(p.id) === String(nextId);
      })[0];
      // Load this pack's saved offer ₹ (or list price if never set)
      if (packChanged && setWinbackPrice) {
        const offer = offerPriceForPack(nextId, pack);
        if (offer != null) setWinbackPrice.value = String(offer);
      }
      paintWinbackSummary();
    });
  }
  if (setWinbackPrice) {
    setWinbackPrice.addEventListener("input", paintWinbackSummary);
  }
  if (setWinbackSaveBtn) {
    setWinbackSaveBtn.addEventListener("click", function () {
      saveWinbackSettingsOnly();
    });
  }
  if (setSaveBtn) {
    setSaveBtn.addEventListener("click", async function () {
      if (setSaveMsg) setSaveMsg.textContent = "Saving…";
      try {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            upiId: setUpiId ? setUpiId.value : "",
            upiName: setUpiName ? setUpiName.value : "",
            trialMinutes: setTrialMinutes ? setTrialMinutes.value : 5,
            oneIdPerDevice: setOneIdDevice ? !!setOneIdDevice.checked : false,
            winbackEnabled: setWinbackEnabled ? !!setWinbackEnabled.checked : false,
            winbackPackageId: setWinbackPack ? setWinbackPack.value : "day",
            winbackPriceInr: setWinbackPrice ? setWinbackPrice.value : 50,
            packages: collectPackagesFromEditor(),
          }),
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          if (handleAuthFail(res)) return;
          if (setSaveMsg) setSaveMsg.textContent = data.error || "Save failed";
          toast(data.error || "Save failed", "err");
          return;
        }
        if (setSaveMsg) setSaveMsg.textContent = "Saved.";
        toast("Pay setup & trial saved", "ok");
        if (data.settings) {
          if (data.settings.winbackPricesByPack) {
            winbackPricesByPack = Object.assign(
              {},
              data.settings.winbackPricesByPack
            );
          }
          savedWinbackPackageId = data.settings.winbackPackageId || "";
          renderPackageEditor(data.settings.packages || []);
          fillWinbackPackSelect(
            data.settings.packages || [],
            data.settings.winbackPackageId || ""
          );
          if (setTrialMinutes && data.settings.trialMinutes != null) {
            setTrialMinutes.value = String(data.settings.trialMinutes);
          }
          if (setOneIdDevice) {
            setOneIdDevice.checked = !!data.settings.oneIdPerDevice;
          }
          if (setWinbackEnabled) {
            setWinbackEnabled.checked = !!data.settings.winbackEnabled;
          }
          if (setWinbackPrice && data.settings.winbackPriceInr != null) {
            setWinbackPrice.value = String(data.settings.winbackPriceInr);
          }
          paintWinbackSummary();
          paintCacheMeta(data.settings);
        }
      } catch (e) {
        toast("Network error", "err");
      }
    });
  }
  if (setBustCacheBtn) {
    setBustCacheBtn.addEventListener("click", async function () {
      if (
        !confirm(
          "Clear cache for all users? Open chat tabs will reload the latest code within about a minute."
        )
      ) {
        return;
      }
      setBustCacheBtn.disabled = true;
      try {
        const res = await fetch("/api/admin/settings/bust-cache", {
          method: "POST",
          headers: authHeaders(),
          body: "{}",
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          if (handleAuthFail(res)) return;
          toast(data.error || "Clear cache failed", "err");
          return;
        }
        paintCacheMeta(data.settings || data);
        toast("Cache cleared · users will get latest code", "ok");
      } catch (e) {
        toast("Network error", "err");
      } finally {
        setBustCacheBtn.disabled = false;
      }
    });
  }
  if (setQrFile) {
    setQrFile.addEventListener("change", function () {
      const file = setQrFile.files && setQrFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        pendingQrBase64 = reader.result;
        if (setQrPreview) setQrPreview.src = pendingQrBase64;
        if (setQrMsg) setQrMsg.textContent = "Ready — click Upload QR";
      };
      reader.readAsDataURL(file);
    });
  }
  if (setQrUploadBtn) {
    setQrUploadBtn.addEventListener("click", async function () {
      if (!pendingQrBase64) {
        toast("Choose a QR image first", "err");
        return;
      }
      setQrUploadBtn.disabled = true;
      try {
        const res = await fetch("/api/admin/settings/qr", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ imageBase64: pendingQrBase64 }),
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          toast(data.error || "Upload failed", "err");
          return;
        }
        pendingQrBase64 = null;
        if (setQrPreview && data.qrImageUrl) setQrPreview.src = data.qrImageUrl;
        if (setQrMsg) setQrMsg.textContent = "QR live for users.";
        toast("QR uploaded", "ok");
      } catch (e) {
        toast("Network error", "err");
      } finally {
        setQrUploadBtn.disabled = false;
      }
    });
  }
  if (setQrClearBtn) {
    setQrClearBtn.addEventListener("click", async function () {
      if (!confirm("Clear custom QR and use default placeholder?")) return;
      const res = await fetch("/api/admin/settings/qr", {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        toast(data.error || "Clear failed", "err");
        return;
      }
      if (setQrPreview) setQrPreview.src = data.qrImageUrl || "/upi-qr.svg";
      toast("QR cleared", "ok");
    });
  }

  if (setWinbackQrFile) {
    setWinbackQrFile.addEventListener("change", function () {
      const file = setWinbackQrFile.files && setWinbackQrFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        pendingWinbackQrBase64 = reader.result;
        if (setWinbackQrPreview) setWinbackQrPreview.src = pendingWinbackQrBase64;
        if (setWinbackQrMsg) {
          setWinbackQrMsg.textContent = "Ready — click Upload win-back QR";
        }
      };
      reader.readAsDataURL(file);
    });
  }
  if (setWinbackQrUploadBtn) {
    setWinbackQrUploadBtn.addEventListener("click", async function () {
      if (!pendingWinbackQrBase64) {
        toast("Choose a win-back QR image first", "err");
        return;
      }
      setWinbackQrUploadBtn.disabled = true;
      try {
        const res = await fetch("/api/admin/settings/winback-qr", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ imageBase64: pendingWinbackQrBase64 }),
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          toast(data.error || "Upload failed", "err");
          return;
        }
        pendingWinbackQrBase64 = null;
        if (setWinbackQrPreview && data.winbackQrImageUrl) {
          setWinbackQrPreview.src = data.winbackQrImageUrl;
        }
        if (setWinbackQrMsg) {
          setWinbackQrMsg.textContent = "Win-back QR live in Support offers.";
        }
        toast("Win-back QR uploaded", "ok");
      } catch (e) {
        toast("Network error", "err");
      } finally {
        setWinbackQrUploadBtn.disabled = false;
      }
    });
  }
  if (setWinbackQrClearBtn) {
    setWinbackQrClearBtn.addEventListener("click", async function () {
      if (!confirm("Clear win-back QR? Offers will use pack / fallback QR.")) return;
      try {
        const res = await fetch("/api/admin/settings/winback-qr", {
          method: "DELETE",
          headers: authHeaders(),
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          toast(data.error || "Clear failed", "err");
          return;
        }
        pendingWinbackQrBase64 = null;
        const fallback =
          (data.settings && data.settings.qrImageUrl) || "/upi-qr.svg";
        if (setWinbackQrPreview) setWinbackQrPreview.src = fallback;
        if (setWinbackQrMsg) {
          setWinbackQrMsg.textContent =
            "No win-back QR — will use pack / fallback QR";
        }
        toast("Win-back QR cleared", "ok");
      } catch (e) {
        toast("Network error", "err");
      }
    });
  }

  if (userSearch) {
    userSearch.addEventListener("input", function () {
      usersPage = 1;
      renderUsers(usersCache);
    });
  }

  if (chatDrawer) {
    chatDrawer.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close-chat") !== null) closeChatDrawer();
      const tab = e.target.closest && e.target.closest("[data-drawer-tab]");
      if (tab && openChatUserId) {
        const name = tab.getAttribute("data-drawer-tab");
        if (name === "photos") openUserPhotos(openChatUserId);
        else openUserChat(openChatUserId);
        return;
      }
      const img = e.target.closest && e.target.closest("img[data-open-src]");
      if (img) {
        const src = img.getAttribute("data-open-src");
        if (src) window.open(src, "_blank", "noopener");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeChatDrawer();
    });
  }

  // Boot: validate saved token
  (async function boot() {
    if (!token) {
      showLogin();
      return;
    }
    showDash();
    const res = await fetch("/api/admin/users", { headers: authHeaders() });
    if (!res.ok) {
      logout();
      setMsg("Please login again.", "err");
      return;
    }
    await refreshAll();
  })();

  // Soft live poll every 5s — stats, online/idle, remaining time (no Loading flash)
  setInterval(function () {
    softRefreshNow();
  }, 5000);

  // Countdown clocks between polls
  setInterval(function () {
    if (!token || document.hidden) return;
    paintLiveClocks();
  }, 1000);

  // Immediate sync when tab/app comes back
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") softRefreshNow();
  });
  window.addEventListener("focus", function () {
    softRefreshNow();
  });
})();
