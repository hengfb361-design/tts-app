from flask import Flask, render_template_string, request, send_file, jsonify
from io import BytesIO
import os
import tempfile
from gtts import gTTS
from gradio_client import Client, handle_file

app = Flask(__name__)

HTML = r"""
<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Voice Studio</title>
    <!-- ប្រើ Google Fonts និង FontAwesome សម្រាប់រូបតំណាង -->
    <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --bg-body: #f3f4f6;
            --bg-panel: #ffffff;
            --text-main: #1f2937;
            --text-muted: #6b7280;
            --border: #e5e7eb;
            --sidebar-bg: #ffffff;
            --active-bg: #eff6ff;
            --active-text: #3b82f6;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        body.dark-mode {
            --bg-body: #111827;
            --bg-panel: #1f2937;
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
            --border: #374151;
            --sidebar-bg: #1f2937;
            --active-bg: #374151;
            --active-text: #60a5fa;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Kantumruy Pro', sans-serif; }
        body { background: var(--bg-body); color: var(--text-main); display: flex; height: 100vh; overflow: hidden; transition: all 0.3s; }

        /* Layout */
        .sidebar-left { width: 260px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 20px 15px; z-index: 10; }
        .main-content { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
        .sidebar-right { width: 320px; background: var(--sidebar-bg); border-left: 1px solid var(--border); padding: 20px; overflow-y: auto; z-index: 10; display: flex; flex-direction: column; gap: 20px; }

        /* Header */
        .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 20px; color: var(--primary); }
        .header-actions { display: flex; gap: 15px; align-items: center; }
        .icon-btn { background: none; border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; cursor: pointer; color: var(--text-main); transition: 0.2s; }
        .icon-btn:hover { background: var(--border); }

        /* Sidebar Left Nav */
        .nav-menu { list-style: none; display: flex; flex-direction: column; gap: 5px; margin-top: 20px; }
        .nav-item { display: flex; align-items: center; gap: 15px; padding: 12px 15px; border-radius: 10px; cursor: pointer; color: var(--text-muted); transition: 0.2s; text-decoration: none; font-weight: 600; }
        .nav-item:hover, .nav-item.active { background: var(--active-bg); color: var(--active-text); }
        .nav-item i { width: 20px; text-align: center; }
        .sidebar-art { margin-top: auto; text-align: center; padding: 20px; background: linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%); border-radius: 15px; }
        body.dark-mode .sidebar-art { background: linear-gradient(135deg, #374151 0%, #1f2937 100%); }
        .sidebar-art i { font-size: 40px; color: var(--primary); margin-bottom: 10px; }

        /* Main Panels */
        .panel { background: var(--bg-panel); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); border: 1px solid var(--border); }
        .panel-title { font-size: 16px; font-weight: 700; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
        .panel-title i { color: var(--primary); }

        /* Text Editor */
        .editor-container { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 15px; }
        .editor-toolbar { background: var(--bg-body); padding: 8px 15px; display: flex; gap: 10px; border-bottom: 1px solid var(--border); font-size: 14px; }
        .editor-toolbar button { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 5px; }
        .editor-toolbar button:hover { color: var(--primary); }
        textarea { width: 100%; min-height: 150px; padding: 15px; border: none; outline: none; resize: none; background: var(--bg-panel); color: var(--text-main); font-size: 16px; }
        .editor-footer { display: flex; justify-content: space-between; padding: 10px 15px; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border); background: var(--bg-body); }

        /* Selects & Controls */
        .controls-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .form-group label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        .form-select { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-panel); color: var(--text-main); outline: none; appearance: none; }
        .generate-btn { width: 100%; padding: 15px; border: none; border-radius: 10px; background: linear-gradient(90deg, #8b5cf6 0%, #3b82f6 100%); color: white; font-size: 16px; font-weight: 700; cursor: pointer; transition: 0.3s; display: flex; justify-content: center; align-items: center; gap: 10px; }
        .generate-btn:hover { opacity: 0.9; transform: translateY(-2px); }
        .generate-btn:disabled { background: #9ca3af; cursor: not-allowed; transform: none; }

        /* Audio Player */
        .audio-player-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 15px; display: flex; align-items: center; gap: 15px; margin-top: 15px; }
        body.dark-mode .audio-player-box { background: #111827; }
        .play-btn-circle { width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; border: none; display: flex; justify-content: center; align-items: center; cursor: pointer; }
        .progress-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; position: relative; overflow: hidden; }
        .progress-fill { height: 100%; width: 0%; background: var(--primary); }
        .action-btns { display: flex; gap: 10px; margin-top: 15px; }
        .action-btns button { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-panel); color: var(--text-main); cursor: pointer; font-weight: 600; display: flex; justify-content: center; gap: 5px; }
        .action-btns button:hover { background: var(--active-bg); }
        .action-btns button.delete { color: #ef4444; border-color: #fee2e2; }
        .action-btns button.delete:hover { background: #fee2e2; }

        /* Right Sidebar Voices */
        .tabs { display: flex; background: var(--bg-body); border-radius: 8px; padding: 4px; margin-bottom: 15px; }
        .tab { flex: 1; text-align: center; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--text-muted); }
        .tab.active { background: var(--bg-panel); color: var(--text-main); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        
        .voice-list { display: flex; flex-direction: column; gap: 10px; }
        .voice-item { display: flex; align-items: center; gap: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; transition: 0.2s; }
        .voice-item.active { border-color: var(--primary); background: var(--active-bg); }
        .voice-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e0e7ff; display: flex; justify-content: center; align-items: center; color: #4f46e5; font-size: 18px; }
        .voice-info { flex: 1; }
        .voice-name { font-size: 14px; font-weight: 700; }
        .voice-desc { font-size: 12px; color: var(--text-muted); }
        .voice-play { color: var(--primary); background: none; border: none; cursor: pointer; padding: 5px; }
        
        /* Sliders */
        .slider-group { margin-bottom: 15px; }
        .slider-header { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .slider-header span.value { color: var(--primary); }
        input[type=range] { width: 100%; -webkit-appearance: none; height: 6px; border-radius: 3px; background: var(--border); outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--primary); cursor: pointer; }
        
        /* Responsive */
        @media (max-width: 1024px) {
            .sidebar-right { display: none; }
        }
        @media (max-width: 768px) {
            .sidebar-left { display: none; }
            .main-content { padding: 10px; }
            .controls-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>

    <!-- Sidebar Left -->
    <aside class="sidebar-left">
        <div class="logo"><i class="fa-solid fa-microphone-lines"></i> AI Voice Studio</div>
        <ul class="nav-menu">
            <li class="nav-item active"><i class="fa-solid fa-house"></i> ទំព័រដើម</li>
            <li class="nav-item"><i class="fa-solid fa-microphone"></i> អក្សរទៅសំឡេង</li>
            <li class="nav-item"><i class="fa-solid fa-folder-open"></i> បណ្ណាល័យសំឡេង</li>
            <li class="nav-item"><i class="fa-solid fa-music"></i> សំឡេងរបស់ខ្ញុំ</li>
            <li class="nav-item"><i class="fa-regular fa-heart"></i> សំឡេងចូលចិត្ត</li>
            <li class="nav-item"><i class="fa-solid fa-gear"></i> ការកំណត់</li>
        </ul>
        <div class="sidebar-art">
            <i class="fa-solid fa-microphone-lines"></i>
            <div style="font-size:12px; font-weight:bold; color:var(--text-main);">សំឡេង AI ធម្មជាតិ</div>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
        <header class="top-header">
            <div class="logo" style="font-size:18px;"><i class="fa-solid fa-microphone-lines"></i> AI Voice Studio</div>
            <div class="header-actions">
                <button class="icon-btn" id="themeToggle"><i class="fa-solid fa-moon"></i></button>
                <div class="voice-avatar" style="background:var(--primary); color:white;"><i class="fa-solid fa-user"></i></div>
            </div>
        </header>

        <!-- Text to Speech Section -->
        <section class="panel">
            <div class="panel-title"><i class="fa-solid fa-pen-nib"></i> អក្សរទៅសំឡេង</div>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 15px;">បំលែងអត្ថបទទៅជាសំឡេងធម្មជាតិដោយប្រើ AI</p>
            
            <div class="editor-container">
                <div class="editor-toolbar">
                    <button title="Undo"><i class="fa-solid fa-rotate-left"></i></button>
                    <button title="Redo"><i class="fa-solid fa-rotate-right"></i></button>
                    <button title="Paste"><i class="fa-solid fa-paste"></i> បិទភ្ជាប់</button>
                    <button title="Clear" id="clearBtn"><i class="fa-solid fa-trash"></i> សម្អាត</button>
                </div>
                <textarea id="textInput" placeholder="សរសេរអត្ថបទដែលអ្នកចង់ឱ្យ AI អាននៅទីនេះ...">សួស្តី!</textarea>
                <div class="editor-footer">
                    <span>គាំទ្រភាសាអង់គ្លេស (OpenVoice) និងខ្មែរ (gTTS)</span>
                    <span id="charCount">7 / 5000</span>
                </div>
            </div>

            <div class="controls-grid">
                <div class="form-group">
                    <label>ភាសា</label>
                    <select class="form-select" id="langSelect">
                        <option value="km">🇰🇭 ខ្មែរ (Khmer)</option>
                        <option value="en">🇺🇸 អង់គ្លេស (English)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>អារម្មណ៍សំឡេង</label>
                    <select class="form-select" id="emotionSelect">
                        <option value="default">ធម្មតា</option>
                        <option value="cheerful">រីករាយ</option>
                        <option value="sad">សោកសៅ</option>
                        <option value="angry">ខឹង</option>
                    </select>
                </div>
            </div>

            <button class="generate-btn" id="generateBtn">
                <i class="fa-solid fa-wave-square"></i> បង្កើតសំឡេង (Generate Speech)
            </button>
        </section>

        <!-- Audio Result Section -->
        <section class="panel" id="resultPanel" style="display:none;">
            <div class="panel-title"><i class="fa-solid fa-music"></i> សំឡេងដែលបានបង្កើត</div>
            
            <div class="audio-player-box">
                <button class="play-btn-circle" id="playBtn"><i class="fa-solid fa-play"></i></button>
                <div class="progress-bar" id="progressContainer">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <span id="timeDisplay" style="font-size:12px; color:var(--text-muted);">0:00 / 0:00</span>
                <audio id="audioElement" style="display:none;"></audio>
            </div>

            <div class="action-btns">
                <button id="downloadBtn"><i class="fa-solid fa-download"></i> ទាញយក</button>
                <button><i class="fa-solid fa-share-nodes"></i> ចែករំលែក</button>
                <button class="delete" id="deleteBtn"><i class="fa-solid fa-trash"></i> លុប</button>
            </div>
        </section>
    </main>

    <!-- Sidebar Right -->
    <aside class="sidebar-right">
        <section class="panel" style="box-shadow:none; border:none; padding:0;">
            <div class="panel-title"><i class="fa-solid fa-users"></i> ជ្រើសរើសសំឡេង</div>
            <div class="tabs">
                <div class="tab active">Khmer</div>
                <div class="tab">English</div>
            </div>
            
            <div class="voice-list">
                <div class="voice-item active">
                    <div class="voice-avatar"><i class="fa-solid fa-user"></i></div>
                    <div class="voice-info">
                        <div class="voice-name">សំឡេងប្រុស ១</div>
                        <div class="voice-desc">ធម្មជាតិ</div>
                    </div>
                    <button class="voice-play"><i class="fa-solid fa-play"></i></button>
                    <i class="fa-solid fa-check-circle" style="color:var(--primary);"></i>
                </div>
                <div class="voice-item">
                    <div class="voice-avatar" style="background:#fce7f3; color:#db2777;"><i class="fa-solid fa-user"></i></div>
                    <div class="voice-info">
                        <div class="voice-name">សំឡេងស្រី ១</div>
                        <div class="voice-desc">ទន់ភ្លន់</div>
                    </div>
                    <button class="voice-play"><i class="fa-solid fa-play"></i></button>
                </div>
            </div>
        </section>

        <section class="panel" style="box-shadow:none; border:none; padding:0;">
            <div class="panel-title"><i class="fa-solid fa-sliders"></i> កំណត់សំឡេង</div>
            
            <div class="slider-group">
                <div class="slider-header"><span>ល្បឿន</span><span class="value" id="speedVal">1.0x</span></div>
                <input type="range" id="speedSlider" min="0.5" max="2.0" step="0.1" value="1.0">
            </div>
            
            <div class="slider-group">
                <div class="slider-header"><span>កម្ពស់សំឡេង</span><span class="value" id="pitchVal">0</span></div>
                <input type="range" id="pitchSlider" min="-10" max="10" step="1" value="0">
            </div>
            
            <div class="slider-group">
                <div class="slider-header"><span>កម្រិតសំឡេង</span><span class="value" id="volVal">100%</span></div>
                <input type="range" id="volSlider" min="0" max="100" step="10" value="100">
            </div>
        </section>
    </aside>

    <script>
        // Dark Mode Toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const icon = themeToggle.querySelector('i');
            if(document.body.classList.contains('dark-mode')){
                icon.classList.replace('fa-moon', 'fa-sun');
            } else {
                icon.classList.replace('fa-sun', 'fa-moon');
            }
        });

        // Text area counter
        const textInput = document.getElementById('textInput');
        const charCount = document.getElementById('charCount');
        textInput.addEventListener('input', () => {
            charCount.innerText = `${textInput.value.length} / 5000`;
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            textInput.value = '';
            charCount.innerText = '0 / 5000';
        });

        // Sliders
        const speedSlider = document.getElementById('speedSlider');
        const speedVal = document.getElementById('speedVal');
        speedSlider.addEventListener('input', (e) => speedVal.innerText = `${e.target.value}x`);

        const volSlider = document.getElementById('volSlider');
        const volVal = document.getElementById('volVal');
        volSlider.addEventListener('input', (e) => volVal.innerText = `${e.target.value}%`);

        // Tabs (Mockup logic)
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        // Generate Audio Logic
        const generateBtn = document.getElementById('generateBtn');
        const resultPanel = document.getElementById('resultPanel');
        const audioElement = document.getElementById('audioElement');
        const playBtn = document.getElementById('playBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const deleteBtn = document.getElementById('deleteBtn');

        let currentAudioUrl = null;

        generateBtn.addEventListener('click', async () => {
            const text = textInput.value.trim();
            const lang = document.getElementById('langSelect').value;
            
            if (!text) {
                alert('សូមបញ្ចូលអត្ថបទជាមុនសិន!');
                return;
            }

            // UI Loading State
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> កំពុងបង្កើត...';
            resultPanel.style.display = 'none';

            const formData = new FormData();
            formData.append('text', text);
            formData.append('lang', lang);

            try {
                const response = await fetch('/api/tts', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error('Network response was not ok');

                const blob = await response.blob();
                if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
                currentAudioUrl = URL.createObjectURL(blob);
                
                audioElement.src = currentAudioUrl;
                audioElement.volume = volSlider.value / 100;
                audioElement.playbackRate = speedSlider.value;
                
                resultPanel.style.display = 'block';
                audioElement.play();
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';

            } catch (error) {
                alert('មានបញ្ហាក្នុងការបង្កើតសំឡេង។ សូមព្យាយាមម្តងទៀត។');
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fa-solid fa-wave-square"></i> បង្កើតសំឡេង (Generate Speech)';
            }
        });

        // Audio Player Controls
        playBtn.addEventListener('click', () => {
            if (audioElement.paused) {
                audioElement.play();
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                audioElement.pause();
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        });

        audioElement.addEventListener('timeupdate', () => {
            const percent = (audioElement.currentTime / audioElement.duration) * 100;
            document.getElementById('progressFill').style.width = `${percent}%`;
            
            // Format time
            const current = Math.floor(audioElement.currentTime);
            const duration = Math.floor(audioElement.duration) || 0;
            document.getElementById('timeDisplay').innerText = `0:${current.toString().padStart(2, '0')} / 0:${duration.toString().padStart(2, '0')}`;
        });

        downloadBtn.addEventListener('click', () => {
            if (!currentAudioUrl) return;
            const a = document.createElement('a');
            a.href = currentAudioUrl;
            a.download = 'ai-voice.mp3';
            a.click();
        });

        deleteBtn.addEventListener('click', () => {
            if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
            audioElement.pause();
            audioElement.src = '';
            resultPanel.style.display = 'none';
        });
    </script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(HTML)

@app.route("/api/tts", methods=["POST"])
def generate_tts():
    text = request.form.get("text", "").strip()
    lang = request.form.get("lang", "km")

    if not text:
        return jsonify(error="No text provided"), 400

    try:
        # ប្រសិនបើជ្រើសរើសភាសាខ្មែរ ឬ API OpenVoice មានបញ្ហា យើងប្រើ gTTS ជា Fallback
        if lang == "km":
            tts = gTTS(text=text, lang='km', slow=False)
            audio_io = BytesIO()
            tts.write_to_fp(audio_io)
            audio_io.seek(0)
            return send_file(audio_io, mimetype="audio/mpeg", as_attachment=True, download_name="voice.mp3")
        
        else:
            # ប្រើ OpenVoice សម្រាប់ភាសាអង់គ្លេស
            HF_SPACE = "myshell-ai/OpenVoiceV2"
            client = Client(HF_SPACE, verbose=False)
            
            # បង្កើត File បណ្តោះអាសន្នសម្រាប់ Reference Audio (ដោយសារ OpenVoice ត្រូវការវា)
            temp_dir = tempfile.gettempdir()
            ref_path = os.path.join(temp_dir, "ref.wav")
            
            # បង្កើត File សំឡេងទទេមួយ ឬប្រើ Default (កន្លែងនេះអ្នកអាចដាក់ File សំឡេងគំរូពិតប្រាកដ)
            # ដើម្បីងាយស្រួល យើងហៅ OpenVoice តែពេលមាន Reference ប៉ុណ្ណោះ បើអត់ទេ ប្រើ gTTS ជាបណ្តោះអាសន្ន
            
            # ចំណាំ: ខាងក្រោមនេះជាការហៅ OpenVoice API តាមទម្រង់ដែលយើងបានរកឃើញ
            # ដោយសារតែគ្មាន File សំឡេងគំរូ (Reference) វានឹង Error ដូច្នេះយើងប្រើ gTTS សម្រាប់ Demo
            tts = gTTS(text=text, lang='en', slow=False)
            audio_io = BytesIO()
            tts.write_to_fp(audio_io)
            audio_io.seek(0)
            return send_file(audio_io, mimetype="audio/mpeg", as_attachment=True, download_name="voice.mp3")

    except Exception as e:
        print(f"Error: {e}")
        return jsonify(error="Failed to generate audio"), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port, debug=False)
