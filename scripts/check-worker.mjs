// Local self-check for the speech worker routes, using mocked Azure/ElevenLabs upstreams.
// Run with: node scripts/check-worker.mjs

import worker from "../worker.js";

let failures = 0;

function check(name, condition, extra = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

const env = { ASSETS: { fetch: () => new Response("asset", { status: 200 }) } };
const calls = [];

function reset() {
  calls.length = 0;
}

function mock(handler) {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init, headers: init.headers || {}, body: init.body });
    return handler(String(url), init);
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function api(path, { method = "POST", body, headers = {} } = {}) {
  return new Request(`https://voice.example.com${path}`, {
    method,
    headers,
    body,
  });
}

function jsonApi(path, body, headers = {}) {
  return api(path, { body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
}

function cloneForm({ name = "My voice", consent = "true", files } = {}) {
  const form = new FormData();
  if (name !== undefined) form.append("name", name);
  if (consent !== undefined) form.append("consent", consent);
  const list = files ?? [new Blob(["voice-sample"], { type: "audio/webm" })];
  list.forEach((file, index) => form.append("files", file, file.name || `sample-${index + 1}.webm`));
  return form;
}

/* 1. health */ {
  console.log("health");
  reset();
  const bare = await worker.fetch(new Request("https://voice.example.com/api/health"), env);
  const data = await bare.json();
  check("status 200", bare.status === 200);
  check(
    "no keyed providers configured",
    data.providers.azure === false && data.providers.elevenlabs === false && data.providers.camb === false,
  );
  check("free google voice always available", data.providers.google === true);
  check("limits reported", data.maxChars === 5000 && data.defaultRegion === "southeastasia");

  const keyed = await worker.fetch(new Request("https://voice.example.com/api/health"), {
    ...env,
    AZURE_SPEECH_KEY: "secret-azure",
    ELEVENLABS_API_KEY: "secret-eleven",
  });
  const payload = JSON.stringify(await keyed.json());
  check("server keys detected", payload.includes('"azure":true') && payload.includes('"elevenlabs":true'));

  const cambKeyed = await worker.fetch(new Request("https://voice.example.com/api/health"), {
    ...env,
    CAMB_API_KEY: "secret-camb",
  });
  const cambPayload = JSON.stringify(await cambKeyed.json());
  check("camb server key detected", cambPayload.includes('"camb":true'));
  check("camb secret never returned", !cambPayload.includes("secret-camb"));
  check("secrets never returned", !payload.includes("secret-azure") && !payload.includes("secret-eleven"));
}

/* 2. builtin voice list */ {
  console.log("voice list (builtin)");
  reset();
  mock(() => {
    throw new Error("upstream should not be called");
  });
  const response = await worker.fetch(new Request("https://voice.example.com/api/voices"), env);
  const data = await response.json();
  check("status 200", response.status === 200);
  check("source builtin", data.source === "builtin", data.source);
  check("khmer voices present", data.voices.some((v) => v.id === "km-KH-SreymomNeural"));
  check("male khmer present", data.voices.some((v) => v.id === "km-KH-PisethNeural"));
  check("voices carry locale", data.voices.every((v) => v.locale && v.name));
  check("no upstream call", calls.length === 0);
}

/* 3. live Azure voice list */ {
  console.log("voice list (azure)");
  reset();
  mock((url) => {
    if (url.includes("/cognitiveservices/voices/list")) {
      return jsonResponse([
        { ShortName: "km-KH-SreymomNeural", LocalName: "Sreymom", Gender: "Female", Locale: "km-KH", LocaleName: "Khmer (Cambodia)" },
        { ShortName: "en-US-AvaNeural", LocalName: "Ava", Gender: "Female", Locale: "en-US", LocaleName: "English (United States)" },
      ]);
    }
    return new Response("nope", { status: 404 });
  });

  const response = await worker.fetch(
    new Request("https://voice.example.com/api/voices", {
      headers: { "x-azure-key": "az-key", "x-azure-region": "eastus" },
    }),
    env,
  );
  const data = await response.json();
  check("source azure", data.source === "azure", data.source);
  check("two voices mapped", data.voices.length === 2, String(data.voices.length));
  check(
    "short name becomes id",
    data.voices.some((voice) => voice.id === "km-KH-SreymomNeural"),
    JSON.stringify(data.voices.map((voice) => voice.id)),
  );
  check("list sorted by locale", data.voices[0].id === "en-US-AvaNeural", data.voices[0]?.id);
  check("key sent as header", calls[0]?.headers["Ocp-Apim-Subscription-Key"] === "az-key");
  check("region respected", calls[0]?.url.startsWith("https://eastus.tts.speech.microsoft.com/"), calls[0]?.url);
}

/* 4. Azure speech */ {
  console.log("azure tts");
  reset();
  mock(() =>
    new Response("ID3-audio-bytes", {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    }),
  );

  const response = await worker.fetch(
    jsonApi(
      "/api/tts",
      { provider: "azure", voice: "km-KH-SreymomNeural", text: "សួស្តី <&> ពិភពលោក", rate: 1.2, pitch: -5 },
      { "x-azure-key": "az-key", "x-azure-region": "southeastasia" },
    ),
    env,
  );

  const body = await response.text();
  const call = calls[0];
  const ssml = String(call?.body);

  check("status 200", response.status === 200, `got ${response.status}`);
  check("audio body passed through", body === "ID3-audio-bytes", body);
  check("mp3 content type", response.headers.get("content-type") === "audio/mpeg");
  check("provider header", response.headers.get("x-tts-provider") === "azure");
  check("voice header", response.headers.get("x-tts-voice") === "km-KH-SreymomNeural");
  check("azure endpoint used", call?.url === "https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1", call?.url);
  check("key header used", call?.headers["Ocp-Apim-Subscription-Key"] === "az-key");
  check(
    "mp3 output format requested",
    call?.headers["X-Microsoft-OutputFormat"] === "audio-24khz-48kbitrate-mono-mp3",
    call?.headers["X-Microsoft-OutputFormat"],
  );
  check("ssml content type", String(call?.headers["Content-Type"]).startsWith("application/ssml+xml"));
  check("khmer locale in ssml", ssml.includes('xml:lang="km-KH"'), ssml);
  check("voice in ssml", ssml.includes('<voice name="km-KH-SreymomNeural">'), ssml);
  check("rate converted to percent", ssml.includes('rate="+20%"'), ssml);
  check("pitch converted to percent", ssml.includes('pitch="-5%"'), ssml);
  check("text escaped", ssml.includes("សួស្តី &lt;&amp;&gt; ពិភពលោក"), ssml);
  check("no raw angle bracket leak", !ssml.includes("<&>"), ssml);
}

/* 5. Azure defaults keep the ssml simple */ {
  console.log("azure defaults");
  reset();
  mock(() => new Response("mp3", { status: 200 }));

  await worker.fetch(
    jsonApi("/api/tts", { voice: "km-KH-PisethNeural", text: "សូមស្វាគមន៍" }, { "x-azure-key": "k" }),
    env,
  );
  const ssml = String(calls[0]?.body);
  check("no prosody at defaults", !ssml.includes("<prosody"), ssml);
  check("default region southeastasia", calls[0]?.url.includes("southeastasia."), calls[0]?.url);
  check("male voice kept", ssml.includes("km-KH-PisethNeural"), ssml);
}

/* 6. Azure rate and pitch limits */ {
  console.log("azure clamps");
  reset();
  mock(() => new Response("mp3", { status: 200 }));

  await worker.fetch(
    jsonApi(
      "/api/tts",
      { voice: "km-KH-SreymomNeural", text: "hi", rate: 9, pitch: 999 },
      { "x-azure-key": "k" },
    ),
    env,
  );
  const ssml = String(calls[0]?.body);
  check("rate capped at +50%", ssml.includes('rate="+50%"'), ssml);
  check("pitch capped at +50%", ssml.includes('pitch="+50%"'), ssml);
}

/* 7. Azure errors */ {
  console.log("azure errors");
  reset();
  mock(() =>
    jsonResponse({ error: { code: "401", message: "Invalid subscription key." } }, 401),
  );
  const badKey = await worker.fetch(
    jsonApi("/api/tts", { voice: "km-KH-SreymomNeural", text: "hi" }, { "x-azure-key": "bad" }),
    env,
  );
  const badData = await badKey.json();
  check("status 502", badKey.status === 502, `got ${badKey.status}`);
  check("message surfaced", badData.message.includes("Invalid subscription key"), badData.message);

  reset();
  mock(() => jsonResponse({ error: { message: "Rate limit" } }, 429));
  const limited = await worker.fetch(
    jsonApi("/api/tts", { voice: "km-KH-SreymomNeural", text: "hi" }, { "x-azure-key": "k" }),
    env,
  );
  check("429 mirrored", limited.status === 429, `got ${limited.status}`);
}

/* 8. missing key stops before upstream */ {
  console.log("missing key");
  reset();
  mock(() => new Response("should not happen", { status: 200 }));
  const response = await worker.fetch(
    jsonApi("/api/tts", { voice: "km-KH-SreymomNeural", text: "hi" }),
    env,
  );
  const data = await response.json();
  check("status 400", response.status === 400, `got ${response.status}`);
  check("no_key error", data.error === "no_key", data.error);
  check("provider echoed", data.provider === "azure", data.provider);
  check("no upstream call", calls.length === 0);
}

/* 9. ElevenLabs speech */ {
  console.log("elevenlabs tts");
  reset();
  mock(() => new Response("EL-AUDIO", { status: 200, headers: { "content-type": "audio/mpeg" } }));

  const response = await worker.fetch(
    jsonApi(
      "/api/tts",
      {
        provider: "elevenlabs",
        voice: "21m00Tcm4TlvDq8ikWAM",
        text: "hello there",
        speed: 1.9,
        stability: 0.4,
        similarity: 0.8,
      },
      { "x-eleven-key": "el-key" },
    ),
    env,
  );

  const body = await response.text();
  const call = calls[0];
  const payload = JSON.parse(call?.body || "{}");

  check("status 200", response.status === 200, `got ${response.status}`);
  check("audio passed through", body === "EL-AUDIO", body);
  check("provider header", response.headers.get("x-tts-provider") === "elevenlabs");
  check(
    "clone endpoint used",
    call?.url === "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM?output_format=mp3_44100_128",
    call?.url,
  );
  check("xi-api-key header", call?.headers["xi-api-key"] === "el-key");
  check("default model", payload.model_id === "eleven_multilingual_v2", payload.model_id);
  check("speed clamped", payload.voice_settings?.speed === 1.2, String(payload.voice_settings?.speed));
  check("stability passed", payload.voice_settings?.stability === 0.4);
  check("similarity passed", payload.voice_settings?.similarity_boost === 0.8);
  check("text passed", payload.text === "hello there");
}

/* 10. ElevenLabs validation and errors */ {
  console.log("elevenlabs errors");
  reset();
  mock(() => new Response("nope", { status: 200 }));

  const badVoice = await worker.fetch(
    jsonApi("/api/tts", { provider: "elevenlabs", voice: "x", text: "hi" }, { "x-eleven-key": "k" }),
    env,
  );
  check("bad voice 400", badVoice.status === 400, `got ${badVoice.status}`);
  check("no upstream call", calls.length === 0);

  reset();
  mock(() => jsonResponse({ detail: { message: "Your quota is exhausted." } }, 401));
  const upstream = await worker.fetch(
    jsonApi(
      "/api/tts",
      { provider: "elevenlabs", voice: "21m00Tcm4TlvDq8ikWAM", text: "hi" },
      { "x-eleven-key": "k" },
    ),
    env,
  );
  const data = await upstream.json();
  check("status 502", upstream.status === 502, `got ${upstream.status}`);
  check("detail message surfaced", data.message === "Your quota is exhausted.", data.message);
}

/* 11. request validation */ {
  console.log("request validation");
  reset();
  mock(() => new Response("mp3", { status: 200 }));

  const empty = await worker.fetch(
    jsonApi("/api/tts", { voice: "km-KH-SreymomNeural", text: "   " }, { "x-azure-key": "k" }),
    env,
  );
  check("empty text 400", empty.status === 400, `got ${empty.status}`);

  const long = await worker.fetch(
    jsonApi("/api/tts", { voice: "km-KH-SreymomNeural", text: "a".repeat(5001) }, { "x-azure-key": "k" }),
    env,
  );
  const longData = await long.json();
  check("long text 400", long.status === 400, `got ${long.status}`);
  check("length explained", longData.error === "too_long", longData.error);

  const broken = await worker.fetch(
    api("/api/tts", { body: "{not json", headers: { "content-type": "application/json", "x-azure-key": "k" } }),
    env,
  );
  check("bad json 400", broken.status === 400, `got ${broken.status}`);

  const wrongMethod = await worker.fetch(api("/api/tts", { method: "GET" }), env);
  check("GET /api/tts 405", wrongMethod.status === 405, `got ${wrongMethod.status}`);

  const unknown = await worker.fetch(new Request("https://voice.example.com/api/nope"), env);
  check("unknown api 404", unknown.status === 404, `got ${unknown.status}`);
}

/* 12. origin guard */ {
  console.log("origin guard");
  reset();
  mock(() => new Response("mp3", { status: 200 }));
  const response = await worker.fetch(
    jsonApi(
      "/api/tts",
      { voice: "km-KH-SreymomNeural", text: "hi" },
      { "x-azure-key": "k", Origin: "https://evil.example" },
    ),
    env,
  );
  check("status 403", response.status === 403, `got ${response.status}`);
  check("no upstream call", calls.length === 0);
}

/* 13. env key fallback */ {
  console.log("env keys");
  reset();
  mock(() => new Response("mp3", { status: 200 }));

  await worker.fetch(
    jsonApi("/api/tts", { voice: "km-KH-SreymomNeural", text: "hi" }),
    { ...env, AZURE_SPEECH_KEY: "env-azure", AZURE_SPEECH_REGION: "westeurope" },
  );
  check("azure env key used", calls[0]?.headers["Ocp-Apim-Subscription-Key"] === "env-azure");
  check("azure env region used", calls[0]?.url.includes("westeurope."), calls[0]?.url);

  await worker.fetch(
    jsonApi("/api/tts", { provider: "elevenlabs", voice: "21m00Tcm4TlvDq8ikWAM", text: "hi" }),
    { ...env, ELEVENLABS_API_KEY: "env-eleven" },
  );
  check("eleven env key used", calls[1]?.headers["xi-api-key"] === "env-eleven");
}

/* 14. voice cloning */ {
  console.log("voice cloning");
  reset();
  mock(() => jsonResponse({ voice_id: "clonedVoice123" }));

  const response = await worker.fetch(
    api("/api/voices/clone", {
      headers: { "x-eleven-key": "el-key" },
      body: cloneForm({ name: "សំឡេងខ្ញុំ" }),
    }),
    env,
  );
  const data = await response.json();
  const forwarded = calls[0];

  check("status 200", response.status === 200, `got ${response.status}`);
  check("voice id returned", data.voice_id === "clonedVoice123", data.voice_id);
  check("clone endpoint used", forwarded?.url === "https://api.elevenlabs.io/v1/voices/add", forwarded?.url);
  check("xi-api-key sent", forwarded?.headers["xi-api-key"] === "el-key");
  check("form forwarded", forwarded?.body instanceof FormData);
  check("name forwarded", forwarded?.body.get("name") === "សំឡេងខ្ញុំ", forwarded?.body.get("name"));
  check("file forwarded", forwarded?.body.getAll("files").length === 1);
  check("noise removal enabled", forwarded?.body.get("remove_background_noise") === "true");
}

/* 15. cloning guards */ {
  console.log("cloning guards");
  reset();
  mock(() => jsonResponse({ voice_id: "x" }));

  const noConsent = await worker.fetch(
    api("/api/voices/clone", {
      headers: { "x-eleven-key": "k" },
      body: cloneForm({ consent: "false" }),
    }),
    env,
  );
  const consentData = await noConsent.json();
  check("consent required", noConsent.status === 400 && consentData.error === "consent_required", consentData.error);
  check("no upstream call", calls.length === 0);

  const noName = await worker.fetch(
    api("/api/voices/clone", { headers: { "x-eleven-key": "k" }, body: cloneForm({ name: "  " }) }),
    env,
  );
  check("name required", noName.status === 400, `got ${noName.status}`);

  const fourFiles = await worker.fetch(
    api("/api/voices/clone", {
      headers: { "x-eleven-key": "k" },
      body: cloneForm({
        files: Array.from({ length: 4 }, (_, index) => new Blob(["x"], { type: "audio/webm" })),
      }),
    }),
    env,
  );
  check("max three files", fourFiles.status === 400, `got ${fourFiles.status}`);

  const noKey = await worker.fetch(api("/api/voices/clone", { body: cloneForm() }), env);
  check("key required", noKey.status === 400, `got ${noKey.status}`);
}

/* 16. cloned voice list and delete */ {
  console.log("cloned voices");
  reset();
  mock((url, init) => {
    if (url.endsWith("/v1/voices") && (init.method || "GET") === "GET") {
      return jsonResponse({
        voices: [
          { voice_id: "preset1", name: "Rachel", category: "premade", preview_url: "https://x/1.mp3" },
          { voice_id: "clone1", name: "My voice", category: "cloned" },
        ],
      });
    }
    if (url.endsWith("/v1/voices/clone1") && init.method === "DELETE") {
      return jsonResponse({ status: "ok" });
    }
    return new Response("unexpected", { status: 404 });
  });

  const list = await worker.fetch(
    new Request("https://voice.example.com/api/voices/cloned", { headers: { "x-eleven-key": "k" } }),
    env,
  );
  const listData = await list.json();
  check("status 200", list.status === 200);
  check("cloned voice first", listData.voices[0].id === "clone1", listData.voices[0]?.id);
  check("cloned flag set", listData.voices[0].cloned === true);
  check("preview kept", listData.voices[1].previewUrl === "https://x/1.mp3");

  const removed = await worker.fetch(
    new Request("https://voice.example.com/api/voices/cloned/clone1", {
      method: "DELETE",
      headers: { "x-eleven-key": "k" },
    }),
    env,
  );
  check("delete status 200", removed.status === 200, `got ${removed.status}`);
  check("delete endpoint used", calls.at(-1)?.url === "https://api.elevenlabs.io/v1/voices/clone1", calls.at(-1)?.url);
  check("delete method", calls.at(-1)?.init.method === "DELETE");

  const invalid = await worker.fetch(
    new Request("https://voice.example.com/api/voices/cloned/x", {
      method: "DELETE",
      headers: { "x-eleven-key": "k" },
    }),
    env,
  );
  check("invalid id 400", invalid.status === 400, `got ${invalid.status}`);
}

/* 17. voice list falls back when Azure fails */ {
  console.log("voice list fallback");
  reset();
  mock(() => new Response("boom", { status: 500 }));
  const response = await worker.fetch(
    new Request("https://voice.example.com/api/voices", { headers: { "x-azure-key": "k" } }),
    env,
  );
  const data = await response.json();
  check("still 200", response.status === 200);
  check("builtin fallback", data.source === "builtin", data.source);
  check("warning attached", Boolean(data.warning));
  check("khmer still available", data.voices.some((v) => v.locale === "km-KH"));
}

/* 18. free Google voice */ {
  console.log("free google voice");
  reset();
  mock(() => new Response(new Uint8Array([7, 7, 7]), { status: 200 }));

  const response = await worker.fetch(
    jsonApi("/api/tts", { provider: "google", voice: "km", language: "km", text: "ក".repeat(400) }),
    env,
  );
  const audio = new Uint8Array(await response.arrayBuffer());

  check("status 200 without a key", response.status === 200, `got ${response.status}`);
  check("three chunks requested", calls.length === 3, String(calls.length));
  check("chunks concatenated", audio.byteLength === 9, String(audio.byteLength));
  check("khmer language sent", calls[0]?.url.includes("tl=km"), calls[0]?.url);
  check("text encoded in query", calls[0]?.url.includes("q=%E1%9E%80"), calls[0]?.url);
  check("browser user agent sent", String(calls[0]?.headers["user-agent"]).includes("Mozilla"), String(calls[0]?.headers["user-agent"]));
  check("chunk count reported", response.headers.get("x-tts-chunks") === "3", response.headers.get("x-tts-chunks"));
  check("provider header", response.headers.get("x-tts-provider") === "google");
  check("audio/mpeg returned", response.headers.get("content-type") === "audio/mpeg");
}

/* 19. free voice limits and outages */ {
  console.log("free google guards");
  reset();
  mock(() => new Response("blocked", { status: 429 }));

  const limited = await worker.fetch(
    jsonApi("/api/tts", { provider: "google", voice: "km", text: "សួស្តី" }),
    env,
  );
  const limitedData = await limited.json();
  check("rate limit 429", limited.status === 429, `got ${limited.status}`);
  check("outage explained", limitedData.error === "free_unavailable", limitedData.error);
  check("azure suggested", /Azure/.test(limitedData.message), limitedData.message);

  reset();
  mock(() => new Response("should not be called", { status: 200 }));
  const tooLong = await worker.fetch(
    jsonApi("/api/tts", { provider: "google", voice: "km", text: "ក".repeat(1501) }),
    env,
  );
  check("free voice capped", tooLong.status === 400, `got ${tooLong.status}`);
  check("no upstream call when too long", calls.length === 0);
}

/* 20. CAMB.AI speech */ {
  console.log("camb tts");
  reset();
  mock(() => new Response("CAMB-MP3", { status: 200 }));

  const response = await worker.fetch(
    jsonApi(
      "/api/tts",
      { provider: "camb", voice: "98765", text: "សួស្តី CAMB", language: "km-kh" },
      { "x-camb-key": "camb-key" },
    ),
    env,
  );
  const body = await response.text();
  const call = calls[0];
  const payload = JSON.parse(call?.body || "{}");

  check("status 200", response.status === 200, `got ${response.status}`);
  check("audio passed through", body === "CAMB-MP3", body);
  check("camb endpoint used", call?.url === "https://client.camb.ai/apis/tts-stream", call?.url);
  check("camb key header", call?.headers["x-api-key"] === "camb-key");
  check("numeric voice id sent", payload.voice_id === 98765, String(payload.voice_id));
  check("khmer locale sent", payload.language === "km-kh", payload.language);
  check("mars 8.1 model sent", payload.speech_model === "mars-8.1-flash-beta", payload.speech_model);
  check("mp3 requested first", payload.output_configuration?.format === "mp3", JSON.stringify(payload.output_configuration));
  check("provider header", response.headers.get("x-tts-provider") === "camb");
}

/* 21. CAMB.AI format fallback + guards */ {
  console.log("camb fallback");
  reset();
  mock((url, init) => {
    const payload = JSON.parse(init.body || "{}");
    if (payload.output_configuration?.format === "mp3") {
      return jsonResponse({ detail: "mp3 unsupported for this model" }, 422);
    }
    return new Response("CAMB-WAV", { status: 200 });
  });

  const response = await worker.fetch(
    jsonApi("/api/tts", { provider: "camb", voice: "1", text: "សួស្តី" }, { "x-camb-key": "k" }),
    env,
  );
  const body = await response.text();
  check("retried with wav", calls.length === 2, String(calls.length));
  check("second call requests wav", JSON.parse(calls[1]?.body || "{}").output_configuration.format === "wav");
  check("wav content type", response.headers.get("content-type") === "audio/wav");
  check("fallback audio returned", body === "CAMB-WAV", body);

  reset();
  mock(() => new Response("nope", { status: 200 }));
  const badVoice = await worker.fetch(
    jsonApi("/api/tts", { provider: "camb", voice: "abc", text: "សួស្តី" }, { "x-camb-key": "k" }),
    env,
  );
  check("non numeric voice 400", badVoice.status === 400, `got ${badVoice.status}`);

  const noKey = await worker.fetch(
    jsonApi("/api/tts", { provider: "camb", voice: "1", text: "សួស្តី" }),
    env,
  );
  check("camb key required", noKey.status === 400, `got ${noKey.status}`);
  check("no upstream call", calls.length === 0);
}

/* 22. CAMB.AI voice list */ {
  console.log("camb voices");
  reset();
  mock((url) => {
    if (url.endsWith("/list-voices")) {
      return jsonResponse([
        { id: 147320, voice_name: "Sreymom clone", gender: 2, language: "km-kh" },
        { id: 98765, voice_name: "My Khmer voice", gender: 1 },
      ]);
    }
    return new Response("unexpected", { status: 404 });
  });

  const response = await worker.fetch(
    new Request("https://voice.example.com/api/voices/camb", { headers: { "x-camb-key": "k" } }),
    env,
  );
  const data = await response.json();
  check("status 200", response.status === 200);
  check("two voices", data.voices.length === 2, String(data.voices.length));
  check("id stringified", data.voices[0].id === "147320", data.voices[0]?.id);
  check("female mapped", data.voices[0].gender === "Female", data.voices[0]?.gender);
  check("male mapped", data.voices[1].gender === "Male", data.voices[1]?.gender);
  check("camb key sent", calls[0]?.headers["x-api-key"] === "k");

  const noKey = await worker.fetch(new Request("https://voice.example.com/api/voices/camb"), env);
  check("key required for list", noKey.status === 400, `got ${noKey.status}`);
}

/* 23. CAMB.AI cloning */ {
  console.log("camb clone");
  reset();
  mock(() => jsonResponse({ voice_id: 98765 }));

  const form = cloneForm({ name: "សំឡេងខ្មែរ" });
  form.append("provider", "camb");
  form.append("gender", "2");
  form.append("language", "km-kh");
  form.set("files", new Blob(["wav-bytes"], { type: "audio/wav" }), "sample.wav");

  const response = await worker.fetch(
    api("/api/voices/clone", { headers: { "x-camb-key": "camb-key" }, body: form }),
    env,
  );
  const data = await response.json();
  const forwarded = calls[0]?.body;

  check("status 200", response.status === 200, `got ${response.status}`);
  check("provider reported", data.provider === "camb", data.provider);
  check("voice id returned as string", data.voice_id === "98765", data.voice_id);
  check("camb clone endpoint", calls[0]?.url === "https://client.camb.ai/apis/create-custom-voice", calls[0]?.url);
  check("camb key header", calls[0]?.headers["x-api-key"] === "camb-key");
  check("form forwarded", forwarded instanceof FormData);
  check("name forwarded", forwarded?.get("voice_name") === "សំឡេងខ្មែរ", forwarded?.get("voice_name"));
  check("gender forwarded", forwarded?.get("gender") === "2", forwarded?.get("gender"));
  check("language forwarded", forwarded?.get("language") === "km-kh", forwarded?.get("language"));
  check("enhancement enabled", forwarded?.get("enhance_audio") === "true");
  check("single reference file", forwarded?.getAll("file").length === 1);
}

/* 24. CAMB.AI cloning needs its own key */ {
  console.log("camb clone key");
  reset();
  mock(() => jsonResponse({ voice_id: 1 }));
  const form = cloneForm();
  form.append("provider", "camb");
  const response = await worker.fetch(api("/api/voices/clone", { body: form }), env);
  check("status 400", response.status === 400, `got ${response.status}`);
  check("no upstream call", calls.length === 0);
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
