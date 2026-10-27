// Local self-check for the speech worker routes, using a mocked CAMB.AI and
// mocked Google Translate upstream.
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
  return new Request(`https://voice.example.com${path}`, { method, headers, body });
}

function jsonApi(path, body, headers = {}) {
  return api(path, { body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
}

function audioBytes(length = 32) {
  return new Uint8Array(length).fill(7);
}

function cloneForm({ name = "My voice", consent = "true", language = "km-kh", files } = {}) {
  const form = new FormData();
  if (name !== undefined) form.append("name", name);
  if (consent !== undefined) form.append("consent", consent);
  form.append("gender", "1");
  form.append("language", language);
  const list = files ?? [new File([audioBytes(64)], "sample.wav", { type: "audio/wav" })];
  list.forEach((file, index) => form.append("files", file, file.name || `sample-${index + 1}.wav`));
  return form;
}

/* 1. health */ {
  console.log("health");
  reset();
  const bare = await worker.fetch(new Request("https://voice.example.com/api/health"), env);
  const data = await bare.json();
  check("status 200", bare.status === 200);
  check("camb is the provider", data.provider === "camb" && data.providers.camb === false);
  check("free google voice always available", data.providers.google === true);
  check("limits reported", data.maxChars === 3000 && data.cambMaxChars === 3000 && data.freeMaxChars === 1500);
  check("model reported", data.model === "mars-8.1-flash-beta");

  const keyed = await worker.fetch(new Request("https://voice.example.com/api/health"), {
    ...env,
    CAMB_API_KEY: "secret-camb",
  });
  const payload = JSON.stringify(await keyed.json());
  check("camb server key detected", payload.includes('"camb":true'));
  check("camb secret never returned", !payload.includes("secret-camb"));
}

/* 2. key check + own clones */ {
  console.log("key check");
  reset();
  mock(() => {
    throw new Error("upstream should not be called");
  });

  const noKey = await worker.fetch(new Request("https://voice.example.com/api/voices"), env);
  const noKeyData = await noKey.json();
  check("no key -> 400", noKey.status === 400 && noKeyData.error === "no_key", String(noKey.status));
  check("no upstream call without key", calls.length === 0);

  reset();
  mock((url) => {
    check("list-voices endpoint", url === "https://client.camb.ai/apis/list-voices", url);
    return jsonResponse({
      voices: [
        { id: 147320, voice_name: "Gary", gender: 1, language: "en-us", description: "A warm voice" },
        { id: 100, voice_name: "Brad Collins", gender: 2, language: "km-kh", description: null },
        {
          id: 98765,
          voice_name: "សំឡេងខ្ញុំ",
          language: "km-kh",
          description: "Cloned in Khmer Voice Studio",
        },
      ],
    });
  });

  const response = await worker.fetch(
    new Request("https://voice.example.com/api/voices", { headers: { "x-camb-key": "user-key" } }),
    env,
  );
  const listData = await response.json();
  check("status 200", response.status === 200 && listData.ok === true);
  check("key forwarded as x-api-key", calls[0]?.headers?.["x-api-key"] === "user-key");
  check("workspace size reported", listData.count === 3);
  check("only our clones returned", listData.voices.length === 1 && listData.voices[0].id === "98765");
  check("clone name kept", listData.voices[0].name === "សំឡេងខ្ញុំ");
  check("clone language kept", listData.voices[0].language === "km-kh");

  reset();
  mock(() => jsonResponse({ detail: "Invalid API key" }, 401));
  const badKey = await worker.fetch(
    new Request("https://voice.example.com/api/voices", { headers: { "x-camb-key": "wrong" } }),
    env,
  );
  const badData = await badKey.json();
  check("upstream failure -> 502", badKey.status === 502 && badData.error === "upstream");
  check("upstream status reported", badData.upstreamStatus === 401);
}

/* 2b. deleting one of my voices */ {
  console.log("delete voice");
  reset();
  mock((url) => {
    check("delete-voice endpoint", url === "https://client.camb.ai/apis/delete-voice/98765", url);
    return jsonResponse({ status: "ok" });
  });

  const response = await worker.fetch(
    new Request("https://voice.example.com/api/voices/98765", {
      method: "DELETE",
      headers: { "x-camb-key": "user-key" },
    }),
    env,
  );
  check("delete 200", response.status === 200 && (await response.json()).ok === true);
  check("DELETE method sent upstream", calls[0]?.init?.method === "DELETE");
  check("key sent on delete", calls[0]?.headers?.["x-api-key"] === "user-key");

  const badId = await worker.fetch(
    new Request("https://voice.example.com/api/voices/abc", {
      method: "DELETE",
      headers: { "x-camb-key": "user-key" },
    }),
    env,
  );
  check("bad id -> 400", badId.status === 400 && (await badId.json()).error === "bad_voice");

  const noKey = await worker.fetch(
    new Request("https://voice.example.com/api/voices/98765", {
      method: "DELETE",
      headers: { origin: "https://voice.example.com" },
    }),
    env,
  );
  check("delete needs key", noKey.status === 400 && (await noKey.json()).error === "no_key");

  const foreign = await worker.fetch(
    new Request("https://voice.example.com/api/voices/98765", {
      method: "DELETE",
      headers: { "x-camb-key": "user-key", origin: "https://evil.example" },
    }),
    env,
  );
  check("cross-origin delete blocked", foreign.status === 403);

  const wrongMethod = await worker.fetch(
    new Request("https://voice.example.com/api/voices/98765", {
      method: "POST",
      headers: { "x-camb-key": "user-key" },
    }),
    env,
  );
  check("POST on a voice -> 405", wrongMethod.status === 405);
}

/* 3. text to speech (CAMB.AI) */ {
  console.log("tts (camb)");
  reset();
  mock((url) => {
    if (url.endsWith("/tts-stream")) return new Response(audioBytes(64), { headers: { "content-type": "audio/mpeg" } });
    throw new Error(`unexpected ${url}`);
  });

  const noKey = await worker.fetch(jsonApi("/api/tts", { text: "សួស្តី", voice: "100" }), env);
  check("no key -> 400", noKey.status === 400 && (await noKey.json()).error === "no_key");

  reset();
  const ok = await worker.fetch(
    jsonApi(
      "/api/tts",
      { provider: "camb", text: "សួស្តីពិភពលោក", voice: "100", language: "km-kh", speed: 1.25 },
      { "x-camb-key": "user-key" },
    ),
    env,
  );
  const sent = JSON.parse(calls[0].body);
  check("200 audio", ok.status === 200 && ok.headers.get("content-type") === "audio/mpeg");
  check("provider header", ok.headers.get("x-tts-provider") === "camb");
  check("audio body forwarded", (await ok.arrayBuffer()).byteLength === 64);
  check("voice_id numeric", sent.voice_id === 100);
  check("model sent", sent.speech_model === "mars-8.1-flash-beta");
  check("mp3 requested", sent.output_configuration?.format === "mp3");
  check("language sent", sent.language === "km-kh");
  check("speed -> speaking_rate", sent.voice_settings?.speaking_rate === 1.25);
  check("key header", calls[0].headers["x-api-key"] === "user-key");

  reset();
  const defaults = await worker.fetch(
    jsonApi("/api/tts", { text: "hello there", voice: "100", language: "NOT A LOCALE" }, { "x-camb-key": "k" }),
    env,
  );
  const defaultPayload = JSON.parse(calls[0].body);
  check("invalid language falls back to km-kh", defaults.status === 200 && defaultPayload.language === "km-kh");
  check("speed omitted at 1x", defaultPayload.voice_settings === undefined);

  reset();
  const badVoice = await worker.fetch(jsonApi("/api/tts", { text: "hi", voice: "abc" }, { "x-camb-key": "k" }), env);
  check("bad voice -> 400", badVoice.status === 400 && (await badVoice.json()).error === "bad_voice");
  check("no upstream call for bad voice", calls.length === 0);

  reset();
  const tooLong = await worker.fetch(
    jsonApi("/api/tts", { text: "ក".repeat(3001), voice: "100" }, { "x-camb-key": "k" }),
    env,
  );
  check("too long -> 400", tooLong.status === 400 && (await tooLong.json()).error === "too_long");

  reset();
  mock(() => jsonResponse({ detail: [{ msg: "Language 'xx-xx' is not supported" }] }, 422));
  const upstreamFail = await worker.fetch(
    jsonApi("/api/tts", { text: "hi there", voice: "100" }, { "x-camb-key": "k" }),
    env,
  );
  const failData = await upstreamFail.json();
  check("upstream 422 -> 502 with detail", upstreamFail.status === 502 && failData.message.includes("not supported"));
}

/* 4. free google voice */ {
  console.log("tts (free google)");
  reset();
  mock((url) => {
    if (url.startsWith("https://translate.google.com/translate_tts")) {
      return new Response(audioBytes(16), { headers: { "content-type": "audio/mpeg" } });
    }
    throw new Error(`unexpected ${url}`);
  });

  const response = await worker.fetch(jsonApi("/api/tts", { provider: "google", text: "សួស្តី", language: "km" }), env);
  check("status 200", response.status === 200);
  check("audio/mpeg", response.headers.get("content-type") === "audio/mpeg");
  check("provider header", response.headers.get("x-tts-provider") === "google");
  check("language in query", calls[0].url.includes("tl=km"));
  check("text in query", calls[0].url.includes(encodeURIComponent("សួស្តី")));
  check("browser-ish user agent", String(calls[0].headers["user-agent"]).includes("Mozilla"));

  reset();
  const longText = `${"សួស្តី ".repeat(60)}`;
  const chunked = await worker.fetch(jsonApi("/api/tts", { provider: "google", text: longText }), env);
  check("long text is chunked", chunked.status === 200 && calls.length > 1, `calls=${calls.length}`);
  check("chunk size respected", calls.every((call) => decodeURIComponent(call.url).length < 400));

  reset();
  const tooLong = await worker.fetch(
    jsonApi("/api/tts", { provider: "google", text: "ក".repeat(1600) }),
    env,
  );
  check("free voice length cap", tooLong.status === 400 && (await tooLong.json()).error === "too_long");

  reset();
  mock(() => new Response("rate limited", { status: 429 }));
  const limited = await worker.fetch(jsonApi("/api/tts", { provider: "google", text: "សួស្តី" }), env);
  check("free voice 429 surfaced", limited.status === 429);
}

/* 5. origin checks (Render forwards http:// while the browser sends https://) */ {
  console.log("origin checks");
  reset();
  mock((url) => {
    if (url.endsWith("/tts-stream")) return new Response(audioBytes(8), { headers: { "content-type": "audio/mpeg" } });
    throw new Error(`unexpected ${url}`);
  });

  const headers = { "content-type": "application/json", origin: "https://voice.example.com" };
  const httpsOrigin = await worker.fetch(
    jsonApi("/api/tts", { text: "សួស្តី", voice: "100" }, { ...headers, "x-camb-key": "k" }),
    env,
  );
  check("https origin against http-scheme url allowed", httpsOrigin.status === 200, String(httpsOrigin.status));

  const forwarded = await worker.fetch(
    new Request("http://internal:10000/api/tts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://app.onrender.com",
        "x-forwarded-host": "app.onrender.com",
        "x-camb-key": "k",
      },
      body: JSON.stringify({ text: "សួស្តី", voice: "100" }),
    }),
    env,
  );
  check("x-forwarded-host honored", forwarded.status === 200, String(forwarded.status));

  const foreign = await worker.fetch(
    jsonApi("/api/tts", { text: "សួស្តី", voice: "100" }, { "content-type": "application/json", origin: "https://evil.example" }),
    env,
  );
  check("foreign origin -> 403", foreign.status === 403 && (await foreign.json()).error === "bad_origin");

  const noOrigin = await worker.fetch(
    new Request("https://voice.example.com/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-camb-key": "k" },
      body: JSON.stringify({ text: "សួស្តី", voice: "100" }),
    }),
    env,
  );
  check("no origin header allowed", noOrigin.status === 200, String(noOrigin.status));
}

/* 6. voice cloning */ {
  console.log("voice cloning");
  reset();
  mock(() => jsonResponse({ voice_id: 98765 }));

  const noConsent = await worker.fetch(
    api("/api/voices/clone", { body: cloneForm({ consent: "false" }), headers: { "x-camb-key": "k" } }),
    env,
  );
  check("consent required", noConsent.status === 400 && (await noConsent.json()).error === "consent_required");

  const noName = await worker.fetch(
    api("/api/voices/clone", { body: cloneForm({ name: "  " }), headers: { "x-camb-key": "k" } }),
    env,
  );
  check("name required", noName.status === 400 && (await noName.json()).error === "no_name");

  const noKey = await worker.fetch(api("/api/voices/clone", { body: cloneForm() }), env);
  check("clone needs key", noKey.status === 400 && (await noKey.json()).error === "no_key");

  reset();
  const ok = await worker.fetch(api("/api/voices/clone", { body: cloneForm(), headers: { "x-camb-key": "k" } }), env);
  const data = await ok.json();
  check("clone 200", ok.status === 200 && data.voice_id === "98765" && data.provider === "camb");
  check("create-custom-voice endpoint", calls[0].url === "https://client.camb.ai/apis/create-custom-voice");
  const sentForm = calls[0].body;
  check("voice_name sent", sentForm.get("voice_name") === "My voice");
  check("gender sent", sentForm.get("gender") === "1");
  check("language sent", sentForm.get("language") === "km-kh");
  check("audio enhanced", sentForm.get("enhance_audio") === "true");
  check("file attached", sentForm.get("file")?.size > 0);

  reset();
  mock(() => jsonResponse({ detail: "quota exceeded" }, 402));
  const upstreamFail = await worker.fetch(
    api("/api/voices/clone", { body: cloneForm(), headers: { "x-camb-key": "k" } }),
    env,
  );
  check("clone upstream failure -> 502", upstreamFail.status === 502);

  const huge = new File([new Uint8Array(11 * 1024 * 1024)], "big.wav", { type: "audio/wav" });
  const tooLarge = await worker.fetch(
    api("/api/voices/clone", { body: cloneForm({ files: [huge] }), headers: { "x-camb-key": "k" } }),
    env,
  );
  check("11 MB file rejected", tooLarge.status === 400 && (await tooLarge.json()).error === "file_too_large");
}

/* 7. routing */ {
  console.log("routing");
  reset();
  const wrongMethod = await worker.fetch(new Request("https://voice.example.com/api/tts"), env);
  check("GET /api/tts -> 405", wrongMethod.status === 405);

  const unknown = await worker.fetch(new Request("https://voice.example.com/api/nope"), env);
  check("unknown api -> 404", unknown.status === 404);

  const asset = await worker.fetch(new Request("https://voice.example.com/"), env);
  check("assets fall through", asset.status === 200 && (await asset.text()) === "asset");

  const removedRoute = await worker.fetch(new Request("https://voice.example.com/api/voices/cloned"), env);
  check("old elevenlabs route gone", removedRoute.status === 405);
}

console.log("");
if (failures > 0) {
  console.log(`${failures} worker check(s) failed`);
  process.exit(1);
}
console.log("all worker checks passed");
