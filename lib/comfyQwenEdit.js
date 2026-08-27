/**
 * RunPod / self-host ComfyUI backend for Qwen-Image-Edit.
 * Set COMFYUI_URL=https://<pod-id>-8188.proxy.runpod.net
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function comfyBaseUrl() {
  return String(process.env.COMFYUI_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function comfyEnabled() {
  return !!comfyBaseUrl();
}

function backendMode() {
  const m = String(process.env.IMAGE_BACKEND || "auto").toLowerCase();
  if (m === "comfy" || m === "venice") return m;
  return "auto";
}

function authHeaders(extra) {
  const h = Object.assign({}, extra || {});
  const token = String(process.env.COMFYUI_API_TOKEN || "").trim();
  if (token) h.Authorization = "Bearer " + token;
  return h;
}

async function comfyFetch(pathname, opts) {
  const base = comfyBaseUrl();
  if (!base) throw new Error("COMFYUI_URL is not set");
  const timeout = (opts && opts.timeoutMs) || 30000;
  const response = await fetch(base + pathname, {
    method: (opts && opts.method) || "GET",
    headers: authHeaders(opts && opts.headers),
    body: opts && opts.body,
    signal: AbortSignal.timeout(timeout),
  });
  return response;
}

function pickName(names, patterns, fallbackFirst) {
  const list = Array.isArray(names) ? names : [];
  for (const re of patterns) {
    const hit = list.find((n) => re.test(String(n)));
    if (hit) return hit;
  }
  return fallbackFirst ? list[0] || "" : "";
}

function uniqueNames(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach(function (n) {
    if (n && out.indexOf(n) === -1) out.push(n);
  });
  return out;
}

async function qwenEncodeClass() {
  try {
    const res = await comfyFetch("/object_info/TextEncodeQwenImageEditPlus", {
      timeoutMs: 6000,
    });
    if (res.ok) return "TextEncodeQwenImageEditPlus";
  } catch (_) {}
  return "TextEncodeQwenImageEdit";
}

async function listModels(folder) {
  try {
    const res = await comfyFetch("/models/" + folder, { timeoutMs: 8000 });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

async function probeComfy() {
  const url = comfyBaseUrl();
  if (!url) {
    return { ok: false, configured: false, error: "COMFYUI_URL not set" };
  }
  try {
    const res = await comfyFetch("/system_stats", { timeoutMs: 6000 });
    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        url,
        error: "GPU pod not ready (HTTP " + res.status + ")",
      };
    }
    const unet = await listModels("diffusion_models");
    const clip = uniqueNames(
      (await listModels("text_encoders")).concat(await listModels("clip"))
    );
    const vae = await listModels("vae");
    const lora = await listModels("loras");
    const unetName =
      process.env.COMFY_UNET ||
      pickName(unet, [/qwen.*edit/i, /qwen_image_edit/i], true);
    const clipName =
      process.env.COMFY_CLIP ||
      pickName(clip, [/qwen_2\.5_vl/i, /qwen2\.5.vl/i, /qwen.*vl/i], true);
    const vaeName =
      process.env.COMFY_VAE ||
      pickName(vae, [/qwen_image_vae/i, /qwen.*vae/i], true);
    const loraName =
      process.env.COMFY_LORA ||
      pickName(lora, [/lightning/i, /qwen-image-edit.*4\s*step/i, /4steps/i], false);
    const ready = !!(unetName && clipName && vaeName) || !!loadSavedWorkflow();
    return {
      ok: ready,
      configured: true,
      url,
      models: {
        unet: unetName || "",
        clip: clipName || "",
        vae: vaeName || "",
        lora: loraName || "",
      },
      error: ready
        ? ""
        : "ComfyUI is up, but Qwen-Image-Edit models are not downloaded yet",
    };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      url,
      error: (e && e.message) || "GPU pod unreachable (is it Running?)",
    };
  }
}

async function uploadImage(imageB64) {
  const raw = String(imageB64 || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const buf = Buffer.from(raw, "base64");
  if (!buf.length) throw new Error("Could not read photo for GPU edit");
  const name = "in_" + crypto.randomBytes(8).toString("hex") + ".jpg";
  const form = new FormData();
  form.append("image", new Blob([buf], { type: "image/jpeg" }), name);
  form.append("overwrite", "true");
  form.append("type", "input");
  const res = await comfyFetch("/upload/image", {
    method: "POST",
    body: form,
    timeoutMs: 60000,
  });
  if (!res.ok) {
    throw new Error("GPU upload failed (" + res.status + ")");
  }
  const data = await res.json().catch(function () {
    return {};
  });
  const uploaded = data.name || name;
  const sub = String(data.subfolder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return {
    name: sub ? sub + "/" + uploaded : uploaded,
    buf: buf,
  };
}

function readImageSize(buf) {
  if (!buf || buf.length < 24) return { width: 768, height: 1024 };
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return {
          height: buf.readUInt16BE(i + 5),
          width: buf.readUInt16BE(i + 7),
        };
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return { width: 768, height: 1024 };
}

function latentSize(w, h) {
  let W = Number(w) || 768;
  let H = Number(h) || 1024;
  const maxSide = 1024;
  const m = Math.max(W, H) || 1024;
  if (m > maxSide) {
    const s = maxSide / m;
    W *= s;
    H *= s;
  }
  const snap = function (n) {
    return Math.max(256, Math.min(1280, Math.round(n / 16) * 16));
  };
  return { width: snap(W), height: snap(H) };
}

function buildWorkflow({ unet, clip, vae, lora, imageName, prompt, seed, encodeClass, width, height }) {
  const steps = lora ? 4 : 20;
  const cfg = lora ? 1 : 4;
  const encodeName = encodeClass || "TextEncodeQwenImageEditPlus";
  const encodeInputs = {
    prompt: prompt,
    clip: ["2", 0],
    vae: ["3", 0],
  };
  if (encodeName === "TextEncodeQwenImageEditPlus") {
    encodeInputs.image1 = ["4", 0];
  } else {
    encodeInputs.image = ["4", 0];
  }
  const graph = {
    "1": {
      class_type: "UNETLoader",
      inputs: {
        unet_name: unet,
        weight_dtype: /fp8/i.test(String(unet)) ? "fp8_e4m3fn" : "default",
      },
    },
    "2": {
      class_type: "CLIPLoader",
      inputs: { clip_name: clip, type: "qwen_image" },
    },
    "3": {
      class_type: "VAELoader",
      inputs: { vae_name: vae },
    },
    "4": {
      class_type: "LoadImage",
      inputs: { image: imageName },
    },
    "5": {
      class_type: encodeName,
      inputs: encodeInputs,
    },
    "6": {
      class_type: "EmptySD3LatentImage",
      inputs: {
        width: width || 768,
        height: height || 1024,
        batch_size: 1,
      },
    },
    "8": {
      class_type: "KSampler",
      inputs: {
        seed: seed,
        steps: steps,
        cfg: cfg,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
        model: lora ? ["10", 0] : ["9", 0],
        positive: ["5", 0],
        negative: ["7", 0],
        latent_image: ["6", 0],
      },
    },
    "7": {
      class_type: "ConditioningZeroOut",
      inputs: { conditioning: ["5", 0] },
    },
    "9": {
      class_type: "ModelSamplingAuraFlow",
      inputs: { shift: 3.1, model: ["1", 0] },
    },
    "11": {
      class_type: "VAEDecode",
      inputs: { samples: ["8", 0], vae: ["3", 0] },
    },
    "12": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "desichat", images: ["11", 0] },
    },
  };
  if (lora) {
    graph["10"] = {
      class_type: "LoraLoaderModelOnly",
      inputs: {
        lora_name: lora,
        strength_model: 1,
        model: ["9", 0],
      },
    };
  }
  return graph;
}

function injectSavedWorkflow(raw, imageName, prompt) {
  const graph = JSON.parse(JSON.stringify(raw));
  Object.keys(graph).forEach(function (id) {
    const node = graph[id];
    if (!node || !node.class_type) return;
    const t = node.class_type;
    node.inputs = node.inputs || {};
    if (t === "LoadImage") node.inputs.image = imageName;
    if (/TextEncodeQwenImageEdit/i.test(t) || t === "CLIPTextEncode") {
      if (node.inputs.prompt != null) node.inputs.prompt = prompt;
      if (node.inputs.text != null) node.inputs.text = prompt;
    }
  });
  return graph;
}

function loadSavedWorkflow() {
  const custom = String(process.env.COMFY_WORKFLOW_FILE || "").trim();
  const file = custom
    ? path.resolve(custom)
    : path.join(__dirname, "..", "data", "comfy-qwen-edit-api.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return null;
  }
}

async function waitForOutput(promptId) {
  const t0 = Date.now();
  const limit = 180000;
  while (Date.now() - t0 < limit) {
    const res = await comfyFetch("/history/" + promptId, { timeoutMs: 15000 });
    if (res.ok) {
      const hist = await res.json();
      const job = hist && hist[promptId];
      if (job && job.status && job.status.status_str === "error") {
        const msgs = (job.status.messages || [])
          .map(function (m) {
            if (Array.isArray(m)) {
              const detail = m[1];
              if (detail && typeof detail === "object") {
                return (
                  detail.exception_message ||
                  detail.message ||
                  JSON.stringify(detail).slice(0, 180)
                );
              }
              return m.join(" ");
            }
            return String(m);
          })
          .join("; ");
        throw new Error(msgs.slice(0, 280) || "GPU edit failed");
      }
      if (job && job.outputs) {
        const ids = Object.keys(job.outputs);
        for (let i = 0; i < ids.length; i++) {
          const images = job.outputs[ids[i]] && job.outputs[ids[i]].images;
          if (images && images[0] && images[0].filename) return images[0];
        }
      }
    }
    await new Promise(function (r) {
      setTimeout(r, 1500);
    });
  }
  throw new Error("GPU edit timed out");
}

async function downloadOutput(meta) {
  const q =
    "?filename=" +
    encodeURIComponent(meta.filename) +
    "&subfolder=" +
    encodeURIComponent(meta.subfolder || "") +
    "&type=" +
    encodeURIComponent(meta.type || "output");
  const res = await comfyFetch("/view" + q, { timeoutMs: 60000 });
  if (!res.ok) throw new Error("Could not download GPU image");
  return Buffer.from(await res.arrayBuffer());
}

async function editWithComfy({ imageB64, prompt }) {
  const health = await probeComfy();
  if (!health.ok) {
    const err = new Error(health.error || "GPU pod is not ready");
    err.code = "GPU_DOWN";
    throw err;
  }
  const uploaded = await uploadImage(imageB64);
  const size = latentSize(readImageSize(uploaded.buf).width, readImageSize(uploaded.buf).height);
  const imageName = uploaded.name;
  const saved = loadSavedWorkflow();
  const workflow = saved
    ? injectSavedWorkflow(saved, imageName, prompt)
    : buildWorkflow({
        unet: process.env.COMFY_UNET || health.models.unet,
        clip: process.env.COMFY_CLIP || health.models.clip,
        vae: process.env.COMFY_VAE || health.models.vae,
        lora: process.env.COMFY_LORA || health.models.lora,
        imageName: imageName,
        prompt: prompt,
        seed: crypto.randomInt(1, 2147483647),
        encodeClass: await qwenEncodeClass(),
        width: size.width,
        height: size.height,
      });
  const body = {
    prompt: workflow,
    client_id: crypto.randomBytes(8).toString("hex"),
  };
  const queued = await comfyFetch("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 30000,
  });
  const queuedJson = await queued.json().catch(function () {
    return {};
  });
  if (!queued.ok) {
    const errObj = queuedJson && queuedJson.error;
    const msg =
      (typeof errObj === "string" && errObj) ||
      (errObj && (errObj.message || errObj.type)) ||
      queuedJson.message ||
      "GPU rejected the workflow";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg).slice(0, 240));
  }
  const promptId = queuedJson.prompt_id;
  if (!promptId) throw new Error("GPU did not start the edit");
  const out = await waitForOutput(promptId);
  return downloadOutput(out);
}

module.exports = {
  comfyEnabled,
  backendMode,
  probeComfy,
  editWithComfy,
};
