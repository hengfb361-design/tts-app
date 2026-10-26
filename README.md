# សំឡេង AI — អក្សរទៅសំឡេង

គេហទំព័របំលែងអក្សរទៅជាសំឡេង ដែលផ្តោតលើ **ភាសាខ្មែរ**។ មានផ្ទាំងទីពីរ
សម្រាប់ **ក្លូនសំឡេងខ្លួនឯង** ហើយអាចបង្កើតសំឡេងខ្មែរបាន **ដោយឥតគិតថ្លៃ**
ដោយមិនបាច់ដាក់ key។

- Frontend៖ HTML + CSS + JS សុទ្ធ (គ្មាន build step)
- Backend៖ Cloudflare Worker បិទបាំង key និងហៅ API ជំនួស browser

## Providers

| Provider | Free? | ខ្មែរ? | ក្លូនសំឡេង? | ចំណាំ |
| --- | --- | --- | --- | --- |
| **Google Translate voice** | ✅ ឥតគិតថ្លៃ ១០០% | ✅ | ❌ | ឥតបាច់ key · ១,៥០០ តួអក្សរ · endpoint មិនផ្លូវការ (gTTS) · អាចត្រូវ rate limit |
| **Azure AI Speech** | ៥០០,០០០ តួអក្សរ neural/ខែ (F0) | ✅ ២ សំឡេង | ❌ | គុណភាពល្អបំផុតសម្រាប់ខ្មែរ · ត្រូវការ key + region |
| **CAMB.AI (MARS 8.1)** | Free plan: សំឡេងក្លូន ១ + ៥០០ តួអក្សរ | ✅ | ✅ | ផ្លូវតែមួយគត់សម្រាប់ “សំឡេងខ្ញុំ + ខ្មែរ” · ត្រូវការ key |
| **ElevenLabs** | ១០,០០០ credits/ខែ | ❌ | ✅ | ល្អសម្រាប់អង់គ្លេស/ថៃ/វៀតណាម · instant cloning ត្រូវការ plan បង់ប្រាក់ |

## របៀបប្រើ

1. បើក website → សំឡេង **“ខ្មែរ · Free”** ត្រូវបានជ្រើសស្រាប់ (ឥតបាច់ key)
2. សរសេរអត្ថបទ → ចុច **បង្កើតសំឡេង** → លេង ឬចុច **ទាញយក**
3. ចង់បានគុណភាពខ្ពស់ → ចុច **Keys** → ដាក់ Azure Speech key + region → ជ្រើសសំឡេង Azure
4. ចង់បានសំឡេងខ្លួនឯង → ផ្ទាំង **សំឡេងខ្ញុំ**

### សំឡេងឥតគិតថ្លៃ (gTTS style)

- ប្រើ `translate.google.com/translate_tts` — endpoint ដែល library **gTTS** ប្រើ
- គាំទ្រ ខ្មែរ / English / ไทย / Tiếng Việt
- អតិបរមា **១,៥០០ តួអក្សរ** ក្នុងមួយដង (បំបែកជា chunk ≤ ១៨០ តួអក្សរ រួចបញ្ចូល MP3)
- ⚠️ មិនមែន API ផ្លូវការទេ — Google អាច block/rate-limit ពេលប្រើច្រើន។
  សម្រាប់ production គួរប្រើ Azure (មាន free tier ៥០០,០០០ តួអក្សរ/ខែ)

## ការក្លូនសំឡេង

1. ផ្ទាំង **សំឡេងខ្ញុំ** → ជ្រើស provider
   - **CAMB.AI · ខ្មែរ** — សំឡេងក្លូននិយាយខ្មែរ (MARS 8.1 beta)
   - **ElevenLabs · ភាសាដទៃ** — មិនគាំទ្រខ្មែរ
2. ផ្ទុកឯកសារ ១–៣ ឬថតដោយមីក្រូហ្វូន (៣០ វិនាទី – ៣ នាទី ល្អបំផុត)
3. ដាក់ឈ្មោះ → ធីកប្រអប់បញ្ជាក់ការយល់ព្រម → **បង្កើតសំឡេងក្លូន**
4. សំឡេងក្លូនចូលក្នុងបញ្ជីសំឡេង (ក្រុម CAMB.AI ឬ ElevenLabs)

CAMB.AI ទទួល **mp3/wav/aac/flac** — ការថតក្នុង browser (webm/opus) ត្រូវបានបំលែង
ទៅ WAV ស្វ័យប្រវត្តិនៅក្នុង browser។ សម្រាប់ CAMB.AI ឯកសារទីមួយត្រូវបានប្រើ។

> **សំខាន់៖** សូមក្លូនតែសំឡេងខ្លួនឯង ឬសំឡេងដែលអ្នកមានការអនុញ្ញាតច្បាស់លាស់។
> ការប្រើសំឡេងអ្នកដទៃដើម្បីបោកប្រាស់ គឺខុសច្បាប់ និងខុសលក្ខខណ្ឌរបស់ provider។

## “ធ្វើឱ្យដូចសំឡេង upload 100%” — ការពិត

**គ្មានប្រព័ន្ធ TTS ណាធានាដូច 100% ទេ** ហើយការផ្សាយពាណិជ្ជកម្មបែបនោះគឺ
លើសពីការពិត។ លេខដែលបានផ្សព្វផ្សាយ (speaker-embedding similarity មិនមែន % ដូច):

| ប្រព័ន្ធ | លទ្ធផលដែលបានផ្សព្វផ្សាយ | ធៀបនឹងសំឡេងពិត |
| --- | --- | --- |
| XTTS (zero-shot) | SECS 0.64 (cross-lingual 0.50) | 0.90 |
| F5-TTS | SIM-o 0.67 | 0.73 |
| RVC v2 (បណ្តុះលើ ៣៩ នាទី) | Resemblyzer 0.846 | 0.898 |

ផ្លូវដែលដូចបំផុត បើចាំបាច់៖

1. **CAMB.AI clone** — ងាយបំផុត, cloud, គាំទ្រខ្មែរ, ប៉ុន្តែគ្រាន់តែ “ស្រដៀងខ្លាំង”
2. **ElevenLabs Professional Voice Clone** — ត្រូវការ ៣០ នាទី – ៣ ម៉ោង នៃសំឡេង និង plan បង់ប្រាក់ (មិនគាំទ្រខ្មែរ)
3. **RVC (voice conversion)** — ដូចបំផុតផ្នែក timbre ព្រោះវាបំលែងសំឡេងដែលមានស្រាប់
   (ឧ. សំឡេង Azure អានខ្មែរ → បំលែងទៅសំឡេងអ្នក)។ ត្រូវការ GPU + បណ្តុះម៉ូដែល
   លើ ១០–៥០ នាទី នៃសំឡេងអ្នក។ មិនឥតគិតថ្លៃ និងមិន 100% ដែរ។

## Keys ដាក់នៅឯណា

**ក្នុង browser** (ណែនាំសម្រាប់ការប្រើឯកជន)
- `localStorage`: `voicesite.azureKey`, `voicesite.azureRegion`, `voicesite.cambKey`, `voicesite.elevenKey`
- ផ្ញើទៅ server ជា header `x-azure-key` / `x-azure-region` / `x-camb-key` / `x-eleven-key`
- មិនដាក់ក្នុង HTML, log ឬ git

**នៅ server** (ឱ្យអ្នកចូលមើលប្រើបាន)
- `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`
- `CAMB_API_KEY`
- `ELEVENLABS_API_KEY`
- ដាក់ក្នុង **Sites → Secrets** ឬ `npx wrangler secret put CAMB_API_KEY`

យក key៖
- Azure Speech — https://portal.azure.com → **Speech** resource (free tier F0)
- CAMB.AI — https://studio.camb.ai → Settings → API Keys
- ElevenLabs — https://elevenlabs.io/app/settings/api-keys

## ដែនកំណត់

| អ្វី | ចំនួន |
| --- | --- |
| អត្ថបទ Azure / ElevenLabs | ៥,០០០ តួអក្សរ |
| អត្ថបទ CAMB.AI | ៣,០០០ តួអក្សរ |
| អត្ថបទ Google free | ១,៥០០ តួអក្សរ |
| ឯកសារក្លូន | ១–៣ · ១០ MB/ឯកសារ · ៣០ MB សរុប |
| ប្រវត្តិ | ៦ សំឡេងចុងក្រោយ ក្នុងវគ្គនេះ (refresh → បាត់) |

## API routes

| Route | តួនាទី |
| --- | --- |
| `POST /api/tts` | បង្កើតសំឡេង (`provider: google \| azure \| camb \| elevenlabs`) |
| `GET /api/voices` | បញ្ជីសំឡេង Azure (ឬ builtin) |
| `GET /api/voices/camb` | បញ្ជីសំឡេង CAMB.AI |
| `GET /api/voices/cloned` | បញ្ជីសំឡេង ElevenLabs |
| `POST /api/voices/clone` | ក្លូន (multipart, `provider=camb\|elevenlabs`, `consent=true`) |
| `DELETE /api/voices/cloned/:id` | លុបសំឡេង ElevenLabs |
| `GET /api/health` | ស្ថានភាព server keys |

## Run / តេស្ត / Deploy

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # worker routes + jsdom UI
npx wrangler deploy
```

ឬតាម Freebuff Sites៖ ប្រើ `sites-manifest.json`។

## Files

| File | តួនាទី |
| --- | --- |
| `worker.js` | TTS (៤ providers), voice lists, cloning, origin guard |
| `public/index.html` | ផ្ទាំងស្ទូឌីយោ + ក្លូនសំឡេង |
| `public/styles.css` | រចនាប័ទ្ម |
| `public/app.js` | voice picker, ប្រវត្តិ, ការក្លូន, key modal |
| `scripts/check-*.mjs` | តេស្ត |
