from flask import Flask, render_template_string, request, send_file, jsonify
from io import BytesIO
import os
import tempfile
from gradio_client import Client, handle_file

app = Flask(__name__)

HTML = r"""
<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Voice Clone & TTS</title>
    <style>
        body { font-family: 'Kantumruy Pro', sans-serif; background: #f0f2f5; margin: 0; padding: 20px; display: flex; justify-content: center; }
        .card { background: white; max-width: 500px; width: 100%; padding: 25px; border-radius: 15px; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        h2 { text-align: center; color: #1a1a1a; margin-bottom: 20px; font-size: 22px; }
        label { display: block; font-weight: bold; margin-bottom: 8px; color: #333; }
        textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; height: 100px; font-size: 16px; resize: none; box-sizing: border-box; }
        input[type="file"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; background: #fafafa; }
        button { width: 100%; padding: 15px; background: #2878ff; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 15px; transition: 0.2s; }
        button:hover { background: #1c5dd4; }
        button:disabled { background: #a0c0ff; cursor: not-allowed; }
        .status { text-align: center; margin-top: 15px; font-size: 14px; font-weight: bold; color: #555; }
        .error { color: #d93025; }
        .success { color: #188038; }
        .player-box { display: none; margin-top: 20px; text-align: center; }
        audio { width: 100%; margin-top: 10px; outline: none; }
        .note { font-size: 12px; color: #888; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="card">
        <h2>🎙️ AI Voice Clone</h2>
        
        <div style="margin-bottom: 20px;">
            <label>📝 អត្ថបទដែលត្រូវអាន (ភាសាអង់គ្លេស):</label>
            <textarea id="textInput" placeholder="សរសេរអត្ថបទជាភាសាអង់គ្លេសនៅទីនេះ...">Hello, this is a test of the AI voice cloning system.</textarea>
        </div>

        <div style="margin-bottom: 20px;">
            <label>🎵 ឯកសារសំឡេងគំរូ (Voice Clone):</label>
            <input type="file" id="audioInput" accept="audio/*">
            <div class="note">* ទុកទទេ ប្រសិនបើចង់ប្រើសំឡេង Default</div>
        </div>

        <button id="generateBtn" onclick="generate()">🚀 បង្កើតសំឡេង</button>
        
        <div class="status" id="statusText"></div>

        <div class="player-box" id="playerBox">
            <audio id="audioPlayer" controls></audio>
        </div>
    </div>

    <script>
        async function generate() {
            const text = document.getElementById('textInput').value.trim();
            const fileInput = document.getElementById('audioInput');
            const btn = document.getElementById('generateBtn');
            const status = document.getElementById('statusText');
            const playerBox = document.getElementById('playerBox');
            const audioPlayer = document.getElementById('audioPlayer');

            if (!text) {
                status.innerText = "សូមបញ្ចូលអត្ថបទជាមុនសិន!";
                status.className = "status error";
                return;
            }

            btn.disabled = true;
            btn.innerText = "⏳ កំពុងដំណើរការ (សូមរង់ចាំ 10-30 វិនាទី)...";
            status.innerText = "";
            playerBox.style.display = "none";

            const formData = new FormData();
            formData.append('text', text);
            if (fileInput.files.length > 0) {
                formData.append('reference_audio', fileInput.files[0]);
            }

            try {
                const response = await fetch('/clone_tts', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || "Server Error");
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                
                audioPlayer.src = url;
                playerBox.style.display = "block";
                status.innerText = "✅ បង្កើតសំឡេងបានជោគជ័យ!";
                status.className = "status success";
                audioPlayer.play();

            } catch (error) {
                status.innerText = "❌ បរាជ័យ: " + error.message;
                status.className = "status error";
            } finally {
                btn.disabled = false;
                btn.innerText = "🚀 បង្កើតសំឡេង";
            }
        }
    </script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(HTML)

@app.route("/clone_tts", methods=["POST"])
def clone_tts():
    text = request.form.get("text", "").strip()
    reference_audio = request.files.get("reference_audio")

    if not text:
        return jsonify(error="សូមបញ្ចូលអត្ថបទ"), 400

    # នេះជា Hugging Face Space សម្រាប់ OpenVoice V2 (ឥតគិតថ្លៃ)
    # អ្នកអាចរក Space ផ្សេងបាន បើវាគាំទ្រ API
    HF_SPACE = "myshell-ai/OpenVoiceV2" 

    temp_audio_path = None
    if reference_audio:
        # រក្សាទុកឯកសារសំឡេងគំរូជាបណ្តោះអាសន្ន
        temp_dir = tempfile.gettempdir()
        temp_audio_path = os.path.join(temp_dir, "ref_audio.wav")
        reference_audio.save(temp_audio_path)

    try:
        # ភ្ជាប់ទៅ OpenVoice V2
        client = Client(HF_SPACE, verbose=False)
        
        # ហៅ API (ចំណាំ: parameter អាចខុសគ្នាបន្តិចបន្តួចតាម Space នីមួយៗ)
        # ប្រសិនបើវា Error សូមពិនិត្យមើល API Docs នៅលើ Space នោះ
        result = client.predict(
            prompt=text,
            style="en_default",
            audio_file_pth=handle_file(temp_audio_path) if temp_audio_path else None,
            speed=1.0,
            agree=True,
            api_name="/predict"
        )

        # លទ្ធផលជាធម្មតាជា Tuple ដែលមាន path ទៅកាន់ឯកសារសំឡេង
        output_audio_path = result[1] if isinstance(result, tuple) else result

        # អានឯកសារសំឡេងដែលបានបង្កើត
        with open(output_audio_path, "rb") as f:
            audio_data = f.read()

        return send_file(
            BytesIO(audio_data),
            mimetype="audio/wav",
            as_attachment=True,
            download_name="output.wav"
        )

    except Exception as e:
        print(f"Error: {e}")
        return jsonify(error="មិនអាចភ្ជាប់ទៅ OpenVoice API បានទេ។ សូមព្យាយាមម្តងទៀត។"), 502
    finally:
        # លុបឯកសារបណ្តោះអាសន្នចោល
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port, debug=False)
