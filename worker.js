// Khmer Voice Studio — API worker.
//
// Azure AI Speech handles Khmer (km-KH) and 40+ other locales with neural
// voices. ElevenLabs handles instant voice cloning of the visitor's own voice.
// Keys arrive from the browser per request (x-azure-key / x-eleven-key) or fall
// back to worker secrets, so the site works with or without a server key.

const AZURE_DEFAULT_REGION = "southeastasia";
const ELEVEN_API = "https://api.elevenlabs.io/v1";
const ELEVEN_OUTPUT = "mp3_44100_128";
const ELEVEN_MODELS = new Set([
  "eleven_multilingual_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
  "eleven_v3",
]);
const ELEVEN_DEFAULT_MODEL = "eleven_multilingual_v2";

const CAMB_API = "https://client.camb.ai/apis";
const CAMB_MODEL = "mars-8.1-flash-beta";
const CAMB_DEFAULT_LANG = "km-kh";
const MAX_CAMB_CHARS = 3000;
const CAMB_LANGS = new Set([
  "km-kh",
  "en-us",
  "th-th",
  "vi-vn",
  "lo-la",
  "my-mm",
  "zh-cn",
  "ja-jp",
  "ko-kr",
  "id-id",
  "ms-my",
]);

// Free, keyless voice: the Google Translate speech endpoint that gTTS uses.
// It is undocumented and rate-limited, so it is capped and used only as the
// no-key fallback rather than the primary voice.
const GOOGLE_FREE_URL = "https://translate.google.com/translate_tts";
const GOOGLE_FREE_MAX_CHARS = 1500;
const GOOGLE_FREE_CHUNK = 180;
const GOOGLE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const GOOGLE_LANGS = new Set(["km", "en", "th", "vi", "ja", "ko", "zh-CN", "lo", "my", "id", "ms", "fr", "de", "es"]);

const MAX_TTS_CHARS = 5000;
const MAX_JSON_BYTES = 64 * 1024;
const MAX_CLONE_BYTES = 30 * 1024 * 1024;
const MAX_CLONE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CLONE_FILES = 3;

const VOICE_RE = /^[A-Za-z0-9-]{4,64}$/;
const VOICE_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const REGION_RE = /^[a-z]{2,12}[a-z0-9-]{0,20}$/;

// Curated fallback list, used before a key is entered or if Azure's live list
// is unreachable. [id, display name, gender, locale, locale name]
const BUILTIN_VOICES = [
  ["km-KH-SreymomNeural", "Sreymom", "Female", "km-KH", "Khmer (Cambodia)"],
  ["km-KH-PisethNeural", "Piseth", "Male", "km-KH", "Khmer (Cambodia)"],
  ["en-US-AvaMultilingualNeural", "Ava", "Female", "en-US", "English (United States)"],
  ["en-US-AndrewMultilingualNeural", "Andrew", "Male", "en-US", "English (United States)"],
  ["en-US-EmmaMultilingualNeural", "Emma", "Female", "en-US", "English (United States)"],
  ["en-US-BrianMultilingualNeural", "Brian", "Male", "en-US", "English (United States)"],
  ["en-US-JennyNeural", "Jenny", "Female", "en-US", "English (United States)"],
  ["en-US-GuyNeural", "Guy", "Male", "en-US", "English (United States)"],
  ["en-GB-SoniaNeural", "Sonia", "Female", "en-GB", "English (United Kingdom)"],
  ["en-GB-RyanNeural", "Ryan", "Male", "en-GB", "English (United Kingdom)"],
  ["en-AU-NatashaNeural", "Natasha", "Female", "en-AU", "English (Australia)"],
  ["en-AU-WilliamNeural", "William", "Male", "en-AU", "English (Australia)"],
  ["en-IN-NeerjaNeural", "Neerja", "Female", "en-IN", "English (India)"],
  ["en-IN-PrabhatNeural", "Prabhat", "Male", "en-IN", "English (India)"],
  ["th-TH-PremwadeeNeural", "Premwadee", "Female", "th-TH", "Thai (Thailand)"],
  ["th-TH-NiwatNeural", "Niwat", "Male", "th-TH", "Thai (Thailand)"],
  ["vi-VN-HoaiMyNeural", "HoaiMy", "Female", "vi-VN", "Vietnamese (Vietnam)"],
  ["vi-VN-NamMinhNeural", "NamMinh", "Male", "vi-VN", "Vietnamese (Vietnam)"],
  ["my-MM-NilarNeural", "Nilar", "Female", "my-MM", "Burmese (Myanmar)"],
  ["my-MM-ThihaNeural", "Thiha", "Male", "my-MM", "Burmese (Myanmar)"],
  ["lo-LA-KeomanyNeural", "Keomany", "Female", "lo-LA", "Lao (Laos)"],
  ["lo-LA-ChanthavongNeural", "Chanthavong", "Male", "lo-LA", "Lao (Laos)"],
  ["ja-JP-NanamiNeural", "Nanami", "Female", "ja-JP", "Japanese (Japan)"],
  ["ja-JP-KeitaNeural", "Keita", "Male", "ja-JP", "Japanese (Japan)"],
  ["ko-KR-SunHiNeural", "SunHi", "Female", "ko-KR", "Korean (Korea)"],
  ["ko-KR-InJoonNeural", "InJoon", "Male", "ko-KR", "Korean (Korea)"],
  ["zh-CN-XiaoxiaoNeural", "Xiaoxiao", "Female", "zh-CN", "Chinese (Mandarin, Simplified)"],
  ["zh-CN-YunxiNeural", "Yunxi", "Male", "zh-CN", "Chinese (Mandarin, Simplified)"],
  ["zh-TW-HsiaoChenNeural", "HsiaoChen", "Female", "zh-TW", "Chinese (Taiwan)"],
  ["zh-HK-HiuMaanNeural", "HiuMaan", "Female", "zh-HK", "Chinese (Cantonese, Hong Kong)"],
  ["id-ID-GadisNeural", "Gadis", "Female", "id-ID", "Indonesian (Indonesia)"],
  ["id-ID-ArdiNeural", "Ardi", "Male", "id-ID", "Indonesian (Indonesia)"],
  ["ms-MY-YasminNeural", "Yasmin", "Female", "ms-MY", "Malay (Malaysia)"],
  ["ms-MY-OsmanNeural", "Osman", "Male", "ms-MY", "Malay (Malaysia)"],
  ["fr-FR-DeniseNeural", "Denise", "Female", "fr-FR", "French (France)"],
  ["fr-FR-HenriNeural", "Henri", "Male", "fr-FR", "French (France)"],
  ["de-DE-KatjaNeural", "Katja", "Female", "de-DE", "German (Germany)"],
  ["de-DE-ConradNeural", "Conrad", "Male", "de-DE", "German (Germany)"],
  ["es-ES-ElviraNeural", "Elvira", "Female", "es-ES", "Spanish (Spain)"],
  ["es-ES-AlvaroNeural", "Alvaro", "Male", "es-ES", "Spanish (Spain)"],
  ["it-IT-ElsaNeural", "Elsa", "Female", "it-IT", "Italian (Italy)"],
  ["it-IT-DiegoNeural", "Diego", "Male", "it-IT", "Italian (Italy)"],
  ["pt-BR-FranciscaNeural", "Francisca", "Female", "pt-BR", "Portuguese (Brazil)"],
  ["pt-BR-AntonioNeural", "Antonio", "Male", "pt-BR", "Portuguese (Brazil)"],
  ["ru-RU-SvetlanaNeural", "Svetlana", "Female", "ru-RU", "Russian (Russia)"],
  ["ru-RU-DmitryNeural", "Dmitry", "Male", "ru-RU", "Russian (Russia)"],
  ["hi-IN-SwaraNeural", "Swara", "Female", "hi-IN", "Hindi (India)"],
  ["hi-IN-MadhurNeural", "Madhur", "Male", "hi-IN", "Hindi (India)"],
  ["ar-SA-ZariyahNeural", "Zariyah", "Female", "ar-SA", "Arabic (Saudi Arabia)"],
  ["ar-SA-HamedNeural", "Hamed", "Male", "ar-SA", "Arabic (Saudi Arabia)"],
  ["tr-TR-EmelNeural", "Emel", "Female", "tr-TR", "Turkish (Turkey)"],
  ["tr-TR-AhmetNeural", "Ahmet", "Male", "tr-TR", "Turkish (Turkey)"],
  ["nl-NL-ColetteNeural", "Colette", "Female", "nl-NL", "Dutch (Netherlands)"],
  ["nl-NL-MaartenNeural", "Maarten", "Male", "nl-NL", "Dutch (Netherlands)"],
  ["pl-PL-ZofiaNeural", "Zofia", "Female", "pl-PL", "Polish (Poland)"],
  ["pl-PL-MarekNeural", "Marek", "Male", "pl-PL", "Polish (Poland)"],
  ["uk-UA-PolinaNeural", "Polina", "Female", "uk-UA", "Ukrainian (Ukraine)"],
  ["uk-UA-OstapNeural", "Ostap", "Male", "uk-UA", "Ukrainian (Ukraine)"],
  ["fil-PH-BlessicaNeural", "Blessica", "Female", "fil-PH", "Filipino (Philippines)"],
  ["fil-PH-AngeloNeural", "Angelo", "Male", "fil-PH", "Filipino (Philippines)"],
].map(([id, name, gender, locale, localeName]) => ({ id, name, gender, locale, localeName }));

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") return health(env);

      if (url.pathname === "/api/voices" && request.method === "GET") {
        return voices(request, env);
      }

      if (url.pathname === "/api/tts") {
        if (request.method !== "POST") return methodNotAllowed("POST");
        return tts(request, env);
      }

      if (url.pathname === "/api/voices/clone") {
        if (request.method !== "POST") return methodNotAllowed("POST");
        return cloneVoice(request, env);
      }

      if (url.pathname === "/api/voices/cloned" && request.method === "GET") {
        return clonedVoices(request, env);
      }

      if (url.pathname === "/api/voices/camb" && request.method === "GET") {
        return cambVoices(request, env);
      }

      if (url.pathname.startsWith("/api/voices/cloned/") && request.method === "DELETE") {
        return deleteClonedVoice(request, env, url.pathname.slice("/api/voices/cloned/".length));
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

function envAzureKey(env) {
  return (env?.AZURE_SPEECH_KEY || env?.AZURE_TTS_KEY || "").trim();
}

function envElevenKey(env) {
  return (env?.ELEVENLABS_API_KEY || env?.ELEVEN_LABS_API_KEY || "").trim();
}

function envCambKey(env) {
  return (env?.CAMB_API_KEY || env?.CAMB_AI_API_KEY || "").trim();
}

function normalizeRegion(value) {
  const region = String(value || "").trim().toLowerCase();
  return REGION_RE.test(region) ? region : "";
}

function azureKey(request, env) {
  return request.headers.get("x-azure-key")?.trim() || envAzureKey(env);
}

function elevenKey(request, env) {
  return request.headers.get("x-eleven-key")?.trim() || envElevenKey(env);
}

function cambKey(request, env) {
  return request.headers.get("x-camb-key")?.trim() || envCambKey(env);
}

function azureRegion(request, env) {
  return (
    normalizeRegion(request.headers.get("x-azure-region")) ||
    normalizeRegion(env?.AZURE_SPEECH_REGION) ||
    AZURE_DEFAULT_REGION
  );
}

function health(env) {
  return json({
    ok: true,
    providers: {
      azure: Boolean(envAzureKey(env)),
      elevenlabs: Boolean(envElevenKey(env)),
      camb: Boolean(envCambKey(env)),
      google: true,
    },
    defaultRegion: AZURE_DEFAULT_REGION,
    maxChars: MAX_TTS_CHARS,
    voices: BUILTIN_VOICES.length,
  });
}

/* ---------------- voices ---------------- */

async function voices(request, env) {
  const key = azureKey(request, env);
  if (!key) {
    return json({ source: "builtin", voices: BUILTIN_VOICES });
  }

  const region = azureRegion(request, env);
  try {
    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
      { headers: { "Ocp-Apim-Subscription-Key": key } },
    );

    if (!response.ok) {
      console.error("azure voices failed", response.status, (await response.text()).slice(0, 200));
      return json({ source: "builtin", voices: BUILTIN_VOICES, warning: "Azure voice list unavailable." });
    }

    const raw = await response.json();
    const list = (Array.isArray(raw) ? raw : [])
      .filter((voice) => typeof voice?.ShortName === "string")
      .map((voice) => ({
        id: voice.ShortName,
        name: voice.LocalName || voice.DisplayName || voice.ShortName,
        gender: voice.Gender || "",
        locale: voice.Locale || "",
        localeName: voice.LocaleName || "",
      }))
      .sort((a, b) => a.locale.localeCompare(b.locale) || a.name.localeCompare(b.name));

    if (list.length === 0) {
      return json({ source: "builtin", voices: BUILTIN_VOICES });
    }
    return json({ source: "azure", voices: list });
  } catch (error) {
    console.error("azure voices error", error?.message || error);
    return json({ source: "builtin", voices: BUILTIN_VOICES, warning: "Azure voice list unreachable." });
  }
}

async function clonedVoices(request, env) {
  const key = elevenKey(request, env);
  if (!key) return json({ error: "no_key", message: "Add an ElevenLabs API key to use cloned voices." }, 400);

  const response = await fetch(`${ELEVEN_API}/voices`, { headers: { "xi-api-key": key } });
  if (!response.ok) return upstreamError(response, "ElevenLabs");

  const data = await safeJsonAsync(response);
  const voices = (data?.voices || []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    category: voice.category || "",
    previewUrl: voice.preview_url || "",
    cloned: voice.category === "cloned",
  }));

  voices.sort((a, b) => Number(b.cloned) - Number(a.cloned) || a.name.localeCompare(b.name));
  return json({ voices });
}

async function cambVoices(request, env) {
  const key = cambKey(request, env);
  if (!key) return json({ error: "no_key", message: "Add a CAMB.AI key to load its voices." }, 400);

  const response = await fetch(`${CAMB_API}/list-voices`, { headers: { "x-api-key": key } });
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
      locale: voice.language || "",
      localeName: "",
    }));

  return json({ voices });
}

/* ---------------- text to speech ---------------- */

async function tts(request, env) {
  if (!sameOrigin(request)) return forbidden();
  if (tooBig(request, MAX_JSON_BYTES)) return tooLarge();

  const body = await readJson(request);
  if (body instanceof Response) return body;

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "no_text", message: "Enter some text to speak." }, 400);
  if (text.length > MAX_TTS_CHARS) {
    return json(
      { error: "too_long", message: `Text is too long. Keep it under ${MAX_TTS_CHARS} characters.` },
      400,
    );
  }

  const provider = ["elevenlabs", "camb", "google"].includes(body.provider) ? body.provider : "azure";

  if (provider === "google") return googleSpeech(body, text);
  if (provider === "camb") return cambSpeech(request, env, body, text);
  if (provider === "elevenlabs") return elevenSpeech(request, env, body, text);
  return azureSpeech(request, env, body, text);
}

async function azureSpeech(request, env, body, text) {
  const key = azureKey(request, env);
  if (!key) {
    return json(
      { error: "no_key", provider: "azure", message: "No Azure Speech key. Add one with the Keys button." },
      400,
    );
  }

  const voice = typeof body.voice === "string" && VOICE_RE.test(body.voice) ? body.voice : "km-KH-SreymomNeural";
  if (!/^[a-z]{2,3}-[A-Z]{2}-/.test(voice)) {
    return json({ error: "bad_voice", message: "That Azure voice name is not valid." }, 400);
  }

  const rate = clamp(body.rate, 0.5, 1.5, 1);
  const pitch = clamp(body.pitch, -50, 50, 0);
  const region = azureRegion(request, env);

  let response;
  try {
    response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml; charset=utf-8",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "khmer-voice-studio",
      },
      body: buildSsml({ text, voice, rate, pitch }),
    });
  } catch (error) {
    return json(
      { error: "network", message: `Cannot reach Azure (${region}). Check the region and try again.` },
      502,
    );
  }

  if (!response.ok) return upstreamError(response, "Azure");

  return new Response(response.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store, no-transform",
      "x-tts-provider": "azure",
      "x-tts-voice": voice,
    },
  });
}

async function elevenSpeech(request, env, body, text) {
  const key = elevenKey(request, env);
  if (!key) {
    return json(
      { error: "no_key", provider: "elevenlabs", message: "No ElevenLabs key. Add one with the Keys button." },
      400,
    );
  }

  const voice = typeof body.voice === "string" && VOICE_ID_RE.test(body.voice) ? body.voice : "";
  if (!voice) return json({ error: "bad_voice", message: "Choose a cloned voice first." }, 400);

  const model = ELEVEN_MODELS.has(body.model) ? body.model : ELEVEN_DEFAULT_MODEL;
  const speed = clamp(body.speed, 0.7, 1.2, 1);
  const stability = clamp(body.stability, 0, 1, 0.5);
  const similarity = clamp(body.similarity, 0, 1, 0.75);

  const settings = {
    stability,
    similarity_boost: similarity,
    style: 0,
    use_speaker_boost: true,
  };
  // Only send speed when it differs from the default, so models/paths that do
  // not accept the field are never given it unnecessarily.
  if (speed !== 1) settings.speed = speed;

  let response;
  try {
    response = await fetch(
      `${ELEVEN_API}/text-to-speech/${encodeURIComponent(voice)}?output_format=${ELEVEN_OUTPUT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
      },
    );
  } catch {
    return json({ error: "network", message: "Cannot reach ElevenLabs. Check your connection." }, 502);
  }

  if (!response.ok) return upstreamError(response, "ElevenLabs");

  return new Response(response.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store, no-transform",
      "x-tts-provider": "elevenlabs",
      "x-tts-voice": voice,
    },
  });
}

async function googleSpeech(body, text) {
  if (text.length > GOOGLE_FREE_MAX_CHARS) {
    return json(
      {
        error: "too_long",
        message: `The free voice handles up to ${GOOGLE_FREE_MAX_CHARS} characters. Use an Azure voice for longer text.`,
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
      window.lastIndexOf("，"),
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
        "The free Google voice is unavailable right now (rate limited). Add an Azure key for a reliable Khmer voice.",
    },
    status === 429 ? 429 : 502,
  );
}

async function cambSpeech(request, env, body, text) {
  const key = cambKey(request, env);
  if (!key) {
    return json(
      { error: "no_key", provider: "camb", message: "No CAMB.AI key. Add one with the Keys button." },
      400,
    );
  }

  if (text.length < 3) {
    return json({ error: "no_text", message: "CAMB.AI needs at least 3 characters." }, 400);
  }
  if (text.length > MAX_CAMB_CHARS) {
    return json(
      { error: "too_long", message: `CAMB.AI accepts up to ${MAX_CAMB_CHARS} characters per request.` },
      400,
    );
  }

  const voice = String(body.voice ?? "");
  if (!/^\d{1,12}$/.test(voice)) {
    return json({ error: "bad_voice", message: "That CAMB.AI voice id is not valid." }, 400);
  }

  const requested = String(body.language || "").toLowerCase();
  const language = CAMB_LANGS.has(requested) ? requested : CAMB_DEFAULT_LANG;

  const call = (format) =>
    fetch(`${CAMB_API}/tts-stream`, {
      method: "POST",
      headers: { "x-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        voice_id: Number(voice),
        language,
        speech_model: CAMB_MODEL,
        output_configuration: { format },
      }),
    });

  let format = "mp3";
  let response;
  try {
    response = await call(format);
    if (response.status === 422) {
      await response.text();
      format = "wav";
      response = await call(format);
    }
  } catch {
    return json({ error: "network", message: "Cannot reach CAMB.AI. Try again." }, 502);
  }

  if (!response.ok) return upstreamError(response, "CAMB.AI");

  return new Response(response.body, {
    headers: {
      "content-type": format === "wav" ? "audio/wav" : "audio/mpeg",
      "cache-control": "no-store, no-transform",
      "x-tts-provider": "camb",
      "x-tts-voice": voice,
    },
  });
}

function buildSsml({ text, voice, rate, pitch }) {
  const locale = voice.split("-").slice(0, 2).join("-");
  const attributes = [];
  if (rate !== 1) attributes.push(`rate="${signedPercent(Math.round((rate - 1) * 100))}"`);
  if (pitch !== 0) attributes.push(`pitch="${signedPercent(Math.round(pitch))}"`);

  const inner = escapeXml(text);
  const prosody = attributes.length ? `<prosody ${attributes.join(" ")}>${inner}</prosody>` : inner;

  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}">` +
    `<voice name="${voice}">${prosody}</voice></speak>`
  );
}

function signedPercent(value) {
  return `${value >= 0 ? "+" : ""}${value}%`;
}

const XML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);
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
    return json({ error: "bad_form", message: "Upload the recordings as form data." }, 400);
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

  const entries = form
    .getAll("files")
    .filter((entry) => typeof entry !== "string" && entry.size > 0);

  if (entries.length === 0) {
    return json({ error: "no_files", message: "Add 1–3 audio recordings of the voice." }, 400);
  }
  if (entries.length > MAX_CLONE_FILES) {
    return json({ error: "too_many_files", message: `Use at most ${MAX_CLONE_FILES} recordings.` }, 400);
  }
  for (const entry of entries) {
    if (entry.size > MAX_CLONE_FILE_BYTES) {
      return json({ error: "file_too_large", message: "Each recording must stay under 10 MB." }, 400);
    }
  }

  if (form.get("provider") === "camb") {
    return cambClone(request, env, form, name, entries);
  }

  const key = elevenKey(request, env);
  if (!key) {
    return json(
      { error: "no_key", message: "Voice cloning needs an ElevenLabs API key. Add one with the Keys button." },
      400,
    );
  }

  const outgoing = new FormData();
  outgoing.append("name", name);
  outgoing.append("remove_background_noise", "true");
  outgoing.append("description", "Cloned in Khmer Voice Studio");

  for (const entry of entries) {
    const buffer = await entry.arrayBuffer();
    const filename = entry.name || "sample.webm";
    const type = entry.type || "audio/webm";
    outgoing.append("files", new Blob([buffer], { type }), filename);
  }

  let response;
  try {
    response = await fetch(`${ELEVEN_API}/voices/add`, {
      method: "POST",
      headers: { "xi-api-key": key },
      body: outgoing,
    });
  } catch {
    return json({ error: "network", message: "Cannot reach ElevenLabs. Check your connection." }, 502);
  }

  if (!response.ok) return upstreamError(response, "ElevenLabs");

  const data = await safeJsonAsync(response);
  if (!data?.voice_id) {
    return json({ error: "upstream", message: "ElevenLabs did not return a voice id." }, 502);
  }
  return json({ ok: true, provider: "elevenlabs", voice_id: data.voice_id, name });
}

async function cambClone(request, env, form, name, entries) {
  const key = cambKey(request, env);
  if (!key) {
    return json(
      { error: "no_key", message: "Cloning with CAMB.AI needs a CAMB.AI key. Add one with the Keys button." },
      400,
    );
  }

  const entry = entries[0];
  const buffer = await entry.arrayBuffer();
  const filename = entry.name || "sample.wav";
  const type = entry.type || "audio/wav";

  const requestedLang = String(form.get("language") || CAMB_DEFAULT_LANG).toLowerCase();
  const language = CAMB_LANGS.has(requestedLang) ? requestedLang : CAMB_DEFAULT_LANG;

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

async function deleteClonedVoice(request, env, rawId) {
  if (!sameOrigin(request)) return forbidden();

  const id = decodeURIComponent(rawId);
  if (!VOICE_ID_RE.test(id)) {
    return json({ error: "bad_voice", message: "That voice id is not valid." }, 400);
  }

  const key = elevenKey(request, env);
  if (!key) return json({ error: "no_key", message: "Add an ElevenLabs API key first." }, 400);

  const response = await fetch(`${ELEVEN_API}/voices/${id}`, {
    method: "DELETE",
    headers: { "xi-api-key": key },
  });

  if (!response.ok) return upstreamError(response, "ElevenLabs");
  return json({ ok: true });
}

/* ---------------- helpers ---------------- */

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
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

  const message =
    parsed?.detail?.message ||
    parsed?.error?.message ||
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
