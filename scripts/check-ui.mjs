// Drives the real front end in jsdom against a mocked CAMB.AI API.
// Run with: node scripts/check-ui.mjs

import fs from "node:fs";
import { JSDOM } from "jsdom";

let failures = 0;
const check = (name, ok, extra = "") => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
};

const html = fs.readFileSync("public/index.html", "utf8");
const appJs = fs.readFileSync("public/app.js", "utf8");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VOICES = [
  { id: "100", name: "Brad Collins", gender: "Female", language: "km-kh" },
  { id: "147320", name: "Gary", gender: "Male", language: "en-us" },
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function boot({
  key = "",
  server = { camb: false, google: true },
  voices = VOICES,
  ttsStatus = 200,
  ttsPayload = { error: "upstream", message: "Key មិនត្រឹមត្រូវ។" },
  cloneStatus = 200,
  clonePayload = { ok: true, provider: "camb", voice_id: "98765" },
} = {}) {
  const dom = new JSDOM(html, {
    url: "https://voice.example.com/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const requests = [];

  window.URL.createObjectURL = () => "blob:test";
  window.URL.revokeObjectURL = () => {};

  window.fetch = async (url, init = {}) => {
    const href = String(url);
    const method = init.method || "GET";
    const headers = init.headers || {};

    if (href.endsWith("/api/health")) {
      return json({ ok: true, providers: server, maxChars: 3000, freeMaxChars: 1500 });
    }

    if (href.endsWith("/api/voices") && method === "GET") {
      requests.push({ url: href, init, method, headers });
      if (!headers["x-camb-key"] && !server.camb) {
        return json({ error: "no_key", provider: "camb", message: "បញ្ចូល CAMB.AI key" }, 400);
      }
      return json({ provider: "camb", model: "mars-8.1-flash-beta", voices });
    }

    if (href.endsWith("/api/voices/clone") && method === "POST") {
      requests.push({ url: href, init, method, headers, form: init.body });
      return json(clonePayload, cloneStatus);
    }

    if (href.endsWith("/api/tts")) {
      requests.push({ url: href, init, method, headers, body: JSON.parse(init.body || "{}") });
      if (ttsStatus !== 200) return json(ttsPayload, ttsStatus);
      return new Response("fake-mp3-bytes", { status: 200, headers: { "content-type": "audio/mpeg" } });
    }

    return json({ error: "not_found" }, 404);
  };

  if (key) window.localStorage.setItem("voicesite.cambKey", key);

  window.eval(appJs);
  return { window, doc: window.document, requests };
}

async function waitFor(predicate, timeout = 2500) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return true;
    await wait(15);
  }
  return false;
}

async function settle() {
  await wait(60);
}

function type(window, doc, text) {
  const area = doc.getElementById("text");
  area.value = text;
  area.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function options(doc) {
  return [...doc.getElementById("voice").options].map((option) => ({ value: option.value, label: option.textContent }));
}

/* 1. free mode (no key) */ {
  console.log("free mode (no key)");
  const { window, doc, requests } = boot();
  await waitFor(() => doc.getElementById("status").textContent !== "…");

  check("status warns about the key", doc.getElementById("status").className.includes("warn"));
  check("key button unlabelled", doc.getElementById("keys-label").textContent === "CAMB.AI Key");
  const list = options(doc);
  check("free voices offered", list.filter((entry) => entry.value.startsWith("google:")).length === 4);
  check("no camb voices without key", !list.some((entry) => entry.value.startsWith("camb:")));
  check("khmer free voice selected", doc.getElementById("voice").value === "google:km");
  check("no voice list request without key", !requests.some((entry) => entry.url.endsWith("/api/voices")));

  type(window, doc, "សួស្តីពិភពលោក");
  doc.getElementById("generate").click();
  const sent = await waitFor(() => requests.some((entry) => entry.url.endsWith("/api/tts")));

  check("tts request sent", sent);
  const tts = requests.find((entry) => entry.url.endsWith("/api/tts"));
  check("google provider used", tts?.body.provider === "google" && tts?.body.voice === "km");
  check("no key header", !tts?.headers["x-camb-key"]);
  check("result shown", (await waitFor(() => doc.getElementById("result").hidden === false)) === true);
  check("history entry added", doc.getElementById("history-count").textContent === "1");
  check("download link set", doc.getElementById("download").getAttribute("href") === "blob:test");
  check("speed hidden for free voice", doc.getElementById("speed-field").hidden === true);
}

/* 2. key set: CAMB voices and speech */ {
  console.log("camb mode");
  const { window, doc, requests } = boot({ key: "camb-test-key-123" });
  await waitFor(() => doc.getElementById("voice").options.length > 4);
  await settle();

  const listRequest = requests.find((entry) => entry.url.endsWith("/api/voices"));
  check("voice list requested", Boolean(listRequest));
  check("key sent on voice list", listRequest?.headers["x-camb-key"] === "camb-test-key-123");

  const list = options(doc);
  check("camb voices listed", list.some((entry) => entry.value === "camb:100"));
  check("gender shown in label", list.find((entry) => entry.value === "camb:100")?.label.includes("ស្រី"));
  check("status ok", doc.getElementById("status").className.includes("ok"));
  check("key button marked", doc.getElementById("keys-label").textContent === "CAMB.AI Key ✓");

  doc.getElementById("voice").value = "camb:147320";
  doc.getElementById("voice").dispatchEvent(new window.Event("change", { bubbles: true }));
  check("speed shown for camb voice", doc.getElementById("speed-field").hidden === false);
  check("voice note names CAMB", doc.getElementById("voice-note").textContent.includes("CAMB.AI"));

  doc.getElementById("speed").value = "1.3";
  type(window, doc, "Hello from CAMB");
  doc.getElementById("generate").click();
  await waitFor(() => requests.some((entry) => entry.url.endsWith("/api/tts")));

  const tts = requests.find((entry) => entry.url.endsWith("/api/tts"));
  check("camb provider used", tts?.body.provider === "camb" && tts?.body.voice === "147320");
  check("voice language used", tts?.body.language === "en-us");
  check("speed forwarded", tts?.body.speed === 1.3);
  check("key header on tts", tts?.headers["x-camb-key"] === "camb-test-key-123");
  check("camb result rendered", (await waitFor(() => doc.getElementById("result-voice").textContent.includes("Gary"))) === true);
  check("camb credited in meta", doc.getElementById("result-meta").textContent.includes("CAMB.AI"));
}

/* 3. key dialog */ {
  console.log("key dialog");
  const { window, doc, requests } = boot();
  await waitFor(() => doc.getElementById("status").textContent !== "…");

  doc.getElementById("keys-btn").click();
  check("modal opens", doc.getElementById("key-modal").hidden === false);

  doc.getElementById("camb-key").value = "short";
  doc.getElementById("key-save").click();
  check("short key rejected", doc.getElementById("key-error").hidden === false);
  check("key not stored", !window.localStorage.getItem("voicesite.cambKey"));

  doc.getElementById("camb-key").value = "valid-camb-key-abcdef";
  doc.getElementById("key-save").click();
  await waitFor(() => options(doc).some((entry) => entry.value.startsWith("camb:")));

  check("modal closes", doc.getElementById("key-modal").hidden === true);
  check("key stored", window.localStorage.getItem("voicesite.cambKey") === "valid-camb-key-abcdef");
  check("voices loaded after save", options(doc).some((entry) => entry.value.startsWith("camb:")));
  check("save triggers voice request with key", requests.some(
    (entry) => entry.url.endsWith("/api/voices") && entry.headers["x-camb-key"] === "valid-camb-key-abcdef",
  ));
  check("status turns ok", doc.getElementById("status").className.includes("ok"));

  doc.getElementById("keys-btn").click();
  doc.getElementById("key-clear").click();
  check("clear removes key", !window.localStorage.getItem("voicesite.cambKey"));
  check("clear drops camb voices", !options(doc).some((entry) => entry.value.startsWith("camb:")));
  check("status warns again", doc.getElementById("status").className.includes("warn"));
}

/* 4. errors */ {
  console.log("errors");
  const { window, doc, requests } = boot({
    key: "camb-test-key-123",
    ttsStatus: 502,
    ttsPayload: { error: "upstream", message: "CAMB.AI key មិនត្រឹមត្រូវ។" },
  });
  await waitFor(() => doc.getElementById("voice").options.length > 4);

  doc.getElementById("voice").value = "camb:100";
  type(window, doc, "សាកល្បង");
  doc.getElementById("generate").click();
  await waitFor(() => doc.getElementById("error").hidden === false);

  check("upstream error shown", doc.getElementById("error").textContent.includes("មិនត្រឹមត្រូវ"));
  check("no history on failure", doc.getElementById("history-count").textContent === "0");

  const free = boot();
  await waitFor(() => free.doc.getElementById("status").textContent !== "…");
  type(free.window, free.doc, "ក".repeat(1600));
  free.doc.getElementById("generate").click();
  await settle();
  check("free length cap explained", free.doc.getElementById("error").textContent.includes("1,500"));
  check("no tts request past the cap", !free.requests.some((entry) => entry.url.endsWith("/api/tts")));
}

/* 5. cloning */ {
  console.log("cloning");
  const { window, doc, requests } = boot({ key: "camb-test-key-123" });
  await waitFor(() => doc.getElementById("voice").options.length > 4);

  doc.querySelector('.tab[data-tab="clone"]').click();
  check("clone tab visible", doc.getElementById("clone").hidden === false);

  doc.getElementById("clone-name").value = "សំឡេងខ្ញុំ";
  doc.getElementById("create-voice").click();
  await settle();
  check("sample required", doc.getElementById("error").textContent.includes("ឯកសារសំឡេង"));

  const file = new window.File([new Uint8Array(256)], "sample.wav", { type: "audio/wav" });
  const input = doc.getElementById("file-input");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("sample listed", doc.getElementById("samples-list").children.length === 1);

  doc.getElementById("create-voice").click();
  await settle();
  check("consent required", doc.getElementById("error").textContent.includes("ការយល់ព្រម"));

  doc.getElementById("consent").checked = true;
  doc.getElementById("clone-gender").value = "1";
  doc.getElementById("clone-lang").value = "km-kh";
  doc.getElementById("create-voice").click();

  const sent = await waitFor(() => requests.some((entry) => entry.url.endsWith("/api/voices/clone")));
  check("clone request sent", sent);
  const clone = requests.find((entry) => entry.url.endsWith("/api/voices/clone"));
  check("clone key header", clone?.headers["x-camb-key"] === "camb-test-key-123");
  check("clone form name", clone?.form?.get("name") === "សំឡេងខ្ញុំ");
  check("clone form consent", clone?.form?.get("consent") === "true");
  check("clone form gender", clone?.form?.get("gender") === "1");
  check("clone form language", clone?.form?.get("language") === "km-kh");
  check("clone form file attached", clone?.form?.get("files")?.size > 0);
  check("clone success reported", (await waitFor(() => doc.getElementById("clone-status").textContent.includes("ជោគជ័យ"))) === true);

  const noKey = boot();
  await waitFor(() => noKey.doc.getElementById("status").textContent !== "…");
  noKey.doc.querySelector('.tab[data-tab="clone"]').click();
  noKey.doc.getElementById("clone-name").value = "x";
  const file2 = new noKey.window.File([new Uint8Array(128)], "s.wav", { type: "audio/wav" });
  const input2 = noKey.doc.getElementById("file-input");
  Object.defineProperty(input2, "files", { value: [file2], configurable: true });
  input2.dispatchEvent(new noKey.window.Event("change", { bubbles: true }));
  noKey.doc.getElementById("consent").checked = true;
  noKey.doc.getElementById("create-voice").click();
  await settle();
  check("clone without key opens dialog", noKey.doc.getElementById("key-modal").hidden === false);
}

console.log("");
if (failures > 0) {
  console.log(`${failures} UI check(s) failed`);
  process.exit(1);
}
console.log("all UI checks passed");
