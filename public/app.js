// Khmer Voice Studio — front end.
// One keyed provider: CAMB.AI MARS 8.1 (Khmer, 300+ locales, voice cloning).
// The keyless Google voice stays as the free "just try it" option.

const STORE = {
  cambKey: "voicesite.cambKey",
  voice: "voicesite.voice",
  speed: "voicesite.speed",
  text: "voicesite.text",
  language: "voicesite.language",
};

const MAX_CHARS = 3000;
const FREE_MAX_CHARS = 1500;
const MAX_CLONE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_HISTORY = 6;
const CAMB_FILE_RE = /\.(aac|flac|mp3|wav)$/i;

const FREE_VOICES = [
  { id: "km", name: "ខ្មែរ · Khmer", language: "km" },
  { id: "en", name: "English", language: "en" },
  { id: "th", name: "ไทย · Thai", language: "th" },
  { id: "vi", name: "Tiếng Việt", language: "vi" },
];

const SAMPLES = {
  greeting:
    "សូមស្វាគមន៍មកកាន់សំឡេង AI! ខ្ញុំអាចអានអត្ថបទខ្មែររបស់អ្នកជាសំឡេងធម្មជាតិ។ សាកល្បងសរសេរប្រយោគណាមួយ រួចចុចបង្កើតសំឡេង។",
  news:
    "ថ្ងៃនេះអាកាសធាតុនៅរាជធានីភ្នំពេញ មានពន្លឺថ្ងៃ និងសីតុណ្ហភាពប្រហែល ៣២ អង្សាសេ។ សូមពិនិត្យស្ថានភាពចរាចរណ៍មុនចេញដំណើរ។",
  guide:
    "ដើម្បីប្រើប្រាស់សេវានេះ៖ ទីមួយ ជ្រើសរើសសំឡេង។ ទីពីរ សរសេរអត្ថបទរបស់អ្នក។ ទីបី ចុចបង្កើតសំឡេង ហើយទាញយកជា MP3។",
  poem:
    "ខ្មែរយើងស្រឡាញ់សន្តិភាព និងធម្មជាតិ។ ទន្លេមេគង្គហូរកាត់ដីខ្មែរ នាំមកនូវជីវិត និងក្តីសង្ឃឹមថ្មី។",
};

const els = {
  status: document.getElementById("status"),
  keysBtn: document.getElementById("keys-btn"),
  keysLabel: document.getElementById("keys-label"),
  tabs: document.getElementById("tabs"),
  studio: document.getElementById("studio"),
  clone: document.getElementById("clone"),

  text: document.getElementById("text"),
  count: document.getElementById("count"),
  speed: document.getElementById("speed"),
  speedField: document.getElementById("speed-field"),
  speedVal: document.getElementById("speed-val"),
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
  cloneGender: document.getElementById("clone-gender"),
  cloneLang: document.getElementById("clone-lang"),
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
  cambKey: document.getElementById("camb-key"),
  keyError: document.getElementById("key-error"),
  keySave: document.getElementById("key-save"),
  keyCancel: document.getElementById("key-cancel"),
  keyClear: document.getElementById("key-clear"),
};

const state = {
  cambKey: localStorage.getItem(STORE.cambKey) || "",
  serverCamb: false,
  voices: [],
  samples: [],
  history: [],
  busy: false,
  resultUrl: "",
  recorder: null,
  recordingChunks: [],
  recordTimer: null,
  recordSeconds: 0,
  voiceTouched: false,
};

/* ---------------- boot ---------------- */

const storedSpeed = Number.parseFloat(localStorage.getItem(STORE.speed) || "");
els.speed.value = String(Number.isFinite(storedSpeed) ? clamp(storedSpeed, 0.5, 2) : 1);
els.text.value = localStorage.getItem(STORE.text) || "";
els.cambKey.value = state.cambKey;

renderVoices();
updateVoiceUi();
updateCount();
updateRangeLabels();
updateStatus();
boot();

async function boot() {
  await checkHealth();
  if (hasKey()) await loadVoices();
  else renderVoices();
}

/* ---------------- keys ---------------- */

function hasKey() {
  return Boolean(state.cambKey || state.serverCamb);
}

function updateStatus() {
  if (hasKey()) {
    els.status.textContent = "CAMB.AI ✓ · MARS 8.1";
    els.status.className = "status ok";
    els.keysLabel.textContent = "CAMB.AI Key ✓";
  } else {
    els.status.textContent = "សំឡេងឥតគិតថ្លៃ ✓ · បញ្ចូល CAMB.AI key សម្រាប់សំឡេងខ្មែរពេញលេញ";
    els.status.className = "status warn";
    els.keysLabel.textContent = "CAMB.AI Key";
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return;
    const data = await response.json();
    state.serverCamb = Boolean(data?.providers?.camb);
    updateStatus();
  } catch {
    /* offline: the free voice and a saved key still work */
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
  if (!hasKey()) {
    state.voices = [];
    renderVoices();
    return;
  }

  try {
    const headers = {};
    if (state.cambKey) headers["x-camb-key"] = state.cambKey;
    const response = await fetch("/api/voices", { headers });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      state.voices = [];
      const message = data?.message || `មិនអាចផ្ទុកបញ្ជីសំឡេងបានទេ (${response.status})។`;
      els.cloneStatus.textContent = message;
      if (data?.error !== "no_key") showError(message);
    } else {
      state.voices = Array.isArray(data?.voices) ? data.voices : [];
    }
  } catch {
    state.voices = [];
    showError("មិនអាចភ្ជាប់ទៅ server បានទេ — សំឡេងឥតគិតថ្លៃនៅតែប្រើបាន។");
  }

  renderVoices();
  renderLibrary();
}

function providerOf(value) {
  const [prefix] = String(value || "").split(":");
  return prefix === "camb" ? "camb" : "google";
}

function renderVoices() {
  const previous = state.voiceTouched ? els.voice.value : localStorage.getItem(STORE.voice) || "";
  const nodes = [];

  const free = document.createElement("optgroup");
  free.label = "🎁 ឥតគិតថ្លៃ · Free";
  for (const voice of FREE_VOICES) {
    free.append(new Option(voice.name, `google:${voice.id}`));
  }
  nodes.push(free);

  if (state.voices.length) {
    const group = document.createElement("optgroup");
    group.label = "🎙 CAMB.AI · MARS 8.1";
    for (const voice of state.voices) {
      const gender = voice.gender === "Female" ? "ស្រី" : voice.gender === "Male" ? "ប្រុស" : "";
      group.append(new Option(gender ? `${voice.name} · ${gender}` : voice.name, `camb:${voice.id}`));
    }
    nodes.push(group);
  }

  els.voice.replaceChildren(...nodes);

  const available = [...els.voice.options].map((option) => option.value);
  const khmerCamb = state.voices.find((voice) => String(voice.language || "").startsWith("km")) || state.voices[0];
  const preferred = [
    previous,
    localStorage.getItem(STORE.voice) || "",
    khmerCamb ? `camb:${khmerCamb.id}` : "",
    "google:km",
    available[0] || "",
  ];
  const chosen = preferred.find((value) => value && available.includes(value)) || "";
  els.voice.value = chosen;

  updateVoiceUi();
}

function currentVoice() {
  const value = els.voice.value || "";
  const provider = providerOf(value);
  const id = value.slice(value.indexOf(":") + 1);
  const label = els.voice.selectedOptions?.[0]?.textContent || id;
  const match = state.voices.find((voice) => voice.id === id);
  return { provider, id, label, value, language: match?.language || "" };
}

function updateVoiceUi() {
  const voice = currentVoice();
  const needsSpeed = voice.provider === "camb";

  els.speedField.hidden = !needsSpeed;
  els.voiceNote.hidden = false;

  if (!voice.value) {
    els.voiceNote.textContent = "មិនទាន់មានសំឡេង — បញ្ចូល CAMB.AI key ឬផ្ទុកបញ្ជីឡើងវិញ។";
    updateRangeLabels();
    return;
  }

  els.voiceNote.textContent =
    voice.provider === "google"
      ? "សំឡេងឥតគិតថ្លៃ · Google Translate (unofficial)"
      : "CAMB.AI · MARS 8.1 (ខ្មែរ + ក្លូន)";

  updateRangeLabels();
  if (state.voiceTouched && voice.value) localStorage.setItem(STORE.voice, voice.value);
}

els.voice.addEventListener("change", () => {
  state.voiceTouched = true;
  updateVoiceUi();
});

function renderLibrary() {
  els.cloned.replaceChildren(
    ...state.voices.map((voice) => {
      const item = document.createElement("li");
      item.className = "voice-row";

      const info = document.createElement("div");
      info.className = "voice-info";

      const name = document.createElement("p");
      name.className = "voice-name";
      name.textContent = voice.name;

      const meta = document.createElement("p");
      meta.className = "track-meta";
      meta.textContent = `CAMB.AI · ${voice.language || "km-kh"}`;

      info.append(name, meta);

      const use = document.createElement("button");
      use.type = "button";
      use.className = "chip small";
      use.textContent = "ប្រើ";
      use.addEventListener("click", () => {
        const value = `camb:${voice.id}`;
        if (![...els.voice.options].some((option) => option.value === value)) return;
        els.voice.value = value;
        state.voiceTouched = true;
        updateVoiceUi();
        setTab("studio");
        els.text.focus();
      });

      item.append(info, use);
      return item;
    }),
  );

  els.clonedEmpty.hidden = state.voices.length > 0;
}

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
    showError(`អត្ថបទវែងពេក (អតិបរមា ${MAX_CHARS.toLocaleString("en-US")} តួអក្សរ)។`);
    return;
  }

  const voice = currentVoice();
  if (!voice.id) {
    showError("សូមជ្រើសរើសសំឡេងមួយសិន។ បញ្ចូល CAMB.AI key ដើម្បីទទួលបានសំឡេងខ្មែរ។");
    return;
  }

  if (voice.provider === "google" && text.length > FREE_MAX_CHARS) {
    showError(
      `សំឡេងឥតគិតថ្លៃអានបានត្រឹម ${FREE_MAX_CHARS.toLocaleString("en-US")} តួអក្សរ។ សម្រាប់អត្ថបទវែង សូមប្រើសំឡេង CAMB.AI។`,
    );
    return;
  }
  if (voice.provider === "camb" && !hasKey()) {
    showError("សំឡេង CAMB.AI ត្រូវការ key។ សូមបញ្ចូលវានៅប៊ូតុង CAMB.AI Key។");
    openKeys();
    return;
  }

  hideError();
  setBusy(true);

  try {
    const headers = { "content-type": "application/json" };
    if (state.cambKey) headers["x-camb-key"] = state.cambKey;

    const payload = { provider: voice.provider, voice: voice.id, text };

    if (voice.provider === "google") {
      payload.language = voice.id;
    } else {
      payload.language = voice.language || "km-kh";
      payload.speed = Number(els.speed.value);
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

function providerName(provider) {
  return provider === "camb" ? "CAMB.AI" : "Google (free)";
}

function showClip(blob, info) {
  const url = makeUrl(blob);
  const at = Date.now();
  const filename = `voice-${new Date(at).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.mp3`;

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

/* ---------------- key dialog ---------------- */

els.keysBtn.addEventListener("click", openKeys);
els.keySave.addEventListener("click", saveKey);
els.keyCancel.addEventListener("click", closeKeys);
els.keyClear.addEventListener("click", clearKey);
els.modal.addEventListener("click", (event) => {
  if (event.target === els.modal) closeKeys();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.modal.hidden) closeKeys();
});

function openKeys() {
  els.cambKey.value = state.cambKey;
  els.keyError.hidden = true;
  els.modal.hidden = false;
  els.cambKey.focus();
}

function closeKeys() {
  els.modal.hidden = true;
}

async function saveKey() {
  const key = els.cambKey.value.trim();
  if (!key) {
    keyError("សូមបញ្ចូល CAMB.AI API key។");
    return;
  }
  if (key.length < 8) {
    keyError("Key ខ្លីពេក — សូមពិនិត្យម្តងទៀត។");
    return;
  }

  state.cambKey = key;
  try {
    localStorage.setItem(STORE.cambKey, key);
  } catch {
    keyError("Browser មិនអនុញ្ញាតឱ្យរក្សាទុក key ទេ។");
    return;
  }

  els.keyError.hidden = true;
  closeKeys();
  updateStatus();

  await loadVoices();
  if (!state.voices.length && hasKey()) {
    showError("Key នេះមិនអាចផ្ទុកបញ្ជីសំឡេងបានទេ — សូមពិនិត្យថាវាត្រឹមត្រូវ។");
  }
}

function clearKey() {
  state.cambKey = "";
  state.voices = [];
  localStorage.removeItem(STORE.cambKey);
  els.cambKey.value = "";
  els.keyError.hidden = true;
  updateStatus();
  renderLibrary();
  renderVoices();
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

  if (target === "clone" && hasKey() && !state.voices.length) loadVoices();
}

/* ---------------- voice cloning ---------------- */

els.pickFiles.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", () => {
  addSample([...(els.fileInput.files || [])]);
  els.fileInput.value = "";
});

els.record.addEventListener("click", toggleRecord);
els.createVoice.addEventListener("click", createVoice);
els.refreshVoices.addEventListener("click", () => loadVoices());

function addSample(files) {
  hideError();

  for (const file of files) {
    const looksAudio =
      (file.type || "").startsWith("audio/") || /\.(mp3|wav|m4a|ogg|oga|webm|flac|aac)$/i.test(file.name || "");
    if (!looksAudio) {
      showError("ឯកសារនោះមិនមែនជាសំឡេងទេ។");
      continue;
    }
    if (file.size > MAX_CLONE_FILE_BYTES) {
      showError("ឯកសារធំពេក (អតិបរមា 10 MB)។");
      continue;
    }
    state.samples = [file];
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
        state.samples = [];
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
        addSample([new File([blob], `recording-1.${extension}`, { type })]);
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
      if (state.recordSeconds >= 180) stopRecording();
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

  if (!name) {
    showError("សូមដាក់ឈ្មោះសំឡេង។");
    els.cloneName.focus();
    return;
  }
  if (state.samples.length === 0) {
    showError("សូមបន្ថែមឯកសារសំឡេង ១។");
    return;
  }
  if (!els.consent.checked) {
    showError("សូមធីកប្រអប់បញ្ជាក់ការយល់ព្រមជាមុន។");
    return;
  }
  if (!hasKey()) {
    showError("ការក្លូនត្រូវការ CAMB.AI key។");
    openKeys();
    return;
  }

  hideError();
  setBusy(true);
  els.cloneStatus.textContent = "កំពុងក្លូនដោយ CAMB.AI… (អាចយូរ ១០–៦០ វិនាទី)";

  try {
    let file = state.samples[0];
    if (!CAMB_FILE_RE.test(file.name || "")) {
      file = await toWavFile(file);
    }
    if (file.size > MAX_CLONE_FILE_BYTES) {
      throw new Error("ឯកសារបន្ទាប់ពីបំលែងធំពេក (អតិបរមា 10 MB)។");
    }

    const form = new FormData();
    form.append("name", name);
    form.append("consent", "true");
    form.append("provider", "camb");
    form.append("gender", els.cloneGender.value);
    form.append("language", els.cloneLang.value);
    form.append("files", file, file.name || "sample.wav");

    const headers = {};
    if (state.cambKey) headers["x-camb-key"] = state.cambKey;

    const response = await fetch("/api/voices/clone", { method: "POST", headers, body: form });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `ការក្លូនបរាជ័យ (${response.status})។`);

    state.samples = [];
    renderSamples();
    els.cloneName.value = "";
    els.consent.checked = false;
    els.cloneStatus.textContent = "✓ បង្កើតសំឡេងក្លូនបានជោគជ័យ។ ជ្រើសវាក្នុងបញ្ជីសំឡេង។";

    await loadVoices();

    const value = `camb:${data?.voice_id}`;
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
