// Khmer Voice Studio — API worker.
//
// One keyed provider: CAMB.AI MARS 8.1 (Khmer + 300+ locales + voice cloning).
// The visitor pastes their own CAMB.AI key in the browser; it is sent per
// request in the x-camb-key header (or falls back to a worker secret), so the
// site works with no server-side secret at all.
//
// A keyless Google Translate voice stays available as the "just try it" option
// (undocumented endpoint, rate limited, capped to short text).

const CAMB_API = "https://client.camb.ai/apis";
const CAMB_MODEL = "mars-8.1-flash-beta";
const CAMB_DEFAULT_LANG = "km-kh";
const MAX_CAMB_CHARS = 3000;

// Free, keyless voice: the Google Translate speech endpoint that gTTS uses.
const GOOGLE_FREE_URL = "https://translate.google.com/translate_tts";
const GOOGLE_FREE_MAX_CHARS = 1500;
const GOOGLE_FREE_CHUNK = 180;
const GOOGLE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const GOOGLE_LANGS = new Set(["km", "en", "th", "vi", "lo", "my", "id", "ms", "ja", "ko", "zh-CN"]);

const MAX_TTS_CHARS = 3000;
const MAX_JSON_BYTES = 64 * 1024;
const MAX_CLONE_BYTES = 30 * 1024 * 1024;
const MAX_CLONE_FILE_BYTES = 10 * 1024 * 1024;

const LOCALE_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$/;

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") return health(env);

      if (url.pathname === "/api/voices" || url.pathname === "/api/voices/camb") {
        if (request.method !== "GET") return methodNotAllowed("GET");
        return cambVoices(request, env);
      }

      if (url.pathname === "/api/tts") {
        if (request.method !== "POST") return methodNotAllowed("POST");
        return tts(request, env);
      }

      if (url.pathname === "/api/voices/clone") {
        if (request.method !== "POST") return methodNotAllowed("POST");
        return cloneVoice(request, env);
      }

      if (url.pathname.startsWith("/api/")) {
        return json({ error: "not_found", message: "Unknown endpoint." }, 404);
      }
    } catch (error) {
      console.error("unhandled", error?.stack || error);
      return json({ error: "server", message: "Server error. Try again." }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};

/* ---------------- keys ---------------- */

function envCambKey(env) {
  return (env?.CAMB_API_KEY || env?.CAMB_AI_API_KEY || "").trim();
}

function cambKey(request, env) {
  return request.headers.get("x-camb-key")?.trim() || envCambKey(env);
}

function health(env) {
  return json({
    ok: true,
    provider: "camb",
    providers: { camb: Boolean(envCambKey(env)), google: true },
    maxChars: MAX_TTS_CHARS,
    freeMaxChars: GOOGLE_FREE_MAX_CHARS,
    cambMaxChars: MAX_CAMB_CHARS,
    model: CAMB_MODEL,
  });
}

/* ---------------- voices ---------------- */

async function cambVoices(request, env) {
  const key = cambKey(request, env);
  if (!key) {
    return json(
      { error: "no_key", provider: "camb", message: "បញ្ចូល CAMB.AI key ដើម្បីបង្ហាញបញ្ជីសំឡេង។" },
      400,
    );
  }

  let response;
  try {
    response = await fetch(`${CAMB_API}/list-voices`, { headers: { "x-api-key": key } });
  } catch {
    return json({ error: "network", message: "មិនអាចភ្ជាប់ទៅ CAMB.AI បានទេ។ សូមព្យាយាមម្តងទៀត។" }, 502);
  }

  if (!response.ok) return upstreamError(response, "CAMB.AI");

  const data = await safeJsonAsync(response);
  const raw = Array.isArray(data) ? data : data?.voices || [];
  const voices = raw
    .filter((voice) => voice && voice.id !== undefined)
    .map((voice) => ({
      id: String(voice.id),
      name: voice.voice_name || voice.name || `CAMB ${voice.id}`,
      gender:
        String(voice.gender) === "1" ? "Male" : String(voice.gender) === "2" ? "Female" : "",
      language: typeof voice.language === "string" ? voice.language.toLowerCase() : "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return json({ provider: "camb", model: CAMB_MODEL, voices });
}

/* ---------------- text to speech ---------------- */

async function tts(request, env) {
  if (!sameOrigin(request)) return forbidden();
  if (tooBig(request, MAX_JSON_BYTES)) return tooLarge();

  const body = await readJson(request);
  if (body instanceof Response) return body;

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "no_text", message: "Enter some text to speak." }, 400);

  const provider = body.provider === "google" ? "google" : "camb";
  if (provider === "google") return googleSpeech(body, text);

  if (text.length > MAX_CAMB_CHARS) {
    return json(
      { error: "too_long", message: `CAMB.AI accepts up to ${MAX_CAMB_CHARS} characters per request.` },
      400,
    );
  }
  if (text.length < 2) {
    return json({ error: "no_text", message: "CAMB.AI needs at least 2 characters." }, 400);
  }

  return cambSpeech(request, env, body, text);
}

async function cambSpeech(request, env, body, text) {
  const key = cambKey(request, env);
  if (!key) {
    return json(
      { error: "no_key", provider: "camb", message: "Still no CAMB.AI key. Add one with the Keys button." },
      400,
    );
  }

  const voice = String(body.voice ?? "").trim();
  if (!/^\d{1,12}$/.test(voice)) {
    return json({ error: "bad_voice", message: "That CAMB.AI voice id is not valid." }, 400);
  }

  const requested = String(body.language || "").trim().toLowerCase();
  const language = LOCALE_RE.test(requested) ? requested : CAMB_DEFAULT_LANG;

  const payload = {
    text,
    voice_id: Number(voice),
    language,
    speech_model: CAMB_MODEL,
    output_configuration: { format: "mp3" },
  };

  const rate = clamp(body.speed, 0.5, 2, 1);
  if (rate !== 1) payload.voice_settings = { speaking_rate: Math.round(rate * 100) / 100 };

  let response;
  try {
    response = await fetch(`${CAMB_API}/tts-stream`, {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: "network", message: "Cannot reach CAMB.AI. Try again." }, 502);
  }

  if (!response.ok) return upstreamError(response, "CAMB.AI");

  return new Response(response.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store, no-transform",
      "x-tts-provider": "camb",
      "x-tts-voice": voice,
      "x-tts-language": language,
    },
  });
}

async function googleSpeech(body, text) {
  if (text.length > GOOGLE_FREE_MAX_CHARS) {
    return json(
      {
        error: "too_long",
        message: `The free voice handles up to ${GOOGLE_FREE_MAX_CHARS} characters. Add a CAMB.AI key for longer text.`,
      },
      400,
    );
  }

  const language = GOOGLE_LANGS.has(body.language) ? body.language : "km";
  const chunks = splitForFreeVoice(text, GOOGLE_FREE_CHUNK);
  if (chunks.length === 0) return json({ error: "no_text", message: "Enter some text to speak." }, 400);

  const parts = [];
  for (const chunk of chunks) {
    const url = `${GOOGLE_FREE_URL}?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
      language,
    )}&q=${encodeURIComponent(chunk)}`;

    let response;
    try {
      response = await fetch(url, {
        headers: {
          "user-agent": GOOGLE_USER_AGENT,
          referer: "https://translate.google.com/",
        },
      });
    } catch {
      return freeVoiceUnavailable(0);
    }

    if (!response.ok) {
      console.error("google free tts failed", language, response.status);
      return freeVoiceUnavailable(response.status);
    }

    parts.push(await response.arrayBuffer());
  }

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const audio = new Uint8Array(total);

  let offset = 0;
  for (const part of parts) {
    audio.set(new Uint8Array(part), offset);
    offset += part.byteLength;
  }

  return new Response(audio, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store, no-transform",
      "x-tts-provider": "google",
      "x-tts-voice": language,
      "x-tts-chunks": String(chunks.length),
    },
  });
}

// Google's endpoint takes roughly 200 characters per request, so long text is
// split on sentence-ish boundaries and the MP3 frames are concatenated.
function splitForFreeVoice(text, limit) {
  const chunks = [];
  let rest = text.trim();

  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = Math.max(
      window.lastIndexOf(" "),
      window.lastIndexOf("\n"),
      window.lastIndexOf("។"),
      window.lastIndexOf("."),
      window.lastIndexOf("!"),
      window.lastIndexOf("?"),
    );
    if (cut < limit * 0.5) cut = limit;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

function freeVoiceUnavailable(status) {
  console.error("google free tts unavailable", status);
  return json(
    {
      error: "free_unavailable",
      message:
        "The free Google voice is unavailable right now (rate limited). Add a CAMB.AI key for a reliable voice.",
    },
    status === 429 ? 429 : 502,
  );
}

/* ---------------- voice cloning ---------------- */

async function cloneVoice(request, env) {
  if (!sameOrigin(request)) return forbidden();

  if (tooBig(request, MAX_CLONE_BYTES)) {
    return json({ error: "too_large", message: "Recordings are too large. Keep the total under 30 MB." }, 413);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "bad_form", message: "Upload the recording as form data." }, 400);
  }

  if (form.get("consent") !== "true") {
    return json(
      {
        error: "consent_required",
        message: "Confirm that this is your own voice, or that you have the speaker's permission.",
      },
      400,
    );
  }

  const name = String(form.get("name") || "").trim().slice(0, 60);
  if (!name) return json({ error: "no_name", message: "Give the cloned voice a name." }, 400);

  const entries = [...form.getAll("files"), ...form.getAll("file")].filter(
    (entry) => typeof entry !== "string" && entry.size > 0,
  );

  if (entries.length === 0) {
    return json({ error: "no_files", message: "Add one audio recording of the voice." }, 400);
  }
  for (const entry of entries) {
    if (entry.size > MAX_CLONE_FILE_BYTES) {
      return json({ error: "file_too_large", message: "The recording must stay under 10 MB." }, 400);
    }
  }

  return cambClone(request, env, form, name, entries[0]);
}

async function cambClone(request, env, form, name, entry) {
  const key = cambKey(request, env);
  if (!key) {
    return json(
      { error: "no_key", message: "Cloning needs a CAMB.AI key. Add one with the Keys button." },
      400,
    );
  }

  const buffer = await entry.arrayBuffer();
  const filename = entry.name || "sample.wav";
  const type = entry.type || "audio/wav";

  const requestedLang = String(form.get("language") || CAMB_DEFAULT_LANG).toLowerCase();
  const language = LOCALE_RE.test(requestedLang) ? requestedLang : CAMB_DEFAULT_LANG;

  const outgoing = new FormData();
  outgoing.append("voice_name", name);
  outgoing.append("gender", String(form.get("gender")) === "1" ? "1" : "2");
  outgoing.append("age", String(clamp(form.get("age"), 1, 100, 30)));
  outgoing.append("enhance_audio", "true");
  outgoing.append("language", language);
  outgoing.append("description", "Cloned in Khmer Voice Studio");
  outgoing.append("file", new Blob([buffer], { type }), filename);

  let response;
  try {
    response = await fetch(`${CAMB_API}/create-custom-voice`, {
      method: "POST",
      headers: { "x-api-key": key },
      body: outgoing,
    });
  } catch {
    return json({ error: "network", message: "Cannot reach CAMB.AI. Try again." }, 502);
  }

  if (!response.ok) return upstreamError(response, "CAMB.AI");

  const data = await safeJsonAsync(response);
  if (data?.voice_id === undefined) {
    return json({ error: "upstream", message: "CAMB.AI did not return a voice id." }, 502);
  }

  return json({ ok: true, provider: "camb", voice_id: String(data.voice_id), name });
}

/* ---------------- helpers ---------------- */

// Render (and any reverse proxy) terminates TLS and forwards plain HTTP, so
// the request URL scheme can be http:// while the browser sends an https://
// Origin. Compare hosts only.
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  if (!originHost) return false;

  const hosts = new Set();
  try {
    hosts.add(new URL(request.url).host.toLowerCase());
  } catch {
    /* ignore */
  }

  for (const header of ["x-forwarded-host", "host"]) {
    const value = request.headers.get(header);
    if (!value) continue;
    for (const part of value.split(",")) {
      const host = part.trim().toLowerCase();
      if (host) hosts.add(host);
    }
  }

  return hosts.has(originHost);
}

function forbidden() {
  return json({ error: "bad_origin", message: "Cross-origin requests are not allowed." }, 403);
}

function tooBig(request, limit) {
  return Number(request.headers.get("content-length") || 0) > limit;
}

function tooLarge() {
  return json({ error: "too_large", message: "Request is too large." }, 413);
}

function methodNotAllowed(allowed) {
  return json({ error: "method_not_allowed", message: `Use ${allowed}.` }, 405);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return json({ error: "bad_json", message: "Request body must be JSON." }, 400);
  }
}

function clamp(value, min, max, fallback) {
  const number = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function upstreamError(response, provider) {
  const raw = await response.text().catch(() => "");
  const parsed = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();

  const detail = Array.isArray(parsed?.detail) ? parsed.detail[0]?.msg : parsed?.detail?.message;
  const message =
    (typeof detail === "string" && detail) ||
    parsed?.error?.message ||
    (typeof parsed?.payload === "string" && parsed.payload) ||
    parsed?.message ||
    raw.replace(/\s+/g, " ").slice(0, 240) ||
    `${provider} request failed.`;

  const status = response.status === 429 ? 429 : 502;
  console.error(provider, "failed", response.status, raw.slice(0, 240));
  return json({ error: "upstream", provider, upstreamStatus: response.status, message }, status);
}

async function safeJsonAsync(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
