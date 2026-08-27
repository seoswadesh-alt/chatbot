const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  parseCreditSms,
  decidePaymentMatch,
  normalizeUtr,
} = require("./smsPaymentMatch");

const DATA_DIR = path.join(__dirname, "..", "data");
const UPLOAD_DIR = path.join(__dirname, "..", "public", "payment-uploads");
const UPI_UPLOAD_DIR = path.join(__dirname, "..", "public", "upi-uploads");
const SUPPORT_UPLOAD_DIR = path.join(__dirname, "..", "public", "support-uploads");
const DB_FILE = path.join(DATA_DIR, "store.json");

const RATE_INR = Number(process.env.RATE_INR_PER_HOUR || 130);

/** Bump when default catalog changes — live store migrates on getSettings() */
const PACKAGES_VERSION = 2;

/** Wall-clock packs: access runs in real time from grant/extend */
const DEFAULT_PACKAGES = [
  {
    id: "day",
    hours: 24,
    listPriceInr: 100,
    priceInr: 100,
    label: "Full Day",
    badge: "Popular",
    popular: true,
  },
  {
    id: "month",
    hours: 720,
    listPriceInr: 2000,
    priceInr: 2000,
    label: "Month",
    badge: "Best value",
    popular: false,
  },
];

/** @deprecated use DEFAULT_PACKAGES — kept for exports */
const PACKAGES = DEFAULT_PACKAGES;

function enrichPackage(p) {
  const list = Number(p.listPriceInr != null ? p.listPriceInr : p.priceInr);
  const price = Number(p.priceInr);
  const save = Math.max(0, list - price);
  const discountPct = list > 0 ? Math.round((save / list) * 100) : 0;
  return {
    ...p,
    listPriceInr: list,
    priceInr: price,
    saveInr: save,
    discountPct,
    perHourInr: Math.round(price / Math.max(0.01, Number(p.hours) || 1)),
  };
}

function defaultSettings() {
  return {
    upiId: process.env.UPI_ID || "yourname@upi",
    upiName: process.env.UPI_NAME || "Chat Service",
    qrImageUrl: process.env.UPI_QR_URL || "/upi-qr.svg",
    trialMinutes: 5,
    oneIdPerDevice: false,
    clientCacheKey: 1,
    clientCacheUpdatedAt: null,
    packagesVersion: PACKAGES_VERSION,
    packages: DEFAULT_PACKAGES.map((p) => ({ ...p })),
    winbackEnabled: false,
    winbackPackageId: "day",
    winbackPriceInr: 50,
    winbackPricesByPack: {},
    winbackQrImageUrl: "",
  };
}

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(UPI_UPLOAD_DIR)) fs.mkdirSync(UPI_UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(SUPPORT_UPLOAD_DIR)) {
    fs.mkdirSync(SUPPORT_UPLOAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(
        {
          users: {},
          payments: {},
          tokens: {},
          devices: {},
          chats: {},
          supportThreads: {},
          smsCredits: {},
          payIntents: {},
          payFunnels: {},
          adminNotices: {},
          settings: defaultSettings(),
        },
        null,
        2
      )
    );
  }
}

function ensurePayFunnels(db) {
  if (!db.payFunnels || typeof db.payFunnels !== "object") db.payFunnels = {};
}

const PAY_FUNNEL_STAGES = {
  open: 1,
  pack: 2,
  scan_qr: 3,
  ive_paid: 4,
  submitted: 5,
  success: 6,
  abandon: 0,
};

function stageRank(stage) {
  return PAY_FUNNEL_STAGES[String(stage || "").toLowerCase()] || 0;
}

/** Durable pay funnel — where users open / leave checkout (not SMS intent TTL). */
function recordPayEvent({ userId, stage, packageId, note }) {
  const id = String(userId || "").trim();
  const st = String(stage || "")
    .trim()
    .toLowerCase()
    .slice(0, 40);
  if (!id) return { ok: false, error: "Login required" };
  if (!Object.prototype.hasOwnProperty.call(PAY_FUNNEL_STAGES, st)) {
    return { ok: false, error: "Invalid stage" };
  }

  const db = readDb();
  if (!db.users[id]) return { ok: false, error: "User not found" };
  ensurePayFunnels(db);

  const pack = packageId ? getPackage(packageId) : null;
  const now = Date.now();
  const prev = db.payFunnels[id] || {
    userId: id,
    stage: "open",
    packageId: null,
    amountInr: null,
    hours: null,
    openedAt: now,
    updatedAt: now,
    abandoned: false,
    abandonedAt: null,
    discountAsked: false,
    discountAskedAt: null,
    submittedAt: null,
    successAt: null,
    stages: [],
  };

  const entry = {
    stage: st,
    at: now,
    packageId: pack ? pack.id : prev.packageId || null,
  };
  prev.stages = Array.isArray(prev.stages) ? prev.stages : [];
  prev.stages.push(entry);
  if (prev.stages.length > 40) prev.stages = prev.stages.slice(-40);

  if (st === "open" && !prev.openedAt) prev.openedAt = now;
  if (st === "open") {
    // Fresh open after success/submit starts a new attempt window
    if (prev.successAt || prev.submittedAt) {
      prev.abandoned = false;
      prev.abandonedAt = null;
      prev.submittedAt = null;
      prev.successAt = null;
    }
  }

  // Only lock pack when user clearly chose / advanced — never on bare "open"
  // (client default pack was overwriting the real pack e.g. 1h → 5h)
  if (
    pack &&
    (st === "pack" ||
      st === "scan_qr" ||
      st === "ive_paid" ||
      st === "submitted" ||
      st === "success")
  ) {
    prev.packageId = pack.id;
    prev.amountInr = pack.priceInr;
    prev.hours = pack.hours;
  }

  if (st === "abandon") {
    // Only count abandon if they actually entered checkout and never finished
    if (
      !prev.submittedAt &&
      !prev.successAt &&
      stageRank(prev.stage) >= stageRank("pack")
    ) {
      prev.abandoned = true;
      prev.abandonedAt = now;
      snapshotPayLead(prev);
    }
  } else if (st === "submitted") {
    prev.submittedAt = now;
    prev.abandoned = false;
    prev.abandonedAt = null;
    prev.stage = st;
  } else if (st === "success") {
    prev.successAt = now;
    prev.abandoned = false;
    prev.abandonedAt = null;
    prev.stage = st;
  } else if (st !== "abandon") {
    // Keep highest progress stage (don't regress pack ← open)
    if (stageRank(st) >= stageRank(prev.stage) || !prev.stage) {
      prev.stage = st;
    }
  }

  if (note) prev.lastNote = String(note).slice(0, 200);
  prev.updatedAt = now;
  db.payFunnels[id] = prev;
  writeDb(db);
  return { ok: true, funnel: publicPayFunnel(prev) };
}

/** Freeze pack/stage shown to admin at abandon / discount ask time. */
function snapshotPayLead(funnel) {
  if (!funnel) return;
  funnel.leadStage = funnel.stage || null;
  funnel.leadPackageId = funnel.packageId || null;
  funnel.leadAmountInr =
    funnel.amountInr != null ? funnel.amountInr : null;
  funnel.leadHours = funnel.hours != null ? funnel.hours : null;
  funnel.leadAt = Date.now();
}

function publicPayFunnel(f) {
  if (!f) return null;
  const showPackId = f.leadPackageId || f.packageId || null;
  const showAmount =
    f.leadAmountInr != null
      ? f.leadAmountInr
      : f.amountInr != null
        ? f.amountInr
        : null;
  const showHours =
    f.leadHours != null ? f.leadHours : f.hours != null ? f.hours : null;
  const showStage = f.leadStage || f.stage || "open";
  return {
    userId: f.userId,
    stage: showStage,
    packageId: showPackId,
    amountInr: showAmount,
    hours: showHours,
    currentStage: f.stage || "open",
    currentPackageId: f.packageId || null,
    openedAt: f.openedAt || null,
    updatedAt: f.updatedAt || null,
    abandoned: !!f.abandoned,
    abandonedAt: f.abandonedAt || null,
    discountAsked: !!f.discountAsked,
    discountAskedAt: f.discountAskedAt || null,
    submittedAt: f.submittedAt || null,
    successAt: f.successAt || null,
  };
}

/** Prefer pack/stage written into [DISCOUNT_ASK] if lead snapshot missing (older rows). */
function enrichFunnelFromDiscountMsg(funnel, msgs) {
  if (!funnel) return null;
  if (funnel.packageId && funnel.leadPackageId) return funnel;
  const ask = (msgs || [])
    .slice()
    .reverse()
    .find(function (m) {
      return m && /\[DISCOUNT_ASK\]/i.test(String(m.text || ""));
    });
  if (!ask) return funnel;
  const text = String(ask.text || "");
  const packMatch = text.match(
    /Pack\s+(\S+)(?:\s*·\s*₹(\d+))?(?:\s*·\s*([\d.]+)\s*h)?/i
  );
  const stageMatch = text.match(/left after:\s*([a-z0-9_]+)/i);
  const out = Object.assign({}, funnel);
  if (packMatch) {
    out.packageId = packMatch[1];
    if (packMatch[2] != null) out.amountInr = Number(packMatch[2]);
    if (packMatch[3] != null) out.hours = Number(packMatch[3]);
  }
  if (stageMatch) out.stage = stageMatch[1];
  return out;
}

function markPayFunnelInDb(db, userId, stage, packageId) {
  const id = String(userId || "").trim();
  if (!id || !db.users[id]) return;
  ensurePayFunnels(db);
  const pack = packageId ? getPackage(packageId) : null;
  const now = Date.now();
  const prev = db.payFunnels[id] || {
    userId: id,
    stage: "open",
    packageId: null,
    amountInr: null,
    hours: null,
    openedAt: now,
    updatedAt: now,
    abandoned: false,
    abandonedAt: null,
    discountAsked: false,
    discountAskedAt: null,
    submittedAt: null,
    successAt: null,
    stages: [],
  };
  prev.stages = Array.isArray(prev.stages) ? prev.stages : [];
  prev.stages.push({
    stage,
    at: now,
    packageId: pack ? pack.id : prev.packageId || null,
  });
  if (prev.stages.length > 40) prev.stages = prev.stages.slice(-40);
  if (pack) {
    prev.packageId = pack.id;
    prev.amountInr = pack.priceInr;
    prev.hours = pack.hours;
  }
  prev.stage = stage;
  prev.updatedAt = now;
  if (stage === "submitted") {
    prev.submittedAt = now;
    prev.abandoned = false;
    prev.abandonedAt = null;
  }
  if (stage === "success") {
    prev.successAt = now;
    prev.abandoned = false;
    prev.abandonedAt = null;
  }
  db.payFunnels[id] = prev;
}

/**
 * Always send QR offer after discount ask — no silent skips.
 * Uses funnel pack + per-pack offer ₹ (or pack sell price).
 */
function sendDiscountAskOffer(userId, funnel) {
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "Login required" };

  const s = getSettings();
  let packId = String(
    (funnel && (funnel.leadPackageId || funnel.packageId)) || ""
  ).trim();
  let pack = packId ? getPackage(packId) : null;

  if (!pack && funnel && funnel.hours != null) {
    const wantH = Number(funnel.hours);
    pack =
      getPackages().find(function (p) {
        return Math.abs(Number(p.hours) - wantH) < 0.02;
      }) || null;
    if (pack) packId = pack.id;
  }
  if (!pack && funnel && funnel.leadAmountInr != null) {
    const wantA = Math.round(Number(funnel.leadAmountInr));
    pack =
      getPackages().find(function (p) {
        return Math.round(Number(p.priceInr)) === wantA;
      }) || null;
    if (pack) packId = pack.id;
  }
  if (!pack) {
    pack = getPackage(s.winbackPackageId || "day") || getPackages()[0] || null;
    if (pack) packId = pack.id;
  }
  if (!pack) {
    return { ok: false, error: "No package configured for offer" };
  }

  let price = getWinbackPriceForPack(pack.id, s);
  // If no special offer saved, use a sensible discount vs list (or funnel amount)
  const listPrice = Math.round(
    Number(pack.listPriceInr != null ? pack.listPriceInr : pack.priceInr)
  );
  if (!Number.isFinite(price) || price < 1) {
    price = listPrice;
  }
  // Prefer saved per-pack offer; otherwise if funnel had list price, keep offer ≤ list
  if (
    !(s.winbackPricesByPack && s.winbackPricesByPack[pack.id] != null) &&
    funnel &&
    funnel.leadAmountInr != null
  ) {
    const funnelAmt = Math.round(Number(funnel.leadAmountInr));
    if (Number.isFinite(funnelAmt) && funnelAmt > 0) {
      // Use configured offer if any for this pack; else funnel amount (what they saw)
      price = getWinbackPriceForPack(pack.id, s);
      if (
        !(s.winbackPricesByPack && s.winbackPricesByPack[pack.id] != null)
      ) {
        price = funnelAmt;
      }
    }
  }

  const qrUrl =
    (s.winbackQrImageUrl && String(s.winbackQrImageUrl).trim()) ||
    (pack.qrImageUrl && String(pack.qrImageUrl).trim()) ||
    (s.qrImageUrl && String(s.qrImageUrl).trim()) ||
    "/upi-qr.svg";

  const text =
    "Pay ₹" +
    price +
    " for " +
    (pack.label || pack.id) +
    ".\n" +
    "UPI note = " +
    id;

  const msgResult = addSupportMessage({
    userId: id,
    from: "admin",
    text: text,
    screenshotUrl: qrUrl,
  });
  if (!msgResult.ok) {
    return { ok: false, error: msgResult.error || "Could not send offer" };
  }

  const now = Date.now();
  const db = readDb();
  const user = db.users[id];
  if (user) {
    user.winbackOffer = {
      packageId: pack.id,
      packageLabel: pack.label || pack.id,
      priceInr: price,
      listPriceInr: listPrice,
      hours: pack.hours,
      qrImageUrl: qrUrl,
      grantedAt: now,
      expiresAt: now + WINBACK_INTENT_MS,
      messageId: msgResult.message && msgResult.message.id,
      source: "discount_ask",
    };
  }
  if (!db.payIntents || typeof db.payIntents !== "object") db.payIntents = {};
  db.payIntents[id] = {
    userId: id,
    packageId: pack.id,
    amountInr: price,
    hours: pack.hours,
    source: "discount_ask",
    createdAt: now,
    expiresAt: now + WINBACK_INTENT_MS,
  };
  if (db.payFunnels && db.payFunnels[id]) {
    db.payFunnels[id].lastOfferSkip = null;
    db.payFunnels[id].lastOfferSentAt = now;
    db.payFunnels[id].lastOfferPriceInr = price;
    db.payFunnels[id].lastOfferPackageId = pack.id;
  }
  writeDb(db);

  return {
    ok: true,
    granted: true,
    offer: user && user.winbackOffer,
    intent: db.payIntents[id],
    supportPopup: getSupportPopupForUser(id),
    message: msgResult.message,
    user: user ? publicUser(user) : null,
  };
}

/**
 * User asks team for a discount after leaving checkout → Support thread.
 * Always auto-replies with QR + offer for their pack.
 */
function requestPayDiscount({ userId, note }) {
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "Login required" };

  const db = readDb();
  if (!db.users[id]) return { ok: false, error: "User not found" };
  ensurePayFunnels(db);

  const funnel = db.payFunnels[id] || null;
  const stage = funnel ? funnel.stage : "open";
  const packLine = funnel && funnel.packageId
    ? `Pack ${funnel.packageId}` +
      (funnel.amountInr != null ? ` · ₹${funnel.amountInr}` : "") +
      (funnel.hours != null ? ` · ${funnel.hours}h` : "")
    : "No pack chosen";
  const extra = String(note || "").trim().slice(0, 400);
  const text =
    "[DISCOUNT_ASK]\n" +
    "Hi team — I was checking payment but didn't finish.\n" +
    packLine +
    " (left after: " +
    stage +
    ").\n" +
    "Please share a discount if possible." +
    (extra ? "\nMy note: " + extra : "");

  if (!db.payFunnels[id]) {
    db.payFunnels[id] = {
      userId: id,
      stage: stage || "abandon",
      packageId: null,
      amountInr: null,
      hours: null,
      openedAt: Date.now(),
      updatedAt: Date.now(),
      abandoned: true,
      abandonedAt: Date.now(),
      discountAsked: false,
      discountAskedAt: null,
      submittedAt: null,
      successAt: null,
      stages: [],
    };
  }
  db.payFunnels[id].discountAsked = true;
  db.payFunnels[id].discountAskedAt = Date.now();
  db.payFunnels[id].abandoned = true;
  if (!db.payFunnels[id].abandonedAt) {
    db.payFunnels[id].abandonedAt = Date.now();
  }
  snapshotPayLead(db.payFunnels[id]);
  db.payFunnels[id].updatedAt = Date.now();
  const funnelSnap = Object.assign({}, db.payFunnels[id]);
  writeDb(db);

  const support = addSupportMessage({
    userId: id,
    from: "user",
    text,
  });
  if (!support.ok) return support;

  // ALWAYS send QR offer (dedicated path — does not silently skip)
  let winback = null;
  try {
    winback = sendDiscountAskOffer(id, funnelSnap);
  } catch (err) {
    winback = {
      ok: false,
      error: (err && err.message) || "offer_exception",
    };
  }
  if (!winback || !winback.ok) {
    // Last-resort text-only admin reply so something always appears
    const failText =
      "Thanks for asking — our team will share a special price and QR here shortly. " +
      "Please keep this Support chat open.";
    let fallback = { ok: false };
    try {
      fallback = addSupportMessage({
        userId: id,
        from: "admin",
        text: failText,
      });
    } catch (_) {}
    winback = {
      ok: false,
      granted: false,
      error: (winback && (winback.error || winback.reason)) || "offer_failed",
      fallback: !!(fallback && fallback.ok),
      supportPopup: getSupportPopupForUser(id),
    };
  }

  const dbFinal = readDb();
  return {
    ok: true,
    funnel: publicPayFunnel(dbFinal.payFunnels[id]),
    thread: getSupportThread(id).thread || support.thread,
    message: support.message,
    winback: winback,
    supportPopup: getSupportPopupForUser(id),
  };
}

/** Open discount / abandon leads for admin (active, not paid success). */
function listPayLeads() {
  const db = readDb();
  ensurePayFunnels(db);
  const dayStart = startOfDayIstMs(Date.now());
  return Object.values(db.payFunnels || {})
    .filter(function (f) {
      if (!f || !db.users[f.userId]) return false;
      if (f.successAt) return false;
      return !!(f.abandoned || f.discountAsked);
    })
    .map(function (f) {
      const u = db.users[f.userId];
      return {
        ...publicPayFunnel(f),
        hasPaid: !!(u && u.hasPaid),
        hoursBalance: u ? liveHoursBalance(u) : 0,
        today: Number(f.abandonedAt || f.discountAskedAt || 0) >= dayStart,
      };
    })
    .sort(function (a, b) {
      const at =
        Math.max(Number(a.discountAskedAt || 0), Number(a.abandonedAt || 0)) -
        Math.max(Number(b.discountAskedAt || 0), Number(b.abandonedAt || 0));
      return -at;
    });
}

function migratePackagesCatalog(settings) {
  const ver = Number(settings.packagesVersion) || 0;
  if (ver >= PACKAGES_VERSION) {
    if (!Array.isArray(settings.packages) || !settings.packages.length) {
      settings.packages = DEFAULT_PACKAGES.map((p) => ({ ...p }));
      settings.packagesVersion = PACKAGES_VERSION;
      return true;
    }
    return false;
  }
  const oldById = {};
  (settings.packages || []).forEach(function (p) {
    if (p && p.id) oldById[p.id] = p;
  });
  settings.packages = DEFAULT_PACKAGES.map(function (p) {
    const prev = oldById[p.id];
    if (!prev) return { ...p };
    const next = { ...p };
    if (prev.qrImageUrl) next.qrImageUrl = prev.qrImageUrl;
    return next;
  });
  settings.packagesVersion = PACKAGES_VERSION;
  return true;
}

function getSettings() {
  const db = readDb();
  if (!db.settings || typeof db.settings !== "object") {
    db.settings = defaultSettings();
    writeDb(db);
  } else {
    let dirty = false;
    if (migratePackagesCatalog(db.settings)) dirty = true;
    if (
      !Number.isFinite(Number(db.settings.trialMinutes)) ||
      Number(db.settings.trialMinutes) <= 0
    ) {
      db.settings.trialMinutes = 5;
      dirty = true;
    }
    if (typeof db.settings.oneIdPerDevice !== "boolean") {
      db.settings.oneIdPerDevice = false;
      dirty = true;
    }
    if (!Number.isFinite(Number(db.settings.clientCacheKey))) {
      db.settings.clientCacheKey = 1;
      dirty = true;
    }
    if (typeof db.settings.winbackEnabled !== "boolean") {
      db.settings.winbackEnabled = false;
      dirty = true;
    }
    if (!db.settings.winbackPackageId) {
      db.settings.winbackPackageId = "day";
      dirty = true;
    }
    if (
      !Number.isFinite(Number(db.settings.winbackPriceInr)) ||
      Number(db.settings.winbackPriceInr) <= 0
    ) {
      db.settings.winbackPriceInr = 50;
      dirty = true;
    }
    if (db.settings.winbackQrImageUrl == null) {
      db.settings.winbackQrImageUrl = "";
      dirty = true;
    }
    if (
      !db.settings.winbackPricesByPack ||
      typeof db.settings.winbackPricesByPack !== "object"
    ) {
      db.settings.winbackPricesByPack = {};
      dirty = true;
    }
    // Seed map from legacy single price so old saves still work
    const wbId = String(db.settings.winbackPackageId || "").trim();
    const wbPrice = Math.round(Number(db.settings.winbackPriceInr));
    if (
      wbId &&
      Number.isFinite(wbPrice) &&
      wbPrice > 0 &&
      db.settings.winbackPricesByPack[wbId] == null
    ) {
      db.settings.winbackPricesByPack[wbId] = wbPrice;
      dirty = true;
    }
    if (dirty) writeDb(db);
  }
  return db.settings;
}

/** Free trial length for new signups (1–120 minutes). */
function getTrialMinutes() {
  const n = Math.round(Number(getSettings().trialMinutes));
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(120, n);
}

function getPackages() {
  return getSettings().packages.map(enrichPackage);
}

function getPackage(packageId) {
  const p = getSettings().packages.find((x) => x.id === packageId);
  return p ? enrichPackage(p) : null;
}

function paymentInfo() {
  const s = getSettings();
  return {
    upiId: s.upiId || process.env.UPI_ID || "yourname@upi",
    upiName: s.upiName || process.env.UPI_NAME || "Chat Service",
    qrImageUrl: s.qrImageUrl || process.env.UPI_QR_URL || "/upi-qr.svg",
    rateInrPerHour: RATE_INR,
    trialMinutes: getTrialMinutes(),
    noteHint: "Remark = your 4-digit User ID (auto-filled). Don’t change it.",
  };
}

function normalizePackagesInput(list, existingPackages) {
  if (!Array.isArray(list) || !list.length) {
    throw new Error("At least one package required");
  }
  const prevById = {};
  (existingPackages || []).forEach(function (p) {
    if (p && p.id) prevById[String(p.id)] = p;
  });
  return list.map((raw, i) => {
    const hours = Number(raw.hours);
    const priceInr = Number(raw.priceInr);
    const listPriceInr = Number(
      raw.listPriceInr != null ? raw.listPriceInr : priceInr
    );
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error("Package " + (i + 1) + ": invalid hours");
    }
    if (!Number.isFinite(priceInr) || priceInr < 0) {
      throw new Error("Package " + (i + 1) + ": invalid price");
    }
    const id =
      String(raw.id || "").trim() ||
      String(hours).replace(/\./g, "p") + "h-" + (i + 1);
    const safeId = id.slice(0, 32);
    const prev = prevById[safeId];
    let qrImageUrl = "";
    if (raw.qrImageUrl != null && String(raw.qrImageUrl).trim()) {
      qrImageUrl = String(raw.qrImageUrl).trim().slice(0, 200);
    } else if (prev && prev.qrImageUrl) {
      qrImageUrl = String(prev.qrImageUrl).trim().slice(0, 200);
    }
    return {
      id: safeId,
      hours,
      priceInr,
      listPriceInr: Number.isFinite(listPriceInr) ? listPriceInr : priceInr,
      label: String(raw.label || hours + " Hour" + (hours === 1 ? "" : "s")).slice(
        0,
        40
      ),
      badge: String(raw.badge || "").slice(0, 24),
      popular: !!raw.popular,
      qrImageUrl,
    };
  });
}

function updatePaySettings({
  upiId,
  upiName,
  packages,
  trialMinutes,
  oneIdPerDevice,
  winbackEnabled,
  winbackPackageId,
  winbackPriceInr,
}) {
  const db = readDb();
  if (!db.settings) db.settings = defaultSettings();
  if (upiId != null) {
    db.settings.upiId = String(upiId).trim().slice(0, 80) || db.settings.upiId;
  }
  if (upiName != null) {
    db.settings.upiName =
      String(upiName).trim().slice(0, 80) || db.settings.upiName;
  }
  if (trialMinutes != null && trialMinutes !== "") {
    const n = Math.round(Number(trialMinutes));
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      throw new Error("Trial minutes must be between 1 and 120");
    }
    db.settings.trialMinutes = n;
  }
  if (oneIdPerDevice != null) {
    db.settings.oneIdPerDevice = !!oneIdPerDevice;
  }
  if (winbackEnabled != null) {
    db.settings.winbackEnabled = !!winbackEnabled;
  }
  if (winbackPackageId != null && String(winbackPackageId).trim()) {
    db.settings.winbackPackageId = String(winbackPackageId).trim().slice(0, 32);
  }
  if (winbackPriceInr != null && winbackPriceInr !== "") {
    const price = Math.round(Number(winbackPriceInr));
    if (!Number.isFinite(price) || price < 1 || price > 100000) {
      throw new Error("Win-back price must be between ₹1 and ₹100000");
    }
    db.settings.winbackPriceInr = price;
    // Per-pack offer prices — each pack keeps its own saved offer ₹
    if (
      !db.settings.winbackPricesByPack ||
      typeof db.settings.winbackPricesByPack !== "object"
    ) {
      db.settings.winbackPricesByPack = {};
    }
    const packKey = String(
      db.settings.winbackPackageId || winbackPackageId || ""
    ).trim();
    if (packKey) {
      db.settings.winbackPricesByPack[packKey] = price;
    }
  }
  if (packages != null) {
    db.settings.packages = normalizePackagesInput(
      packages,
      db.settings.packages || []
    );
    db.settings.packagesVersion = Math.max(
      PACKAGES_VERSION,
      Number(db.settings.packagesVersion) || 0
    );
  }
  // Validate winback pack exists after package update
  const packs = db.settings.packages || [];
  const wbId = String(db.settings.winbackPackageId || "").trim();
  if (wbId && !packs.some((p) => p && p.id === wbId)) {
    db.settings.winbackPackageId = packs[0] ? packs[0].id : "day";
  }
  writeDb(db);
  return {
    ok: true,
    settings: adminGetSettings(),
  };
}

function getClientCacheKey() {
  const n = Math.round(Number(getSettings().clientCacheKey));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function isOneIdPerDeviceEnabled() {
  return !!getSettings().oneIdPerDevice;
}

function getClientConfig() {
  return {
    cacheKey: getClientCacheKey(),
    oneIdPerDevice: isOneIdPerDeviceEnabled(),
    updatedAt: getSettings().clientCacheUpdatedAt || null,
  };
}

function bumpClientCacheKey() {
  const db = readDb();
  if (!db.settings) db.settings = defaultSettings();
  const prev = Math.round(Number(db.settings.clientCacheKey)) || 1;
  db.settings.clientCacheKey = prev + 1;
  db.settings.clientCacheUpdatedAt = Date.now();
  writeDb(db);
  return {
    ok: true,
    cacheKey: db.settings.clientCacheKey,
    updatedAt: db.settings.clientCacheUpdatedAt,
    settings: adminGetSettings(),
  };
}

function saveUpiQrBase64(base64Data) {
  ensureDirs();
  const raw = String(base64Data || "");
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const b64 = m ? m[2] : raw.includes(",") ? raw.split(",").pop() : raw;
  const mime = m ? m[1] : "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg")
    ? "jpg"
    : mime.includes("webp")
      ? "webp"
      : "png";
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > 3 * 1024 * 1024) {
    throw new Error("QR image invalid or too large (max ~3MB)");
  }
  // Remove old global uploaded qrs (not pack-specific qr-*)
  try {
    for (const f of fs.readdirSync(UPI_UPLOAD_DIR)) {
      if (/^qr\./i.test(f)) fs.unlinkSync(path.join(UPI_UPLOAD_DIR, f));
    }
  } catch (_) {
    /* ignore */
  }
  const filename = "qr." + ext;
  fs.writeFileSync(path.join(UPI_UPLOAD_DIR, filename), buf);
  const url = "/upi-uploads/" + filename + "?v=" + Date.now();
  const db = readDb();
  if (!db.settings) db.settings = defaultSettings();
  db.settings.qrImageUrl = url;
  writeDb(db);
  return { ok: true, qrImageUrl: url };
}

function clearUpiQr() {
  const db = readDb();
  if (!db.settings) db.settings = defaultSettings();
  try {
    for (const f of fs.readdirSync(UPI_UPLOAD_DIR)) {
      if (/^qr\./i.test(f)) fs.unlinkSync(path.join(UPI_UPLOAD_DIR, f));
    }
  } catch (_) {
    /* ignore */
  }
  db.settings.qrImageUrl = process.env.UPI_QR_URL || "/upi-qr.svg";
  writeDb(db);
  return { ok: true, qrImageUrl: db.settings.qrImageUrl };
}

/** Dedicated QR for win-back Support messages (not pack checkout QR). */
function saveWinbackQrBase64(base64Data) {
  ensureDirs();
  const raw = String(base64Data || "");
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const b64 = m ? m[2] : raw.includes(",") ? raw.split(",").pop() : raw;
  const mime = m ? m[1] : "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg")
    ? "jpg"
    : mime.includes("webp")
      ? "webp"
      : "png";
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > 3 * 1024 * 1024) {
    throw new Error("QR image invalid or too large (max ~3MB)");
  }
  try {
    for (const f of fs.readdirSync(UPI_UPLOAD_DIR)) {
      if (/^winback-qr\./i.test(f)) fs.unlinkSync(path.join(UPI_UPLOAD_DIR, f));
    }
  } catch (_) {
    /* ignore */
  }
  const filename = "winback-qr." + ext;
  fs.writeFileSync(path.join(UPI_UPLOAD_DIR, filename), buf);
  const url = "/upi-uploads/" + filename + "?v=" + Date.now();
  const db = readDb();
  if (!db.settings) db.settings = defaultSettings();
  db.settings.winbackQrImageUrl = url;
  writeDb(db);
  return {
    ok: true,
    winbackQrImageUrl: url,
    settings: adminGetSettings(),
  };
}

function clearWinbackQr() {
  const db = readDb();
  if (!db.settings) db.settings = defaultSettings();
  try {
    for (const f of fs.readdirSync(UPI_UPLOAD_DIR)) {
      if (/^winback-qr\./i.test(f)) fs.unlinkSync(path.join(UPI_UPLOAD_DIR, f));
    }
  } catch (_) {
    /* ignore */
  }
  db.settings.winbackQrImageUrl = "";
  writeDb(db);
  return {
    ok: true,
    winbackQrImageUrl: "",
    settings: adminGetSettings(),
  };
}

function packageQrFilePrefix(packageId) {
  const safe = String(packageId || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 32);
  return "qr-" + (safe || "pack");
}

function savePackageQrBase64(packageId, base64Data) {
  ensureDirs();
  const id = String(packageId || "").trim();
  if (!id) throw new Error("Package ID required");
  const db = readDb();
  if (!db.settings) db.settings = defaultSettings();
  const packs = db.settings.packages || [];
  const idx = packs.findIndex(function (p) {
    return p && p.id === id;
  });
  if (idx < 0) throw new Error("Package not found — save packs first");

  const raw = String(base64Data || "");
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const b64 = m ? m[2] : raw.includes(",") ? raw.split(",").pop() : raw;
  const mime = m ? m[1] : "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg")
    ? "jpg"
    : mime.includes("webp")
      ? "webp"
      : "png";
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > 3 * 1024 * 1024) {
    throw new Error("QR image invalid or too large (max ~3MB)");
  }

  const prefix = packageQrFilePrefix(id);
  try {
    for (const f of fs.readdirSync(UPI_UPLOAD_DIR)) {
      if (f.indexOf(prefix + ".") === 0) {
        fs.unlinkSync(path.join(UPI_UPLOAD_DIR, f));
      }
    }
  } catch (_) {
    /* ignore */
  }

  const filename = prefix + "." + ext;
  fs.writeFileSync(path.join(UPI_UPLOAD_DIR, filename), buf);
  const url = "/upi-uploads/" + filename + "?v=" + Date.now();
  packs[idx].qrImageUrl = url;
  db.settings.packages = packs;
  writeDb(db);
  return {
    ok: true,
    packageId: id,
    qrImageUrl: url,
    settings: adminGetSettings(),
  };
}

function clearPackageQr(packageId) {
  const id = String(packageId || "").trim();
  if (!id) throw new Error("Package ID required");
  const db = readDb();
  if (!db.settings) db.settings = defaultSettings();
  const packs = db.settings.packages || [];
  const idx = packs.findIndex(function (p) {
    return p && p.id === id;
  });
  if (idx < 0) throw new Error("Package not found");

  const prefix = packageQrFilePrefix(id);
  try {
    for (const f of fs.readdirSync(UPI_UPLOAD_DIR)) {
      if (f.indexOf(prefix + ".") === 0) {
        fs.unlinkSync(path.join(UPI_UPLOAD_DIR, f));
      }
    }
  } catch (_) {
    /* ignore */
  }

  packs[idx].qrImageUrl = "";
  db.settings.packages = packs;
  writeDb(db);
  return {
    ok: true,
    packageId: id,
    qrImageUrl: "",
    settings: adminGetSettings(),
  };
}

function getWinbackPriceForPack(packageId, settings) {
  const s = settings || getSettings();
  const id = String(packageId || s.winbackPackageId || "").trim();
  const map = s.winbackPricesByPack || {};
  if (id && map[id] != null) {
    const n = Math.round(Number(map[id]));
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Active pack falls back to legacy single price
  if (id && id === String(s.winbackPackageId || "").trim()) {
    const legacy = Math.round(Number(s.winbackPriceInr));
    if (Number.isFinite(legacy) && legacy > 0) return legacy;
  }
  const pack = getPackage(id);
  if (pack && pack.priceInr != null) {
    const list = Math.round(Number(pack.priceInr));
    if (Number.isFinite(list) && list > 0) return list;
  }
  return Math.round(Number(s.winbackPriceInr) || 50);
}

function adminGetSettings() {
  const s = getSettings();
  const packId = s.winbackPackageId || "day";
  return {
    upiId: s.upiId,
    upiName: s.upiName,
    qrImageUrl: s.qrImageUrl,
    trialMinutes: getTrialMinutes(),
    oneIdPerDevice: !!s.oneIdPerDevice,
    clientCacheKey: getClientCacheKey(),
    clientCacheUpdatedAt: s.clientCacheUpdatedAt || null,
    packages: (s.packages || []).map(enrichPackage),
    winbackEnabled: !!s.winbackEnabled,
    winbackPackageId: packId,
    winbackPriceInr: getWinbackPriceForPack(packId, s),
    winbackPricesByPack: Object.assign({}, s.winbackPricesByPack || {}),
    winbackQrImageUrl: s.winbackQrImageUrl || "",
  };
}

function readDb() {
  ensureDirs();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  ensureDirs();
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function randomId(prefix, len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}_${out}`;
}

/** Easy 4-digit User ID (1000–9999), unique across all users */
function generateUniqueUserId(db) {
  const used = new Set(Object.keys(db.users || {}));
  for (let i = 0; i < 8000; i++) {
    const id = String(crypto.randomInt(1000, 10000));
    if (!used.has(id)) return id;
  }
  throw new Error("No free 4-digit user IDs left (1000–9999 all used)");
}

function hashPin(pin, salt) {
  return crypto.createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

function normalizeDeviceId(raw) {
  const s = String(raw || "").trim().slice(0, 80);
  if (!/^[a-zA-Z0-9_-]{10,80}$/.test(s)) return "";
  return s;
}

/**
 * When admin enables "One ID per device", block a second signup on the same browser/phone.
 * Soft backup: limit new signups per IP per day (stops wipe/incognito spam).
 * When off, anyone can create new IDs freely — login/pay/chat unchanged.
 */
const MAX_SIGNUPS_PER_IP_DAY = 3;
const SIGNUP_IP_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalizeIp(raw) {
  let s = String(raw || "").trim().slice(0, 80);
  if (!s) return "";
  // ::ffff:1.2.3.4 → 1.2.3.4
  if (s.indexOf("::ffff:") === 0) s = s.slice(7);
  return s;
}

function assertCanRegister({ deviceId, ip }) {
  const did = normalizeDeviceId(deviceId);
  if (!isOneIdPerDeviceEnabled()) {
    if (!did) {
      const fallback = "web_" + crypto.randomBytes(8).toString("hex");
      return { ok: true, deviceId: fallback };
    }
    return { ok: true, deviceId: did };
  }

  const db = readDb();
  if (!db.devices) db.devices = {};

  if (!did) {
    return {
      ok: false,
      error: "Device check failed. Refresh the page and try again.",
    };
  }

  const byDevice = db.devices[did];
  if (byDevice && byDevice.userId) {
    const existing = db.users && db.users[byDevice.userId];
    if (existing) {
      return {
        ok: false,
        error:
          "This device already has User ID " +
          byDevice.userId +
          ". Login with your PIN — one ID per device is on.",
        existingUserId: byDevice.userId,
      };
    }
  }

  const nip = normalizeIp(ip);
  if (nip && nip !== "127.0.0.1" && nip !== "::1") {
    const since = Date.now() - SIGNUP_IP_WINDOW_MS;
    let count = 0;
    for (const d of Object.values(db.devices)) {
      if (!d || !d.userId) continue;
      if (normalizeIp(d.ip) !== nip) continue;
      if (Number(d.lastRegisterAt || 0) < since) continue;
      count += 1;
    }
    if (count >= MAX_SIGNUPS_PER_IP_DAY) {
      return {
        ok: false,
        error:
          "Too many new IDs from this network today. Login with an existing ID, or try again tomorrow.",
        retryAfterMs: SIGNUP_IP_WINDOW_MS,
      };
    }
  }

  return { ok: true, deviceId: did };
}

/** Support: allow one re-signup on a phone after wipe (does not delete the user). */
function adminUnlinkDevice(userId) {
  const db = readDb();
  const id = String(userId || "").trim();
  if (!db.users || !db.users[id]) {
    return { ok: false, error: "User not found" };
  }
  if (!db.devices) db.devices = {};
  let removed = 0;
  for (const did of Object.keys(db.devices)) {
    const d = db.devices[did];
    if (d && d.userId === id) {
      delete db.devices[did];
      removed += 1;
    }
  }
  writeDb(db);
  return { ok: true, userId: id, devicesUnlinked: removed };
}

/** Require DOB proving age >= 18. Accepts YYYY-MM-DD. */
function assertAdultDob(dateOfBirth) {
  const raw = String(dateOfBirth || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: "Date of birth required (YYYY-MM-DD)." };
  }
  const [y, m, d] = raw.split("-").map(Number);
  const dob = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dob.getTime()) ||
    dob.getUTCFullYear() !== y ||
    dob.getUTCMonth() !== m - 1 ||
    dob.getUTCDate() !== d
  ) {
    return { ok: false, error: "Invalid date of birth." };
  }
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  if (dob.getTime() > todayUtc) {
    return { ok: false, error: "Date of birth cannot be in the future." };
  }
  let age = now.getFullYear() - y;
  const hadBirthday =
    now.getMonth() > m - 1 ||
    (now.getMonth() === m - 1 && now.getDate() >= d);
  if (!hadBirthday) age -= 1;
  if (age < 18) {
    return {
      ok: false,
      error: "You must be 18 or older to create an account.",
    };
  }
  if (age > 120) {
    return { ok: false, error: "Invalid date of birth." };
  }
  return { ok: true, ageYears: age, iso: raw };
}

function assertUserPin(pin) {
  const raw = String(pin || "").trim();
  if (!/^\d{4}$/.test(raw)) {
    return { ok: false, error: "PIN must be exactly 4 digits." };
  }
  return { ok: true, pin: raw };
}

function createUser({ deviceId, ip, dateOfBirth, pin: pinInput } = {}) {
  const age = assertAdultDob(dateOfBirth);
  if (!age.ok) {
    return { error: age.error };
  }

  const pinCheck = assertUserPin(pinInput);
  if (!pinCheck.ok) {
    return { error: pinCheck.error };
  }
  const pin = pinCheck.pin;

  const gate = assertCanRegister({ deviceId, ip });
  if (!gate.ok) {
    return {
      error: gate.error,
      retryAfterMs: gate.retryAfterMs,
      existingUserId: gate.existingUserId,
    };
  }

  const db = readDb();
  if (!db.devices) db.devices = {};

  // Never let User ID equal the chosen PIN — pick another ID instead of failing.
  let userId = generateUniqueUserId(db);
  for (let n = 0; n < 20 && userId === pin; n += 1) {
    userId = generateUniqueUserId(db);
  }
  if (userId === pin) {
    return { error: "Could not assign User ID. Try a different PIN." };
  }

  const salt = crypto.randomBytes(8).toString("hex");
  const pinHash = hashPin(pin, salt);
  const trialMinutes = getTrialMinutes();
  const now = Date.now();

  db.users[userId] = {
    userId,
    pinHash,
    pinSalt: salt,
    pinPlain: pin,
    hoursBalance: trialMinutes / 60,
    accessExpiresAt: now + trialMinutes * 60 * 1000,
    trialMinutes,
    hasPaid: false,
    storyModeFreeUsed: 0,
    storyModeTotalUses: 0,
    storyModeLastAt: null,
    createdAt: now,
    lastTickAt: null,
    lastSeenAt: now,
    sessionActive: false,
    deviceId: gate.deviceId,
    dateOfBirth: age.iso,
    ageYears: age.ageYears,
    ageVerifiedAt: now,
  };

  db.devices[gate.deviceId] = {
    lastRegisterAt: now,
    userId,
    ip: String(ip || "").slice(0, 80) || null,
  };

  writeDb(db);

  // Round-trip check so a bad hash never ships to the client
  const saved = readDb().users[userId];
  if (!saved || saved.pinHash !== hashPin(pin, saved.pinSalt)) {
    return { error: "Account created but PIN save failed. Contact admin." };
  }

  return { userId, trialMinutes };
}

function loginUser(userId, pin) {
  const db = readDb();
  const raw = String(userId || "").trim();
  // Support old USR_ ids (uppercase) and new 4-digit ids
  const id = /^\d{4}$/.test(raw) ? raw : raw.toUpperCase();
  const user = db.users[id];
  if (!user) return null;
  const ok = user.pinHash === hashPin(String(pin || "").trim(), user.pinSalt);
  if (!ok) return null;

  const token = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  user.lastSeenAt = now;
  if (migrateUserAccess(user, now)) {
    /* migrated old wallet → wall clock */
  } else {
    syncHoursBalanceFromExpiry(user, now);
  }
  db.tokens[token] = { userId: id, createdAt: now, role: "user" };
  writeDb(db);
  return { token, user: publicUser(user) };
}

function adminLogin(userId, password) {
  const expectedId = String(process.env.ADMIN_ID || "admin").trim().toLowerCase();
  const expectedPass = String(process.env.ADMIN_PASSWORD || "admin123").trim();
  const id = String(userId || "").trim().toLowerCase();
  const pass = String(password || "").trim();
  if (!pass || pass !== expectedPass) return null;
  // ID required and must match when provided; empty id allowed only for password-only calls
  if (id && id !== expectedId) return null;
  const db = readDb();
  const token = crypto.randomBytes(24).toString("hex");
  db.tokens[token] = { userId: "ADMIN", createdAt: Date.now(), role: "admin" };
  writeDb(db);
  return { token, role: "admin", adminId: expectedId };
}

/** Main login form: detect admin ID + password. */
function isAdminCredentials(userId, pin) {
  const expectedId = String(process.env.ADMIN_ID || "admin").trim().toLowerCase();
  const expectedPass = String(process.env.ADMIN_PASSWORD || "admin123").trim();
  return (
    String(userId || "").trim().toLowerCase() === expectedId &&
    String(pin || "").trim() === expectedPass
  );
}

function getTokenRecord(token) {
  if (!token) return null;
  const db = readDb();
  return db.tokens[token] || null;
}

function publicUser(user) {
  const hours = liveHoursBalance(user);
  const hasPaid =
    !!user.hasPaid ||
    Number(user.accessExpiresAt || 0) > Date.now() ||
    hours >= 0.99;
  const totalSec = Math.max(0, Math.floor(hours * 3600));
  const minutes = Math.max(0, Math.ceil(hours * 60));
  const active =
    !!user.sessionActive &&
    !!user.lastTickAt &&
    Date.now() - Number(user.lastTickAt) <= STALE_SESSION_MS;
  const story = storyModeQuotaForUser(user, !!user.hasPaid);
  const pendingPayOffer =
    !!(user && user.winbackOffer) && !user.hasPaid;
  return {
    userId: user.userId,
    hoursBalance: hours,
    hasPaid,
    minutesLeft: minutes,
    secondsLeft: totalSec,
    timeLabel: formatClock(totalSec),
    sessionActive: active,
    accessExpiresAt: Number(user.accessExpiresAt) || 0,
    storyModeFreeUsed: story.freeUsed,
    storyModeFreeLeft: story.freeLeft,
    storyModeFreeLimit: story.freeLimit,
    storyModeTotalUses: story.totalUses,
    canUseStoryMode: story.canUse,
    pendingPayOffer,
    // Real payment flag (trial time does not count) — for paid-only UI
    paidFeature: !!user.hasPaid,
    photoBonus: Math.max(0, Math.round(Number(user.photoBonus) || 0)),
    photoUsedHour: photoUsageOf(user, Date.now()).usedHour,
    photoCap: PHOTO_MAX_PER_HOUR,
  };
}

/** Free unpaid users get a small Story-mode reply quota; paid = unlimited. */
const STORY_MODE_FREE_USES = 2;

function storyModeQuotaForUser(user, hasPaidOverride) {
  const paid =
    hasPaidOverride != null
      ? !!hasPaidOverride
      : !!(user && user.hasPaid);
  const freeUsed = Math.max(0, Math.round(Number(user && user.storyModeFreeUsed) || 0));
  const totalUses = Math.max(0, Math.round(Number(user && user.storyModeTotalUses) || 0));
  const freeLimit = STORY_MODE_FREE_USES;
  const freeLeft = paid ? null : Math.max(0, freeLimit - freeUsed);
  return {
    paid,
    freeLimit,
    freeUsed,
    freeLeft,
    totalUses,
    canUse: paid || freeLeft > 0,
    lastAt: (user && user.storyModeLastAt) || null,
  };
}

/**
 * Gate + count one Story-mode AI reply.
 * Paid: always allowed, totalUses++.
 * Unpaid: allowed while freeUsed < freeLimit, then needsPay.
 */
function consumeStoryModeUse(userId) {
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "Login required" };
  const db = readDb();
  const user = db.users[id];
  if (!user) return { ok: false, error: "User not found" };

  const now = Date.now();
  migrateUserAccess(user, now);
  syncHoursBalanceFromExpiry(user, now);
  // Only real payments unlock unlimited Story — trial time does not
  const reallyPaid = !!user.hasPaid;

  if (!user.storyModeFreeUsed) user.storyModeFreeUsed = 0;
  if (!user.storyModeTotalUses) user.storyModeTotalUses = 0;

  const quotaBefore = storyModeQuotaForUser(user, reallyPaid);
  if (!quotaBefore.canUse) {
    writeDb(db);
    return {
      ok: true,
      allowed: false,
      needsPay: true,
      quota: quotaBefore,
      user: publicUser(user),
    };
  }

  user.storyModeTotalUses = Number(user.storyModeTotalUses || 0) + 1;
  if (!reallyPaid) {
    user.storyModeFreeUsed = Number(user.storyModeFreeUsed || 0) + 1;
  }
  user.storyModeLastAt = now;
  writeDb(db);
  const quota = storyModeQuotaForUser(user, reallyPaid);
  return {
    ok: true,
    allowed: true,
    needsPay: false,
    quota,
    user: publicUser(user),
  };
}

function getStoryModeQuota(userId) {
  const id = String(userId || "").trim();
  const user = getUser(id);
  if (!user) return { ok: false, error: "User not found" };
  const pub = publicUser(user);
  return {
    ok: true,
    quota: storyModeQuotaForUser(user, !!user.hasPaid),
    user: pub,
  };
}

/** 0:59 or 1:05:03 */
function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return h + ":" + pad(m) + ":" + pad(sec);
  return m + ":" + pad(sec);
}

function getUser(userId) {
  const db = readDb();
  return db.users[userId] || null;
}

/** Soft activity stamp for analytics (login / app open). */
function touchLastSeen(userId) {
  const db = readDb();
  const user = db.users[userId];
  if (!user) return null;
  const now = Date.now();
  user.lastSeenAt = now;
  migrateUserAccess(user, now);
  syncHoursBalanceFromExpiry(user, now);
  writeDb(db);
  return publicUser(user);
}

/** Keep chats (live + archive) for 5 days from last activity, then wipe. */
const CHAT_RETENTION_MS = 5 * 24 * 60 * 60 * 1000;

function chatStamp(session) {
  return Number((session && (session.archivedAt || session.updatedAt)) || 0);
}

function visibleChatMessages(history) {
  return (history || []).filter(
    (m) =>
      m &&
      m.content &&
      !/^Setup locked for this chat:/i.test(String(m.content))
  );
}

function normalizeArchiveList(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.filter(Boolean);
  return [entry];
}

function purgeExpiredChats(db) {
  const cutoff = Date.now() - CHAT_RETENTION_MS;
  let changed = false;

  if (db.chats) {
    for (const id of Object.keys(db.chats)) {
      const s = db.chats[id];
      if (chatStamp(s) && chatStamp(s) < cutoff) {
        delete db.chats[id];
        changed = true;
      }
    }
  }

  if (db.chatArchive) {
    for (const id of Object.keys(db.chatArchive)) {
      const kept = normalizeArchiveList(db.chatArchive[id]).filter(
        (s) => chatStamp(s) >= cutoff
      );
      if (!kept.length) {
        delete db.chatArchive[id];
        changed = true;
      } else if (
        kept.length !== normalizeArchiveList(db.chatArchive[id]).length ||
        !Array.isArray(db.chatArchive[id])
      ) {
        db.chatArchive[id] = kept;
        changed = true;
      }
    }
  }

  return changed;
}

function pushChatToArchive(db, userId, session) {
  if (!session) return;
  const msgs = visibleChatMessages(session.history);
  if (!msgs.length) return;
  if (!db.chatArchive) db.chatArchive = {};
  const list = normalizeArchiveList(db.chatArchive[userId]);
  list.push(
    Object.assign({}, session, {
      archivedAt: Date.now(),
      archiveId: randomId("ARCH", 8),
    })
  );
  // Cap stored archives per user (still purged by 5-day rule)
  db.chatArchive[userId] = list.slice(-30);
}

/** Move live chat into 5-day archive (keeps history for admin). */
function wipeChatInDb(db, userId) {
  if (db.chats && db.chats[userId]) {
    pushChatToArchive(db, userId, db.chats[userId]);
    delete db.chats[userId];
  }
  purgeExpiredChats(db);
}

function collectUserSessions(db, userId) {
  purgeExpiredChats(db);
  const id = String(userId || "").trim();
  const sessions = [];
  if (db.chats && db.chats[id]) {
    sessions.push({
      source: "live",
      session: db.chats[id],
      archiveId: null,
    });
  }
  for (const s of normalizeArchiveList(db.chatArchive && db.chatArchive[id])) {
    sessions.push({
      source: "archived",
      session: s,
      archiveId: s.archiveId || null,
    });
  }
  sessions.sort(
    (a, b) => chatStamp(b.session) - chatStamp(a.session)
  );
  return sessions;
}

/**
 * Wall-clock access: remaining time = accessExpiresAt - now.
 * sessionActive is presence-only (admin "online"); it does not pause the clock.
 */
const STALE_SESSION_MS = 90 * 1000;

/** Sync derived hoursBalance from accessExpiresAt. */
function syncHoursBalanceFromExpiry(user, now = Date.now()) {
  if (!user) return 0;
  const exp = Number(user.accessExpiresAt) || 0;
  const hours = exp > now ? (exp - now) / 3600000 : 0;
  user.hoursBalance = hours;
  if (hours <= 0.0001) {
    user.hoursBalance = 0;
    if (exp && exp <= now) {
      /* keep accessExpiresAt for history */
    }
  }
  return user.hoursBalance;
}

/**
 * One-time: old online-drain wallets → wall-clock from this moment.
 * If accessExpiresAt already set (even past), trust it.
 */
function migrateUserAccess(user, now = Date.now()) {
  if (!user) return false;
  if (user.accessExpiresAt != null && Number.isFinite(Number(user.accessExpiresAt))) {
    syncHoursBalanceFromExpiry(user, now);
    return false;
  }
  const bal = Number(user.hoursBalance || 0);
  if (bal > 0.0001) {
    user.accessExpiresAt = now + bal * 3600000;
    user.wallClockMigratedAt = now;
  } else {
    user.accessExpiresAt = 0;
    user.hoursBalance = 0;
  }
  syncHoursBalanceFromExpiry(user, now);
  return true;
}

/** Extend (or shrink) wall-clock access. Stacks from max(now, current expiry). */
function grantAccessHours(user, hours, now = Date.now()) {
  if (!user) return;
  migrateUserAccess(user, now);
  const add = Number(hours);
  if (!Number.isFinite(add) || add === 0) {
    syncHoursBalanceFromExpiry(user, now);
    return;
  }
  if (add > 0) {
    const curExp = Number(user.accessExpiresAt) || 0;
    const base = Math.max(now, curExp);
    user.accessExpiresAt = base + add * 3600000;
    user.hasPaid = true;
  } else {
    const curExp = Number(user.accessExpiresAt) || now;
    user.accessExpiresAt = Math.max(now, curExp + add * 3600000);
  }
  syncHoursBalanceFromExpiry(user, now);
}

/** Set absolute remaining hours from now (admin set). */
function setAccessHours(user, hours, now = Date.now()) {
  if (!user) return;
  const val = Number(hours);
  if (!Number.isFinite(val) || val < 0) return;
  if (val <= 0.0001) {
    user.accessExpiresAt = 0;
    user.hoursBalance = 0;
    user.sessionActive = false;
    user.lastTickAt = null;
    return;
  }
  user.accessExpiresAt = now + val * 3600000;
  syncHoursBalanceFromExpiry(user, now);
}

/** Hours left until accessExpiresAt (read-only; migrates in-memory if needed). */
function liveHoursBalance(user, now = Date.now()) {
  if (!user) return 0;
  if (user.accessExpiresAt == null || !Number.isFinite(Number(user.accessExpiresAt))) {
    // Legacy wallet with no expiry: do not treat stored hours as forever.
    // Prefer 0 until migrateUserAccess runs and sets a real end time.
    return 0;
  }
  const exp = Number(user.accessExpiresAt) || 0;
  if (exp <= now) return 0;
  return (exp - now) / 3600000;
}

/** Mark ghost sessions offline — does not change accessExpiresAt. */
function settleStaleSessions() {
  const db = readDb();
  const now = Date.now();
  let changed = false;
  for (const user of Object.values(db.users || {})) {
    if (!user || !user.sessionActive) continue;
    if (!user.lastTickAt || now - Number(user.lastTickAt) > STALE_SESSION_MS) {
      user.sessionActive = false;
      user.lastTickAt = null;
      changed = true;
    }
  }
  if (changed) writeDb(db);
  return changed;
}

/** Refresh wallet from wall clock; optionally mark session active (chatting). */
function tickUserHours(userId, { markActive = true } = {}) {
  const db = readDb();
  const user = db.users[userId];
  if (!user) return { ok: false, error: "User not found" };

  const now = Date.now();
  migrateUserAccess(user, now);
  syncHoursBalanceFromExpiry(user, now);
  // Always stamp app-open presence (even at 0 hours — for discount outreach)
  user.lastSeenAt = now;

  if (Number(user.hoursBalance || 0) <= 0.0001) {
    user.hoursBalance = 0;
    user.sessionActive = false;
    user.lastTickAt = null;
    writeDb(db);
    return {
      ok: false,
      error:
        "Time’s up. Scene paused here. Pay to continue this same chat.",
      user: publicUser(user),
      chatCleared: false,
    };
  }

  if (markActive) {
    user.sessionActive = true;
    user.lastTickAt = now;
  }
  writeDb(db);
  return { ok: true, user: publicUser(user) };
}

/**
 * Light heartbeat: user has the app open (logged in), not necessarily chatting.
 * Works at 0 hours so admins can see pay/discount targets.
 */
function pingAppOpen(userId) {
  const db = readDb();
  const user = db.users[userId];
  if (!user) return { ok: false, error: "User not found" };
  const now = Date.now();
  migrateUserAccess(user, now);
  syncHoursBalanceFromExpiry(user, now);
  user.lastSeenAt = now;
  writeDb(db);
  return { ok: true, user: publicUser(user) };
}

/** Presence only — leaving the app does not freeze wall-clock access. */
function pauseSession(userId) {
  const db = readDb();
  const user = db.users[userId];
  if (!user) return null;
  const now = Date.now();
  migrateUserAccess(user, now);
  syncHoursBalanceFromExpiry(user, now);
  user.sessionActive = false;
  user.lastTickAt = null;
  // Age lastSeenAt so admin "App open" clears immediately on leave
  user.lastSeenAt = Date.now() - STALE_SESSION_MS - 1000;
  writeDb(db);
  const pub = publicUser(user);
  pub.chatCleared = false;
  return pub;
}

function saveScreenshot(base64Data, userId) {
  ensureDirs();
  const raw = String(base64Data || "");
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const b64 = m ? m[2] : raw.includes(",") ? raw.split(",").pop() : raw;
  const mime = m ? m[1] : "image/jpeg";
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > 4.5 * 1024 * 1024) {
    throw new Error("Screenshot invalid or too large (max ~4MB)");
  }
  const filename = `${userId}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  return `/payment-uploads/${filename}`;
}

const PAY_INTENT_MS = 12 * 60 * 1000; // Scan QR / wait for SMS auto-match window
const WINBACK_INTENT_MS = 20 * 60 * 60 * 1000; // Win-back pay window (~20h)
const WINBACK_COOLDOWN_MS = 20 * 60 * 60 * 1000;

function submitPayment({
  userId,
  packageId,
  screenshotBase64,
  upiNote,
  utr,
  skipScreenshot,
  amountInr,
}) {
  const pack = getPackage(packageId);
  if (!pack) throw new Error("Invalid package");

  let screenshotUrl = null;
  if (!skipScreenshot) {
    if (!screenshotBase64) throw new Error("Screenshot required");
    screenshotUrl = saveScreenshot(screenshotBase64, userId);
  }
  const db = readDb();
  const paymentId = randomId("PAY", 8);
  const cleanUtr = normalizeUtr(utr);
  let amount = Math.round(Number(pack.priceInr));
  const override = Math.round(Number(amountInr));
  if (Number.isFinite(override) && override > 0) {
    amount = override;
  } else if (
    db.payIntents &&
    db.payIntents[userId] &&
    db.payIntents[userId].packageId === pack.id
  ) {
    const intentAmt = Math.round(Number(db.payIntents[userId].amountInr));
    if (Number.isFinite(intentAmt) && intentAmt > 0) amount = intentAmt;
  }
  db.payments[paymentId] = {
    paymentId,
    userId,
    packageId: pack.id,
    hours: pack.hours,
    amountInr: amount,
    screenshotUrl,
    upiNote: String(upiNote || "").slice(0, 120),
    utr: cleanUtr || "",
    status: "pending",
    createdAt: Date.now(),
    reviewedAt: null,
    reviewedBy: null,
  };
  // Clear pay intent — they submitted proof (or SMS path will clear)
  if (db.payIntents && db.payIntents[userId]) {
    delete db.payIntents[userId];
  }
  markPayFunnelInDb(db, userId, "submitted", packageId);
  writeDb(db);
  return db.payments[paymentId];
}

/** User opened UPI / tapped I've paid — short window for SMS auto-match (low traffic). */
function recordPayIntent({
  userId,
  packageId,
  source,
  amountInr,
  windowMs,
}) {
  const id = String(userId || "").trim();
  const pack = getPackage(packageId);
  if (!id) return { ok: false, error: "Login required" };
  if (!pack) return { ok: false, error: "Invalid package" };
  const db = readDb();
  if (!db.users[id]) return { ok: false, error: "User not found" };
  if (!db.payIntents || typeof db.payIntents !== "object") db.payIntents = {};
  const now = Date.now();
  const src = String(source || "pay").slice(0, 40);
  const existing = db.payIntents[id];
  // Don't clobber an active win-back intent with a full-price pack open
  if (
    existing &&
    existing.source === "winback" &&
    Number(existing.expiresAt || 0) > now &&
    src !== "winback"
  ) {
    return {
      ok: true,
      intent: existing,
      windowMs: Math.max(0, Number(existing.expiresAt) - now),
      preserved: true,
    };
  }
  const amtOverride = Math.round(Number(amountInr));
  const amount =
    Number.isFinite(amtOverride) && amtOverride > 0
      ? amtOverride
      : Math.round(Number(pack.priceInr));
  const ttl =
    Number.isFinite(Number(windowMs)) && Number(windowMs) > 0
      ? Number(windowMs)
      : src === "winback"
        ? WINBACK_INTENT_MS
        : PAY_INTENT_MS;
  db.payIntents[id] = {
    userId: id,
    packageId: pack.id,
    amountInr: amount,
    hours: pack.hours,
    source: src,
    createdAt: now,
    expiresAt: now + ttl,
  };
  writeDb(db);
  return { ok: true, intent: db.payIntents[id], windowMs: ttl };
}

function listActivePayIntents(db, amountInr) {
  if (!db.payIntents || typeof db.payIntents !== "object") return [];
  const now = Date.now();
  let changed = false;
  const active = [];
  for (const uid of Object.keys(db.payIntents)) {
    const intent = db.payIntents[uid];
    if (!intent || Number(intent.expiresAt || 0) < now) {
      delete db.payIntents[uid];
      changed = true;
      continue;
    }
    if (
      amountInr == null ||
      Math.round(Number(intent.amountInr)) === Math.round(Number(amountInr))
    ) {
      active.push(intent);
    }
  }
  if (changed) writeDb(db);
  return active;
}

function listPayments(status) {
  const db = readDb();
  let list = Object.values(db.payments);
  if (status) list = list.filter((p) => p.status === status);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

function approvePayment(paymentId, opts) {
  const options = opts || {};
  const db = readDb();
  const pay = db.payments[paymentId];
  if (!pay) return { ok: false, error: "Payment not found" };
  if (pay.status !== "pending") {
    return { ok: false, error: `Already ${pay.status}` };
  }
  const user = db.users[pay.userId];
  if (!user) return { ok: false, error: "User missing" };

  grantAccessHours(user, Number(pay.hours), Date.now());
  user.hasPaid = true;
  if (user.winbackOffer) delete user.winbackOffer;
  pay.status = "approved";
  pay.reviewedAt = Date.now();
  pay.reviewedBy = String(options.reviewedBy || "admin").slice(0, 40);
  if (options.matchVia) pay.matchVia = String(options.matchVia).slice(0, 40);
  if (options.smsCreditId) pay.smsCreditId = String(options.smsCreditId).slice(0, 40);
  if (options.utr && !pay.utr) pay.utr = normalizeUtr(options.utr);
  markPayFunnelInDb(db, pay.userId, "success", pay.packageId);
  writeDb(db);
  return { ok: true, payment: pay, user: publicUser(user) };
}

/**
 * Admin phone / paste: bank credit SMS → safe auto-approve.
 * Order: UTR → unique ₹+screenshot → unique pay-intent (no shot) → else review/no_match.
 */
function ingestSmsCredit({ smsText, amountInr, utr }) {
  const parsed = parseCreditSms(smsText);
  const amount = Math.round(Number(amountInr != null ? amountInr : parsed.amountInr));
  const ref = normalizeUtr(utr || parsed.utr);
  const body = String(smsText || parsed.raw || "").slice(0, 800);

  if (parsed.isCredit === false && amountInr == null) {
    return {
      ok: true,
      action: "ignored",
      reason: "SMS does not look like a credit",
      parsed,
    };
  }

  // Body fingerprint — stop re-processing the same SMS spam
  const bodyKey =
    "B_" +
    crypto
      .createHash("sha1")
      .update(body.toLowerCase().replace(/\s+/g, " "))
      .digest("hex")
      .slice(0, 20);

  const db = readDb();
  if (!db.smsCredits || typeof db.smsCredits !== "object") db.smsCredits = {};
  if (!db.payIntents || typeof db.payIntents !== "object") db.payIntents = {};

  if (db.smsCredits[bodyKey]) {
    return {
      ok: true,
      action: "duplicate",
      reason: "Same SMS text already processed",
      credit: db.smsCredits[bodyKey],
      parsed: { amountInr: amount, utr: ref, isCredit: !!parsed.isCredit },
    };
  }

  if (ref && db.smsCredits[ref] && db.smsCredits[ref].action === "approve") {
    return {
      ok: true,
      action: "duplicate",
      reason: "This UTR was already used to auto-approve",
      credit: db.smsCredits[ref],
      parsed: { amountInr: amount, utr: ref, isCredit: true },
    };
  }

  const pending = Object.values(db.payments || {}).filter((p) => p.status === "pending");
  const packAmounts = getPackages().map((p) => p.priceInr);
  const s = getSettings();
  if (s.winbackEnabled) {
    const map = s.winbackPricesByPack || {};
    Object.keys(map).forEach(function (k) {
      const n = Math.round(Number(map[k]));
      if (Number.isFinite(n) && n > 0) packAmounts.push(n);
    });
    if (Number(s.winbackPriceInr) > 0) {
      packAmounts.push(Math.round(Number(s.winbackPriceInr)));
    }
  }
  const activeIntents = listActivePayIntents(db, amount);
  const decision = decidePaymentMatch({
    amountInr: amount,
    utr: ref,
    pendingPayments: pending,
    packAmounts,
    activePayIntents: activeIntents,
  });

  const creditId = ref || bodyKey;
  const creditRow = {
    creditId,
    bodyKey,
    amountInr: Number.isFinite(amount) ? amount : null,
    utr: ref || "",
    smsText: body,
    action: decision.action,
    reason: decision.reason,
    paymentId: decision.paymentId || null,
    candidates: decision.candidates || null,
    createdAt: Date.now(),
  };

  function saveCreditAndReturn(payload, dbWrite) {
    const store = dbWrite || readDb();
    if (!store.smsCredits || typeof store.smsCredits !== "object") {
      store.smsCredits = {};
    }
    store.smsCredits[creditId] = creditRow;
    if (bodyKey && bodyKey !== creditId) {
      store.smsCredits[bodyKey] = creditRow;
    }
    writeDb(store);
    return payload;
  }

  if (decision.action === "approve" && decision.paymentId) {
    const approved = approvePayment(decision.paymentId, {
      reviewedBy: "sms-auto",
      matchVia: decision.matchVia || "sms",
      smsCreditId: creditId,
      utr: ref,
    });
    const dbAfter = readDb();
    if (!approved.ok) {
      creditRow.action = "needs_review";
      creditRow.reason = approved.error || "Approve failed";
      return saveCreditAndReturn(
        {
          ok: false,
          action: "needs_review",
          reason: creditRow.reason,
          credit: creditRow,
          parsed: { amountInr: amount, utr: ref, isCredit: true },
        },
        dbAfter
      );
    }
    if (dbAfter.payIntents && approved.payment && approved.payment.userId) {
      delete dbAfter.payIntents[approved.payment.userId];
    }
    creditRow.action = "approve";
    creditRow.paymentId = decision.paymentId;
    creditRow.userId = approved.payment.userId;
    creditRow.hours = approved.payment.hours;
    return saveCreditAndReturn(
      {
        ok: true,
        action: "approve",
        reason: decision.reason,
        payment: approved.payment,
        user: approved.user,
        credit: creditRow,
        parsed: { amountInr: amount, utr: ref, isCredit: true },
      },
      dbAfter
    );
  }

  if (decision.action === "approve_intent" && decision.intent) {
    const intent = decision.intent;
    let payment;
    try {
      payment = submitPayment({
        userId: intent.userId,
        packageId: intent.packageId,
        upiNote: intent.userId,
        utr: ref,
        skipScreenshot: true,
        amountInr: intent.amountInr,
      });
    } catch (e) {
      creditRow.action = "needs_review";
      creditRow.reason = e.message || "Could not create payment from intent";
      return saveCreditAndReturn({
        ok: false,
        action: "needs_review",
        reason: creditRow.reason,
        credit: creditRow,
        parsed: { amountInr: amount, utr: ref, isCredit: true },
      });
    }
    const approved = approvePayment(payment.paymentId, {
      reviewedBy: "sms-auto",
      matchVia: "pay_intent",
      smsCreditId: creditId,
      utr: ref,
    });
    const dbAfter = readDb();
    if (dbAfter.payIntents) delete dbAfter.payIntents[intent.userId];
    if (!approved.ok) {
      creditRow.action = "needs_review";
      creditRow.reason = approved.error || "Approve failed after intent";
      creditRow.paymentId = payment.paymentId;
      return saveCreditAndReturn(
        {
          ok: false,
          action: "needs_review",
          reason: creditRow.reason,
          credit: creditRow,
          parsed: { amountInr: amount, utr: ref, isCredit: true },
        },
        dbAfter
      );
    }
    creditRow.action = "approve";
    creditRow.paymentId = payment.paymentId;
    creditRow.userId = intent.userId;
    creditRow.hours = intent.hours;
    creditRow.matchVia = "pay_intent";
    return saveCreditAndReturn(
      {
        ok: true,
        action: "approve",
        reason: decision.reason,
        payment: approved.payment,
        user: approved.user,
        credit: creditRow,
        parsed: { amountInr: amount, utr: ref, isCredit: true },
      },
      dbAfter
    );
  }

  return saveCreditAndReturn(
    {
      ok: true,
      action: decision.action,
      reason: decision.reason,
      candidates: decision.candidates || null,
      credit: creditRow,
      parsed: { amountInr: amount, utr: ref, isCredit: true },
    },
    db
  );
}

function listSmsCredits(limit) {
  const db = readDb();
  const list = Object.values(db.smsCredits || {});
  return list
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, Math.min(100, Number(limit) || 40));
}

/** Compact feed for admin Android app notifications (poll since timestamp). */
function getAdminAlerts(sinceMs) {
  const since = Math.max(0, Number(sinceMs) || 0);
  const db = readDb();
  const now = Date.now();

  const newUsers = Object.values(db.users || {})
    .filter((u) => Number(u.createdAt || 0) > since)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 30)
    .map((u) => ({
      type: "new_user",
      userId: u.userId,
      createdAt: u.createdAt,
      title: "New user " + u.userId,
      body: "Registered · PIN saved on their browser",
    }));

  const newPayments = Object.values(db.payments || {})
    .filter((p) => Number(p.createdAt || 0) > since)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 40)
    .map((p) => ({
      type: p.status === "pending" ? "pending_payment" : "payment_" + p.status,
      paymentId: p.paymentId,
      userId: p.userId,
      amountInr: p.amountInr,
      status: p.status,
      createdAt: p.createdAt,
      title:
        p.status === "pending"
          ? "Pending pay ₹" + p.amountInr
          : "Payment " + p.status + " ₹" + p.amountInr,
      body: "User " + p.userId + " · " + (p.packageId || ""),
    }));

  const support = Object.values(db.supportThreads || {})
    .filter((t) => Number(t.updatedAt || 0) > since && t.needsAdmin)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 30)
    .map((t) => {
      const msgs = t.messages || [];
      const last = msgs[msgs.length - 1];
      return {
        type: "support",
        userId: t.userId,
        createdAt: t.updatedAt,
        title: "Support from " + t.userId,
        body: String(
          (last && last.text) || (last && last.screenshotUrl ? "[screenshot]" : "New message")
        ).slice(0, 120),
      };
    });

  const smsAuto = Object.values(db.smsCredits || {})
    .filter((c) => Number(c.createdAt || 0) > since && c.action === "approve")
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 20)
    .map((c) => ({
      type: "sms_auto_approve",
      userId: c.userId,
      paymentId: c.paymentId,
      amountInr: c.amountInr,
      createdAt: c.createdAt,
      title: "SMS auto-unlocked ₹" + (c.amountInr || ""),
      body: "User " + (c.userId || "?") + " · " + (c.reason || "approved"),
    }));

  const alerts = []
    .concat(newUsers, newPayments, support, smsAuto)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

  return {
    since: since,
    serverTime: now,
    count: alerts.length,
    alerts: alerts,
    summary: {
      newUsers: newUsers.length,
      payments: newPayments.length,
      support: support.length,
      smsAuto: smsAuto.length,
    },
  };
}

function rejectPayment(paymentId, reason) {
  const db = readDb();
  const pay = db.payments[paymentId];
  if (!pay) return { ok: false, error: "Payment not found" };
  if (pay.status !== "pending") {
    return { ok: false, error: `Already ${pay.status}` };
  }
  pay.status = "rejected";
  pay.rejectReason = String(reason || "").slice(0, 200);
  pay.reviewedAt = Date.now();
  pay.reviewedBy = "admin";
  writeDb(db);
  return { ok: true, payment: pay };
}

function extractBriefFromSetup(rpSetup) {
  const s = String(rpSetup || "");
  const m =
    s.match(/USER RP BRIEF[^:\n]*:\s*([^\n]+)/i) ||
    s.match(/Place:\s*([^\n]+)/i);
  if (!m) return "";
  let brief = m[1]
    .trim()
    .replace(
      /\.\s*(Start vibe|Pace|Resistance|All adults|Scene rule|ACTIVE MOOD|Identity lock|Default shy).*/i,
      ""
    )
    .trim();
  if (!brief || /^none\b/i.test(brief)) return "";
  return brief.slice(0, 200);
}

function extractMoodFromSetup(rpSetup) {
  const m = String(rpSetup || "").match(/ACTIVE MOOD:\s*([^\n.]+)/i);
  return m ? m[1].trim().slice(0, 80) : "";
}

function listUsers() {
  settleStaleSessions();
  const db = readDb();
  if (purgeExpiredChats(db)) writeDb(db);
  const payments = Object.values(db.payments || {});
  const now = Date.now();
  let listMigrated = false;
  const rows = Object.values(db.users || {})
    .map((u) => {
      const mine = payments.filter((p) => p.userId === u.userId);
      const isLegacy = !/^\d{4}$/.test(String(u.userId || ""));
      const sessions = collectUserSessions(db, u.userId);
      const live = db.chats && db.chats[u.userId];
      const archives = normalizeArchiveList(
        db.chatArchive && db.chatArchive[u.userId]
      );
      let chatMsgCount = 0;
      let latestSession = null;
      for (const item of sessions) {
        const n = visibleChatMessages(item.session && item.session.history).length;
        chatMsgCount += n;
        if (!latestSession) latestSession = item.session;
      }
      const session = latestSession;
      const charName =
        (session && session.form && session.form.characterName) ||
        (session && session.selectedCharacter && session.selectedCharacter.name) ||
        "";
      const botRole =
        (session && session.form && session.form.botRole) || "";
      // Trial + paid: same wall clock — left only while accessExpiresAt > now
      if (migrateUserAccess(u, now)) listMigrated = true;
      else syncHoursBalanceFromExpiry(u, now);
      const hoursLive = liveHoursBalance(u, now);
      const expAt = Number(u.accessExpiresAt) || 0;
      const reallyOnline =
        !!u.sessionActive &&
        !!u.lastTickAt &&
        now - Number(u.lastTickAt) <= STALE_SESSION_MS;
      const appOpen =
        !!u.lastSeenAt && now - Number(u.lastSeenAt) <= STALE_SESSION_MS;
      const supportThread = db.supportThreads && db.supportThreads[u.userId];
      const supportUnseen = supportThread
        ? (supportThread.messages || []).filter(function (m) {
            return m.from === "admin" && !m.seenByUserAt;
          }).length
        : 0;
      return {
        userId: u.userId,
        pin: u.pinPlain || null,
        isLegacy,
        needsFourDigit: isLegacy,
        hoursBalance: hoursLive,
        accessExpiresAt: expAt > now ? expAt : 0,
        timeEnded: hoursLive <= 0.0001,
        hasPaid: !!u.hasPaid,
        sessionActive: reallyOnline,
        appOpen: appOpen,
        createdAt: u.createdAt,
        lastTickAt: u.lastTickAt || null,
        lastSeenAt: u.lastSeenAt || null,
        pendingPayments: mine.filter((p) => p.status === "pending").length,
        approvedPayments: mine.filter((p) => p.status === "approved").length,
        rejectedPayments: mine.filter((p) => p.status === "rejected").length,
        chatMsgCount,
        chatSessionCount: sessions.length,
        chatLive: !!live,
        chatArchived: archives.length > 0,
        characterName: String(charName || "").slice(0, 40),
        botRole: String(botRole || "").slice(0, 40),
        userRole: String(
          (session && session.form && session.form.userRole) || ""
        ).slice(0, 40),
        sceneNote: String(
          (session && session.form && session.form.note) ||
            extractBriefFromSetup(session && session.rpSetup) ||
            ""
        ).slice(0, 160),
        resistance: String(
          (session && session.form && session.form.resistance) || ""
        ).slice(0, 20),
        vibe: String((session && session.form && session.form.vibe) || "").slice(
          0,
          40
        ),
        activeMood: String(extractMoodFromSetup(session && session.rpSetup) || "").slice(
          0,
          40
        ),
        chatUpdatedAt: (session && (session.updatedAt || session.archivedAt)) || null,
        supportUnseen: supportUnseen,
        supportAwaitingUser: supportUnseen > 0,
        storyModeFreeUsed: Math.max(
          0,
          Math.round(Number(u.storyModeFreeUsed) || 0)
        ),
        storyModeFreeLimit: STORY_MODE_FREE_USES,
        storyModeTotalUses: Math.max(
          0,
          Math.round(Number(u.storyModeTotalUses) || 0)
        ),
        storyModeLastAt: u.storyModeLastAt || null,
        photoLookCount: (u.photoLooks && u.photoLooks.length) || 0,
        photoBonus: Math.max(0, Math.round(Number(u.photoBonus) || 0)),
        photoUsedHour: photoUsageOf(u, now).usedHour,
        photoCap: PHOTO_MAX_PER_HOUR,
        photoCreditRequested: !!(
          Number(u.photoCreditRequestedAt) &&
          now - Number(u.photoCreditRequestedAt) < 24 * 60 * 60 * 1000
        ),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  if (listMigrated) writeDb(db);
  return rows;
}

const PHOTO_MAX_PER_HOUR = 25;
const PHOTO_LOOK_KEEP_MS = 5 * 24 * 60 * 60 * 1000;
const PHOTO_LOOK_MAX = 80;
const PHOTO_CREDIT_REQUEST_COOLDOWN_MS = 20 * 60 * 1000;

function prunePhotoState(user, now) {
  if (!user) return;
  const t = Number(now) || Date.now();
  user.photoHits = (user.photoHits || []).filter(function (hit) {
    return t - Number(hit) < 60 * 60 * 1000;
  });
  user.photoLooks = (user.photoLooks || []).filter(function (look) {
    return look && t - Number(look.createdAt || 0) < PHOTO_LOOK_KEEP_MS;
  });
  if (user.photoLooks.length > PHOTO_LOOK_MAX) {
    user.photoLooks = user.photoLooks.slice(-PHOTO_LOOK_MAX);
  }
  user.photoBonus = Math.max(0, Math.round(Number(user.photoBonus) || 0));
}

function photoUsageOf(user, now) {
  prunePhotoState(user, now);
  return {
    usedHour: (user && user.photoHits ? user.photoHits.length : 0),
    cap: PHOTO_MAX_PER_HOUR,
    bonus: user ? user.photoBonus : 0,
    lookCount: user && user.photoLooks ? user.photoLooks.length : 0,
  };
}

function canGeneratePhoto(userId) {
  const id = String(userId || "").trim();
  const db = readDb();
  const user = db.users && db.users[id];
  if (!user) return { ok: false, error: "User not found", code: "AUTH" };
  const snap = photoUsageOf(user, Date.now());
  if (snap.usedHour < snap.cap) {
    return { ok: true, useBonus: false, ...snap };
  }
  if (snap.bonus > 0) {
    return { ok: true, useBonus: true, ...snap };
  }
  return {
    ok: false,
    code: "RATE",
    error: "Slow down — too many photo looks this hour",
    ...snap,
  };
}

function recordPhotoLook(userId, look, useBonus) {
  const id = String(userId || "").trim();
  const db = readDb();
  const user = db.users && db.users[id];
  if (!user) return { ok: false, error: "User not found" };
  const now = Date.now();
  prunePhotoState(user, now);
  if (useBonus && user.photoBonus > 0) {
    user.photoBonus -= 1;
  } else {
    user.photoHits.push(now);
  }
  user.photoLooks = user.photoLooks || [];
  user.photoLooks.push({
    id: randomId("PH", 8),
    url: String((look && look.url) || "").slice(0, 240),
    prompt: String((look && look.prompt) || "").slice(0, 400),
    caption: String((look && look.caption) || "").slice(0, 120),
    iterate: !!(look && look.iterate),
    createdAt: now,
  });
  if (user.photoLooks.length > PHOTO_LOOK_MAX) {
    user.photoLooks = user.photoLooks.slice(-PHOTO_LOOK_MAX);
  }
  writeDb(db);
  return { ok: true, ...photoUsageOf(user, now) };
}

function addGeneratedUrlOwner(map, url, userId) {
  const raw = String(url || "")
    .split("?")[0]
    .replace(/\\/g, "/");
  const name = path.basename(raw);
  if (!/^[df][a-f0-9]{16,}\.(jpg|jpeg|png|webp)$/i.test(name)) return;
  if (userId) map[name] = String(userId);
}

function listPhotoFileOwners() {
  const db = readDb();
  const map = {};
  const users = db.users || {};
  Object.keys(users).forEach(function (id) {
    (users[id].photoLooks || []).forEach(function (look) {
      addGeneratedUrlOwner(map, look && look.url, id);
    });
  });
  const chats = db.chats || {};
  Object.keys(chats).forEach(function (id) {
    const session = chats[id] || {};
    const dress = session.lastDress || {};
    addGeneratedUrlOwner(map, dress.url, id);
    addGeneratedUrlOwner(map, dress.identityUrl, id);
    (session.history || []).forEach(function (m) {
      addGeneratedUrlOwner(map, m && m.imageUrl, id);
    });
  });
  return map;
}

function getUserPhotosAdmin(userId) {
  const id = String(userId || "").trim();
  const db = readDb();
  const user = db.users && db.users[id];
  if (!user) return { ok: false, error: "User not found" };
  const now = Date.now();
  prunePhotoState(user, now);
  return {
    ok: true,
    userId: id,
    looks: (user.photoLooks || []).slice().reverse(),
    usage: photoUsageOf(user, now),
    keepDays: 5,
    creditRequestedAt: Number(user.photoCreditRequestedAt) || 0,
  };
}

function adminAddPhotoCredits(userId, amount) {
  const db = readDb();
  const id = String(userId || "").trim();
  const user = db.users && db.users[id];
  if (!user) return { ok: false, error: "User not found" };
  const add = Math.round(Number(amount));
  if (!Number.isFinite(add) || add === 0) {
    return { ok: false, error: "Invalid photo credit amount" };
  }
  prunePhotoState(user, Date.now());
  user.photoBonus = Math.max(0, (user.photoBonus || 0) + add);
  writeDb(db);
  const snap = photoUsageOf(getUser(id) || user, Date.now());
  try {
    addSupportMessage({
      userId: id,
      from: "admin",
      text:
        add > 0
          ? "Extra photo looks added (+" +
            add +
            "). You now have " +
            snap.bonus +
            " extra look" +
            (snap.bonus === 1 ? "" : "s") +
            " beyond the " +
            PHOTO_MAX_PER_HOUR +
            "/hour cap. Open Photos to continue."
          : "Photo extra looks adjusted. Extra remaining: " + snap.bonus + ".",
    });
  } catch (_) {
    /* non-fatal */
  }
  return {
    ok: true,
    user: publicUser(getUser(id) || user),
    usage: snap,
    supportPopup: getSupportPopupForUser(id),
  };
}

function requestPhotoCredits(userId) {
  const id = String(userId || "").trim();
  const db = readDb();
  const user = db.users && db.users[id];
  if (!user) return { ok: false, error: "User not found" };
  const now = Date.now();
  prunePhotoState(user, now);
  const last = Number(user.photoCreditRequestedAt) || 0;
  if (last && now - last < PHOTO_CREDIT_REQUEST_COOLDOWN_MS) {
    const waitMin = Math.max(
      1,
      Math.ceil((PHOTO_CREDIT_REQUEST_COOLDOWN_MS - (now - last)) / 60000)
    );
    return {
      ok: true,
      already: true,
      usage: photoUsageOf(user, now),
      error:
        "Already asked admin. Wait about " + waitMin + " min, or buy more time.",
    };
  }
  const snap = photoUsageOf(user, now);
  user.photoCreditRequestedAt = now;
  writeDb(db);
  const result = addSupportMessage({
    userId: id,
    from: "user",
    text:
      "[PHOTO_CREDITS] Used " +
      snap.usedHour +
      "/" +
      snap.cap +
      " photo looks this hour. Extra left: " +
      snap.bonus +
      ". Please add more photo credits.",
  });
  if (!result.ok) return result;
  return { ok: true, already: false, usage: snap, thread: result.thread };
}

/** Admin: live + archived chats kept for CHAT_RETENTION_MS (5 days). */
function getChatSessionAdmin(userId) {
  const db = readDb();
  if (purgeExpiredChats(db)) writeDb(db);
  const sessions = collectUserSessions(db, userId);
  const primary = sessions[0] || null;
  return {
    session: primary ? primary.session : null,
    source: primary ? primary.source : null,
    sessions,
    keepDays: 5,
  };
}

function adminAddHours(userId, hours) {
  const db = readDb();
  const id = String(userId || "").trim();
  const user = db.users[id];
  if (!user) return { ok: false, error: "User not found" };
  const add = Number(hours);
  if (!Number.isFinite(add) || add === 0) {
    return { ok: false, error: "Invalid hours" };
  }
  grantAccessHours(user, add, Date.now());
  if (add > 0 && user.winbackOffer) delete user.winbackOffer;
  writeDb(db);

  const pub = publicUser(user);
  const clock = formatClock(Math.floor(Number(pub.hoursBalance || 0) * 3600));
  const addLabel =
    add >= 24
      ? Math.round(add / 24) + " day" + (Math.round(add / 24) === 1 ? "" : "s")
      : add >= 1
        ? add + " hour" + (add === 1 ? "" : "s")
        : Math.round(add * 60) + " min";
  try {
    addSupportMessage({
      userId: id,
      from: "admin",
      text:
        "Time increased (+" +
        addLabel +
        "). You now have " +
        clock +
        " left. Continue your chat.",
    });
  } catch (_) {
    /* non-fatal */
  }

  return {
    ok: true,
    user: publicUser(getUser(id) || user),
    supportPopup: getSupportPopupForUser(id),
  };
}

function adminSetHours(userId, hours) {
  const db = readDb();
  const id = String(userId || "").trim();
  const user = db.users[id];
  if (!user) return { ok: false, error: "User not found" };
  const val = Number(hours);
  if (!Number.isFinite(val) || val < 0) {
    return { ok: false, error: "Invalid hours" };
  }
  const prevHours = liveHoursBalance(user, Date.now());
  setAccessHours(user, val, Date.now());
  writeDb(db);

  const pub = publicUser(user);
  if (val > prevHours + 2 / 3600) {
    const clock = formatClock(Math.floor(Number(pub.hoursBalance || 0) * 3600));
    try {
      addSupportMessage({
        userId: id,
        from: "admin",
        text:
          "Time updated. You now have " +
          clock +
          " left. Continue your chat.",
      });
    } catch (_) {
      /* non-fatal */
    }
  }

  return {
    ok: true,
    user: publicUser(getUser(id) || user),
    chatCleared: false,
    supportPopup: getSupportPopupForUser(id),
  };
}

function adminResetPin(userId) {
  const db = readDb();
  const id = String(userId || "").trim();
  const user = db.users[id];
  if (!user) return { ok: false, error: "User not found" };

  let pin;
  do {
    pin = String(crypto.randomInt(1000, 10000));
  } while (pin === id);

  const salt = crypto.randomBytes(8).toString("hex");
  user.pinSalt = salt;
  user.pinHash = hashPin(pin, salt);
  user.pinPlain = pin;
  writeDb(db);
  return { ok: true, userId: id, pin };
}

/** Convert old USR_xxx id → unique 4-digit id (keeps hours + payments) */
function adminMigrateToFourDigit(userId) {
  const db = readDb();
  const oldId = String(userId || "").trim();
  const user = db.users[oldId];
  if (!user) return { ok: false, error: "User not found" };
  if (/^\d{4}$/.test(oldId)) {
    return { ok: false, error: "Already a 4-digit ID" };
  }

  const newId = generateUniqueUserId(db);
  let pin = user.pinPlain;
  if (!pin) {
    do {
      pin = String(crypto.randomInt(1000, 10000));
    } while (pin === newId);
  }
  const salt = crypto.randomBytes(8).toString("hex");

  db.users[newId] = {
    ...user,
    userId: newId,
    pinSalt: salt,
    pinHash: hashPin(pin, salt),
    pinPlain: pin,
    migratedFrom: oldId,
  };
  delete db.users[oldId];

  Object.values(db.payments || {}).forEach((p) => {
    if (p.userId === oldId) p.userId = newId;
  });
  Object.values(db.tokens || {}).forEach((t) => {
    if (t.userId === oldId) t.userId = newId;
  });

  writeDb(db);
  return { ok: true, oldId, userId: newId, pin };
}

const MAX_CHAT_MESSAGES = 40;
const MAX_MSG_CHARS = 3500;

function saveChatSession(userId, session) {
  const db = readDb();
  purgeExpiredChats(db);
  const user = db.users[userId];
  if (!user) return { ok: false, error: "User not found" };
  // Allow saving even at 0 hours so the paused scene stays for pay-to-continue
  if (!db.chats) db.chats = {};

  const history = Array.isArray(session?.history) ? session.history : [];
  const cleanHistory = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-MAX_CHAT_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, MAX_MSG_CHARS),
    }));

  const prev = db.chats[userId];
  if (prev && visibleChatMessages(prev.history).length > 0) {
    const prevSetup = String(prev.rpSetup || "");
    const nextSetup = String(session?.rpSetup || "");
    const setupChanged = prevSetup && nextSetup && prevSetup !== nextSetup;
    const resetLike =
      cleanHistory.length <= 3 &&
      visibleChatMessages(prev.history).length > 5;
    if (setupChanged || resetLike) {
      pushChatToArchive(db, userId, prev);
    }
  }

  const hoursLeft = Number(user.hoursBalance || 0);
  db.chats[userId] = {
    updatedAt: Date.now(),
    // Soft hint only; paused (0h) chats keep retention window, not instant expiry
    expiresAt:
      hoursLeft > 0.0001
        ? Date.now() + Math.ceil(hoursLeft * 3600000)
        : Date.now() + CHAT_RETENTION_MS,
    setupLocked: !!session?.setupLocked,
    rpSetup: String(session?.rpSetup || "").slice(0, 2500),
    chatSource: String(session?.chatSource || "maa").slice(0, 20),
    form: session?.form && typeof session.form === "object" ? session.form : {},
    selectedCharacter: session?.selectedCharacter || null,
    history: cleanHistory,
  };
  writeDb(db);
  return { ok: true, session: db.chats[userId] };
}

function getChatSession(userId) {
  const db = readDb();
  if (purgeExpiredChats(db)) writeDb(db);
  const user = db.users[userId];
  if (!user) return null;
  // Return live chat even at 0 hours (paused until they pay)
  const session = (db.chats && db.chats[userId]) || null;
  return session || null;
}

function clearChatSession(userId) {
  const db = readDb();
  if (db.chats && db.chats[userId]) {
    wipeChatInDb(db, userId);
    writeDb(db);
  }
  return { ok: true };
}

/** Hard-delete live + archived chats (no 5-day keep). Frees store space. */
function adminDeleteUserChats(userId) {
  const db = readDb();
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "User ID required" };
  let removed = 0;
  if (db.chats && db.chats[id]) {
    delete db.chats[id];
    removed += 1;
  }
  if (db.chatArchive && db.chatArchive[id]) {
    const n = normalizeArchiveList(db.chatArchive[id]).length;
    removed += n;
    delete db.chatArchive[id];
  }
  purgeExpiredChats(db);
  writeDb(db);
  return { ok: true, userId: id, removedSessions: removed };
}

function tryUnlinkUpload(urlPath) {
  try {
    const rel = String(urlPath || "");
    if (!rel.startsWith("/payment-uploads/")) return;
    const name = path.basename(rel);
    if (!name || name === "." || name === "..") return;
    const full = path.join(UPLOAD_DIR, name);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) {
    /* ignore file errors */
  }
}

function tryUnlinkSupportUpload(urlPath) {
  try {
    const rel = String(urlPath || "");
    if (!rel.startsWith("/support-uploads/")) return;
    const name = path.basename(rel);
    if (!name || name === "." || name === "..") return;
    const full = path.join(SUPPORT_UPLOAD_DIR, name);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) {
    /* ignore file errors */
  }
}

/** Wipe every store object keyed to this user (support, notices, reports, intents, SMS). */
function purgeUserRelatedData(db, userId) {
  const id = String(userId || "").trim();
  if (!id) return;

  if (db.supportThreads && db.supportThreads[id]) {
    const msgs = db.supportThreads[id].messages || [];
    for (const m of msgs) {
      if (m && m.screenshotUrl) tryUnlinkSupportUpload(m.screenshotUrl);
    }
    delete db.supportThreads[id];
  }

  if (db.adminNotices) {
    for (const nid of Object.keys(db.adminNotices)) {
      const n = db.adminNotices[nid];
      if (n && String(n.userId || "") === id) delete db.adminNotices[nid];
    }
  }

  if (db.aiReports) {
    for (const rid of Object.keys(db.aiReports)) {
      const r = db.aiReports[rid];
      if (r && String(r.userId || "") === id) delete db.aiReports[rid];
    }
  }

  if (db.payIntents && db.payIntents[id]) {
    delete db.payIntents[id];
  }

  if (db.payFunnels && db.payFunnels[id]) {
    delete db.payFunnels[id];
  }

  if (db.smsCredits) {
    for (const cid of Object.keys(db.smsCredits)) {
      const c = db.smsCredits[cid];
      if (c && String(c.userId || "") === id) delete db.smsCredits[cid];
    }
  }
}

/** Delete account + chats + tokens + payments + support + reports + notices. */
function adminDeleteUser(userId) {
  const db = readDb();
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "User ID required" };
  if (!db.users || !db.users[id]) {
    return { ok: false, error: "User not found" };
  }

  delete db.users[id];

  if (db.chats && db.chats[id]) delete db.chats[id];
  if (db.chatArchive && db.chatArchive[id]) delete db.chatArchive[id];

  let paymentsRemoved = 0;
  if (db.payments) {
    for (const payId of Object.keys(db.payments)) {
      const p = db.payments[payId];
      if (p && p.userId === id) {
        tryUnlinkUpload(p.screenshotUrl);
        delete db.payments[payId];
        paymentsRemoved += 1;
      }
    }
  }

  let tokensRemoved = 0;
  if (db.tokens) {
    for (const tok of Object.keys(db.tokens)) {
      const t = db.tokens[tok];
      if (t && t.userId === id) {
        delete db.tokens[tok];
        tokensRemoved += 1;
      }
    }
  }

  // Device gate entries that only pointed at this user
  if (db.devices) {
    for (const did of Object.keys(db.devices)) {
      const d = db.devices[did];
      if (d && d.userId === id) delete db.devices[did];
    }
  }

  purgeUserRelatedData(db, id);

  purgeExpiredChats(db);
  writeDb(db);
  return {
    ok: true,
    userId: id,
    paymentsRemoved,
    tokensRemoved,
  };
}

/** Drop all chats older than retention (5 days). */
function adminPurgeOldChats() {
  const db = readDb();
  const beforeChats = Object.keys(db.chats || {}).length;
  let beforeArch = 0;
  for (const id of Object.keys(db.chatArchive || {})) {
    beforeArch += normalizeArchiveList(db.chatArchive[id]).length;
  }
  purgeExpiredChats(db);
  const afterChats = Object.keys(db.chats || {}).length;
  let afterArch = 0;
  for (const id of Object.keys(db.chatArchive || {})) {
    afterArch += normalizeArchiveList(db.chatArchive[id]).length;
  }
  writeDb(db);
  return {
    ok: true,
    removedLive: Math.max(0, beforeChats - afterChats),
    removedArchived: Math.max(0, beforeArch - afterArch),
    keepDays: 5,
  };
}

const MAX_AI_REPORTS = 800;

function submitAiReport(payload) {
  const db = readDb();
  if (!db.aiReports) db.aiReports = {};
  const userId = String(payload.userId || "").trim();
  if (!userId) return { ok: false, error: "Login required" };

  const aiMessage = String(payload.aiMessage || "").trim().slice(0, 8000);
  if (!aiMessage) return { ok: false, error: "Nothing to report" };

  const reason = String(payload.reason || "bad reply").trim().slice(0, 80);
  const note = String(payload.note || "").trim().slice(0, 500);
  const context = Array.isArray(payload.context)
    ? payload.context
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
        .slice(-12)
        .map((m) => ({
          role: m.role,
          content: String(m.content).slice(0, 3500),
        }))
    : [];

  const reportId = randomId("RPT", 8);
  db.aiReports[reportId] = {
    reportId,
    userId,
    reason,
    note,
    aiMessage,
    context,
    setup: String(payload.setup || "").slice(0, 2500),
    characterName: String(payload.characterName || "").slice(0, 40),
    botRole: String(payload.botRole || "").slice(0, 40),
    userRole: String(payload.userRole || "").slice(0, 40),
    botGender: String(payload.botGender || "").slice(0, 12),
    userGender: String(payload.userGender || "").slice(0, 12),
    createdAt: Date.now(),
  };

  // Cap storage — drop oldest
  const all = Object.values(db.aiReports).sort((a, b) => a.createdAt - b.createdAt);
  if (all.length > MAX_AI_REPORTS) {
    for (let i = 0; i < all.length - MAX_AI_REPORTS; i++) {
      delete db.aiReports[all[i].reportId];
    }
  }

  writeDb(db);
  return { ok: true, reportId };
}

function listAiReports() {
  const db = readDb();
  return Object.values(db.aiReports || {}).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Aggregate recent AI reports into actionable themes for prompts + admin UI.
 */
function getAiReportDigest(options = {}) {
  const days = Math.min(30, Math.max(1, Number(options.days) || 7));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const reports = listAiReports().filter(
    (r) => Number(r.createdAt || 0) >= since
  );

  const themeDefs = [
    {
      id: "ignored-line",
      label: "ignored last message / off-topic",
      re: /(ignore|off.?topic|not.?answer|galat.?jawab|irrelevant|kitchen|weather|padhai|same.?hello)/i,
      hint: "MUST react to the user's latest line first; never pivot to kitchen/padhai/weather off their ask",
    },
    {
      id: "stock-opener",
      label: "stock / repetitive opener",
      re: /(repeat|same|stock|template|aankh|pallu|chehra|boring|har.?baar)/i,
      hint: "Vary openers for every role; ban aankhein-phat / pallu / Main-teri-X-hoon stock essays",
    },
    {
      id: "wrong-role",
      label: "wrong role / address / gender",
      re: /(wrong.?role|bahu|damad|gender|address|rishta|samjhi|papa.?ji|mummy.?ji)/i,
      hint: "Keep correct rishta address and gender verbs every line (Saas≠bahu for damad, etc.)",
    },
    {
      id: "too-fast",
      label: "too fast / instant sex",
      re: /(too.?fast|instant|jaldi|easy|no.?resist|theek.?hai.?aaja|ready)/i,
      hint: "Respect Resistance: dirty talk OK early, but no instant body-yes / Theek-hai-aaja",
    },
    {
      id: "amnesia",
      label: "forgot scene / amnesia",
      re: /(forget|forgot|amnesia|continuity|scene|yaad|pehli.?baar|rewind)/i,
      hint: "Honor ESTABLISHED place/clothes/acts; never rewind mid-scene facts",
    },
    {
      id: "english-essay",
      label: "English / essay / fake voice",
      re: /(english|essay|awkward|uncomfortable|weird|robot|ai|fake)/i,
      hint: "Stay short desi WhatsApp Hinglish; no English filler (awkward/weird/suddenly)",
    },
  ];

  const themes = themeDefs
    .map(function (def) {
      const matched = reports.filter(function (r) {
        const blob = [r.reason, r.note, r.aiMessage].join(" ");
        return def.re.test(blob);
      });
      return {
        id: def.id,
        label: def.label,
        hint: def.hint,
        count: matched.length,
      };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Always include top universal hints so voice stays sharp even with few reports
  if (!themes.length) {
    themes.push(
      {
        id: "ignored-line",
        label: "stay on last line",
        hint: "MUST react to the user's latest line first; never pivot to kitchen/padhai/weather off their ask",
        count: 0,
      },
      {
        id: "stock-opener",
        label: "vary openers",
        hint: "Vary openers for every role; ban aankhein-phat / pallu / Main-teri-X-hoon stock essays",
        count: 0,
      }
    );
  }

  const byRole = {};
  reports.forEach(function (r) {
    const role = String(r.botRole || "unknown").toLowerCase() || "unknown";
    byRole[role] = (byRole[role] || 0) + 1;
  });

  return {
    days,
    total: reports.length,
    themes,
    byRole: Object.keys(byRole)
      .map(function (k) {
        return { role: k, count: byRole[k] };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    topNotes: reports
      .filter((r) => r.note)
      .slice(0, 8)
      .map(function (r) {
        return {
          reason: r.reason,
          note: String(r.note).slice(0, 120),
          botRole: r.botRole,
          createdAt: r.createdAt,
        };
      }),
  };
}

function clearAiReports() {
  const db = readDb();
  const n = Object.keys(db.aiReports || {}).length;
  db.aiReports = {};
  writeDb(db);
  return { ok: true, cleared: n };
}

function saveSupportScreenshot(base64Data, userId) {
  ensureDirs();
  const raw = String(base64Data || "");
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const b64 = m ? m[2] : raw.includes(",") ? raw.split(",").pop() : raw;
  const mime = m ? m[1] : "image/jpeg";
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > 4.5 * 1024 * 1024) {
    throw new Error("Screenshot invalid or too large (max ~4MB)");
  }
  const filename = `${userId}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(SUPPORT_UPLOAD_DIR, filename), buf);
  return `/support-uploads/${filename}`;
}

function getOrCreateSupportThread(db, userId) {
  if (!db.supportThreads) db.supportThreads = {};
  const id = String(userId || "").trim();
  if (!db.supportThreads[id]) {
    db.supportThreads[id] = {
      userId: id,
      status: "open",
      updatedAt: Date.now(),
      messages: [],
    };
  }
  return db.supportThreads[id];
}

function publicSupportThread(thread) {
  if (!thread) {
    return {
      userId: "",
      status: "open",
      updatedAt: null,
      awaitingUserSeen: false,
      messages: [],
    };
  }
  return {
    userId: thread.userId,
    status: thread.status || "open",
    updatedAt: thread.updatedAt || null,
    awaitingUserSeen: !!thread.awaitingUserSeen,
    messages: (thread.messages || []).map(function (m) {
      return {
        id: m.id,
        from: m.from,
        text: m.text || "",
        screenshotUrl: m.screenshotUrl || null,
        createdAt: m.createdAt,
        seenByUserAt: m.seenByUserAt || null,
        notifyUser: !!m.notifyUser,
      };
    }),
  };
}

function getSupportThread(userId) {
  const db = readDb();
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "Login required" };
  if (!db.users[id]) return { ok: false, error: "User not found" };
  if (!db.supportThreads || !db.supportThreads[id]) {
    return {
      ok: true,
      thread: { userId: id, status: "open", updatedAt: null, messages: [] },
    };
  }
  return { ok: true, thread: publicSupportThread(db.supportThreads[id]) };
}

function addSupportMessage({ userId, from, text, screenshotBase64, screenshotUrl }) {
  const id = String(userId || "").trim();
  const role = from === "admin" ? "admin" : "user";
  const body = String(text || "").trim().slice(0, 2000);
  if (!id) return { ok: false, error: "User ID required" };
  let shotUrl = null;
  if (screenshotUrl && String(screenshotUrl).trim()) {
    shotUrl = String(screenshotUrl).trim().slice(0, 240);
  }
  if (!body && !screenshotBase64 && !shotUrl) {
    return { ok: false, error: "Write a message or add a screenshot" };
  }

  const db = readDb();
  if (!db.users[id]) return { ok: false, error: "User not found" };

  if (!shotUrl && screenshotBase64) {
    try {
      shotUrl = saveSupportScreenshot(screenshotBase64, id);
    } catch (e) {
      return { ok: false, error: e.message || "Screenshot upload failed" };
    }
  }

  const thread = getOrCreateSupportThread(db, id);
  const msg = {
    id: randomId("SUP", 8),
    from: role,
    text: body,
    screenshotUrl: shotUrl,
    createdAt: Date.now(),
    notifyUser: role === "admin",
    seenByUserAt: role === "admin" ? null : Date.now(),
  };
  thread.messages = thread.messages || [];
  thread.messages.push(msg);
  if (thread.messages.length > 200) {
    thread.messages = thread.messages.slice(-200);
  }
  thread.updatedAt = Date.now();
  thread.status = "open";
  if (role === "user") {
    thread.needsAdmin = true;
    // User replied — treat admin's pending notify as seen
    markSupportMessagesSeenInThread(thread);
    thread.awaitingUserSeen = false;
  }
  if (role === "admin") {
    thread.needsAdmin = false;
    thread.awaitingUserSeen = true;
  }
  writeDb(db);
  return { ok: true, thread: publicSupportThread(thread), message: msg };
}

function markSupportMessagesSeenInThread(thread) {
  if (!thread || !thread.messages) return;
  const now = Date.now();
  for (const m of thread.messages) {
    if (m.from === "admin" && m.notifyUser && !m.seenByUserAt) {
      m.seenByUserAt = now;
    }
  }
}

/** User opened popup / Support — mark admin messages as seen. */
function markSupportSeenByUser(userId) {
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "Login required" };
  const db = readDb();
  const thread = db.supportThreads && db.supportThreads[id];
  if (!thread) return { ok: true, seen: 0 };
  let n = 0;
  const now = Date.now();
  for (const m of thread.messages || []) {
    if (m.from === "admin" && !m.seenByUserAt) {
      m.seenByUserAt = now;
      n += 1;
    }
  }
  thread.awaitingUserSeen = false;
  writeDb(db);
  return { ok: true, seen: n };
}

/** Latest admin Support message waiting for user popup. */
function getSupportPopupForUser(userId) {
  const id = String(userId || "").trim();
  const db = readDb();
  const thread = db.supportThreads && db.supportThreads[id];
  if (!thread) return null;
  const unseen = (thread.messages || [])
    .filter(function (m) {
      return m.from === "admin" && !m.seenByUserAt;
    })
    .sort(function (a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
  if (!unseen.length) return null;
  const m = unseen[0];
  return {
    messageId: m.id,
    title: "Support · Admin",
    text: m.text || (m.screenshotUrl ? "[screenshot]" : ""),
    screenshotUrl: m.screenshotUrl || null,
    createdAt: m.createdAt,
    unreadCount: unseen.length,
  };
}

/**
 * Send Support QR + pay-intent for a win-back / discount offer.
 * @param {string} userId
 * @param {{ packageId?: string, force?: boolean, allowWithTime?: boolean, source?: string }} [opts]
 */
function grantWinbackOffer(userId, opts) {
  const options = opts || {};
  const id = String(userId || "").trim();
  if (!id) return { ok: false, error: "Login required" };

  const s = getSettings();
  // Discount-ask always tries to send; time=0 winback still needs the toggle ON
  if (!s.winbackEnabled && options.source !== "discount_ask") {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  const wantedId = String(
    options.packageId || s.winbackPackageId || "day"
  ).trim();
  const pack =
    getPackage(wantedId) || getPackage(s.winbackPackageId || "day");
  if (!pack) return { ok: false, error: "Win-back package not found" };
  const price = getWinbackPriceForPack(pack.id, s);
  if (!Number.isFinite(price) || price < 1) {
    return { ok: false, error: "Invalid win-back price" };
  }

  const db = readDb();
  const user = db.users[id];
  if (!user) return { ok: false, error: "User not found" };

  const now = Date.now();
  migrateUserAccess(user, now);
  syncHoursBalanceFromExpiry(user, now);
  const hours = Number(user.hoursBalance || 0);
  if (
    user.hasPaid &&
    options.source !== "discount_ask" &&
    options.source !== "admin_resend"
  ) {
    return { ok: true, skipped: true, reason: "has_paid" };
  }
  if (!options.allowWithTime && hours > 0.0001) {
    return { ok: true, skipped: true, reason: "has_time" };
  }

  const prev = user.winbackOffer;
  const samePackOffer =
    prev &&
    String(prev.packageId || "") === String(pack.id) &&
    Math.round(Number(prev.priceInr)) === Math.round(price);
  if (
    !options.force &&
    samePackOffer &&
    Number(prev.grantedAt || 0) > 0 &&
    now - Number(prev.grantedAt) < WINBACK_COOLDOWN_MS
  ) {
    if (!db.payIntents || typeof db.payIntents !== "object") db.payIntents = {};
    db.payIntents[id] = {
      userId: id,
      packageId: pack.id,
      amountInr: price,
      hours: pack.hours,
      source: String(options.source || "winback").slice(0, 40),
      createdAt: Number(prev.grantedAt) || now,
      expiresAt: now + WINBACK_INTENT_MS,
    };
    writeDb(db);
    return {
      ok: true,
      already: true,
      offer: prev,
      intent: db.payIntents[id],
      supportPopup: getSupportPopupForUser(id),
      user: publicUser(user),
    };
  }

  const listPrice = Math.round(
    Number(pack.listPriceInr != null ? pack.listPriceInr : pack.priceInr)
  );
  const qrUrl =
    (s.winbackQrImageUrl && String(s.winbackQrImageUrl).trim()) ||
    (pack.qrImageUrl && String(pack.qrImageUrl).trim()) ||
    (s.qrImageUrl && String(s.qrImageUrl).trim()) ||
    "/upi-qr.svg";

  const text =
    "Pay ₹" +
    price +
    " for " +
    (pack.label || pack.id) +
    ".\n" +
    "UPI note = " +
    id;

  writeDb(db);

  const msgResult = addSupportMessage({
    userId: id,
    from: "admin",
    text: text,
    screenshotUrl: qrUrl,
  });
  if (!msgResult.ok) {
    return { ok: false, error: msgResult.error || "Could not send offer" };
  }

  const db2 = readDb();
  const user2 = db2.users[id];
  if (!user2) return { ok: false, error: "User not found" };
  user2.winbackOffer = {
    packageId: pack.id,
    packageLabel: pack.label || pack.id,
    priceInr: price,
    listPriceInr: listPrice,
    hours: pack.hours,
    qrImageUrl: qrUrl,
    grantedAt: now,
    expiresAt: now + WINBACK_INTENT_MS,
    messageId: msgResult.message && msgResult.message.id,
    source: String(options.source || "winback").slice(0, 40),
  };
  if (!db2.payIntents || typeof db2.payIntents !== "object") db2.payIntents = {};
  db2.payIntents[id] = {
    userId: id,
    packageId: pack.id,
    amountInr: price,
    hours: pack.hours,
    source: String(options.source || "winback").slice(0, 40),
    createdAt: now,
    expiresAt: now + WINBACK_INTENT_MS,
  };
  writeDb(db2);

  return {
    ok: true,
    granted: true,
    offer: user2.winbackOffer,
    intent: db2.payIntents[id],
    supportPopup: getSupportPopupForUser(id),
    user: publicUser(user2),
  };
}

function listSupportThreads() {
  const db = readDb();
  if (!db.supportThreads) db.supportThreads = {};
  ensurePayFunnels(db);

  // Drop leftover threads for deleted accounts
  let purged = false;
  for (const uid of Object.keys(db.supportThreads)) {
    if (!db.users || !db.users[uid]) {
      purgeUserRelatedData(db, uid);
      purged = true;
    }
  }
  if (purged) writeDb(db);

  const threads = Object.values(db.supportThreads || {});
  return threads
    .map(function (t) {
      const msgs = t.messages || [];
      const last = msgs[msgs.length - 1];
      const unseenForUser = msgs.filter(function (m) {
        return m.from === "admin" && !m.seenByUserAt;
      }).length;
      const lastText = last
        ? String(last.text || (last.screenshotUrl ? "[screenshot]" : "")).slice(
            0,
            120
          )
        : "";
      const payLead = msgs.some(function (m) {
        return (
          m &&
          m.from === "user" &&
          /\[DISCOUNT_ASK\]|\[PAY_LEAD\]/i.test(String(m.text || ""))
        );
      });
      const photoCredit = msgs.some(function (m) {
        return (
          m &&
          m.from === "user" &&
          /\[PHOTO_CREDITS\]/i.test(String(m.text || ""))
        );
      });
      let funnel =
        db.payFunnels && db.payFunnels[t.userId]
          ? publicPayFunnel(db.payFunnels[t.userId])
          : null;
      funnel = enrichFunnelFromDiscountMsg(funnel, msgs);
      return {
        userId: t.userId,
        status: t.status || "open",
        updatedAt: t.updatedAt || 0,
        needsAdmin: !!t.needsAdmin,
        awaitingUserSeen: !!t.awaitingUserSeen || unseenForUser > 0,
        userUnseenCount: unseenForUser,
        messageCount: msgs.length,
        lastFrom: last ? last.from : null,
        lastText: lastText,
        lastAt: last ? last.createdAt : t.updatedAt || 0,
        payLead: !!payLead || !!(funnel && funnel.discountAsked),
        photoCredit: !!photoCredit,
        payFunnel: funnel,
      };
    })
    .sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function setSupportThreadStatus(userId, status) {
  const db = readDb();
  const id = String(userId || "").trim();
  const thread = db.supportThreads && db.supportThreads[id];
  if (!thread) return { ok: false, error: "No support thread" };
  thread.status = status === "closed" ? "closed" : "open";
  if (thread.status === "closed") thread.needsAdmin = false;
  thread.updatedAt = Date.now();
  writeDb(db);
  return { ok: true, thread: publicSupportThread(thread) };
}

/** Read-only dashboard metrics from existing store (no schema change). */
function startOfDayIstMs(nowMs) {
  const now = Number(nowMs) || Date.now();
  const istOffsetMin = 330; // UTC+5:30
  const shifted = new Date(now + istOffsetMin * 60000);
  return (
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
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

function istDayLabel(dayStartMs) {
  const istOffsetMin = 330;
  const shifted = new Date(Number(dayStartMs) + istOffsetMin * 60000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[shifted.getUTCDay()] || "";
}

function getAnalytics() {
  settleStaleSessions();
  const db = readDb();
  const users = Object.values(db.users || {});
  const payments = Object.values(db.payments || {});
  const reports = Object.values(db.aiReports || {});
  const now = Date.now();
  const dayStart = startOfDayIstMs(now);
  const dayMs = 24 * 3600000;
  const weekMs = 7 * dayMs;
  const weekStart = dayStart - 6 * dayMs;

  const approved = payments.filter((p) => p.status === "approved");
  const pending = payments.filter((p) => p.status === "pending");
  const rejected = payments.filter((p) => p.status === "rejected");
  const payAt = (p) =>
    Number(p.reviewedAt || p.approvedAt || p.updatedAt || p.createdAt || 0);

  let chatMessages = 0;
  let liveChats = 0;
  for (const u of users) {
    const sessions = collectUserSessions(db, u.userId);
    if (db.chats && db.chats[u.userId]) liveChats += 1;
    for (const item of sessions) {
      chatMessages += visibleChatMessages(item.session && item.session.history).length;
    }
  }

  ensurePayFunnels(db);
  const funnels = Object.values(db.payFunnels || {});
  const payAbandonedOpen = funnels.filter(
    (f) => f && f.abandoned && !f.successAt && !f.submittedAt
  ).length;
  const discountAsksOpen = funnels.filter(
    (f) => f && f.discountAsked && !f.successAt
  ).length;
  const payLeadsOpen = funnels.filter(
    (f) => f && !f.successAt && (f.abandoned || f.discountAsked)
  ).length;
  const payOpensToday = funnels.filter(
    (f) => f && Number(f.openedAt || f.updatedAt || 0) >= dayStart
  ).length;
  const payAbandonedToday = funnels.filter(
    (f) => f && f.abandoned && Number(f.abandonedAt || 0) >= dayStart
  ).length;
  const discountAsksToday = funnels.filter(
    (f) => f && f.discountAsked && Number(f.discountAskedAt || 0) >= dayStart
  ).length;
  const paySuccessToday = funnels.filter(
    (f) => f && Number(f.successAt || 0) >= dayStart
  ).length;

  const hoursSold = approved.reduce((s, p) => s + Number(p.hours || 0), 0);
  const moneyInr = approved.reduce((s, p) => s + Number(p.amountInr || 0), 0);
  const moneyToday = approved
    .filter((p) => payAt(p) >= dayStart)
    .reduce((s, p) => s + Number(p.amountInr || 0), 0);
  const moneyWeek = approved
    .filter((p) => payAt(p) >= weekStart)
    .reduce((s, p) => s + Number(p.amountInr || 0), 0);
  const hoursSoldToday = approved
    .filter((p) => payAt(p) >= dayStart)
    .reduce((s, p) => s + Number(p.hours || 0), 0);
  const hoursLive = users.reduce((s, u) => s + liveHoursBalance(u, now), 0);
  const reallyOnline = (u) =>
    !!u.sessionActive &&
    !!u.lastTickAt &&
    now - Number(u.lastTickAt) <= STALE_SESSION_MS;
  const appOpenNow = (u) =>
    !!u.lastSeenAt && now - Number(u.lastSeenAt) <= STALE_SESSION_MS;

  const isNewToday = (u) => Number(u.createdAt || 0) >= dayStart;
  const isActiveToday = (u) => userActivityAt(u) >= dayStart;
  const newToday = users.filter(isNewToday).length;
  const uniqueToday = users.filter(isActiveToday).length;
  const repeatToday = users.filter((u) => isActiveToday(u) && !isNewToday(u)).length;
  const paidUsers = users.filter((u) => u.hasPaid).length;
  const trialOnly = users.filter((u) => !u.hasPaid).length;
  const withTimeLeft = users.filter((u) => liveHoursBalance(u, now) > 0.0001).length;
  const trialLeads = users.filter(
    (u) =>
      !u.hasPaid &&
      liveHoursBalance(u, now) <= 0.0001 &&
      userActivityAt(u) >= dayStart
  ).length;

  const seriesDays = [];
  for (let i = 6; i >= 0; i--) {
    const start = dayStart - i * dayMs;
    const end = start + dayMs;
    const signups = users.filter((u) => {
      const t = Number(u.createdAt || 0);
      return t >= start && t < end;
    }).length;
    const actives = users.filter((u) => {
      const t = userActivityAt(u);
      return t >= start && t < end;
    }).length;
    const dayPays = approved.filter((p) => {
      const t = payAt(p);
      return t >= start && t < end;
    });
    const money = dayPays.reduce((s, p) => s + Number(p.amountInr || 0), 0);
    seriesDays.push({
      start,
      label: istDayLabel(start),
      isToday: i === 0,
      signups,
      actives,
      moneyInr: Math.round(money),
      approved: dayPays.length,
    });
  }

  const paidShare =
    users.length > 0 ? Math.round((paidUsers / users.length) * 1000) / 10 : 0;
  const convertToday =
    payOpensToday > 0
      ? Math.round((paySuccessToday / payOpensToday) * 1000) / 10
      : 0;

  return {
    usersTotal: users.length,
    usersToday: newToday, // calendar IST new signups (kept key for old UI)
    usersNewToday: newToday,
    usersUniqueToday: uniqueToday,
    usersRepeatToday: repeatToday,
    dayStartIst: dayStart,
    usersWeek: users.filter((u) => now - Number(u.createdAt || 0) < weekMs).length,
    paidUsers,
    trialOnly,
    paidSharePct: paidShare,
    withTimeLeft,
    trialLeads,
    sessionActive: users.filter(reallyOnline).length,
    appOpen: users.filter(appOpenNow).length,
    liveChats,
    chatMessages,
    paymentsPending: pending.length,
    paymentsApproved: approved.length,
    paymentsRejected: rejected.length,
    moneyInr: Math.round(moneyInr),
    moneyToday: Math.round(moneyToday),
    moneyWeek: Math.round(moneyWeek),
    hoursSold: Math.round(hoursSold * 10) / 10,
    hoursSoldToday: Math.round(hoursSoldToday * 10) / 10,
    hoursLive: Math.round(hoursLive * 10) / 10,
    aiReports: reports.length,
    aiReportsToday: reports.filter((r) => Number(r.createdAt || 0) >= dayStart).length,
    payAbandonedOpen,
    discountAsksOpen,
    payLeadsOpen,
    payOpensToday,
    payAbandonedToday,
    discountAsksToday,
    paySuccessToday,
    convertTodayPct: convertToday,
    seriesDays,
    generatedAt: now,
  };
}

function ensureAdminNotices(db) {
  if (!db.adminNotices || typeof db.adminNotices !== "object") {
    db.adminNotices = {};
  }
}

function sendAdminNotice({ userId, text, title }) {
  const id = String(userId || "").trim();
  const body = String(text || "").trim().slice(0, 500);
  const head = String(title || "").trim().slice(0, 80);
  if (!id) return { ok: false, error: "User ID required" };
  if (!body) return { ok: false, error: "Message required" };

  const db = readDb();
  if (!db.users[id]) return { ok: false, error: "User not found" };
  ensureAdminNotices(db);

  const noticeId = randomId("NTC", 8);
  const notice = {
    noticeId,
    userId: id,
    title: head || "Message from admin",
    text: body,
    createdAt: Date.now(),
    seenAt: null,
    createdBy: "admin",
  };
  db.adminNotices[noticeId] = notice;
  writeDb(db);
  return { ok: true, notice: publicAdminNotice(notice) };
}

function publicAdminNotice(n) {
  return {
    noticeId: n.noticeId,
    userId: n.userId,
    title: n.title || "Message from admin",
    text: n.text,
    createdAt: n.createdAt,
    seenAt: n.seenAt || null,
    seen: !!n.seenAt,
  };
}

function listAdminNotices(opts) {
  const options = opts || {};
  const db = readDb();
  ensureAdminNotices(db);
  let list = Object.values(db.adminNotices);
  if (options.userId) {
    const uid = String(options.userId).trim();
    list = list.filter((n) => n.userId === uid);
  }
  if (options.unseenOnly) {
    list = list.filter((n) => !n.seenAt);
  }
  return list
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, Math.min(200, Number(options.limit) || 80))
    .map(publicAdminNotice);
}

function listUserNotices(userId, opts) {
  const options = opts || {};
  const db = readDb();
  ensureAdminNotices(db);
  let list = Object.values(db.adminNotices).filter(
    (n) => n.userId === String(userId || "").trim()
  );
  if (options.unseenOnly) list = list.filter((n) => !n.seenAt);
  return list
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 20)
    .map(publicAdminNotice);
}

function markNoticeSeen(userId, noticeId) {
  const db = readDb();
  ensureAdminNotices(db);
  const n = db.adminNotices[String(noticeId || "")];
  if (!n) return { ok: false, error: "Notice not found" };
  if (n.userId !== String(userId || "").trim()) {
    return { ok: false, error: "Not your notice" };
  }
  if (!n.seenAt) n.seenAt = Date.now();
  writeDb(db);
  return { ok: true, notice: publicAdminNotice(n) };
}

function noticeStatsForUser(db, userId) {
  ensureAdminNotices(db);
  const mine = Object.values(db.adminNotices).filter(
    (n) => n.userId === String(userId || "")
  );
  const unread = mine.filter((n) => !n.seenAt).length;
  const latest = mine.sort(
    (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
  )[0];
  return {
    noticeUnread: unread,
    lastNoticeSeen: latest ? !!latest.seenAt : null,
    lastNoticeAt: latest ? latest.createdAt : null,
  };
}

module.exports = {
  ensureDirs,
  PACKAGES,
  getPackages,
  getTrialMinutes,
  assertAdultDob,
  createUser,
  loginUser,
  adminLogin,
  isAdminCredentials,
  getTokenRecord,
  publicUser,
  getUser,
  touchLastSeen,
  tickUserHours,
  pingAppOpen,
  pauseSession,
  settleStaleSessions,
  liveHoursBalance,
  formatClock,
  submitPayment,
  recordPayIntent,
  grantWinbackOffer,
  sendDiscountAskOffer,
  recordPayEvent,
  requestPayDiscount,
  listPayLeads,
  listPayments,
  approvePayment,
  rejectPayment,
  ingestSmsCredit,
  listSmsCredits,
  getAdminAlerts,
  parseCreditSms,
  paymentInfo,
  listUsers,
  adminAddHours,
  adminSetHours,
  adminResetPin,
  adminMigrateToFourDigit,
  saveChatSession,
  getChatSession,
  getChatSessionAdmin,
  getUserPhotosAdmin,
  canGeneratePhoto,
  recordPhotoLook,
  listPhotoFileOwners,
  adminAddPhotoCredits,
  requestPhotoCredits,
  PHOTO_MAX_PER_HOUR,
  clearChatSession,
  adminDeleteUserChats,
  adminDeleteUser,
  adminUnlinkDevice,
  adminPurgeOldChats,
  submitAiReport,
  listAiReports,
  getAiReportDigest,
  clearAiReports,
  getSupportThread,
  addSupportMessage,
  listSupportThreads,
  setSupportThreadStatus,
  markSupportSeenByUser,
  getSupportPopupForUser,
  getAnalytics,
  getSettings,
  adminGetSettings,
  updatePaySettings,
  getClientCacheKey,
  getClientConfig,
  bumpClientCacheKey,
  isOneIdPerDeviceEnabled,
  saveUpiQrBase64,
  clearUpiQr,
  saveWinbackQrBase64,
  clearWinbackQr,
  savePackageQrBase64,
  clearPackageQr,
  sendAdminNotice,
  listAdminNotices,
  listUserNotices,
  markNoticeSeen,
  STORY_MODE_FREE_USES,
  storyModeQuotaForUser,
  consumeStoryModeUse,
  getStoryModeQuota,
};
