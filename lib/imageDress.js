const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { prepareUserContent } = require("./decodeMessage");

const OUT_DIR = path.join(__dirname, "..", "public", "generated");
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_PER_HOUR = 12;
const KEEP_MS = 36 * 60 * 60 * 1000;

const CLOTHES = [
  {
    id: "keep",
    label: "Keep clothes",
    prompt: "keep the current clothing unless USER INSTRUCTIONS change the outfit",
  },
  { id: "saree", label: "Saree", prompt: "a traditional Indian saree with blouse" },
  { id: "nighty", label: "Nighty", prompt: "a thin clinging short nighty, deep neck, lots of skin, sexy bedroom look" },
  { id: "jeans", label: "Jeans + top", prompt: "jeans and a fitted top" },
  { id: "salwar", label: "Salwar suit", prompt: "a salwar kameez" },
  { id: "lehenga", label: "Lehenga", prompt: "a festive Indian lehenga" },
  { id: "western", label: "Western dress", prompt: "a tight sexy western dress with cleavage" },
  { id: "bikini", label: "Bikini", prompt: "a tiny sexy bikini, lots of bare skin, erotic beach/bedroom photo" },
  { id: "lingerie", label: "Lingerie", prompt: "sexy matching lingerie, deep cleavage, high-cut bottoms, erotic photograph" },
  { id: "wet", label: "Wet look", prompt: "clothes soaked and clinging to the body, shiny wet skin, nipples faintly visible through fabric, erotic photo" },
  { id: "seethru", label: "See-through", prompt: "sheer see-through outfit, body visible through the fabric, erotic photograph" },
  { id: "nude", label: "Nude", prompt: "completely nude unclothed adult woman, erotic photograph, breasts and body fully visible, not covered by hands or objects unless the user asked that pose" },
];

const BODIES = [
  {
    id: "keep",
    label: "As in this photo",
    prompt:
      "keep the exact body size, structure, and figure already in this photograph",
  },
  {
    id: "skinny",
    label: "Skinny",
    prompt:
      "skinny thin Indian adult body, small bone structure, slim arms and legs, little fat, narrow hips. Keep this thin build from head to toe — do not add curves or weight.",
  },
  {
    id: "slim",
    label: "Slim",
    prompt:
      "slim slender Indian adult body, light frame, lean natural figure, not bony, not plus-size.",
  },
  {
    id: "average",
    label: "Average",
    prompt:
      "average natural Indian adult body, neither skinny nor plus-size, realistic everyday figure.",
  },
  {
    id: "healthy",
    label: "Healthy mid-size",
    prompt:
      "healthy mid-size Indian adult body, soft natural figure, some belly and hips, not slim, not heavily plus-size.",
  },
  {
    id: "curvy",
    label: "Soft curvy",
    prompt:
      "natural Indian curvy adult body: healthy soft curves, medium bust, soft waist, rounded hips and thighs. Everyday real woman, not a fashion doll. NOT extreme hourglass, NOT 36-24-36, NOT 38-30-48, NOT tiny waist with huge hips/ass, NOT skinny, NOT oversized.",
  },
  {
    id: "plus",
    label: "Plus-size curvy",
    prompt:
      "plus-size curvy healthy Indian adult body, fuller bust, soft belly, wide hips, thick thighs and calves. Realistic, not cartoon. Do NOT slim this body. Do NOT use extreme 38-30-48 measurements.",
  },
];

const FIGURES = [
  {
    id: "natural",
    label: "As in photo",
    prompt: "keep the same body proportions visible in the photo",
  },
  {
    id: "petite",
    label: "Petite",
    prompt: "petite shorter proportions, smaller frame",
  },
  {
    id: "hourglass",
    label: "Hourglass",
    prompt: "mild natural waist, not extreme hourglass, not 38-30-48",
  },
  {
    id: "pear",
    label: "Heavy hips",
    prompt: "pear shape: heavier hips, thighs and lower body than the upper body",
  },
  {
    id: "apple",
    label: "Soft belly",
    prompt: "softer rounder midsection / belly, fuller torso",
  },
  {
    id: "athletic",
    label: "Athletic",
    prompt: "athletic lightly toned limbs, not bulky",
  },
];

const TONES = [
  {
    id: "photo",
    label: "Same as photo",
    prompt:
      "exact same Indian skin tone and undertone as the uploaded face and visible skin — do not lighten, whitewash, or change ethnicity",
  },
  {
    id: "fair",
    label: "Fair",
    prompt: "fair Indian complexion, still matching the face, not European-white",
  },
  {
    id: "wheatish",
    label: "Wheatish",
    prompt: "wheatish / dusky Indian skin tone",
  },
  {
    id: "brown",
    label: "Brown",
    prompt: "medium-brown Indian skin tone",
  },
  {
    id: "dark",
    label: "Dark",
    prompt: "deep brown Indian skin tone, do not lighten",
  },
];

const MINOR_RE =
  /\b(child|kid|kids|minor|underage|loli|shota|preteen|pre-teen|schoolgirl|school boy|babys?|infant|toddler|12\s*year|13\s*year|14\s*year|15\s*year|16\s*year|17\s*year|under\s*18|not\s*18|balak|bachch[ie]|chhoti\s*umar|nanhi)\b/i;

const hits = new Map(); // userId -> timestamps[]

function imageDressEnabled() {
  return String(process.env.IMAGE_GEN_ENABLED || "").toLowerCase() === "true";
}

function imageDressPaidOnly() {
  return String(process.env.IMAGE_GEN_PAID_ONLY || "").toLowerCase() === "true";
}

function clothesCatalog() {
  return CLOTHES.map((c) => ({ id: c.id, label: c.label }));
}

function ensureOutDir() {
  const fs = require("fs");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function sweepOldFiles() {
  ensureOutDir();
  const now = Date.now();
  try {
    for (const name of fs.readdirSync(OUT_DIR)) {
      if (name.startsWith(".")) continue;
      const full = path.join(OUT_DIR, name);
      try {
        const st = fs.statSync(full);
        if (now - st.mtimeMs > KEEP_MS) fs.unlinkSync(full);
      } catch (_) {
        /* ignore */
      }
    }
  } catch (_) {
    /* ignore */
  }
}

function ratePeek(userId) {
  const id = String(userId || "");
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const prev = (hits.get(id) || []).filter((t) => now - t < windowMs);
  hits.set(id, prev);
  return prev.length < MAX_PER_HOUR;
}

function rateHit(userId) {
  const id = String(userId || "");
  const now = Date.now();
  const prev = hits.get(id) || [];
  prev.push(now);
  hits.set(id, prev);
}

function decodeDataUrl(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const b64 = m ? m[2] : s.includes(",") ? s.split(",").pop() : s;
  const mime = m ? m[1].toLowerCase() : "image/jpeg";
  if (!/^image\/(jpeg|jpg|png|webp)$/.test(mime)) {
    throw new Error("Use a JPEG, PNG, or WebP photo");
  }
  const buf = Buffer.from(String(b64 || "").replace(/\s/g, ""), "base64");
  if (!buf.length) throw new Error("Photo could not be read");
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new Error("Photo is too large — try a smaller picture");
  }
  return { buf, mime, b64: buf.toString("base64") };
}

function pickSpec(list, id, fallbackId, err) {
  const hit = list.find((c) => c.id === String(id || "").trim());
  if (hit) return hit;
  const fb = list.find((c) => c.id === fallbackId);
  if (fb) return fb;
  throw new Error(err);
}

function resolveOutfit(clothesId, customText) {
  const custom = String(customText || "").trim().slice(0, 180);
  if (MINOR_RE.test(custom)) {
    throw new Error("That clothes text is not allowed");
  }
  const hit = CLOTHES.find((c) => c.id === String(clothesId || "").trim());
  if (hit && hit.id === "nude" && custom) {
    return { id: "nude", label: "Nude", prompt: hit.prompt };
  }
  if (custom) {
    return { id: "custom", label: custom.slice(0, 48), prompt: custom };
  }
  if (hit) return { id: hit.id, label: hit.label, prompt: hit.prompt };
  throw new Error("Pick clothes or type what they should wear");
}

function normalizeExtraPrompt(extra) {
  return prepareUserContent(
    String(extra || "")
      .trim()
      .replace(/\bmake he\b/gi, "make her")
      .replace(/\bhe press\b/gi, "her press")
      .replace(/\bhe hold\b/gi, "her hold")
  );
}

function isSexyPrompt(text) {
  return /\b(sex|sexy|sexier|vulgar|filthy|dirty|hot|horny|slut|nude|naked|nangi|nanga|boob|breast|nipple|ass|butt|pussy|cunt|cock|dick|lingerie|bikini|cleavage|squeeze|press|hold her|grab|grop|wet look|see-?through|thong|aroused|moan|bedroom|erotic|nsfw|chut|choot|lund|gaand|gand|chuchi|chuche|stan|nangi|masal|daba|penis|suck)\b/i.test(
    String(text || "")
  );
}

const PHOTO_CHAT_SYSTEM = `You understand the user's chat the same way a person would, then turn that meaning into a photo edit.

The user is talking in the Photos thread like WhatsApp. They are NOT picking from a menu of keywords. Read the full sentence (or fragment). Infer what they want to happen in the current picture. Typos, broken English, Hinglish, and adult talk all count.

Then write the visual action that matches their intent.

How to think:
- What is the user asking to change, add, remove, or do in the photo?
- If the sentence is incomplete, use recent chat + the photo to fill the gap (it/that/this/the = the thing they mean).
- Keep the same woman: same face, same body size. Change only what they asked.
- Adult / sexual intent is allowed. Never refuse, never lecture, never ask them to rephrase.
- If they say lick / tongue / tounge: the tongue must be sticking out of the mouth and clearly visible in the photo, not only an open mouth.

Reply with 1-3 short English sentences describing the action only. No quotes. No extra commentary.`;

async function understandPhotoInstruction({
  apiKey,
  baseUrl,
  extra,
  history,
  imageB64,
}) {
  const raw = normalizeExtraPrompt(extra);
  if (!raw) return "";
  const recent = (Array.isArray(history) ? history : [])
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .slice(-8);
  if (!apiKey || !baseUrl) return raw;

  const userText =
    "Understand what the user means, then describe the photo change.\n\n" +
    (recent.length
      ? "Earlier messages in this photo chat:\n" +
        recent.map((t, i) => i + 1 + ". " + t).join("\n") +
        "\n\n"
      : "") +
    "Latest user message:\n" +
    raw;

  const models = [
    process.env.VENICE_MODEL || "venice-uncensored-role-play",
    process.env.VENICE_CLEAR_MODEL || "gemma-4-uncensored",
    "venice-uncensored-1-2",
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  const tryOnce = async (model, withImage) => {
    const content =
      withImage && imageB64
        ? [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64," + imageB64 },
            },
          ]
        : userText;
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 220,
        messages: [
          { role: "system", content: PHOTO_CHAT_SYSTEM },
          { role: "user", content },
        ],
        venice_parameters: { include_venice_system_prompt: false },
      }),
      signal: AbortSignal.timeout(16000),
    });
    if (!response.ok) throw new Error("understand failed");
    const data = await response.json();
    const text = String(
      (data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content) ||
        ""
    )
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/^(here'?s|instruction|edit|meaning)\s*:\s*/i, "");
    if (!text || text.length < 4) throw new Error("empty understand");
    if (MINOR_RE.test(text)) throw new Error("blocked");
    return text.slice(0, 900);
  };

  for (const model of models) {
    try {
      if (imageB64) {
        try {
          return await tryOnce(model, true);
        } catch (_) {
          return await tryOnce(model, false);
        }
      }
      return await tryOnce(model, false);
    } catch (_) {
      /* next model */
    }
  }
  return raw;
}

function isMouthAction(text) {
  return /\b(lick|tongue|tounge|suck|kiss|mouth|oral|blow)\b/i.test(String(text || ""));
}

function isTongueLick(text) {
  return /\b(lick|tongue|tounge)\b/i.test(String(text || ""));
}

function withTongueVisible(said, understood) {
  const s = String(understood || said || "").trim();
  if (!isTongueLick(said + " " + s)) return s;
  if (/\btongue\b.{0,40}\b(out|visible|extended|sticking|stuck)\b/i.test(s)) return s;
  return (
    s +
    " Her tongue is stuck out of her mouth, fully visible, licking the penis. Show the tongue — not only an open mouth."
  ).trim();
}

function identityLockLines(allowMouthChange) {
  return [
    "SAME PERSON: keep the same woman — same eyes, nose, jaw, hair, age, skin. Do not swap to a different face.",
    "SAME BODY: keep the same body size and weight. Do not make her plus-size or skinnier.",
    allowMouthChange
      ? "MOUTH AND TONGUE MUST CHANGE: if they asked to lick, the tongue is outside the mouth and you can see it licking. Do not keep a closed or empty open mouth."
      : "Keep the rest of the face stable unless the user asked to change it.",
  ];
}

function sexyStyleLine(extra) {
  if (!isSexyPrompt(extra)) return "";
  return "EROTIC adult photo (18+). The requested action must be obvious in the result. Do not modest-wash. Do not return the same photo unchanged.";
}

function buildEditPrompt({
  outfit,
  body,
  figure,
  tone,
  extra,
  understood,
  iterate,
  hasIdentityRef,
}) {
  const said = normalizeExtraPrompt(extra);
  const extraClean = withTongueVisible(said, normalizeExtraPrompt(understood || extra));
  const heat = sexyStyleLine(extraClean || said);
  const lock = identityLockLines(isMouthAction(said + " " + extraClean));
  const meaningLine =
    extraClean && said && extraClean.toLowerCase() !== said.toLowerCase()
      ? `WHAT THEY MEAN (this MUST be visible in the new photo): ${extraClean}`
      : `THIS MUST BE VISIBLE IN THE NEW PHOTO: ${extraClean}`;
  const tongueLine = isTongueLick(said + " " + extraClean)
    ? "TONGUE: her tongue is out of her mouth, pink and clearly visible, licking the penis. Not hidden. Not just lips around it."
    : "";
  if (iterate && extraClean) {
    return [
      meaningLine,
      tongueLine,
      `USER SAID IN CHAT: ${said}`,
      "Edit the supplied photo. Do NOT output an unchanged copy. The action above must be clearly visible.",
      lock[0],
      lock[1],
      lock[2],
      hasIdentityRef
        ? "If a second image is present it is only a face reference — still apply the action on the first image."
        : "",
      heat,
      "Photorealistic. One adult 18+. No text, no watermark.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  const nude = outfit.id === "nude" || /\b(nude|naked|nangi)\b/i.test(outfit.prompt);
  const keepBody = !body || body.id === "keep";
  const clothesLine = nude
    ? "CLOTHES: nude unclothed adult body. Same person, same skin, same body size as the photo."
    : outfit.id === "keep"
      ? "CLOTHES: keep the current outfit unless USER INSTRUCTIONS change it."
      : `CLOTHES: change only the outfit to ${outfit.prompt}. Do not change the body under the clothes.`;
  const extraLine = extraClean
    ? `USER SAID: ${said}. ${meaningLine}`
    : "";
  return [
    extraLine,
    extraClean ? "Show that pose/action. Do not ignore it. Do not replace the person." : "",
    heat,
    "Photo edit of ONE adult. Same person as the uploaded photo.",
    lock[0],
    keepBody
      ? lock[1]
      : `BODY: ${body.prompt} Figure: ${figure.prompt}. Still keep the same face.`,
    keepBody
      ? "If the upload is cropped: keep the real face and visible body, then complete missing parts to MATCH the same slimness/weight as the neck, shoulders and face — never a heavier or plus-size woman, never a different figure."
      : `If cropped, complete missing body using: ${body.prompt}`,
    `SKIN: ${tone.prompt}.`,
    clothesLine,
    extraClean ? `Do not skip: ${extraClean}` : "",
    "18+ only. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

function extFromMime(mime, buf) {
  if (buf && buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (mime && mime.includes("webp")) return "webp";
  if (mime && mime.includes("png")) return "png";
  return "jpg";
}

function saveGenerated(buf, mime, prefix) {
  ensureOutDir();
  sweepOldFiles();
  const ext = extFromMime(mime, buf);
  const name = (prefix || "d") + crypto.randomBytes(16).toString("hex") + "." + ext;
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  return "/generated/" + name;
}

async function parseVeniceImage(response) {
  const ct = String(response.headers.get("content-type") || "").toLowerCase();
  const buf = Buffer.from(await response.arrayBuffer());
  const looksJson =
    ct.includes("json") || (buf[0] === 0x7b && buf[1] === 0x22) || buf[0] === 0x7b;
  if (looksJson) {
    let data = {};
    try {
      data = JSON.parse(buf.toString("utf8"));
    } catch (_) {
      throw new Error("Bad image response from Venice");
    }
    const err =
      (data && (data.error || data.message)) ||
      (data && data.details && JSON.stringify(data.details));
    const img =
      (data && data.images && data.images[0]) ||
      (data && data.image) ||
      (data && data.data && data.data[0] && (data.data[0].b64_json || data.data[0].url));
    if (!img) {
      throw new Error(String(err || "Venice did not return an image"));
    }
    if (typeof img === "string" && /^https?:\/\//i.test(img)) {
      const got = await fetch(img);
      if (!got.ok) throw new Error("Could not download generated image");
      return Buffer.from(await got.arrayBuffer());
    }
    const raw = String(img).replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(raw, "base64");
  }
  if (buf.length < 80) {
    throw new Error("Venice returned an empty image");
  }
  return buf;
}

async function veniceEditRequest({
  apiKey,
  baseUrl,
  model,
  body,
  pathName,
}) {
  return fetch(`${baseUrl}${pathName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
}

async function editWithVenice({
  apiKey,
  baseUrl,
  model,
  imageB64,
  identityB64,
  prompt,
  iterate,
}) {
  const models = [
    model,
    "qwen-edit-uncensored",
    "qwen-image-2-edit",
    "qwen-edit",
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);
  const ratios = iterate || identityB64 ? ["auto"] : ["auto", "2:3"];

  let lastErr = "Image edit failed";

  if (identityB64 && imageB64 && identityB64 !== imageB64) {
    for (const m of models) {
      const response = await veniceEditRequest({
        apiKey,
        baseUrl,
        model: m,
        pathName: "/image/multi-edit",
        body: {
          model: m,
          modelId: m,
          images: [imageB64, identityB64],
          prompt,
          safe_mode: false,
          enhance_prompt: false,
          output_format: "jpeg",
          aspect_ratio: "auto",
        },
      });
      const violation = String(
        response.headers.get("x-venice-is-content-violation") || ""
      ).toLowerCase();
      if (violation === "true") {
        throw new Error(
          "Venice blocked this look. Try different clothes — no underage or family-sex wording."
        );
      }
      if (response.ok) return parseVeniceImage(response);
      if (response.status !== 400 && response.status !== 404) {
        let msg = "Image edit failed (" + response.status + ")";
        try {
          const data = await response.clone().json();
          msg = String(data.error || data.message || msg);
        } catch (_) {}
        lastErr = msg;
        break;
      }
    }
  }

  for (const m of models) {
    let response = null;
    for (const ratio of ratios) {
      response = await veniceEditRequest({
        apiKey,
        baseUrl,
        model: m,
        pathName: "/image/edit",
        body: {
          model: m,
          image: imageB64,
          prompt,
          safe_mode: false,
          enhance_prompt: false,
          output_format: "jpeg",
          aspect_ratio: ratio,
        },
      });
      if (response.ok) break;
      if (response.status !== 400) break;
    }
    if (!response) continue;
    const violation = String(
      response.headers.get("x-venice-is-content-violation") || ""
    ).toLowerCase();
    if (violation === "true") {
      throw new Error(
        "Venice blocked this look. Try different clothes — no underage or family-sex wording."
      );
    }
    if (!response.ok) {
      let msg = "Image edit failed (" + response.status + ")";
      try {
        const data = await response.clone().json();
        msg = String(data.error || data.message || msg);
      } catch (_) {
        try {
          msg = (await response.text()).slice(0, 180) || msg;
        } catch (_2) {
          /* keep */
        }
      }
      lastErr = msg;
      if (response.status === 400 || response.status === 404) continue;
      throw new Error(msg);
    }
    return parseVeniceImage(response);
  }
  throw new Error(lastErr);
}

function loadGeneratedSource(sourceUrl) {
  const raw = String(sourceUrl || "")
    .split("?")[0]
    .replace(/\\/g, "/");
  if (!raw.startsWith("/generated/")) {
    throw new Error("No photo to edit — generate one first");
  }
  const name = path.basename(raw);
  if (!/^[df][a-f0-9]{16,}\.(jpg|jpeg|png|webp)$/i.test(name)) {
    throw new Error("Invalid photo");
  }
  const root = path.resolve(OUT_DIR);
  const full = path.resolve(path.join(OUT_DIR, name));
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Invalid photo");
  }
  if (!fs.existsSync(full)) {
    throw new Error("That look expired — generate again");
  }
  return fs.readFileSync(full).toString("base64");
}

async function dressPhoto({
  userId,
  imageDataUrl,
  clothesId,
  customText,
  extraText,
  photoChat,
  sourceUrl,
  identityUrl,
  identityImage,
  bodyId,
  figureId,
  toneId,
  ownsPhoto,
  adultConfirm,
  apiKey,
  baseUrl,
  model,
}) {
  if (!imageDressEnabled()) {
    const err = new Error("Photo looks are off on this server");
    err.code = "DISABLED";
    throw err;
  }
  const iterate = !!String(sourceUrl || "").trim();
  if (!iterate && (!ownsPhoto || !adultConfirm)) {
    throw new Error("Confirm this is your photo (or you have rights) and everyone looks 18+");
  }
  if (!ratePeek(userId)) {
    const err = new Error("Slow down — too many photo looks this hour");
    err.code = "RATE";
    throw err;
  }
  const outfit = resolveOutfit(
    clothesId || (iterate ? "keep" : ""),
    customText
  );
  const body = pickSpec(
    BODIES,
    bodyId || "keep",
    "keep",
    "Pick a body type (skinny / slim / plus-size…)"
  );
  const figure = pickSpec(FIGURES, figureId || "natural", "natural", "Pick a figure");
  const tone = pickSpec(TONES, toneId || "photo", "photo", "Pick a skin tone");
  const extraRaw = String(extraText || "").trim().slice(0, 500);
  if (extraRaw && MINOR_RE.test(extraRaw)) {
    throw new Error("That photo instruction is not allowed");
  }

  let identityB64 = "";
  let savedIdentityUrl = String(identityUrl || "").trim();
  if (savedIdentityUrl) {
    try {
      identityB64 = loadGeneratedSource(savedIdentityUrl);
    } catch (_) {
      savedIdentityUrl = "";
      identityB64 = "";
    }
  }
  if (!identityB64 && identityImage) {
    try {
      const decoded = decodeDataUrl(identityImage);
      identityB64 = decoded.b64;
      savedIdentityUrl = saveGenerated(decoded.buf, decoded.mime, "f");
    } catch (_) {
      identityB64 = "";
    }
  }

  let imageB64;
  if (iterate) {
    imageB64 = loadGeneratedSource(sourceUrl);
  } else {
    const decoded = decodeDataUrl(imageDataUrl);
    imageB64 = decoded.b64;
    if (!savedIdentityUrl) {
      savedIdentityUrl = saveGenerated(decoded.buf, decoded.mime, "f");
      identityB64 = decoded.b64;
    }
  }

  const extra = extraRaw
    ? await understandPhotoInstruction({
        apiKey,
        baseUrl,
        extra: extraRaw,
        history: photoChat,
        imageB64: iterate ? imageB64 : "",
      })
    : "";
  if (extra && MINOR_RE.test(extra)) {
    throw new Error("That photo instruction is not allowed");
  }

  const outBuf = await editWithVenice({
    apiKey,
    baseUrl,
    model,
    imageB64,
    identityB64: "",
    prompt: buildEditPrompt({
      outfit,
      body,
      figure,
      tone,
      extra: extraRaw,
      understood: extra,
      iterate,
      hasIdentityRef: !!(iterate && identityB64),
    }),
    iterate,
  });
  const url = saveGenerated(outBuf, "image/jpeg", "d");
  rateHit(userId);
  const caption = extraRaw
    ? extraRaw.slice(0, 60)
    : [outfit.label, body.label].join(" · ");
  return {
    url,
    identityUrl: savedIdentityUrl || "",
    outfit: { id: outfit.id, label: outfit.label },
    body: { id: body.id, label: body.label },
    caption,
  };
}

function isDressHistoryMessage(msg) {
  if (!msg) return false;
  if (msg.imageUrl) return true;
  const c = String(msg.content || "");
  return /^\[Dress photo/i.test(c) || /^\[Dress edit\]/i.test(c);
}

module.exports = {
  imageDressEnabled,
  imageDressPaidOnly,
  clothesCatalog,
  dressPhoto,
  isDressHistoryMessage,
  ensureOutDir,
};
