# សំឡេង AI — អក្សរទៅសំឡេង (CAMB.AI)

គេហទំព័របំលែងអក្សរទៅជាសំឡេង ដែលផ្តោតលើ **ភាសាខ្មែរ**។ មាន **key តែមួយប៉ុណ្ណោះ** —
**CAMB.AI** — ហើយ key នោះគ្រប់គ្រាន់សម្រាប់ឲ្យគេហទំព័រដំណើរការពេញលេញ
(សំឡេងខ្មែរ + ភាសាជាង ៣០០ + ការក្លូនសំឡេងខ្លួនឯង)។

- Frontend៖ HTML + CSS + JS សុទ្ធ (គ្មាន build step)
- Backend៖ Cloudflare Worker (`worker.js`) ឬ Node server (`server.js`) សម្រាប់ Render —
  ទាំងពីរប្រើ handler តែមួយ ដូច្នេះ API ដូចគ្នា
- Key របស់អ្នករក្សាក្នុង browser (localStorage) ហើយផ្ញើទៅ server តែពេលបង្កើតសំឡេង

## Providers

| Provider | Free? | ខ្មែរ? | ក្លូនសំឡេង? | ចំណាំ |
| --- | --- | --- | --- | --- |
| **CAMB.AI MARS 8.1** | free plan មានកំណត់ | ✅ | ✅ | provider សំខាន់ · ត្រូវការ key មួយ · បង្ហាញ **តែសំឡេងក្លូនរបស់អ្នក** (មិនបង្ហាញសំឡេង stock របស់ CAMB.AI) |
| **Google Translate voice** | ✅ ឥតគិតថ្លៃ ១០០% | ✅ | ❌ | key មិនបាច់ · ១,៥០០ តួអក្សរ · endpoint មិនផ្លូវការ (gTTS) · អាច rate limit |

## របៀបប្រើ

1. បើកគេហទំព័រ → ចុច **CAMB.AI Key** (ខាងស្តាំលើ) → បិទភ្ជាប់ key → **រក្សាទុក**
2. ផ្ទាំង **សំឡេងខ្ញុំ** → ផ្ទុក/ថតសំឡេងខ្លួនឯង → **បង្កើតសំឡេងក្លូន**
3. ត្រឡប់ទៅ **បង្កើតសំឡេង** → សំឡេងក្លូនរបស់អ្នកត្រូវបានជ្រើសស្រាប់ → សរសេរអត្ថបទ → **បង្កើតសំឡេង**
4. លេង ឬចុច **ទាញយក** (MP3)

បញ្ជីសំឡេងបង្ហាញ **តែសំឡេងក្លូនដែលអ្នកបង្កើត** (រក្សាក្នុង browser ហើយផ្ទៀងផ្ទាត់ជាមួយ
CAMB.AI រាល់ពេលបើក) បូកនឹងសំឡេងឥតគិតថ្លៃ — សំឡេង stock រាប់រយរបស់ CAMB.AI
មិនត្រូវបានបង្ហាញទេ។ ចង់លុបសំឡេងក្លូនណាមួយ → ចុច **លុប** ក្នុងបញ្ជី (លុបនៅ CAMB.AI ដែរ)។

មិនទាន់មាន key? ក្រុម **🎁 ឥតគិតថ្លៃ · Free** នៅតែបង្កើតសំឡេងខ្មែរបាន (ខ្លី)។

យក key៖ https://studio.camb.ai → ផ្នែក **API** → បង្កើត API key។

## ការក្លូនសំឡេង

1. ផ្ទាំង **សំឡេងខ្ញុំ** → ផ្ទុកឯកសារ **១** ឬថតដោយមីក្រូហ្វូន (៣០ វិនាទី – ៣ នាទី)
2. ដាក់ឈ្មោះ · ជ្រើសស្រី/ប្រុស · ជ្រើសភាសាគំរូ → ធីកប្រអប់បញ្ជាក់ → **បង្កើតសំឡេងក្លូន**
3. សំឡេងក្លូនចូលក្នុងបញ្ជីសំឡេងភ្លាម (CAMB.AI បង្កើតរួចភ្លាម) → ជ្រើសវាដើម្បីអានអត្ថបទ

CAMB.AI ទទួល **mp3/wav/aac/flac** — ការថតក្នុង browser (webm/opus) ត្រូវបានបំលែងទៅ
WAV ស្វ័យប្រវត្តិនៅក្នុង browser មុនផ្ញើ។

> **សំខាន់៖** សូមក្លូនតែសំឡេងខ្លួនឯង ឬសំឡេងដែលអ្នកមានការអនុញ្ញាតច្បាស់លាស់។
> ការប្រើសំឡេងអ្នកដទៃដើម្បីបោកប្រាស់ គឺខុសច្បាប់ និងខុសលក្ខខណ្ឌរបស់ provider។

## “ធ្វើឱ្យដូចសំឡេង upload 100%” — ការពិត

**គ្មានប្រព័ន្ធ TTS ណាធានាដូច 100% ទេ។** លេខដែលបានផ្សព្វផ្សាយ
(speaker-embedding similarity មិនមែន % ដូច):

| ប្រព័ន្ធ | លទ្ធផលដែលបានផ្សព្វផ្សាយ | ធៀបនឹងសំឡេងពិត |
| --- | --- | --- |
| XTTS (zero-shot) | SECS 0.64 (cross-lingual 0.50) | 0.90 |
| F5-TTS | SIM-o 0.67 | 0.73 |
| RVC v2 (បណ្តុះលើ ៣៩ នាទី) | Resemblyzer 0.846 | 0.898 |

ផ្លូវដែលជិតបំផុត៖

1. **CAMB.AI clone** — ងាយបំផុត, cloud, គាំទ្រខ្មែរ, ប៉ុន្តែគ្រាន់តែ “ស្រដៀងខ្លាំង”
2. **RVC (voice conversion)** — ដូចបំផុតផ្នែក timbre ព្រោះវាបំលែងសំឡេងដែលមានស្រាប់
   (ឧ. សំឡេងអានខ្មែរ → បំលែងទៅសំឡេងអ្នក)។ ត្រូវការ GPU + បណ្តុះម៉ូដែល
   លើ ១០–៥០ នាទី នៃសំឡេងអ្នក។ មិនឥតគិតថ្លៃ និងមិន 100% ដែរ។

## Keys ដាក់នៅឯណា

**ក្នុង browser** (ណែនាំ — គេហទំព័រនេះធ្វើបែបនេះស្រាប់)
- `localStorage`: `voicesite.cambKey`
- ផ្ញើទៅ server ជា header `x-camb-key`
- មិនដាក់ក្នុង HTML, log ឬ git — មិនប៉ះពាល់អ្នកប្រើដទៃ

**នៅ server** (ស្រេចចិត្ត — បើចង់ឲ្យអ្នកចូលមើលប្រើបានដោយមិនបាច់មាន key ខ្លួនឯង)
- Render → **Environment** → `CAMB_API_KEY`
- Cloudflare → `npx wrangler secret put CAMB_API_KEY`

## ដែនកំណត់

| អ្វី | ចំនួន |
| --- | --- |
| អត្ថបទ CAMB.AI | ៣,០០០ តួអក្សរ / សំណើ |
| អត្ថបទ Google free | ១,៥០០ តួអក្សរ |
| ឯកសារក្លូន | ១ ឯកសារ · ១០ MB |
| ប្រវត្តិ | ៦ សំឡេងចុងក្រោយ ក្នុងវគ្គនេះ (refresh → បាត់) |

## API routes

| Route | តួនាទី |
| --- | --- |
| `POST /api/tts` | បង្កើតសំឡេង (`provider: camb \\| google`) |
| `GET /api/voices` | ផ្ទៀងផ្ទាត់ key + ត្រឡប់ **តែសំឡេងក្លូនរបស់អ្នក** (សម្គាល់ដោយ description) |
| `DELETE /api/voices/:id` | លុបសំឡេងក្លូនមួយ (CAMB.AI `delete-voice`) |
| `POST /api/voices/clone` | ក្លូន (multipart: `name`, `consent=true`, `gender`, `language`, `files`) |
| `GET /api/health` | ស្ថានភាព server key |

សំណើ POST ត្រូវមកពី origin ដូចគ្នា (ការពារ cross-site abuse)។
នៅពីក្រោយ reverse proxy ដូច Render, `worker.js` ប្រៀបធៀបតែ **host**
ព្រោះ proxy បំលែង https → http។

## Run / តេស្ត / Deploy

```bash
npm install
npm run dev        # Cloudflare Worker នៅ http://localhost:3000
npm start          # Node server (ដូច Render) នៅ $PORT ឬ 8787
npm run check      # តេស្ត៖ worker routes (mock CAMB.AI) + jsdom UI
```

- **Render**៖ Web Service → runtime **Node** → Build `npm install` → Start `npm start`។
  Push ទៅ branch `main` → Render deploy ស្វ័យប្រវត្តិ។
- **Cloudflare**៖ `npx wrangler deploy` (ឬប្រើ `sites-manifest.json`)។

## Files

| File | តួនាទី |
| --- | --- |
| `worker.js` | TTS (CAMB.AI + free), key check, ក្លូន/លុបសំឡេង, origin guard |
| `server.js` | Node entry point សម្រាប់ Render (ប្រើ `worker.js` ដូចគ្នា) |
| `public/index.html` | ផ្ទាំងស្ទូឌីយោ + ក្លូនសំឡេង + key dialog |
| `public/styles.css` | រចនាប័ទ្ម |
| `public/app.js` | voice picker, ប្រវត្តិ, ការក្លូន, key dialog |
| `scripts/check-worker.mjs` | តេស្ត API (mock upstream) |
| `scripts/check-ui.mjs` | តេស្ត front end ក្នុង jsdom |
