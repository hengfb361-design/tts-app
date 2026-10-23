from flask import Flask, render_template_string, request, send_file, jsonify
from io import BytesIO
import os
import tempfile
from gtts import gTTS
import requests

app = Flask(__name__)

# ទាញយក Key ទាំងអស់ពី Render ដោយបំបែកវាតាមសញ្ញាក្បៀស (,)
raw_keys = os.getenv("CLOUD_API_KEYS", "")
# បំបែកខ្សែអក្សរទៅជា List នៃ Keys
API_KEYS = [key.strip() for key in raw_keys.split(",") if key.strip()]

# ប្រសិនបើគ្មាន Key ទេ ដាក់ Key គំរូទុកដើម្បីកុំឱ្យ Error
if not API_KEYS:
    API_KEYS = ["5e4a8172-42fa-464c-8034-c62cbd7f3244"]

HTML = r"""
<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Voice Clone Studio</title>
    <style>
        body { font-family: 'Kantumruy Pro', sans-serif; background: #f3f4f6; padding: 20px; display: flex; justify-content: center; }
        .card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
        h2 { text-align: center; color: #333; }
        textarea { width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; margin-bottom: 15px; resize: none; font-size: 16px; }
        button { width: 100%; padding: 14px; background: linear-gradient(90deg, #8b5cf6, #3b82f6); color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; }
        button:disabled { background: #a5b4fc; cursor: not-allowed; }
        .status { text-align: center; margin-top: 15px; color: #666; font-size: 14px; font-weight: bold; }
        audio { width: 100%; margin-top: 15px; display: none; }
    </style>
</head>
<body>
    <div class="card">
        <h2>🎙️ AI Voice Clone (Auto-Switch)</h2>
        
        <textarea id="textInput" placeholder="សរសេរអត្ថបទខ្មែរនៅទីនេះ...">សួស្តី! នេះជាការបង្ហាញពីប្រព័ន្ធប្តូរ Key ស្វ័យប្រវត្តិ។</textarea>

        <button id="generateBtn">បង្កើតសំឡេង (Generate)</button>
        
        <div class="status" id="statusText"></div>
        <audio id="audioPlayer" controls></audio>
    </div>

    <script>
        document.getElementById('generateBtn').addEventListener('click', async () => {
            const text = document.getElementById('textInput').value.trim();
            const btn = document.getElementById('generateBtn');
            const status = document.getElementById('statusText');
            const audioPlayer = document.getElementById('audioPlayer');

            if (!text) { alert('សូមបញ្ចូលអត្ថបទ!'); return; }

            btn.disabled = true;
            btn.innerText = '⏳ កំពុងដំណើរការ...';
            status.innerText = 'កំពុងភ្ជាប់ទៅកាន់ Cloud API...';
            audioPlayer.style.display = 'none';

            const formData = new FormData();
            formData.append('text', text);

            try {
                const response = await fetch('/api/generate', { method: 'POST', body: formData });
                
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Network Error');
                }

                const blob = await response.blob();
                audioPlayer.src = URL.createObjectURL(blob);
                audioPlayer.style.display = 'block';
                
                // អាន Header ដើម្បីដឹងថាតើ API ណាដែលត្រូវបានប្រើ
                const usedSource = response.headers.get('X-Voice-Source');
                status.innerText = `✅ បង្កើតបានជោគជ័យ! (ប្រើ៖ ${usedSource})`;
                
                audioPlayer.play();
            } catch (error) {
                status.innerText = '❌ ' + error.message;
            } finally {
                btn.disabled = false;
                btn.innerText = 'បង្កើតសំឡេង (Generate)';
            }
        });
    </script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(HTML)

@app.route("/api/generate", methods=["POST"])
def generate_audio():
    text = request.form.get("text", "").strip()
    if not text:
        return jsonify(error="សូមបញ្ចូលអត្ថបទ"), 400

    temp_dir = tempfile.gettempdir()
    base_audio_path = os.path.join(temp_dir, "base_audio.mp3")

    # ជំហានទី១៖ បង្កើតសំឡេងគោលដោយ gTTS
    try:
        tts = gTTS(text=text, lang='km', slow=False)
        tts.save(base_audio_path)
    except Exception as e:
        return jsonify(error="មិនអាចបង្កើតសំឡេងគោលបានទេ"), 500

    # ជំហានទី២៖ ព្យាយាមហៅ Cloud API ដោយប្តូរ Key ស្វ័យប្រវត្តិ
    # (ចំណាំ៖ ខាងក្រោមនេះជាកូដគំរូសម្រាប់ការពន្យល់។ 
    # អ្នកត្រូវប្តូរ URL និងទម្រង់ទិន្នន័យទៅតាម API ពិតរបស់អ្នក)
    
    API_URL = "https://api.your-cloud-provider.com/v1/tts" 
    
    for i, key in enumerate(API_KEYS):
        try:
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json"
            }
            payload = {
                "text": text,
                "language": "km-kh",
                "voice_id": "YOUR_CLONED_VOICE_ID"
            }

            # ព្យាយាមផ្ញើ Request
            # response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
            
            # --- កូដសាកល្បងសម្រាប់បង្ហាញពីដំណើរការប្តូរ Key ---
            # (ព្រោះយើងមិនដឹង API ពិត ខ្ញុំធ្វើឱ្យ Key ទី១ Error ដើម្បីបង្ហាញថាវាប្តូរទៅ Key ទី២)
            if i == 0: 
                raise requests.exceptions.HTTPError("402 Client Error: Payment Required (Out of Credits)")
            # -----------------------------------------------------------

            # ប្រសិនបើជោគជ័យ (Status 200)
            # if response.status_code == 200:
            #     # យើងបន្ថែម Header ដើម្បីប្រាប់ Frontend ថាប្រើ Key ណា
            #     resp = send_file(BytesIO(response.content), mimetype="audio/wav")
            #     resp.headers["X-Voice-Source"] = f"Cloud API (Key {i+1})"
            #     return resp
            
            # សម្រាប់ការសាកល្បងនេះ ប្រសិនបើវាឆ្លងផុត (មិន Error) យើងត្រឡប់ gTTS វិញ
            resp = send_file(base_audio_path, mimetype="audio/mpeg")
            resp.headers["X-Voice-Source"] = f"Cloud API (Key {i+1})"
            return resp

        except (requests.exceptions.RequestException, Exception) as e:
            # បើ Error (ដូចជាអស់ Credit) ឱ្យវាបន្តទៅ Key បន្ទាប់ (Loop បន្ត)
            print(f"Key ទី {i+1} បរាជ័យ: {e}. កំពុងប្តូរទៅ Key បន្ទាប់...")
            continue # បន្តទៅ Key បន្ទាប់

    # ប្រសិនបើរត់អស់ Key ទាំងអស់ហើយ តែនៅតែ Error
    print("Key ទាំងអស់អស់ Credit ឬមានបញ្ហា! ប្រើ gTTS ជំនួសវិញ។")
    resp = send_file(base_audio_path, mimetype="audio/mpeg")
    resp.headers["X-Voice-Source"] = "gTTS Fallback (All Keys Failed)"
    return resp

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port, debug=False)
