// Drives the real front end in jsdom against a mocked speech API.
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
  { id: "km-KH-SreymomNeural", name: "Sreymom", gender: "Female", locale: "km-KH", localeName: "Khmer (Cambodia)" },
  { id: "km-KH-PisethNeural", name: "Piseth", gender: "Male", locale: "km-KH", localeName: "Khmer (Cambodia)" },
  { id: "th-TH-PremwadeeNeural", name: "Premwadee", gender: "Female", locale: "th-TH", localeName: "Thai (Thailand)" },
];

const CLONED = [{ id: "clone1", name: "My voice", category: "cloned", previewUrl: "", cloned: true }];
const CAMB = [{ id: "100", name: "Khmer clone", gender: "Female", locale: "km-kh" }];

function boot({
  azureKey = "",
  azureRegion = "southeastasia",
  cambKey = "",
  elevenKey = "",
  server = { azure: false, camb: false, elevenlabs: false },
  voices = VOICES,
  cloned = CLONED,
  cambVoices = CAMB,
  ttsStatus = 200,
  ttsPayload = { error: "upstream", message: "Azure key មិនត្រឹមត្រូវ។" },
  cloneId = "clone1",
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

    if (href.endsWith("/api/health")) {
      return json({
        ok: true,
        providers: server,
        defaultRegion: "southeastasia",
        maxChars: 5000,
      });
    }

    if (href.endsWith("/api/voices/camb") && method === "GET") {
      return json({ voices: cambVoices });
    }

    if (href.endsWith("/api/voices/cloned") && method === "GET") {
      return json({ voices: cloned });
    }

    if (href.includes("/api/voices/cloned/") && method === "DELETE") {
      requests.push({ url: href, init, method });
      return json({ ok: true });
    }

    if (href.endsWith("/api/voices/clone") && method === "POST") {
      requests.push({ url: href, init, method, form: init.body });
      return json({ ok: true, voice_id: cloneId });
    }

    if (href.endsWith("/api/voices") && method === "GET") {
      return json({ source: "builtin", voices });
    }

    if (href.endsWith("/api/tts")) {
      requests.push({ url: href, init, method, headers: init.headers || {}, body: JSON.parse(init.body || "{}") });
      if (ttsStatus !== 200) {
        return json(ttsPayload, ttsStatus);
      }
      return new Response("fake-mp3-bytes", { status: 200, headers: { "content-type": "audio/mpeg" } });
    }

    return json({ error: "not_found" }, 404);
  };

  if (azureKey) window.localStorage.setItem("voicesite.azureKey", azureKey);
  if (azureRegion) window.localStorage.setItem("voicesite.azureRegion", azureRegion);
  if (cambKey) window.localStorage.setItem("voicesite.cambKey", cambKey);
  if (elevenKey) window.localStorage.setItem("voicesite.elevenKey", elevenKey);

  window.eval(appJs);
  return { window, requests, doc: window.document };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function waitFor(predicate, timeout = 2500) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return true;
    await wait(15);
  }
  return false;
}

const textOf = (doc, id) => doc.getElementById(id).textContent;
const ttsCalls = (requests) => requests.filter((request) => request.url.endsWith("/api/tts"));

/* 1. boot */ {
  console.log("boot");
  const { doc } = boot();
  await wait(40);

  check("free voice status", textOf(doc, "status").includes("ឥតគិតថ្លៃ"), textOf(doc, "status"));
  check("studio tab active", doc.querySelector('.tab[data-tab="studio"]').classList.contains("is-active"));
  check("clone page hidden", doc.getElementById("clone").hidden === true);
  check("free group offered", Boolean(doc.querySelector('#voice optgroup[label*="Free"]')));
  check(
    "free khmer selected without a key",
    doc.getElementById("voice").value === "google:km",
    doc.getElementById("voice").value,
  );
  check("voice grouped by language", Boolean(doc.querySelector('#voice optgroup[label*="ខ្មែរ"]')));
  check("result empty shown", doc.getElementById("result-empty").hidden === false);
  check("history empty", doc.getElementById("history-empty").hidden === false);
  check("counter at zero", textOf(doc, "count").startsWith("0 / 5,000"), textOf(doc, "count"));
  check("speed hidden for the free voice", doc.getElementById("speed-field").hidden === true);
}

/* 2. text input */ {
  console.log("text input");
  const { doc } = boot();
  await wait(30);

  const text = doc.getElementById("text");
  text.value = "សួស្តី";
  text.dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));
  check("counter tracks typing", textOf(doc, "count").startsWith(`${text.value.length} / 5,000`), textOf(doc, "count"));

  doc.querySelector('.sample[data-sample="greeting"]').click();
  check("sample fills textarea", text.value.includes("សូមស្វាគមន៍"), text.value.slice(0, 40));
}

/* 3. key dialog */ {
  console.log("key dialog");
  const { window, doc } = boot();
  await wait(30);

  doc.getElementById("keys-btn").click();
  check("modal opens", doc.getElementById("key-modal").hidden === false);

  doc.getElementById("azure-key").value = "az-secret";
  doc.getElementById("azure-region").value = "eastus";
  doc.getElementById("camb-key").value = "camb-secret";
  doc.getElementById("eleven-key").value = "el-secret";
  doc.getElementById("key-save").click();
  await wait(40);

  check("modal closes", doc.getElementById("key-modal").hidden === true);
  check("azure key stored", window.localStorage.getItem("voicesite.azureKey") === "az-secret");
  check("region stored", window.localStorage.getItem("voicesite.azureRegion") === "eastus");
  check("camb key stored", window.localStorage.getItem("voicesite.cambKey") === "camb-secret");
  check("eleven key stored", window.localStorage.getItem("voicesite.elevenKey") === "el-secret");
  check("all providers reported", textOf(doc, "status").includes("CAMB ✓"), textOf(doc, "status"));
  check("no key leaks into status", !textOf(doc, "status").includes("secret"));
}

/* 4. key validation */ {
  console.log("key validation");
  const { doc } = boot();
  await wait(30);

  doc.getElementById("keys-btn").click();
  doc.getElementById("azure-key").value = "az";
  doc.getElementById("azure-region").value = "bad region!";
  doc.getElementById("key-save").click();

  check("modal stays open", doc.getElementById("key-modal").hidden === false);
  check("error explained", doc.getElementById("key-error").hidden === false);
  check("key not saved", !doc.defaultView.localStorage.getItem("voicesite.azureKey"));
}

/* 5. free voice works with no key */ {
  console.log("free synthesis");
  const { doc, requests } = boot();
  await wait(40);

  doc.getElementById("text").value = "សួស្តី នេះជាសំឡេងឥតគិតថ្លៃ";
  doc.getElementById("generate").click();

  const sent = await waitFor(() => ttsCalls(requests).length === 1);
  const request = ttsCalls(requests)[0];
  check("request sent without key", sent);
  check("provider google", request?.body.provider === "google", request?.body.provider);
  check("language km", request?.body.language === "km", request?.body.language);
  check("no key headers", !request?.headers["x-azure-key"] && !request?.headers["x-camb-key"]);

  const shown = await waitFor(() => doc.getElementById("result").hidden === false);
  check("result card shown", shown);
  check("provider labelled", textOf(doc, "result-meta").includes("Google"), textOf(doc, "result-meta"));
  check("history added", textOf(doc, "history-count") === "1");
}

/* 6. azure synthesis */ {
  console.log("azure synthesis");
  const { doc, requests } = boot({ azureKey: "az-key" });
  await wait(60);

  check("azure voice preferred with key", doc.getElementById("voice").value === "azure:km-KH-SreymomNeural", doc.getElementById("voice").value);
  check("speed visible for azure", doc.getElementById("speed-field").hidden === false);
  check("pitch visible for azure", doc.getElementById("pitch-field").hidden === false);

  doc.getElementById("text").value = "សួស្តីពិភពលោក";
  doc.getElementById("speed").value = "1.2";
  doc.getElementById("speed").dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));
  doc.getElementById("pitch").value = "-4";
  doc.getElementById("pitch").dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));

  doc.getElementById("generate").click();
  await waitFor(() => ttsCalls(requests).length === 1);
  const request = ttsCalls(requests)[0];

  check("azure key header", request?.headers["x-azure-key"] === "az-key");
  check("region header", request?.headers["x-azure-region"] === "southeastasia");
  check("provider azure", request?.body.provider === "azure");
  check("voice sent", request?.body.voice === "km-KH-SreymomNeural");
  check("rate sent", request?.body.rate === 1.2, String(request?.body.rate));
  check("pitch sent", request?.body.pitch === -4, String(request?.body.pitch));

  const shown = await waitFor(() => doc.getElementById("result").hidden === false);
  check("result shown", shown);
  check("audio source set", doc.getElementById("audio").src.includes("blob:test"));
  check("download ready", doc.getElementById("download").getAttribute("href") === "blob:test");
  check("download mp3", doc.getElementById("download").download.endsWith(".mp3"), doc.getElementById("download").download);
}

/* 7. keyed voice without a key asks for one */ {
  console.log("missing key");
  const { doc, requests } = boot();
  await wait(40);

  const select = doc.getElementById("voice");
  select.value = "azure:km-KH-SreymomNeural";
  select.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));

  doc.getElementById("text").value = "សួស្តី";
  doc.getElementById("generate").click();
  await wait(30);

  check("key modal opened", doc.getElementById("key-modal").hidden === false);
  check("no tts request", ttsCalls(requests).length === 0);
  check("error shown", doc.getElementById("error").hidden === false);
}

/* 8. tts error */ {
  console.log("tts error");
  const { doc } = boot({ azureKey: "bad-key", ttsStatus: 502 });
  await wait(50);

  doc.getElementById("text").value = "សួស្តី";
  doc.getElementById("generate").click();

  const shown = await waitFor(() => doc.getElementById("error").hidden === false);
  check("error banner shown", shown);
  check("upstream message shown", textOf(doc, "error").includes("មិនត្រឹមត្រូវ"));
  check("no result card", doc.getElementById("result").hidden === true);
  check("no history entry", textOf(doc, "history-count") === "0");
  check("generate re-enabled", doc.getElementById("generate").disabled === false);
}

/* 9. cloned voices */ {
  console.log("cloned voice selection");
  const { doc } = boot({ elevenKey: "el-key", cambKey: "camb-key" });
  await wait(80);

  const options = [...doc.getElementById("voice").options].map((option) => option.value);
  check("elevenlabs voice in picker", options.includes("eleven:clone1"), JSON.stringify(options.slice(0, 6)));
  check("camb voice in picker", options.includes("camb:100"));

  const select = doc.getElementById("voice");
  select.value = "eleven:clone1";
  select.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
  check("pitch hidden for clones", doc.getElementById("pitch-field").hidden === true);
  check("elevenlabs note", textOf(doc, "voice-note").includes("ElevenLabs"));
  check("speed range narrowed", doc.getElementById("speed").max === "1.2");

  select.value = "camb:100";
  select.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));
  check("camb note", textOf(doc, "voice-note").includes("CAMB.AI"), textOf(doc, "voice-note"));
  check("speed hidden for camb", doc.getElementById("speed-field").hidden === true);
}

/* 10. camb synthesis */ {
  console.log("camb synthesis");
  const { doc, requests } = boot({ cambKey: "camb-key" });
  await wait(70);

  const select = doc.getElementById("voice");
  select.value = "camb:100";
  select.dispatchEvent(new doc.defaultView.Event("change", { bubbles: true }));

  doc.getElementById("text").value = "សួស្តី ខ្មែរ";
  doc.getElementById("generate").click();
  await waitFor(() => ttsCalls(requests).length === 1);
  const request = ttsCalls(requests)[0];

  check("camb key header", request?.headers["x-camb-key"] === "camb-key");
  check("provider camb", request?.body.provider === "camb");
  check("numeric id sent", request?.body.voice === "100");
  check("khmer language sent", request?.body.language === "km-kh");
}

/* 11. clone with ElevenLabs */ {
  console.log("elevenlabs clone flow");
  const { window, doc, requests } = boot({ elevenKey: "el-key" });
  await wait(50);

  doc.querySelector('.tab[data-tab="clone"]').click();
  check("clone page visible", doc.getElementById("clone").hidden === false);

  const provider = doc.getElementById("clone-provider");
  provider.value = "elevenlabs";
  provider.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("gender hidden for elevenlabs", doc.getElementById("clone-gender-field").hidden === true);

  const file = new window.File(["fake-wav"], "sample.wav", { type: "audio/wav" });
  const input = doc.getElementById("file-input");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  await wait(20);
  check("sample listed", doc.querySelectorAll("#samples-list .sample-file").length === 1);

  doc.getElementById("clone-name").value = "សំឡេងខ្ញុំ";
  doc.getElementById("consent").checked = true;
  doc.getElementById("create-voice").click();

  const sent = await waitFor(() => requests.some((r) => r.url.endsWith("/api/voices/clone")));
  const request = requests.find((r) => r.url.endsWith("/api/voices/clone"));

  check("clone request sent", sent);
  check("provider in form", request?.form?.get("provider") === "elevenlabs", request?.form?.get("provider"));
  check("name in form", request?.form?.get("name") === "សំឡេងខ្ញុំ");
  check("consent in form", request?.form?.get("consent") === "true");
  check("audio file in form", request?.form?.getAll("files").length === 1);
  check("eleven key header", request?.init?.headers?.["x-eleven-key"] === "el-key");

  check("success message", await waitFor(() => textOf(doc, "clone-status").includes("ជោគជ័យ")));
  check("samples cleared", doc.querySelectorAll("#samples-list .sample-file").length === 0);
}

/* 12. clone with CAMB.AI */ {
  console.log("camb clone flow");
  const { window, doc, requests } = boot({ cambKey: "camb-key", cloneId: "100" });
  await wait(60);

  doc.querySelector('.tab[data-tab="clone"]').click();
  check("camb provider default", doc.getElementById("clone-provider").value === "camb");
  check("gender shown for camb", doc.getElementById("clone-gender-field").hidden === false);
  check("language shown for camb", doc.getElementById("clone-lang-field").hidden === false);

  doc.getElementById("clone-gender").value = "1";
  doc.getElementById("clone-lang").value = "km-kh";

  const file = new window.File(["wav"], "khmer.wav", { type: "audio/wav" });
  const input = doc.getElementById("file-input");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));

  doc.getElementById("clone-name").value = "សំឡេងខ្មែរ";
  doc.getElementById("consent").checked = true;
  doc.getElementById("create-voice").click();

  const sent = await waitFor(() => requests.some((r) => r.url.endsWith("/api/voices/clone")));
  const request = requests.find((r) => r.url.endsWith("/api/voices/clone"));

  check("clone sent", sent);
  check("provider camb", request?.form?.get("provider") === "camb");
  check("gender sent", request?.form?.get("gender") === "1", request?.form?.get("gender"));
  check("language sent", request?.form?.get("language") === "km-kh");
  check("camb key header", request?.init?.headers?.["x-camb-key"] === "camb-key", JSON.stringify(request?.init?.headers));
  check("success message", await waitFor(() => textOf(doc, "clone-status").includes("CAMB.AI")));
}

/* 13. clone guards */ {
  console.log("clone guards");
  const { window, doc, requests } = boot({ cambKey: "camb-key" });
  await wait(50);
  doc.querySelector('.tab[data-tab="clone"]').click();

  const file = new window.File(["x"], "a.wav", { type: "audio/wav" });
  const input = doc.getElementById("file-input");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));

  doc.getElementById("clone-name").value = "voice";
  doc.getElementById("create-voice").click();
  await wait(20);
  check("consent required first", requests.filter((r) => r.url.endsWith("/api/voices/clone")).length === 0);

  doc.getElementById("consent").checked = true;
  doc.getElementById("create-voice").click();
  await waitFor(() => requests.some((r) => r.url.endsWith("/api/voices/clone")));
  check("allowed once consent given", requests.filter((r) => r.url.endsWith("/api/voices/clone")).length === 1);
}

/* 14. delete an ElevenLabs voice (two-step) */ {
  console.log("delete cloned voice");
  const { doc, requests } = boot({ elevenKey: "el-key", cambVoices: [] });
  await wait(80);
  doc.querySelector('.tab[data-tab="clone"]').click();
  await wait(60);

  const row = doc.querySelector("#cloned .voice-row");
  check("cloned row rendered", Boolean(row));

  row.querySelector(".chip.danger").click();
  check(
    "asks for confirmation",
    doc.querySelector("#cloned .voice-row .chip.danger")?.textContent === "ប្រាកដ?",
    doc.querySelector("#cloned .voice-row .chip.danger")?.textContent,
  );
  check("no delete yet", requests.filter((r) => r.method === "DELETE").length === 0);

  doc.querySelector("#cloned .voice-row .chip.danger").click();
  const deleted = await waitFor(() => requests.some((r) => r.method === "DELETE"));
  const request = requests.find((r) => r.method === "DELETE");
  check("delete sent", deleted);
  check("delete url", request?.url.endsWith("/api/voices/cloned/clone1"));
  check("row removed", await waitFor(() => doc.querySelectorAll("#cloned .voice-row").length === 0));
}

/* 15. recording fallback */ {
  console.log("recording fallback");
  const { doc } = boot({ cambKey: "camb-key" });
  await wait(40);
  doc.querySelector('.tab[data-tab="clone"]').click();
  doc.getElementById("record").click();
  await wait(20);
  check("explains unsupported browser", doc.getElementById("error").hidden === false);
}

/* 16. clear keys */ {
  console.log("clear keys");
  const { window, doc } = boot({ azureKey: "az", cambKey: "camb", elevenKey: "el" });
  await wait(60);

  doc.getElementById("keys-btn").click();
  doc.getElementById("key-clear").click();
  await wait(40);

  check("azure key removed", !window.localStorage.getItem("voicesite.azureKey"));
  check("camb key removed", !window.localStorage.getItem("voicesite.cambKey"));
  check("eleven key removed", !window.localStorage.getItem("voicesite.elevenKey"));
  check("back to free voice", textOf(doc, "status").includes("ឥតគិតថ្លៃ"), textOf(doc, "status"));
  check("library cleared", doc.querySelectorAll("#cloned .voice-row").length === 0);
  check("modal closed", doc.getElementById("key-modal").hidden === true);
}

/* 17. server-side keys */ {
  console.log("server keys");
  const { doc } = boot({ server: { azure: true, camb: false, elevenlabs: false } });
  await wait(60);

  check("server key reported", textOf(doc, "status").includes("Azure ✓"), textOf(doc, "status"));
  check("azure default selected", doc.getElementById("voice").value === "azure:km-KH-SreymomNeural", doc.getElementById("voice").value);

  doc.getElementById("text").value = "សួស្តី";
  doc.getElementById("generate").click();
  await wait(30);
  check("no key dialog when server has the key", doc.getElementById("key-modal").hidden === true);
}

console.log(failures === 0 ? "\nall UI checks passed" : `\n${failures} UI check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
