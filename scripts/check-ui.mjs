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

const OWN = [{ id: "98765", name: "សំឡេងខ្ញុំ", language: "km-kh" }];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function boot({
  key = "",
  voice = "",
  server = { camb: false, google: true },
  own = OWN,
  keyStatus = 200,
  ttsStatus = 200,
  ttsPayload = { error: "upstream", message: "Key មិនត្រឹមត្រូវ។" },
  cloneStatus = 200,
  clonePayload = { ok: true, provider: "camb", voice_id: "55501" },
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
      if (keyStatus !== 200) return json({ error: "upstream", message: "Invalid/Expired API Key" }, keyStatus);
      return json({ ok: true, provider: "camb", count: own.length + 200, voices: own });
    }

    if (/\/api\/voices\/\d+$/.test(href) && method === "DELETE") {
      requests.push({ url: href, init, method, headers });
      return json({ ok: true });
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
  if (voice) window.localStorage.setItem("voicesite.voice", voice);

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

async function settle(ms = 60) {
  await wait(ms);
}

function type(window, doc, text) {
  const area = doc.getElementById("text");
  area.value = text;
  area.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function options(doc) {
  return [...doc.getElementById("voice").options].map((option) => ({ value: option.value, label: option.textContent }));
}

function attachSample(window, doc, name = "sample.wav") {
  const file = new window.File([new Uint8Array(256)], name, { type: "audio/wav" });
  const input = doc.getElementById("file-input");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  return file;
}

/* 1. free mode (no key) */ {
  console.log("free mode (no key)");
  const { window, doc, requests } = boot();
  await waitFor(() => doc.getElementById("status").textContent !== "…");

  check("status warns about the key", doc.getElementById("status").className.includes("warn"));
  check("key button unlabelled", doc.getElementById("keys-label").textContent === "CAMB.AI Key");
  const list = options(doc);
  check("free voices offered", list.filter((entry) => entry.value.startsWith("google:")).length === 4);
  check("no clone voices without a key", !list.some((entry) => entry.value.startsWith("camb:")));
  check("khmer free voice selected", doc.getElementById("voice").value === "google:km");
  check("no key check without a key", !requests.some((entry) => entry.url.endsWith("/api/voices")));
  check("empty library explained", doc.getElementById("cloned-empty").hidden === false);

  type(window, doc, "សួស្តីពិភពលោក");
  doc.getElementById("generate").click();
  await waitFor(() => requests.some((entry) => entry.url.endsWith("/api/tts")));

  const tts = requests.find((entry) => entry.url.endsWith("/api/tts"));
  check("google provider used", tts?.body.provider === "google" && tts?.body.voice === "km");
  check("no key header", !tts?.headers["x-camb-key"]);
  check("result shown", (await waitFor(() => doc.getElementById("result").hidden === false)) === true);
  check("history entry added", doc.getElementById("history-count").textContent === "1");
  check("download link set", doc.getElementById("download").getAttribute("href") === "blob:test");
  check("speed hidden for the free voice", doc.getElementById("speed-field").hidden === true);
}

/* 2. key set: only my own clones are listed */ {
  console.log("own clones only");
  const { window, doc, requests } = boot({ key: "camb-test-key-123" });
  await waitFor(() => options(doc).some((entry) => entry.value.startsWith("camb:")));
  await settle();

  const keyCheck = requests.find((entry) => entry.url.endsWith("/api/voices"));
  check("key verified with the key header", keyCheck?.headers["x-camb-key"] === "camb-test-key-123");

  const list = options(doc);
  check("no CAMB.AI stock voices listed", list.every((entry) => !/Brad Collins|Gary|Aapo/.test(entry.label)));
  check("my clone is listed", list.some((entry) => entry.value === "camb:98765"));
  check("my clone auto-selected", doc.getElementById("voice").value === "camb:98765");
  check("one library row", doc.getElementById("cloned").children.length === 1);
  check(
    "library row marks it as my clone",
    doc.getElementById("cloned").textContent.includes("ក្លូនរបស់អ្នក"),
  );
  check("status ok", doc.getElementById("status").className.includes("ok"));
  check("speed shown for a clone", doc.getElementById("speed-field").hidden === false);

  doc.getElementById("speed").value = "1.3";
  type(window, doc, "សួស្តី ពីសំឡេងក្លូន");
  doc.getElementById("generate").click();
  await waitFor(() => requests.some((entry) => entry.url.endsWith("/api/tts")));

  const tts = requests.find((entry) => entry.url.endsWith("/api/tts"));
  check("clone provider used", tts?.body.provider === "camb" && tts?.body.voice === "98765");
  check("clone language used", tts?.body.language === "km-kh");
  check("speed forwarded", tts?.body.speed === 1.3);
  check("key header on tts", tts?.headers["x-camb-key"] === "camb-test-key-123");
  check("clone credited in meta", (await waitFor(() => doc.getElementById("result-meta").textContent.includes("CAMB.AI"))) === true);
}

/* 2b. a remembered free voice never overrides the clone */ {
  console.log("own voice wins on load");
  const { doc } = boot({ key: "camb-test-key-123", voice: "google:vi" });
  await waitFor(() => options(doc).some((entry) => entry.value === "camb:98765"));
  await settle();

  check("clone selected although a free voice was remembered", doc.getElementById("voice").value === "camb:98765");
  check("clones listed before the free voices", options(doc)[0].value.startsWith("camb:"));
  check("free voices still available", options(doc).some((entry) => entry.value === "google:vi"));
}

/* 3. key set but no clones yet */ {
  console.log("key without clones");
  const { doc } = boot({ key: "camb-test-key-123", own: [] });
  await waitFor(() => doc.getElementById("status").className.includes("ok"));
  await settle();

  check("only free voices available", options(doc).every((entry) => entry.value.startsWith("google:")));
  check(
    "voice note points at the clone tab",
    doc.getElementById("voice-note").textContent.includes("សំឡេងខ្ញុំ"),
  );
  check("library stays empty", doc.getElementById("cloned").children.length === 0);
}

/* 4. deleting one of my voices */ {
  console.log("deleting a clone");
  const { window, doc, requests } = boot({ key: "camb-test-key-123" });
  await waitFor(() => options(doc).some((entry) => entry.value === "camb:98765"));

  const row = doc.getElementById("cloned").children[0];
  const remove = [...row.querySelectorAll("button")].find((button) => button.textContent === "លុប");
  remove.click();
  check("first click asks for confirmation", doc.getElementById("cloned").textContent.includes("ប្រាកដ?"));

  const confirm = [...doc.getElementById("cloned").querySelectorAll("button")].find(
    (button) => button.textContent === "ប្រាកដ?",
  );
  confirm.click();
  await waitFor(() => doc.getElementById("cloned").children.length === 0);

  const call = requests.find((entry) => entry.method === "DELETE");
  check("delete request sent", call?.url.endsWith("/api/voices/98765"));
  check("delete sends the key", call?.headers["x-camb-key"] === "camb-test-key-123");
  check("row removed", doc.getElementById("cloned").children.length === 0);
  check("dropdown drops the voice", !options(doc).some((entry) => entry.value === "camb:98765"));
  check("list forgotten locally", window.localStorage.getItem("voicesite.clones") === "[]");
}

/* 5. key dialog */ {
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
  await waitFor(() => options(doc).some((entry) => entry.value === "camb:98765"));

  check("modal closes", doc.getElementById("key-modal").hidden === true);
  check("key stored", window.localStorage.getItem("voicesite.cambKey") === "valid-camb-key-abcdef");
  check(
    "key checked with the key header",
    requests.some(
      (entry) => entry.url.endsWith("/api/voices") && entry.headers["x-camb-key"] === "valid-camb-key-abcdef",
    ),
  );
  check("existing clone loaded", options(doc).some((entry) => entry.value === "camb:98765"));
  check("status turns ok", doc.getElementById("status").className.includes("ok"));

  doc.getElementById("keys-btn").click();
  doc.getElementById("key-clear").click();
  check("clear removes key", !window.localStorage.getItem("voicesite.cambKey"));
  check("clear drops clones", !options(doc).some((entry) => entry.value.startsWith("camb:")));
  check("status warns again", doc.getElementById("status").className.includes("warn"));
}

/* 6. errors */ {
  console.log("errors");
  const wrongKey = boot({ key: "camb-test-key-123", keyStatus: 502 });
  await waitFor(() => wrongKey.doc.getElementById("error").hidden === false);
  check("bad key reported", wrongKey.doc.getElementById("error").textContent.includes("Invalid/Expired"));

  const { window, doc } = boot({ key: "camb-test-key-123", ttsStatus: 502 });
  await waitFor(() => doc.getElementById("status").className.includes("ok"));
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

/* 7. cloning */ {
  console.log("cloning");
  const { window, doc, requests } = boot({ key: "camb-test-key-123", own: [] });
  await waitFor(() => doc.getElementById("status").className.includes("ok"));

  doc.querySelector('.tab[data-tab="clone"]').click();
  check("clone tab visible", doc.getElementById("clone").hidden === false);

  doc.getElementById("create-voice").click();
  await settle();
  check("name required", doc.getElementById("error").textContent.includes("ឈ្មោះ"));

  doc.getElementById("clone-name").value = "សាកល្បង";
  doc.getElementById("create-voice").click();
  await settle();
  check("sample required", doc.getElementById("error").textContent.includes("ឯកសារសំឡេង"));

  doc.getElementById("clone-name").value = "";
  attachSample(window, doc);
  check("sample listed", doc.getElementById("samples-list").children.length === 1);
  check("name prefilled", doc.getElementById("clone-name").value === "សំឡេងខ្ញុំ");

  doc.getElementById("clone-name").value = "";
  doc.getElementById("create-voice").click();
  await settle();
  check("name still required when emptied", doc.getElementById("error").textContent.includes("ឈ្មោះ"));

  doc.getElementById("clone-name").value = "សំឡេងខ្ញុំ";
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

  await waitFor(() => options(doc).some((entry) => entry.value === "camb:55501"));
  check("new clone listed", options(doc).some((entry) => entry.value === "camb:55501"));
  check("new clone selected", doc.getElementById("voice").value === "camb:55501");
  check("new clone saved locally", window.localStorage.getItem("voicesite.clones")?.includes("55501"));
  check("clone success reported", doc.getElementById("clone-status").textContent.includes("ជោគជ័យ"));

  const noKey = boot();
  await waitFor(() => noKey.doc.getElementById("status").textContent !== "…");
  noKey.doc.querySelector('.tab[data-tab="clone"]').click();
  attachSample(noKey.window, noKey.doc, "s.wav");
  noKey.doc.getElementById("consent").checked = true;
  noKey.doc.getElementById("create-voice").click();
  await settle();
  check("clone without key opens the dialog", noKey.doc.getElementById("key-modal").hidden === false);
  check("no clone request without key", !noKey.requests.some((entry) => entry.url.endsWith("/api/voices/clone")));
}

console.log("");
if (failures > 0) {
  console.log(`${failures} UI check(s) failed`);
  process.exit(1);
}
console.log("all UI checks passed");
