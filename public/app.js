// Khmer Voice Studio — front end.
// Providers:
//   google      free Google Translate voice (no key, Khmer)
//   azure       Azure Speech neural voices (key, Khmer, best quality)
//   camb        CAMB.AI MARS 8.1 (key, Khmer + voice cloning)
//   elevenlabs  ElevenLabs (key, other languages + voice cloning)

const STORE = {
  azureKey: "voicesite.azureKey",
  azureRegion: "voicesite.azureRegion",
  cambKey: "voicesite.cambKey",
  elevenKey: "voicesite.elevenKey",
  voice: "voicesite.voice",
  speed: "voicesite.speed",
  pitch: "voicesite.pitch",
  text: "voicesite.text",
};

const MAX_CHARS = 5000;
const MAX_CLONE_FILES = 3;
const MAX_CLONE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_HISTORY = 6;
const DEFAULT_REGION = "southeastasia";
const FREE_MAX_CHARS = 1500;
const CAMB_MAX_CHARS = 3000;
const FREE_VOICES = [
  { id: "km", name: "ខ្មែរ · Khmer", provider: "google" },
  { id: "en", name: "English", provider: "google" },
  { id: "th", name: "ไทย · Thai", provider: "google" },
  { id: "vi", name: "Tiếng Việt", provider: "google" },
];
const AZURE_FALLBACK = [
  { id: "km-KH-SreymomNeural", name: "Sreymom", gender: "Female", locale: "km-KH", localeName: "Khmer (Cambodia)" },
  { id: "km-KH-PisethNeural", name: "Piseth", gender: "Male", locale: "km-KH", localeName: "Khmer (Cambodia)" },
];
const CAMB_FILE_RE = /\.(aac|flac|mp3|wav)$/i;

const SAMPLES = {
  greeting:
    "សូមស្វាគមន៍មកកាន់សំឡេង AI! ខ្ញុំអាចអានអត្ថបទខ្មែររបស់អ្នកជាសំឡេងធម្មជាតិ។ សាកល្បងសរសេរប្រយោគណាមួយ រួចចុចបង្កើតសំឡេង។",
  news:
    "ថ្ងៃនេះអាកាសធាតុនៅរាជធានីភ្នំពេញ មានពន្លឺថ្ងៃ និងសីតុណ្ហភាពប្រហែល ៣២ អង្សាសេ។ សូមពិនិត្យស្ថានភាពចរាចរណ៍មុនចេញដំណើរ។",
  guide:
    "ដើម្បីប្រើប្រាស់សេវានេះ៖ ទីមួយ ជ្រើសរើសសំឡេង។ ទីពីរ សរសេរអត្ថបទរបស់អ្នក។ ទីបី ចុចបង្កើតសំឡេង ហើយទាញយកជា MP3 ឬ WAV។",
  poem:
    "ខ្មែរយើងស្រឡាញ់សន្តិភាព និងធម្មជាតិ។ ទន្លេមេគង្គហូរកាត់ដីខ្មែរ នាំមកនូវជីវិត និងក្តីសង្ឃឹមថ្មី។",
};

const LOCALE_LABELS = {
  "km-KH": "ខ្មែរ · Khmer",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "en-AU": "English (AU)",
  "en-IN": "English (IN)",
  "th-TH": "ไทย · Thai",
  "vi-VN": "Tiếng Việt",
  "my-MM": "မြန်မာ · Burmese",
  "lo-LA": "ລາວ · Lao",
  "ja-JP": "日本語 · Japanese",
  "ko-KR": "한국어 · Korean",
  "zh-CN": "中文 (简体)",
  "zh-TW": "中文 (台灣)",
  "zh-HK": "中文 (香港)",
  "id-ID": "Bahasa Indonesia",
  "ms-MY": "Bahasa Melayu",
  "fr-FR": "Français",
  "de-DE": "Deutsch",
  "es-ES": "Español",
  "it-IT": "Italiano",
  "pt-BR": "Português (BR)",
  "ru-RU": "Русский",
  "hi-IN": "हिन्दी · Hindi",
  "ar-SA": "العربية · Arabic",
  "tr-TR": "Türkçe",
  "nl-NL": "Nederlands",
  "pl-PL": "Polski",
  "uk-UA": "Українська",
  "fil-PH": "Filipino",
};

const els = {
  status: document.getElementById("status"),
  keysBtn: document.getElementById("keys-btn"),
  tabs: document.getElementById("tabs"),
  studio: document.getElementById("studio"),
  clone: document.getElementById("clone"),

  text: document.getElementById("text"),
  count: document.getElementById("count"),
  speed: document.getElementById("speed"),
  speedField: document.getElementById("speed-field"),
  speedVal: document.getElementById("speed-val"),
  pitch: document.getElementById("pitch"),
  pitchVal: document.getElementById("pitch-val"),
  pitchField: document.getElementById("pitch-field"),
  voice: document.getElementById("voice"),
  voiceNote: document.getElementById("voice-note"),
  generate: document.getElementById("generate"),
  generateLabel: document.getElementById("generate-label"),

  result: document.getElementById("result"),
  resultEmpty: document.getElementById("result-empty"),
  resultVoice: document.getElementById("result-voice"),
  resultMeta: document.getElementById("result-meta"),
  audio: document.getElementById("audio"),
  download: document.getElementById("download"),

  history: document.getElementById("history"),
  historyEmpty: document.getElementById("history-empty"),
  historyCount: document.getElementById("history-count"),

  pickFiles: document.getElementById("pick-files"),
  record: document.getElementById("record"),
  recordTime: document.getElementById("record-time"),
  samplesList: document.getElementById("samples-list"),
  cloneProvider: document.getElementById("clone-provider"),
  cloneGender: document.getElementById("clone-gender"),
  cloneGenderField: document.getElementById("clone-gender-field"),
  cloneLang: document.getElementById("clone-lang"),
  cloneLangField: document.getElementById("clone-lang-field"),
  cloneName: document.getElementById("clone-name"),
  consent: document.getElementById("consent"),
  createVoice: document.getElementById("create-voice"),
  cloneStatus: document.getElementById("clone-status"),
  cloned: document.getElementById("cloned"),
  clonedEmpty: document.getElementById("cloned-empty"),
  refreshVoices: document.getElementById("refresh-voices"),

  error: document.getElementById("error"),
  fileInput: document.getElementById("file-input"),

  modal: document.getElementById("key-modal"),
  azureKey: document.getElementById("azure-key"),
  azureRegion: document.getElementById("azure-region"),
  cambKey: document.getElementById("camb-key"),
  elevenKey: document.getElementById("eleven-key"),
  keyError: document.getElementById("key-error"),
  keySave: document.getElementById("key-save"),
  keyCancel: document.getElementById("key-cancel"),
  keyClear: document.getElementById("key-clear"),
};

const state = {
  azureKey: localStorage.getItem(STORE.azureKey) || "",
  azureRegion: localStorage.getItem(STORE.azureRegion) || DEFAULT_REGION,
  cambKey: localStorage.getItem(STORE.cambKey) || "",
  elevenKey: localStorage.getItem(STORE.elevenKey) || "",
  server: { azure: false, camb: false, elevenlabs: false },
  voices: [],
  cambVoices: [],
  cloned: [],
  samples: [],
  history: [],
  busy: false,
  resultUrl: "",
  recorder: null,
  recordingChunks: [],
  recordTimer: null,
  recordSeconds: 0,
  pendingDelete: "",
  voiceTouched: false,
};

/* ---------------- boot ---------------- */

const storedSpeed = Number.parseFloat(localStorage.getItem(STORE.speed) || "");
const storedPitch = Number.parseFloat(localStorage.getItem(STORE.pitch) || "");

els.speed.value = String(Number.isFinite(storedSpeed) ? clamp(storedSpeed, 0.5, 1.5) : 1);
els.pitch.value = String(Number.isFinite(storedPitch) ? clamp(storedPitch, -30, 30) : 0);
els.azureRegion.value = state.azureRegion;
els.text.value = localStorage.getItem(STORE.text) || "";

renderVoices();
updateVoiceUi();
updateCloneFields();
updateCount();
updateRangeLabels();
updateStatus();
boot();

async function boot() {
  await checkHealth();
  await loadVoices();
  if (hasKey("camb")) loadCambVoices();
  if (hasKey("elevenlabs")) loadCloned();
}

/* ---------------- keys ---------------- */

function hasKey(provider) {
  if (provider === "google") return true;
  if (provider === "camb") return Boolean(state.cambKey || state.server.camb);
  if (provider === "elevenlabs") return Boolean(state.elevenKey || state.server.elevenlabs);
  return Boolean(state.azureKey || state.server.azure);
}

function updateStatus() {
  const parts = [];
  if (hasKey("azure")) parts.push("Azure ✓");
  if (hasKey("camb")) parts.push("CAMB ✓");
  if (hasKey("elevenlabs")) parts.push("ElevenLabs ✓");

  const message = parts.length
    ? parts.join(" · ")
    : "សំឡេងឥតគិតថ្លៃ ✓ · ចុច Keys សម្រាប់សំឡេងក្លូន";
  const tone = parts.length ? "ok" : "warn";

  els.status.textContent = message;
  els.status.className = `status ${tone}`;
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return;
    const data = await response.json();
    state.server = {
      azure: Boolean(data?.providers?.azure),
      camb: Boolean(data?.providers?.camb),
      elevenlabs: Boolean(data?.providers?.elevenlabs),
    };
    if (data?.defaultRegion && !localStorage.getItem(STORE.azureRegion)) {
      state.azureRegion = data.defaultRegion;
      els.azureRegion.value = data.defaultRegion;
    }
    updateStatus();
  } catch {
    /* offline: the free voice and saved keys still work */
  }
}

/* ---------------- text ---------------- */

function updateCount() {
  const length = els.text.value.length;
  els.count.textContent = `${length.toLocaleString("en-US")} / ${MAX_CHARS.toLocaleString("en-US")}`;
  els.count.classList.toggle("warn", length > MAX_CHARS * 0.9);
}

function updateRangeLabels() {
  els.speedVal.textContent = `${Number(els.speed.value).toFixed(2).replace(/0$/, "")}×`;
  els.pitchVal.textContent = String(Math.round(Number(els.pitch.value)));
}

els.text.addEventListener("input", () => {
  updateCount();
  try {
    localStorage.setItem(STORE.text, els.text.value);
  } catch {
    /* quota: text still works this session */
  }
});

els.text.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    generate();
  }
});

els.speed.addEventListener("input", () => {
  updateRangeLabels();
  localStorage.setItem(STORE.speed, els.speed.value);
});

els.pitch.addEventListener("input", () => {
  updateRangeLabels();
  localStorage.setItem(STORE.pitch, els.pitch.value);
});

for (const button of document.querySelectorAll(".sample")) {
  button.addEventListener("click", () => {
    const sample = SAMPLES[button.dataset.sample];
    if (!sample) return;
    els.text.value = sample;
    els.text.dispatchEvent(new Event("input", { bubbles: true }));
    els.text.focus();
  });
}

/* ---------------- voices ---------------- */

async function loadVoices() {
  const headers = {};
  if (state.azureKey) {
    headers["x-azure-key"] = state.azureKey;
    headers["x-azure-region"] = state.azureRegion;
  }

  try {
    const response = await fetch("/api/voices", { headers });
    if (!response.ok) throw new Error("voice list failed");
    const data = await response.json();
    state.voices = Array.isArray(data?.voices) && data.voices.length ? data.voices : AZURE_FALLBACK;
  } catch {
    state.voices = AZURE_FALLBACK;
    showError("មិនអាចផ្ទុកបញ្ជីសំឡេង Azure បានទេ — សំឡេងឥតគិតថ្លៃនៅតែប្រើបាន។");
  }

  renderVoices();
  updateVoiceUi();
}

async function loadCambVoices() {
  if (!hasKey("camb")) {
    state.cambVoices = [];
    renderLibrary();
    renderVoices();
    return;
  }

  try {
    const headers = {};
    if (state.cambKey) headers["x-camb-key"] = state.cambKey;
    const response = await fetch("/api/voices/camb", { headers });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      state.cambVoices = [];
      if (data?.error !== "no_key") els.cloneStatus.textContent = data?.message || "";
    } else {
      state.cambVoices = Array.isArray(data?.voices) ? data.voices : [];
    }
  } catch {
    state.cambVoices = [];
  }

  renderLibrary();
  renderVoices();
}

async function loadCloned() {
  if (!hasKey("elevenlabs")) {
    state.cloned = [];
    renderLibrary();
    renderVoices();
    return;
  }

  try {
    const headers = {};
    if (state.elevenKey) headers["x-eleven-key"] = state.elevenKey;
    const response = await fetch("/api/voices/cloned", { headers });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      state.cloned = [];
      if (data?.message && data.error !== "no_key") {
        els.cloneStatus.textContent = data.message;
      }
    } else {
      state.cloned = Array.isArray(data?.voices) ? data.voices : [];
    }
  } catch {
    state.cloned = [];
  }

  renderLibrary();
  renderVoices();
}

function refreshVoices() {
  loadCambVoices();
  loadCloned();
}

function providerOf(value) {
  const [prefix] = String(value || "").split(":");
  if (prefix === "google") return "google";
  if (prefix === "camb") return "camb";
  if (prefix === "eleven") return "elevenlabs";
  return "azure";
}

function renderVoices() {
  const previous = state.voiceTouched
    ? els.voice.value
    : localStorage.getItem(STORE.voice) || "";
  const nodes = [];

  const free = document.createElement("optgroup");
  free.label = "🎁 ឥតគិតថ្លៃ · Free";
  for (const voice of FREE_VOICES) {
    free.append(new Option(voice.name, `google:${voice.id}`));
  }
  nodes.push(free);

  if (state.cambVoices.length) {
    const group = document.createElement("optgroup");
    group.label = "🎙 CAMB.AI · ក្លូន / សំឡេងខ្ញុំ";
    for (const voice of state.cambVoices) {
      group.append(new Option(voice.name, `camb:${voice.id}`));
    }
    nodes.push(group);
  }

  if (state.cloned.length) {
    const group = document.createElement("optgroup");
    group.label = "🎙 ElevenLabs · សំឡេងខ្ញុំ";
    for (const voice of state.cloned) {
      group.append(new Option(voice.name, `eleven:${voice.id}`));
    }
    nodes.push(group);
  }

  const groups = new Map();
  for (const voice of state.voices) {
    const locale = voice.locale || "en-US";
    if (!groups.has(locale)) {
      groups.set(locale, {
        label: LOCALE_LABELS[locale] || voice.localeName || locale,
        voices: [],
      });
    }
    groups.get(locale).voices.push(voice);
  }

  const ordered = [...groups.entries()].sort(([a], [b]) => {
    if (a === "km-KH") return -1;
    if (b === "km-KH") return 1;
    return LOCALE_LABELS[a] ? LOCALE_LABELS[a].localeCompare(LOCALE_LABELS[b] || b) : a.localeCompare(b);
  });

  for (const [locale, group] of ordered) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    for (const voice of group.voices) {
      const gender = voice.gender === "Female" ? "ស្រី" : voice.gender === "Male" ? "ប្រុស" : "";
      optgroup.append(new Option(gender ? `${voice.name} · ${gender}` : voice.name, `azure:${voice.id}`));
    }
    nodes.push(optgroup);
  }

  els.voice.replaceChildren(...nodes);

  const available = [...els.voice.options].map((option) => option.value);
  const preferred = [
    previous,
    localStorage.getItem(STORE.voice) || "",
    hasKey("azure") ? "azure:km-KH-SreymomNeural" : "",
    "google:km",
    available[0] || "",
  ];

  let chosen = preferred.find((value) => value && available.includes(value)) || "";
  if (chosen && !hasKey(providerOf(chosen))) {
    chosen = available.includes("google:km") ? "google:km" : chosen;
  }
  els.voice.value = chosen;

  updateVoiceUi();
}

function currentVoice() {
  const value = els.voice.value || "";
  const provider = providerOf(value);
  const id = value.slice(value.indexOf(":") + 1);
  const label = els.voice.selectedOptions?.[0]?.textContent || id;
  return { provider, id, label, value };
}

function updateVoiceUi() {
  const voice = currentVoice();
  const needsPitch = voice.provider === "azure";
  const needsSpeed = voice.provider === "azure" || voice.provider === "elevenlabs";

  els.pitchField.hidden = !needsPitch;
  els.speedField.hidden = !needsSpeed;
  els.voiceNote.hidden = false;

  if (!voice.value) {
    els.voiceNote.textContent = "មិនទាន់មានសំឡេង — សូមផ្ទុកបញ្ជីឡើងវិញ។";
    return;
  }

  if (voice.provider === "google") {
    els.voiceNote.textContent = "សំឡេងឥតគិតថ្លៃ · Google Translate (unofficial)";
  } else if (voice.provider === "camb") {
    els.voiceNote.textContent = "CAMB.AI · MARS 8.1 (ខ្មែរ + ក្លូន)";
  } else if (voice.provider === "elevenlabs") {
    els.voiceNote.textContent = "សំឡេងក្លូន · ElevenLabs (មិនគាំទ្រអក្សរខ្មែរ)";
  } else {
    const match = state.voices.find((entry) => entry.id === voice.id);
    const locale = match?.locale || "";
    els.voiceNote.textContent =
      locale === "km-KH"
        ? "សំឡេងខ្មែរ · Azure neural"
        : `${LOCALE_LABELS[locale] || match?.localeName || locale} · Azure neural`;
  }

  if (voice.provider === "elevenlabs") {
    els.speed.min = "0.7";
    els.speed.max = "1.2";
  } else {
    els.speed.min = "0.5";
    els.speed.max = "1.5";
  }

  if (Number(els.speed.value) < Number(els.speed.min)) els.speed.value = els.speed.min;
  if (Number(els.speed.value) > Number(els.speed.max)) els.speed.value = els.speed.max;
  updateRangeLabels();

  if (state.voiceTouched && voice.value) localStorage.setItem(STORE.voice, voice.value);
}

els.voice.addEventListener("change", () => {
  state.voiceTouched = true;
  updateVoiceUi();
});

/* ---------------- text to speech ---------------- */

els.generate.addEventListener("click", generate);

async function generate() {
  if (state.busy) return;

  const text = els.text.value.trim();
  if (!text) {
    showError("សូមបញ្ចូលអត្ថបទមុននឹងបង្កើតសំឡេង។");
    els.text.focus();
    return;
  }
  if (text.length > MAX_CHARS) {
    showError(`អត្ថបទវែងពេក (អតិបរមា ${MAX_CHARS} តួអក្សរ)។`);
    return;
  }

  const voice = currentVoice();
  if (!voice.id) {
    showError("សូមជ្រើសរើសសំឡេងមួយសិន។");
    return;
  }

  if (voice.provider === "google" && text.length > FREE_MAX_CHARS) {
    showError(
      `សំឡេងឥតគិតថ្លៃអានបានត្រឹម ${FREE_MAX_CHARS.toLocaleString("en-US")} តួអក្សរ។ សម្រាប់អត្ថបទវែង សូមប្រើសំឡេង Azure។`,
    );
    return;
  }
  if (voice.provider === "camb" && text.length > CAMB_MAX_CHARS) {
    showError(`CAMB.AI អានបានត្រឹម ${CAMB_MAX_CHARS.toLocaleString("en-US")} តួអក្សរក្នុងមួយដង។`);
    return;
  }
  if (!hasKey(voice.provider)) {
    showError("ត្រូវការ API key សម្រាប់សំឡេងនេះ។ សូមបញ្ចូលវានៅប៊ូតុង Keys។");
    openKeys();
    return;
  }

  hideError();
  setBusy(true);

  try {
    const headers = { "content-type": "application/json" };
    if (state.azureKey) {
      headers["x-azure-key"] = state.azureKey;
      headers["x-azure-region"] = state.azureRegion;
    }
    if (state.cambKey) headers["x-camb-key"] = state.cambKey;
    if (state.elevenKey) headers["x-eleven-key"] = state.elevenKey;

    const payload = { provider: voice.provider, voice: voice.id, text };

    if (voice.provider === "azure") {
      payload.rate = Number(els.speed.value);
      payload.pitch = Number(els.pitch.value);
    } else if (voice.provider === "elevenlabs") {
      payload.speed = clamp(Number(els.speed.value), 0.7, 1.2);
      payload.stability = 0.5;
      payload.similarity = 0.75;
    } else if (voice.provider === "google") {
      payload.language = voice.id;
    } else if (voice.provider === "camb") {
      payload.language = "km-kh";
    }

    const response = await fetch("/api/tts", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (data?.error === "no_key") openKeys();
      throw new Error(data?.message || `បង្កើតសំឡេងបរាជ័យ (${response.status})។`);
    }

    const blob = await response.blob();
    showClip(blob, { text, voice: voice.label, provider: voice.provider });
  } catch (error) {
    showError(error?.message || "បង្កើតសំឡេងបរាជ័យ។ សូមព្យាយាមម្តងទៀត។");
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  els.generate.disabled = busy;
  els.generate.classList.toggle("is-busy", busy);
  els.generateLabel.textContent = busy ? "កំពុងបង្កើត…" : "បង្កើតសំឡេង";
  els.createVoice.disabled = busy;
}

function makeUrl(blob) {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(blob);
  }
  return "";
}

function revoke(url) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

function extensionFor(blob) {
  const type = (blob?.type || "").toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  return "mp3";
}

function providerName(provider) {
  if (provider === "elevenlabs") return "ElevenLabs";
  if (provider === "camb") return "CAMB.AI";
  if (provider === "google") return "Google (free)";
  return "Azure";
}

function showClip(blob, info) {
  const url = makeUrl(blob);
  const at = Date.now();
  const extension = extensionFor(blob);
  const filename = `voice-${new Date(at).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${extension}`;

  revoke(state.resultUrl);
  state.resultUrl = url;

  if (url) {
    els.audio.src = url;
    els.download.href = url;
  }
  els.download.download = filename;

  els.result.hidden = false;
  els.resultEmpty.hidden = true;
  els.resultVoice.textContent = info.voice;
  els.resultMeta.textContent = `${formatBytes(blob.size)} · ${providerName(info.provider)}`;

  addHistory({ ...info, url, filename, size: blob.size, at });
}

function addHistory(entry) {
  state.history.unshift(entry);
  while (state.history.length > MAX_HISTORY) {
    const dropped = state.history.pop();
    if (dropped.url && dropped.url !== state.resultUrl) revoke(dropped.url);
  }
  renderHistory();
}

function renderHistory() {
  els.history.replaceChildren(
    ...state.history.map((entry) => {
      const item = document.createElement("li");
      item.className = "track";
      item.dataset.at = String(entry.at);

      const play = document.createElement("button");
      play.type = "button";
      play.className = "track-play";
      play.textContent = "▶";
      play.setAttribute("aria-label", "លេងសំឡេងនេះ");
      play.addEventListener("click", () => replay(entry));

      const body = document.createElement("div");
      body.className = "track-body";

      const snippet = document.createElement("p");
      snippet.className = "track-text";
      snippet.textContent = entry.text;

      const meta = document.createElement("p");
      meta.className = "track-meta";
      meta.textContent = `${entry.voice} · ${formatBytes(entry.size)}`;

      body.append(snippet, meta);

      const download = document.createElement("a");
      download.className = "track-dl";
      download.textContent = "↓";
      download.setAttribute("aria-label", "ទាញយកសំឡេង");
      download.download = entry.filename;
      if (entry.url) download.href = entry.url;

      item.append(play, body, download);
      return item;
    }),
  );

  els.history.hidden = state.history.length === 0;
  els.historyEmpty.hidden = state.history.length > 0;
  els.historyCount.textContent = String(state.history.length);
}

function replay(entry) {
  if (!entry.url) return;
  revoke(state.resultUrl);
  state.resultUrl = entry.url;
  els.audio.src = entry.url;
  els.download.href = entry.url;
  els.download.download = entry.filename;
  els.result.hidden = false;
  els.resultEmpty.hidden = true;
  els.resultVoice.textContent = entry.voice;
  els.resultMeta.textContent = `${formatBytes(entry.size)} · ${providerName(entry.provider)}`;
}

/* ---------------- keys ---------------- */

els.keysBtn.addEventListener("click", openKeys);
els.keySave.addEventListener("click", saveKeys);
els.keyCancel.addEventListener("click", closeKeys);
els.keyClear.addEventListener("click", clearKeys);
els.modal.addEventListener("click", (event) => {
  if (event.target === els.modal) closeKeys();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.modal.hidden) closeKeys();
});

function openKeys() {
  els.azureKey.value = state.azureKey;
  els.azureRegion.value = state.azureRegion;
  els.cambKey.value = state.cambKey;
  els.elevenKey.value = state.elevenKey;
  els.keyError.hidden = true;
  els.modal.hidden = false;
  els.azureKey.focus();
}

function closeKeys() {
  els.modal.hidden = true;
}

function saveKeys() {
  const region = (els.azureRegion.value || "").trim().toLowerCase() || DEFAULT_REGION;
  if (!/^[a-z]{2,12}[a-z0-9-]{0,20}$/.test(region)) {
    keyError("Region មិនត្រឹមត្រូវ — ឧ. southeastasia ឬ eastus។");
    return;
  }

  const azureKey = els.azureKey.value.trim();
  const cambKey = els.cambKey.value.trim();
  const elevenKey = els.elevenKey.value.trim();

  if (!azureKey && !cambKey && !elevenKey) {
    keyError("សូមបញ្ចូល key យ៉ាងតិចមួយ (Azure, CAMB.AI ឬ ElevenLabs)។");
    return;
  }

  state.azureKey = azureKey;
  state.azureRegion = region;
  state.cambKey = cambKey;
  state.elevenKey = elevenKey;

  try {
    localStorage.setItem(STORE.azureKey, azureKey);
    localStorage.setItem(STORE.azureRegion, region);
    localStorage.setItem(STORE.cambKey, cambKey);
    localStorage.setItem(STORE.elevenKey, elevenKey);
  } catch {
    keyError("Browser មិនអនុញ្ញាតឱ្យរក្សាទុក key ទេ។");
    return;
  }

  els.keyError.hidden = true;
  closeKeys();
  updateStatus();
  loadVoices();
  refreshVoices();
}

function clearKeys() {
  state.azureKey = "";
  state.cambKey = "";
  state.elevenKey = "";
  state.azureRegion = DEFAULT_REGION;
  state.cambVoices = [];
  state.cloned = [];

  for (const key of [STORE.azureKey, STORE.azureRegion, STORE.cambKey, STORE.elevenKey]) {
    localStorage.removeItem(key);
  }

  els.azureKey.value = "";
  els.azureRegion.value = DEFAULT_REGION;
  els.cambKey.value = "";
  els.elevenKey.value = "";
  els.keyError.hidden = true;

  updateStatus();
  renderLibrary();
  renderVoices();
  loadVoices();
  closeKeys();
}

function keyError(message) {
  els.keyError.textContent = message;
  els.keyError.hidden = false;
}

/* ---------------- tabs ---------------- */

els.tabs.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (tab) setTab(tab.dataset.tab);
});

function setTab(name) {
  const target = name === "clone" ? "clone" : "studio";

  for (const tab of els.tabs.querySelectorAll(".tab")) {
    const active = tab.dataset.tab === target;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  }

  els.studio.hidden = target !== "studio";
  els.clone.hidden = target !== "clone";

  if (target === "clone") refreshVoices();
}

/* ---------------- voice cloning ---------------- */

els.pickFiles.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", () => {
  addSamples([...(els.fileInput.files || [])]);
  els.fileInput.value = "";
});

els.record.addEventListener("click", toggleRecord);
els.createVoice.addEventListener("click", createVoice);
els.refreshVoices.addEventListener("click", refreshVoices);
els.cloneProvider.addEventListener("change", updateCloneFields);

function updateCloneFields() {
  const camb = els.cloneProvider.value === "camb";
  els.cloneGenderField.hidden = !camb;
  els.cloneLangField.hidden = !camb;
}

function addSamples(files) {
  hideError();

  for (const file of files) {
    if (state.samples.length >= MAX_CLONE_FILES) {
      showError(`បន្ថែមបានអតិបរមា ${MAX_CLONE_FILES} ឯកសារ។`);
      break;
    }
    const looksAudio =
      (file.type || "").startsWith("audio/") || /\.(mp3|wav|m4a|ogg|oga|webm|flac|aac)$/i.test(file.name || "");
    if (!looksAudio) {
      showError("ឯកសារនោះមិនមែនជាសំឡេងទេ។");
      continue;
    }
    if (file.size > MAX_CLONE_FILE_BYTES) {
      showError("ឯកសារធំពេក (អតិបរមា 10 MB ក្នុងមួយឯកសារ)។");
      continue;
    }
    state.samples.push(file);
  }

  renderSamples();
}

function renderSamples() {
  els.samplesList.replaceChildren(
    ...state.samples.map((file, index) => {
      const item = document.createElement("li");
      item.className = "sample-file";

      const name = document.createElement("span");
      name.className = "sample-name";
      name.textContent = `${index + 1}. ${file.name || "recording"}`;

      const size = document.createElement("span");
      size.className = "sample-size";
      size.textContent = formatBytes(file.size);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "link-btn danger";
      remove.textContent = "លុប";
      remove.addEventListener("click", () => {
        state.samples.splice(index, 1);
        renderSamples();
      });

      item.append(name, size, remove);
      return item;
    }),
  );
}

async function toggleRecord() {
  if (state.recorder) {
    stopRecording();
    return;
  }

  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    showError("Browser នេះមិនគាំទ្រការថតសំឡេងទេ — សូមជ្រើសឯកសារជំនួស។");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    state.recorder = recorder;
    state.recordingChunks = [];
    state.recordSeconds = 0;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) state.recordingChunks.push(event.data);
    });

    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      const type = recorder.mimeType || "audio/webm";
      const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
      const blob = new Blob(state.recordingChunks, { type });
      state.recordingChunks = [];
      state.recorder = null;
      els.record.textContent = "🎙 ថតសំឡេង";
      els.record.classList.remove("is-recording");
      els.recordTime.hidden = true;
      clearInterval(state.recordTimer);
      state.recordTimer = null;

      if (blob.size > 0) {
        addSamples([
          new File([blob], `recording-${state.samples.length + 1}.${extension}`, { type }),
        ]);
      }
    });

    recorder.start();
    state.recordSeconds = 0;
    els.record.textContent = "⏹ បញ្ចប់ការថត";
    els.record.classList.add("is-recording");
    els.recordTime.hidden = false;
    els.recordTime.textContent = "0:00";

    state.recordTimer = setInterval(() => {
      state.recordSeconds += 1;
      const minutes = Math.floor(state.recordSeconds / 60);
      const seconds = String(state.recordSeconds % 60).padStart(2, "0");
      els.recordTime.textContent = `${minutes}:${seconds}`;
      if (state.recordSeconds >= 60) stopRecording();
    }, 1000);
  } catch {
    showError("មិនអាចបើកមីក្រូហ្វូនបានទេ។ សូមពិនិត្យការអនុញ្ញាតរបស់ browser។");
  }
}

function stopRecording() {
  if (!state.recorder) return;
  try {
    state.recorder.stop();
  } catch {
    state.recorder = null;
  }
}

async function createVoice() {
  if (state.busy) return;

  const name = els.cloneName.value.trim();
  const provider = els.cloneProvider.value === "elevenlabs" ? "elevenlabs" : "camb";

  if (!name) {
    showError("សូមដាក់ឈ្មោះសំឡេង។");
    els.cloneName.focus();
    return;
  }
  if (state.samples.length === 0) {
    showError("សូមបន្ថែមឯកសារសំឡេងយ៉ាងតិច ១។");
    return;
  }
  if (!els.consent.checked) {
    showError("សូមធីកប្រអប់បញ្ជាក់ការយល់ព្រមជាមុន។");
    return;
  }
  if (!hasKey(provider)) {
    showError(
      provider === "camb"
        ? "ការក្លូនខ្មែរត្រូវការ CAMB.AI key។"
        : "ការក្លូនដោយ ElevenLabs ត្រូវការ ElevenLabs key។",
    );
    openKeys();
    return;
  }

  hideError();
  setBusy(true);
  els.cloneStatus.textContent =
    provider === "camb"
      ? "កំពុងក្លូនដោយ CAMB.AI… (អាចយូរ ១០–៦០ វិនាទី)"
      : "កំពុងក្លូនដោយ ElevenLabs… (អាចយូរ ១០–៦០ វិនាទី)";

  try {
    let files = state.samples;
    if (provider === "camb") {
      files = [];
      for (const file of state.samples) {
        const prepared = CAMB_FILE_RE.test(file.name || "") ? file : await toWavFile(file);
        if (prepared.size > MAX_CLONE_FILE_BYTES) {
          throw new Error("ឯកសារបន្ទាប់ពីបំលែងធំពេក (អតិបរមា 10 MB)។");
        }
        files.push(prepared);
      }
    }

    const form = new FormData();
    form.append("name", name);
    form.append("consent", "true");
    form.append("provider", provider);
    if (provider === "camb") {
      form.append("gender", els.cloneGender.value);
      form.append("language", els.cloneLang.value);
    }
    for (const [index, file] of files.entries()) {
      form.append("files", file, file.name || `sample-${index + 1}.wav`);
    }

    const headers = {};
    if (provider === "camb" && state.cambKey) headers["x-camb-key"] = state.cambKey;
    if (provider === "elevenlabs" && state.elevenKey) headers["x-eleven-key"] = state.elevenKey;

    const response = await fetch("/api/voices/clone", { method: "POST", headers, body: form });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `ការក្លូនបរាជ័យ (${response.status})។`);

    state.samples = [];
    renderSamples();
    els.cloneName.value = "";
    els.consent.checked = false;
    els.cloneStatus.textContent =
      provider === "camb"
        ? "✓ បង្កើតសំឡេងក្លូន (CAMB.AI) បានជោគជ័យ។ ជ្រើសវាក្នុងបញ្ជីសំឡេង។"
        : "✓ បង្កើតសំឡេងក្លូន (ElevenLabs) បានជោគជ័យ។ ជ្រើសវាក្នុងបញ្ជីសំឡេង។";

    if (provider === "camb") await loadCambVoices();
    else await loadCloned();

    const value = `${provider === "camb" ? "camb" : "eleven"}:${data?.voice_id}`;
    if ([...els.voice.options].some((option) => option.value === value)) {
      els.voice.value = value;
      state.voiceTouched = true;
      updateVoiceUi();
    }
  } catch (error) {
    els.cloneStatus.textContent = "";
    showError(error?.message || "ការក្លូនបរាជ័យ។ សូមព្យាយាមម្តងទៀត។");
  } finally {
    setBusy(false);
  }
}

// CAMB.AI accepts aac/flac/mp3/wav only; browser recordings are webm/opus, so
// they are decoded and re-encoded to mono 16-bit WAV before upload.
async function toWavFile(file) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return file;

  const context = new AudioCtx();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    const mono = new Float32Array(audio.length);
    for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
      const data = audio.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) {
        mono[index] += data[index] / audio.numberOfChannels;
      }
    }
    const name = (file.name || "sample").replace(/\.[^.]+$/, "");
    return new File([encodeWav(mono, audio.sampleRate)], `${name}.wav`, { type: "audio/wav" });
  } catch {
    return file;
  } finally {
    context.close?.();
  }
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const text = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function renderLibrary() {
  const rows = [
    ...state.cambVoices.map((voice) => ({
      id: voice.id,
      name: voice.name,
      meta: "CAMB.AI · MARS 8.1",
      provider: "camb",
    })),
    ...state.cloned.map((voice) => ({
      id: voice.id,
      name: voice.name,
      meta: voice.cloned ? "ElevenLabs · សំឡេងក្លូន" : voice.category || "ElevenLabs",
      provider: "elevenlabs",
    })),
  ];

  els.cloned.replaceChildren(
    ...rows.map((voice) => {
      const item = document.createElement("li");
      item.className = "voice-row";

      const info = document.createElement("div");
      info.className = "voice-info";

      const name = document.createElement("p");
      name.className = "voice-name";
      name.textContent = voice.name;

      const meta = document.createElement("p");
      meta.className = "track-meta";
      meta.textContent = voice.meta;

      info.append(name, meta);

      const use = document.createElement("button");
      use.type = "button";
      use.className = "chip small";
      use.textContent = "ប្រើ";
      use.addEventListener("click", () => {
        const value = `${voice.provider === "camb" ? "camb" : "eleven"}:${voice.id}`;
        if (![...els.voice.options].some((option) => option.value === value)) return;
        els.voice.value = value;
        state.voiceTouched = true;
        updateVoiceUi();
        setTab("studio");
        els.text.focus();
      });

      item.append(info, use);

      if (voice.provider === "elevenlabs") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "chip small danger";
        remove.textContent = state.pendingDelete === voice.id ? "ប្រាកដ?" : "លុប";
        remove.addEventListener("click", () => deleteCloned(voice));
        item.append(remove);
      }

      return item;
    }),
  );

  els.clonedEmpty.hidden = rows.length > 0;
}

async function deleteCloned(voice) {
  if (state.pendingDelete !== voice.id) {
    state.pendingDelete = voice.id;
    renderLibrary();
    setTimeout(() => {
      if (state.pendingDelete === voice.id) {
        state.pendingDelete = "";
        renderLibrary();
      }
    }, 4000);
    return;
  }

  state.pendingDelete = "";
  try {
    const headers = {};
    if (state.elevenKey) headers["x-eleven-key"] = state.elevenKey;
    const response = await fetch(`/api/voices/cloned/${encodeURIComponent(voice.id)}`, {
      method: "DELETE",
      headers,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "លុបមិនបានទេ។");
    state.cloned = state.cloned.filter((entry) => entry.id !== voice.id);
    renderLibrary();
    renderVoices();
  } catch (error) {
    showError(error?.message || "លុបមិនបានទេ។");
  }
}

/* ---------------- shared ui ---------------- */

let errorTimer = null;

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(hideError, 12000);
}

function hideError() {
  els.error.hidden = true;
  clearTimeout(errorTimer);
}

els.error.addEventListener("click", hideError);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
