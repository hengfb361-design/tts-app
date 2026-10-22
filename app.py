from flask import Flask, render_template_string, request, send_file, jsonify
from io import BytesIO
import os
import requests

app = Flask(__name__)

# រចនាសម្ព័ន្ធ HTML ខ្លីៗ តែគ្រប់គ្រាន់សម្រាប់ការប្រើប្រាស់
HTML = r"""
<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AI Voice Studio - Voice Clone</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        h2 { text-align: center; color: #333; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        textarea, input[type="file"] { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; }
        textarea { height: 100px; resize: vertical; }
        button { width: 100%; padding: 12px; background: #2878ff; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; margin-top: 10px; }
        button:hover { background: #1c5dd4; }
        .player { margin-top: 20px; text-align: center; display: none; }
        audio { width: 100%; margin-top: 10px; }
        .status { text-align: center; color: #666; margin-top: 10px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>🎙️ AI Voice Clone & TTS</h2>
        <div class="form-group">
            <label>📝 អត្ថបទដែលត្រូវអាន (Text to Speech):</label>
            <textarea id="text" placeholder="សរសេរអត្ថបទនៅទីនេះ..."></textarea>
        </div>
        <div class="form-group">
            <label>🎵 ឯកសារសំឡេងគំរូ (Reference Audio - Voice Clone):</label>
            <input type="file" id="audioFile" accept="audio/*">
            <small style="color: #888;">ទុកទទេប្រសិនបើចង់ប្រើសំឡេងលំនាំដើម</small>
        </div>
        <button id="generateBtn" onclick="generateSpeech()">បង្កើតសំឡេង (Generate)</button>
        
        <div class="status" id="status"></div>
        
        <div class="player" id="playerBox">
            <audio id="audioPlayer" controls></audio>
        </div>
    </div>

    <script>
        async function generateSpeech() {
            const text = document.getElementById('text').value.trim();
            const fileInput = document.getElementById('audioFile');
            const status = document.getElementById('status');
            const playerBox = document.getElementById('playerBox');
            const audioPlayer = document.getElementById('audioPlayer');
            const btn = document.getElementById('generateBtn');

            if (!text) {
                alert('សូមបញ្ចូលអត្ថបទជាមុនសិន!');
                return;
            }

            btn.disabled = true;
            btn.innerText = '⏳ កំពុងបង្កើតសំឡេង...';
            status.innerText = 'កំពុងដំណើរការ...';
            playerBox.style.display = 'none';

            const formData = new FormData();
            formData.append('text', text);
            if (fileInput.files.length > 0) {
                formData.append('reference_audio', fileInput.files[0]);
            }

            try {
                // ហៅទៅកាន់ Backend របស់អ្នក (Flask)
                const response = await fetch('/clone_tts', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'មានបញ្ហាក្នុងការបង្កើតសំឡេង');
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                audioPlayer.src = url;
                playerBox.style.display = 'block';
                status.innerText = '✅ បង្កើតសំឡេងបានជោគជ័យ!';
                audioPlayer.play();

            } catch (error) {
                status.innerText = '❌ ' + error.message;
                console.error(error);
            } finally {
                btn.disabled = false;
                btn.innerText = 'បង្កើតសំឡេង (Generate)';
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

    # ចំណុចសំខាន់៖ នៅទីនេះអ្នកត្រូវភ្ជាប់ទៅ OpenVoice V2 API
    # ឧទាហរណ៍៖ ការហៅទៅកាន់ Hugging Face Space ឬ Server ផ្ទាល់ខ្លួនរបស់អ្នក
    # ខាងក្រោមនេះជា Logic គំរូសម្រាប់ការតភ្ជាប់ (អ្នកត្រូវបញ្ជាក់ URL ពិតប្រាកដ)
    
    try:
        # ឧទាហរណ៍កូដហៅទៅ OpenVoice API (ត្រូវកែសម្រួលតាម API ដែលអ្នកប្រើ)
        # ចំណាំ៖ បើប្រើ Hugging Face Space ត្រូវប្រើ gradio_client ឬ requests ទៅកាន់ /api/predict
        OPENVOICE_API_URL = "https://your-openvoice-server-url.com/tts" 
        
        payload = {"text": text, "language": "en"} # ភាសាដែល OpenVoice V2 គាំទ្រគឺ អង់គ្លេស, ចិន, ជប៉ុន, កូរ៉េ, អេស្ប៉ាញ, បារាំង
        
        files = {}
        if reference_audio:
            files['reference_audio'] = (reference_audio.filename, reference_audio.stream, reference_audio.mimetype)

        # បញ្ជូនទៅ API
        response = requests.post(OPENVOICE_API_URL, data=payload, files=files if files else None, timeout=60)
        
        if response.status_code != 200:
            return jsonify(error="API ខាងក្រៅមានបញ្ហា"), 502

        # ត្រឡប់ឯកសារសំឡេងត្រឡប់មកវិញ
        return send_file(
            BytesIO(response.content),
            mimetype="audio/wav",
            as_attachment=True,
            download_name="output.wav"
        )

    except Exception as e:
        app.logger.error(f"Error calling OpenVoice API: {e}")
        return jsonify(error="មិនអាចភ្ជាប់ទៅ OpenVoice API បានទេ"), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port, debug=False)
