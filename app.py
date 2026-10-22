from flask import Flask, render_template_string, request, send_file
from gtts import gTTS
import io

app = Flask(__name__)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Voice Studio - Text to Speech</title>
    <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Kantumruy Pro', sans-serif; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .card { background: #ffffff; width: 100%; max-width: 500px; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        h2 { color: #333; text-align: center; margin-bottom: 20px; font-size: 24px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 600; color: #555; }
        textarea { width: 100%; height: 120px; padding: 12px; border: 2px solid #e1e1e1; border-radius: 8px; font-size: 15px; resize: none; outline: none; transition: border-color 0.3s; }
        textarea:focus { border-color: #667eea; }
        select { width: 100%; padding: 12px; border: 2px solid #e1e1e1; border-radius: 8px; font-size: 15px; outline: none; background: #fff; cursor: pointer; }
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity 0.3s; }
        button:hover { opacity: 0.9; }
        .audio-box { margin-top: 20px; text-align: center; }
        audio { width: 100%; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="card">
        <h2>🎙️ AI Voice Studio</h2>
        <form method="POST" action="/tts">
            <div class="form-group">
                <label for="text">បញ្ចូលអត្ថបទរបស់អ្នក៖</label>
                <textarea name="text" id="text" placeholder="វាយអត្ថបទភាសាខ្មែរ ឬ អង់គ្លេសនៅទីនេះ..." required>{{ text if text else '' }}</textarea>
            </div>
            <div class="form-group">
                <label for="lang">ជ្រើសរើសភាសា៖</label>
                <select name="lang" id="lang">
                    <option value="km">ភាសាខ្មែរ (Khmer)</option>
                    <option value="en">ភាសាអង់គ្លេស (English)</option>
                </select>
            </div>
            <button type="submit">បង្កើតសំឡេង (Generate Speech)</button>
        </form>
    </div>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/tts', methods=['POST'])
def tts():
    text = request.form.get('text')
    lang = request.form.get('lang', 'km')
    
    try:
        tts = gTTS(text=text, lang=lang)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return send_file(fp, mimetype='audio/mp3', as_attachment=True, download_name='voice.mp3')
    except Exception as e:
        return f"เกิดข้อผิดพลาด: {e}"

if __name__ == '__main__':
    app.run(debug=True)
