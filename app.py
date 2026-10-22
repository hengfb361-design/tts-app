
from flask import Flask, render_template_string, request, send_file, jsonify
from gtts import gTTS
from io import BytesIO
import os

app = Flask(__name__)

HTML = r"""
<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f5f6ff">
<title>AI Voice Studio</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
:root{--blue:#2878ff;--purple:#9849f5;--ink:#182544;--muted:#78839b;--line:#e2e8f4;--panel:#fff;--bg:#f3f6ff}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(ellipse at top,#e7eaff,#f8f9ff 50%,#eef4ff);color:var(--ink);font-family:"Kantumruy Pro",Inter,sans-serif}
button,textarea,select,input{font:inherit}button{cursor:pointer}
.top{height:72px;background:#ffffffed;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:5}
.brand{display:flex;align-items:center;gap:10px;font:800 21px Inter,sans-serif}.logo{background:linear-gradient(135deg,#287aff,#9b45f5);color:white;width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:23px}.brand span{color:#5850ef}
.topright{display:flex;gap:10px;align-items:center}.topright button,.topright select{height:40px;border:1px solid var(--line);background:white;border-radius:12px;padding:0 12px;color:var(--ink)}.user{width:40px;height:40px;border-radius:50%;background:#e5eaff;display:grid;place-items:center;font-size:21px}
.layout{max-width:1500px;margin:auto;padding:20px;display:grid;grid-template-columns:205px minmax(0,1fr) 300px;gap:16px}
.sidebar{display:flex;flex-direction:column;gap:7px;padding-top:5px}.nav{border:0;background:transparent;text-align:left;padding:13px 12px;border-radius:12px;color:#586680}.nav b{display:inline-block;width:30px;font-size:18px}.nav.active{background:linear-gradient(110deg,#dce7ff,#eee5ff);color:#5147eb;font-weight:700}.sideart{margin-top:auto;text-align:center;padding:15px 0;color:#7888ed}.bigmic{font-size:75px;filter:drop-shadow(0 10px 10px #7667ef55)}.wave{letter-spacing:4px;font-size:22px}
.panel{background:var(--panel);border:1px solid #e7ecf6;border-radius:17px;padding:19px;margin-bottom:15px;box-shadow:0 10px 30px #263e790c;min-width:0}
.hero{display:flex;justify-content:space-between;align-items:center;min-height:135px;background:linear-gradient(110deg,#fff,#f0efff 60%,#e5efff);overflow:hidden}.eyebrow{font:700 10px Inter,sans-serif;letter-spacing:2px;color:#8994b2}.hero h1{font-size:27px;line-height:1.2;margin:8px 0}.hero h1 span{color:#5054ee}.hero p{font-size:13px;color:#6e7991;margin:0}.heromic{font-size:67px;margin:0 12px;color:#7189fa}
.heading{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:13px}.heading h2{font-size:17px;margin:0}.counter{font:12px Inter,sans-serif;color:#7b879f}
.editor{border:1px solid #dfe5f1;border-radius:12px;overflow:hidden}.tools{display:flex;gap:6px;flex-wrap:wrap;padding:9px;border-bottom:1px solid #edf0f7}.tool{border:1px solid #e4e9f3;background:white;border-radius:8px;padding:6px 9px;color:#5e6a83;font-size:12px}.text{width:100%;min-height:190px;padding:15px;border:0;outline:0;resize:vertical;font-size:17px;line-height:1.8;color:var(--ink)}.editorfoot{display:flex;justify-content:space-between;gap:10px;padding:8px 11px;background:#fafbff;border-top:1px solid #edf0f7;color:#8993a8;font-size:11px}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:15px}.field label{display:block;font-size:13px;font-weight:700;margin-bottom:6px}.field select{width:100%;height:44px;border:1px solid #dce3f0;border-radius:10px;padding:0 9px;background:white;color:#283653;outline-color:#8d8cff}
.settings{margin-top:15px;padding:13px;border:1px solid #e8edf7;background:#f8faff;border-radius:12px}.settings h3{font-size:14px;margin:0 0 12px}.sliders{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.slider label{display:flex;justify-content:space-between;gap:5px;font-size:11px;color:#65718a}.slider input{width:100%;accent-color:#6259f5;margin-top:10px}
.primary{width:100%;border:0;border-radius:11px;padding:14px;background:linear-gradient(100deg,#287aff,#a143f2);color:white;font-weight:700;margin-top:15px;box-shadow:0 7px 18px #7458ed25}.primary:disabled{opacity:.6;cursor:wait}
.playerbox{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px;background:linear-gradient(100deg,#f2f6ff,#f8f5ff);border:1px solid #edf0f7;border-radius:13px}.play{width:42px;height:42px;border:0;border-radius:50%;background:linear-gradient(135deg,#287aff,#7655f2);color:white;font-size:17px}.playerbox audio{width:100%;height:36px}.playerhint{font-size:12px;color:#8490aa;flex:1}.actions{display:flex;gap:8px;margin-top:10px}.action{flex:1;border:1px solid #dce5ff;border-radius:9px;padding:10px 5px;background:#f5f7ff;color:#395bc6;font-size:12px;font-weight:600}.action.download{background:linear-gradient(100deg,#6558e9,#9b4be8);color:white;border:0}.action.danger{color:#d84d5b;background:#fff6f6;border-color:#ffdade}
.tabs{display:flex;gap:4px;background:#f1f4fb;padding:4px;border-radius:10px;margin-bottom:12px}.tab{flex:1;border:0;border-radius:8px;padding:8px 2px;background:transparent;color:#65718a;font-size:12px}.tab.active{background:linear-gradient(100deg,#347aff,#9550f1);color:white}.voicelist{display:flex;flex-direction:column;gap:7px}.voice{display:grid;grid-template-columns:30px 37px minmax(0,1fr) 20px;gap:7px;align-items:center;border:1px solid #e5eaf4;border-radius:11px;padding:9px 6px;cursor:pointer}.voice.selected{border-color:#7fa8ff;background:#f4f8ff}.vplay{width:29px;height:29px;border:0;border-radius:50%;background:#edf3ff;color:#286cff}.face{width:35px;height:35px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(140deg,#f5e6dc,#e1e8ff);font-size:20px}.vname{font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vdesc{font-size:10px;color:#8590a6}.tag{font:10px Inter,sans-serif;background:#e6f7eb;color:#278047;border-radius:4px;padding:3px 5px;display:inline-block;margin-top:4px}.heart{border:0;background:transparent;color:#8995b0;font-size:18px;padding:0}.heart.fav{color:#ed5089}
.tips{font-size:12px;line-height:1.8;color:#78849c;background:#f6f8ff;padding:11px;border-radius:10px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1b2848;color:white;padding:11px 16px;border-radius:10px;display:none;z-index:20;font-size:13px;max-width:90vw}.toast.show{display:block}
body.dark{--ink:#edf1ff;--muted:#aeb9d1;--line:#35405c;--panel:#202943;background:#141b2d;color:var(--ink)}body.dark .top,body.dark .panel,body.dark .voice,body.dark .field select,body.dark .tool,body.dark .topright select,body.dark .topright button{background:#202943;color:var(--ink);border-color:#35405c}body.dark .hero{background:linear-gradient(110deg,#202943,#2c2d51)}body.dark .text,body.dark .editorfoot{background:#202943;color:var(--ink)}body.dark .settings,body.dark .playerbox,body.dark .tips,body.dark .tabs{background:#293451;border-color:#394663}body.dark .voice.selected{background:#303b62}
.mobilebar{display:none}
@media(max-width:1100px){.layout{grid-template-columns:175px minmax(0,1fr)}.right{grid-column:2;display:grid;grid-template-columns:1fr 1fr;gap:12px}.right .panel{margin-bottom:0}.sideart{display:none}}
@media(max-width:700px){.top{height:62px;padding:0 12px}.brand{font-size:17px;gap:7px}.logo{width:36px;height:36px}.topright{gap:5px}.topright select{max-width:105px;font-size:10px;padding:0 4px}.topright button{height:35px;padding:0 7px}.user{width:34px;height:34px}.layout{display:block;padding:11px 9px 80px}.sidebar{display:none}.panel{padding:14px;border-radius:15px;margin-bottom:12px}.hero{min-height:115px;padding:15px}.hero h1{font-size:23px}.hero p{font-size:11px}.heromic{font-size:52px;margin:0}.text{min-height:155px;font-size:16px}.fields{gap:8px}.field select{font-size:11px;padding:0 5px}.sliders{grid-template-columns:1fr;gap:10px}.slider input{margin-top:3px}.right{display:block}.right .panel{margin-bottom:12px}.mobilebar{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:8;justify-content:space-around;padding:7px 2px max(7px,env(safe-area-inset-bottom));background:#ffffffed;border-top:1px solid #e3e8f4;backdrop-filter:blur(12px)}.mobilebar button{border:0;background:transparent;color:#6c7894;font-size:10px;display:flex;flex-direction:column;align-items:center;gap:2px}.mobilebar b{font-size:19px}.actions{flex-wrap:wrap}.action{min-width:28%}.heading h2{font-size:15px}}
</style>
</head>
<body>
<header class="top">
  <div class="brand"><div class="logo">🎙</div><div>AI Voice <span>Studio</span></div></div>
  <div class="topright">
    <select id="toplang" aria-label="Language"><option value="km">🌐 ខ្មែរ</option><option value="en">🌐 English</option></select>
    <button id="theme" aria-label="Dark mode">☾</button><div class="user">♙</div>
  </div>
</header>
<div class="layout">
  <aside class="sidebar">
    <button class="nav active" data-target="editor"><b>⌂</b> ទំព័រដើម</button>
    <button class="nav" data-target="editor"><b>🎙</b> អក្សរទៅជាសំឡេង</button>
    <button class="nav" data-target="voices"><b>▤</b> បណ្ណាល័យសំឡេង</button>
    <button class="nav" data-target="audio"><b>♫</b> សំឡេងរបស់ខ្ញុំ</button>
    <button class="nav" data-target="voices"><b>♡</b> សំឡេងចូលចិត្ត</button>
    <button class="nav" data-target="settings"><b>⚙</b> ការកំណត់</button>
    <div class="sideart"><div class="bigmic">🎙</div><div class="wave">▂ ▄ ▆ ▄ ▂</div><small>សំឡេង AI របស់អ្នក</small></div>
  </aside>
  <main>
    <section class="panel hero"><div><div class="eyebrow">CLOUD TEXT TO SPEECH</div><h1>AI Voice <span>Studio</span></h1><p>បម្លែងអត្ថបទទៅជាសំឡេងបានយ៉ាងងាយស្រួល</p></div><div class="heromic">🎙</div></section>
    <section class="panel" id="editor">
      <div class="heading"><h2>✍️ បញ្ចូលអត្ថបទរបស់អ្នក</h2><span class="counter" id="count">0 / 5000</span></div>
      <div class="editor">
        <div class="tools"><button class="tool" id="undo">↶ Undo</button><button class="tool" id="redo">↷ Redo</button><button class="tool" id="paste">▣ Paste</button><button class="tool" id="clear">▤ សម្អាត</button><button class="tool" id="example">✦ ឧទាហរណ៍</button></div>
        <textarea class="text" id="text" maxlength="5000" placeholder="សរសេរអត្ថបទដែលអ្នកចង់ឱ្យ AI អាននៅទីនេះ..."></textarea>
        <div class="editorfoot"><span>💡 ប្រើសញ្ញាក្បៀស ដើម្បីឱ្យការអានមានចន្លោះធម្មជាតិ</span><span id="remain">នៅសល់ 5000</span></div>
      </div>
      <div class="fields">
        <div class="field"><label for="lang">🌐 ភាសា</label><select id="lang"><option value="km">🇰🇭 ភាសាខ្មែរ (Khmer)</option><option value="en">🇺🇸 English</option></select></div>
        <div class="field"><label for="emotion">🎭 អារម្មណ៍សំឡេង</label><select id="emotion"><option value="normal">🙂 ធម្មតា</option><option value="happy">😄 រីករាយ</option><option value="sad">😢 សោកសៅ</option><option value="calm">😌 ស្ងប់ស្ងាត់</option><option value="excited">🤩 រំភើប</option><option value="serious">🎙 ម៉ឺងម៉ាត់</option></select></div>
      </div>
      <div class="settings" id="settings"><h3>⚙️ ការកំណត់សំឡេង</h3><div class="sliders">
        <div class="slider"><label for="speed">ល្បឿន <b id="speedval">1.0x</b></label><input id="speed" type="range" min=".6" max="1.5" step=".1" value="1"></div>
        <div class="slider"><label for="pitch">កម្ពស់សំឡេង <b id="pitchval">0</b></label><input id="pitch" type="range" min="-5" max="5" value="0"></div>
        <div class="slider"><label for="volume">កម្រិតសំឡេង <b id="volumeval">100%</b></label><input id="volume" type="range" min="0" max="100" value="100"></div>
      </div></div>
      <button class="primary" id="generate">▥ &nbsp; បង្កើតសំឡេង (Generate Speech)</button>
    </section>
    <section class="panel" id="audio">
      <div class="heading"><h2>♫ សំឡេងដែលបានបង្កើត</h2><span class="counter" id="status">រង់ចាំអត្ថបទ</span></div>
      <div class="playerbox"><button class="play" id="play">▶</button><span class="playerhint" id="hint">សំឡេងដែលបង្កើតរួចនឹងបង្ហាញនៅទីនេះ</span><audio id="player" controls hidden></audio></div>
      <div class="actions"><button class="action download" id="download">⬇ ទាញយក MP3</button><button class="action" id="share">↗ ចែករំលែក</button><button class="action danger" id="delete">▤ លុប</button></div>
    </section>
  </main>
  <aside class="right">
    <section class="panel" id="voices">
      <div class="heading"><h2>👥 ជ្រើសរើសសំឡេង</h2></div>
      <div class="tabs"><button class="tab active" data-filter="km">Khmer</button><button class="tab" data-filter="en">English</button><button class="tab" data-filter="all">All</button></div>
      <div class="voicelist">
        <div class="voice selected" data-lang="km" data-voice="male1"><button class="vplay">▶</button><div class="face">👨🏻</div><div><div class="vname">សំឡេងប្រុស 1</div><div class="vdesc">ធម្មជាតិ · Khmer</div><span class="tag">Natural</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="km" data-voice="male2"><button class="vplay">▶</button><div class="face">👨🏽</div><div><div class="vname">សំឡេងប្រុស 2</div><div class="vdesc">សំឡេងជ្រៅ · Khmer</div><span class="tag">Deep</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="km" data-voice="female1"><button class="vplay">▶</button><div class="face">👩🏻</div><div><div class="vname">សំឡេងស្រី 1</div><div class="vdesc">ទន់ភ្លន់ · Khmer</div><span class="tag">Soft</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="km" data-voice="female2"><button class="vplay">▶</button><div class="face">👩🏽</div><div><div class="vname">សំឡេងស្រី 2</div><div class="vdesc">ស្រស់ស្រាយ · Khmer</div><span class="tag">Bright</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="en" data-voice="enfemale"><button class="vplay">▶</button><div class="face">👩🏼</div><div><div class="vname">Emma (Female)</div><div class="vdesc">Natural · English</div><span class="tag">Natural</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="en" data-voice="enmale"><button class="vplay">▶</button><div class="face">👨🏻</div><div><div class="vname">James (Male)</div><div class="vdesc">Professional · English</div><span class="tag">Pro</span></div><button class="heart">♡</button></div>
      </div>
    </section>
    <section class="panel"><h3 style="font-size:15px;margin:0 0 12px">✨ គន្លឹះសម្រាប់សំឡេងល្អ</h3><div class="tips">• ប្រើសញ្ញាក្បៀស និងសញ្ញាចុច។<br>• ជ្រើសភាសាឱ្យត្រូវនឹងអត្ថបទ។<br>• កែសម្រួលល្បឿននៅពេលចាក់ស្តាប់។<br><br>ចំណាំ៖ gTTS ប្រើសំឡេងតាមភាសា មិនទាន់គាំទ្រការបញ្ជាអារម្មណ៍ ឬជ្រើសតួសំឡេងដាច់ដោយឡែកទេ។</div></section>
  </aside>
</div>
<nav class="mobilebar"><button data-target="editor"><b>⌂</b>ដើម</button><button data-target="voices"><b>🎙</b>សំឡេង</button><button data-target="audio"><b>♫</b>ស្នាដៃ</button><button data-target="settings"><b>⚙</b>កំណត់</button></nav>
<div class="toast" id="toast"></div>
<script>
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const text=$('#text'), player=$('#player'), toast=$('#toast');
let previous='',redoValue='',audioUrl='';
function note(s){toast.textContent=s;toast.classList.add('show');clearTimeout(note.timer);note.timer=setTimeout(()=>toast.classList.remove('show'),2800)}
function count(){ $('#count').textContent=text.value.length+' / 5000';$('#remain').textContent='នៅសល់ '+(5000-text.value.length)}
text.addEventListener('input',count);
$('#clear').onclick=()=>{previous=text.value;text.value='';count();text.focus()};
$('#example').onclick=()=>{previous=text.value;text.value=$('#lang').value==='km'?'សួស្តី! សូមស្វាគមន៍មកកាន់ AI Voice Studio។ ថ្ងៃនេះអ្នកសុខសប្បាយទេ?':'Hello! Welcome to AI Voice Studio. How are you today?';count()};
$('#undo').onclick=()=>{redoValue=text.value;text.value=previous;count()};
$('#redo').onclick=()=>{previous=text.value;text.value=redoValue;count()};
$('#paste').onclick=async()=>{try{text.value=await navigator.clipboard.readText();count();note('បានបិទភ្ជាប់អត្ថបទ')}catch(e){note('សូម Paste អត្ថបទដោយផ្ទាល់ក្នុងប្រអប់')}};
$('#theme').onclick=()=>{document.body.classList.toggle('dark');$('#theme').textContent=document.body.classList.contains('dark')?'☀':'☾'};
$('#speed').oninput=e=>{$('#speedval').textContent=Number(e.target.value).toFixed(1)+'x';player.playbackRate=Number(e.target.value)};
$('#pitch').oninput=e=>$('#pitchval').textContent=e.target.value;
$('#volume').oninput=e=>{$('#volumeval').textContent=e.target.value+'%';player.volume=Number(e.target.value)/100};
function filter(f){$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.filter===f));$$('.voice').forEach(v=>v.style.display=f==='all'||v.dataset.lang===f?'grid':'none')}
$$('.tab').forEach(t=>t.onclick=()=>{filter(t.dataset.filter);if(t.dataset.filter!=='all')$('#lang').value=t.dataset.filter});
$('#lang').onchange=()=>filter($('#lang').value);
$('#toplang').onchange=()=>{$('#lang').value=$('#toplang').value;filter($('#lang').value)};
$$('.voice').forEach(v=>{
 v.onclick=e=>{if(e.target.closest('.heart')||e.target.closest('.vplay'))return;$$('.voice').forEach(x=>x.classList.remove('selected'));v.classList.add('selected');$('#lang').value=v.dataset.lang;$('#toplang').value=v.dataset.lang;filter(v.dataset.lang);note('បានជ្រើសរើស '+v.querySelector('.vname').textContent)};
 v.querySelector('.heart').onclick=e=>{e.stopPropagation();e.currentTarget.classList.toggle('fav');e.currentTarget.textContent=e.currentTarget.classList.contains('fav')?'♥':'♡'};
 v.querySelector('.vplay').onclick=e=>{e.stopPropagation();note('gTTS មិនមាន voice preview ដាច់ដោយឡែកទេ — សូម Generate អត្ថបទដើម្បីស្តាប់')};
});
$('#generate').onclick=async()=>{
 const value=text.value.trim();
 if(!value){note('សូមបញ្ចូលអត្ថបទជាមុនសិន');text.focus();return}
 const btn=$('#generate');btn.disabled=true;btn.textContent='⏳ កំពុងបង្កើតសំឡេង...';$('#status').textContent='កំពុងដំណើរការ';
 try{
  const r=await fetch('/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:value,lang:$('#lang').value,emotion:$('#emotion').value})});
  if(!r.ok){let msg='មិនអាចបង្កើតសំឡេងបាន';try{msg=(await r.json()).error||msg}catch(e){}throw new Error(msg)}
  const blob=await r.blob();if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(blob);
  player.src=audioUrl;player.hidden=false;player.playbackRate=Number($('#speed').value);player.volume=Number($('#volume').value)/100;
  $('#hint').hidden=true;$('#status').textContent='រួចរាល់';await player.play().catch(()=>{});note('បានបង្កើតសំឡេងជោគជ័យ');
 }catch(e){$('#status').textContent='មានបញ្ហា';note(e.message+' — ពិនិត្យ Internet និង Backend')}
 finally{btn.disabled=false;btn.textContent='▥  បង្កើតសំឡេង (Generate Speech)'}
};
$('#play').onclick=()=>{if(!player.src){note('សូម Generate សំឡេងជាមុនសិន');return}if(player.paused)player.play();else player.pause()};
player.onplay=()=>$('#play').textContent='Ⅱ';player.onpause=()=>$('#play').textContent='▶';
$('#download').onclick=()=>{if(!audioUrl){note('សូមបង្កើតសំឡេងជាមុនសិន');return}const a=document.createElement('a');a.href=audioUrl;a.download='ai-voice.mp3';a.click()};
$('#delete').onclick=()=>{if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl='';player.pause();player.removeAttribute('src');player.load();player.hidden=true;$('#hint').hidden=false;$('#status').textContent='រង់ចាំអត្ថបទ';note('បានសម្អាតសំឡេង')};
$('#share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);note('បានចម្លងតំណ Website')}catch(e){note('សូមចម្លងតំណពី Browser')}}
$$('[data-target]').forEach(b=>b.onclick=()=>{const el=document.getElementById(b.dataset.target);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.target===b.dataset.target))});
</script>
</body>
</html>
"""

@app.get("/")
def index():
    return render_template_string(HTML)

@app.post("/tts")
def text_to_speech():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    lang = data.get("lang", "km")

    if not text:
        return jsonify(error="សូមបញ្ចូលអត្ថបទជាមុនសិន"), 400
    if len(text) > 5000:
        return jsonify(error="អត្ថបទវែងពេក។ អតិបរមា 5000 តួអក្សរ។"), 400
    if lang not in ("km", "en"):
        return jsonify(error="ភាសានេះមិនទាន់គាំទ្រទេ"), 400

    try:
        audio = BytesIO()
        gTTS(text=text, lang=lang, slow=False).write_to_fp(audio)
        audio.seek(0)
        return send_file(
            audio,
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name="ai-voice.mp3",
            max_age=0
        )
    except Exception as exc:
        app.logger.exception("TTS generation failed")
        return jsonify(error="បង្កើតសំឡេងមិនបាន។ សូមពិនិត្យ Internet ឬសាកម្ដងទៀត។"), 502

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port, debug=False)

app = Flask(__name__)

HTML = r"""
<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f5f6ff">
<title>AI Voice Studio</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
:root{--blue:#2878ff;--purple:#9849f5;--ink:#182544;--muted:#78839b;--line:#e2e8f4;--panel:#fff;--bg:#f3f6ff}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(ellipse at top,#e7eaff,#f8f9ff 50%,#eef4ff);color:var(--ink);font-family:"Kantumruy Pro",Inter,sans-serif}
button,textarea,select,input{font:inherit}button{cursor:pointer}
.top{height:72px;background:#ffffffed;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:5}
.brand{display:flex;align-items:center;gap:10px;font:800 21px Inter,sans-serif}.logo{background:linear-gradient(135deg,#287aff,#9b45f5);color:white;width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:23px}.brand span{color:#5850ef}
.topright{display:flex;gap:10px;align-items:center}.topright button,.topright select{height:40px;border:1px solid var(--line);background:white;border-radius:12px;padding:0 12px;color:var(--ink)}.user{width:40px;height:40px;border-radius:50%;background:#e5eaff;display:grid;place-items:center;font-size:21px}
.layout{max-width:1500px;margin:auto;padding:20px;display:grid;grid-template-columns:205px minmax(0,1fr) 300px;gap:16px}
.sidebar{display:flex;flex-direction:column;gap:7px;padding-top:5px}.nav{border:0;background:transparent;text-align:left;padding:13px 12px;border-radius:12px;color:#586680}.nav b{display:inline-block;width:30px;font-size:18px}.nav.active{background:linear-gradient(110deg,#dce7ff,#eee5ff);color:#5147eb;font-weight:700}.sideart{margin-top:auto;text-align:center;padding:15px 0;color:#7888ed}.bigmic{font-size:75px;filter:drop-shadow(0 10px 10px #7667ef55)}.wave{letter-spacing:4px;font-size:22px}
.panel{background:var(--panel);border:1px solid #e7ecf6;border-radius:17px;padding:19px;margin-bottom:15px;box-shadow:0 10px 30px #263e790c;min-width:0}
.hero{display:flex;justify-content:space-between;align-items:center;min-height:135px;background:linear-gradient(110deg,#fff,#f0efff 60%,#e5efff);overflow:hidden}.eyebrow{font:700 10px Inter,sans-serif;letter-spacing:2px;color:#8994b2}.hero h1{font-size:27px;line-height:1.2;margin:8px 0}.hero h1 span{color:#5054ee}.hero p{font-size:13px;color:#6e7991;margin:0}.heromic{font-size:67px;margin:0 12px;color:#7189fa}
.heading{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:13px}.heading h2{font-size:17px;margin:0}.counter{font:12px Inter,sans-serif;color:#7b879f}
.editor{border:1px solid #dfe5f1;border-radius:12px;overflow:hidden}.tools{display:flex;gap:6px;flex-wrap:wrap;padding:9px;border-bottom:1px solid #edf0f7}.tool{border:1px solid #e4e9f3;background:white;border-radius:8px;padding:6px 9px;color:#5e6a83;font-size:12px}.text{width:100%;min-height:190px;padding:15px;border:0;outline:0;resize:vertical;font-size:17px;line-height:1.8;color:var(--ink)}.editorfoot{display:flex;justify-content:space-between;gap:10px;padding:8px 11px;background:#fafbff;border-top:1px solid #edf0f7;color:#8993a8;font-size:11px}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:15px}.field label{display:block;font-size:13px;font-weight:700;margin-bottom:6px}.field select{width:100%;height:44px;border:1px solid #dce3f0;border-radius:10px;padding:0 9px;background:white;color:#283653;outline-color:#8d8cff}
.settings{margin-top:15px;padding:13px;border:1px solid #e8edf7;background:#f8faff;border-radius:12px}.settings h3{font-size:14px;margin:0 0 12px}.sliders{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.slider label{display:flex;justify-content:space-between;gap:5px;font-size:11px;color:#65718a}.slider input{width:100%;accent-color:#6259f5;margin-top:10px}
.primary{width:100%;border:0;border-radius:11px;padding:14px;background:linear-gradient(100deg,#287aff,#a143f2);color:white;font-weight:700;margin-top:15px;box-shadow:0 7px 18px #7458ed25}.primary:disabled{opacity:.6;cursor:wait}
.playerbox{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px;background:linear-gradient(100deg,#f2f6ff,#f8f5ff);border:1px solid #edf0f7;border-radius:13px}.play{width:42px;height:42px;border:0;border-radius:50%;background:linear-gradient(135deg,#287aff,#7655f2);color:white;font-size:17px}.playerbox audio{width:100%;height:36px}.playerhint{font-size:12px;color:#8490aa;flex:1}.actions{display:flex;gap:8px;margin-top:10px}.action{flex:1;border:1px solid #dce5ff;border-radius:9px;padding:10px 5px;background:#f5f7ff;color:#395bc6;font-size:12px;font-weight:600}.action.download{background:linear-gradient(100deg,#6558e9,#9b4be8);color:white;border:0}.action.danger{color:#d84d5b;background:#fff6f6;border-color:#ffdade}
.tabs{display:flex;gap:4px;background:#f1f4fb;padding:4px;border-radius:10px;margin-bottom:12px}.tab{flex:1;border:0;border-radius:8px;padding:8px 2px;background:transparent;color:#65718a;font-size:12px}.tab.active{background:linear-gradient(100deg,#347aff,#9550f1);color:white}.voicelist{display:flex;flex-direction:column;gap:7px}.voice{display:grid;grid-template-columns:30px 37px minmax(0,1fr) 20px;gap:7px;align-items:center;border:1px solid #e5eaf4;border-radius:11px;padding:9px 6px;cursor:pointer}.voice.selected{border-color:#7fa8ff;background:#f4f8ff}.vplay{width:29px;height:29px;border:0;border-radius:50%;background:#edf3ff;color:#286cff}.face{width:35px;height:35px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(140deg,#f5e6dc,#e1e8ff);font-size:20px}.vname{font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vdesc{font-size:10px;color:#8590a6}.tag{font:10px Inter,sans-serif;background:#e6f7eb;color:#278047;border-radius:4px;padding:3px 5px;display:inline-block;margin-top:4px}.heart{border:0;background:transparent;color:#8995b0;font-size:18px;padding:0}.heart.fav{color:#ed5089}
.tips{font-size:12px;line-height:1.8;color:#78849c;background:#f6f8ff;padding:11px;border-radius:10px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1b2848;color:white;padding:11px 16px;border-radius:10px;display:none;z-index:20;font-size:13px;max-width:90vw}.toast.show{display:block}
body.dark{--ink:#edf1ff;--muted:#aeb9d1;--line:#35405c;--panel:#202943;background:#141b2d;color:var(--ink)}body.dark .top,body.dark .panel,body.dark .voice,body.dark .field select,body.dark .tool,body.dark .topright select,body.dark .topright button{background:#202943;color:var(--ink);border-color:#35405c}body.dark .hero{background:linear-gradient(110deg,#202943,#2c2d51)}body.dark .text,body.dark .editorfoot{background:#202943;color:var(--ink)}body.dark .settings,body.dark .playerbox,body.dark .tips,body.dark .tabs{background:#293451;border-color:#394663}body.dark .voice.selected{background:#303b62}
.mobilebar{display:none}
@media(max-width:1100px){.layout{grid-template-columns:175px minmax(0,1fr)}.right{grid-column:2;display:grid;grid-template-columns:1fr 1fr;gap:12px}.right .panel{margin-bottom:0}.sideart{display:none}}
@media(max-width:700px){.top{height:62px;padding:0 12px}.brand{font-size:17px;gap:7px}.logo{width:36px;height:36px}.topright{gap:5px}.topright select{max-width:105px;font-size:10px;padding:0 4px}.topright button{height:35px;padding:0 7px}.user{width:34px;height:34px}.layout{display:block;padding:11px 9px 80px}.sidebar{display:none}.panel{padding:14px;border-radius:15px;margin-bottom:12px}.hero{min-height:115px;padding:15px}.hero h1{font-size:23px}.hero p{font-size:11px}.heromic{font-size:52px;margin:0}.text{min-height:155px;font-size:16px}.fields{gap:8px}.field select{font-size:11px;padding:0 5px}.sliders{grid-template-columns:1fr;gap:10px}.slider input{margin-top:3px}.right{display:block}.right .panel{margin-bottom:12px}.mobilebar{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:8;justify-content:space-around;padding:7px 2px max(7px,env(safe-area-inset-bottom));background:#ffffffed;border-top:1px solid #e3e8f4;backdrop-filter:blur(12px)}.mobilebar button{border:0;background:transparent;color:#6c7894;font-size:10px;display:flex;flex-direction:column;align-items:center;gap:2px}.mobilebar b{font-size:19px}.actions{flex-wrap:wrap}.action{min-width:28%}.heading h2{font-size:15px}}
</style>
</head>
<body>
<header class="top">
  <div class="brand"><div class="logo">🎙</div><div>AI Voice <span>Studio</span></div></div>
  <div class="topright">
    <select id="toplang" aria-label="Language"><option value="km">🌐 ខ្មែរ</option><option value="en">🌐 English</option></select>
    <button id="theme" aria-label="Dark mode">☾</button><div class="user">♙</div>
  </div>
</header>
<div class="layout">
  <aside class="sidebar">
    <button class="nav active" data-target="editor"><b>⌂</b> ទំព័រដើម</button>
    <button class="nav" data-target="editor"><b>🎙</b> អក្សរទៅជាសំឡេង</button>
    <button class="nav" data-target="voices"><b>▤</b> បណ្ណាល័យសំឡេង</button>
    <button class="nav" data-target="audio"><b>♫</b> សំឡេងរបស់ខ្ញុំ</button>
    <button class="nav" data-target="voices"><b>♡</b> សំឡេងចូលចិត្ត</button>
    <button class="nav" data-target="settings"><b>⚙</b> ការកំណត់</button>
    <div class="sideart"><div class="bigmic">🎙</div><div class="wave">▂ ▄ ▆ ▄ ▂</div><small>សំឡេង AI របស់អ្នក</small></div>
  </aside>
  <main>
    <section class="panel hero"><div><div class="eyebrow">CLOUD TEXT TO SPEECH</div><h1>AI Voice <span>Studio</span></h1><p>បម្លែងអត្ថបទទៅជាសំឡេងបានយ៉ាងងាយស្រួល</p></div><div class="heromic">🎙</div></section>
    <section class="panel" id="editor">
      <div class="heading"><h2>✍️ បញ្ចូលអត្ថបទរបស់អ្នក</h2><span class="counter" id="count">0 / 5000</span></div>
      <div class="editor">
        <div class="tools"><button class="tool" id="undo">↶ Undo</button><button class="tool" id="redo">↷ Redo</button><button class="tool" id="paste">▣ Paste</button><button class="tool" id="clear">▤ សម្អាត</button><button class="tool" id="example">✦ ឧទាហរណ៍</button></div>
        <textarea class="text" id="text" maxlength="5000" placeholder="សរសេរអត្ថបទដែលអ្នកចង់ឱ្យ AI អាននៅទីនេះ..."></textarea>
        <div class="editorfoot"><span>💡 ប្រើសញ្ញាក្បៀស ដើម្បីឱ្យការអានមានចន្លោះធម្មជាតិ</span><span id="remain">នៅសល់ 5000</span></div>
      </div>
      <div class="fields">
        <div class="field"><label for="lang">🌐 ភាសា</label><select id="lang"><option value="km">🇰🇭 ភាសាខ្មែរ (Khmer)</option><option value="en">🇺🇸 English</option></select></div>
        <div class="field"><label for="emotion">🎭 អារម្មណ៍សំឡេង</label><select id="emotion"><option value="normal">🙂 ធម្មតា</option><option value="happy">😄 រីករាយ</option><option value="sad">😢 សោកសៅ</option><option value="calm">😌 ស្ងប់ស្ងាត់</option><option value="excited">🤩 រំភើប</option><option value="serious">🎙 ម៉ឺងម៉ាត់</option></select></div>
      </div>
      <div class="settings" id="settings"><h3>⚙️ ការកំណត់សំឡេង</h3><div class="sliders">
        <div class="slider"><label for="speed">ល្បឿន <b id="speedval">1.0x</b></label><input id="speed" type="range" min=".6" max="1.5" step=".1" value="1"></div>
        <div class="slider"><label for="pitch">កម្ពស់សំឡេង <b id="pitchval">0</b></label><input id="pitch" type="range" min="-5" max="5" value="0"></div>
        <div class="slider"><label for="volume">កម្រិតសំឡេង <b id="volumeval">100%</b></label><input id="volume" type="range" min="0" max="100" value="100"></div>
      </div></div>
      <button class="primary" id="generate">▥ &nbsp; បង្កើតសំឡេង (Generate Speech)</button>
    </section>
    <section class="panel" id="audio">
      <div class="heading"><h2>♫ សំឡេងដែលបានបង្កើត</h2><span class="counter" id="status">រង់ចាំអត្ថបទ</span></div>
      <div class="playerbox"><button class="play" id="play">▶</button><span class="playerhint" id="hint">សំឡេងដែលបង្កើតរួចនឹងបង្ហាញនៅទីនេះ</span><audio id="player" controls hidden></audio></div>
      <div class="actions"><button class="action download" id="download">⬇ ទាញយក MP3</button><button class="action" id="share">↗ ចែករំលែក</button><button class="action danger" id="delete">▤ លុប</button></div>
    </section>
  </main>
  <aside class="right">
    <section class="panel" id="voices">
      <div class="heading"><h2>👥 ជ្រើសរើសសំឡេង</h2></div>
      <div class="tabs"><button class="tab active" data-filter="km">Khmer</button><button class="tab" data-filter="en">English</button><button class="tab" data-filter="all">All</button></div>
      <div class="voicelist">
        <div class="voice selected" data-lang="km" data-voice="male1"><button class="vplay">▶</button><div class="face">👨🏻</div><div><div class="vname">សំឡេងប្រុស 1</div><div class="vdesc">ធម្មជាតិ · Khmer</div><span class="tag">Natural</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="km" data-voice="male2"><button class="vplay">▶</button><div class="face">👨🏽</div><div><div class="vname">សំឡេងប្រុស 2</div><div class="vdesc">សំឡេងជ្រៅ · Khmer</div><span class="tag">Deep</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="km" data-voice="female1"><button class="vplay">▶</button><div class="face">👩🏻</div><div><div class="vname">សំឡេងស្រី 1</div><div class="vdesc">ទន់ភ្លន់ · Khmer</div><span class="tag">Soft</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="km" data-voice="female2"><button class="vplay">▶</button><div class="face">👩🏽</div><div><div class="vname">សំឡេងស្រី 2</div><div class="vdesc">ស្រស់ស្រាយ · Khmer</div><span class="tag">Bright</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="en" data-voice="enfemale"><button class="vplay">▶</button><div class="face">👩🏼</div><div><div class="vname">Emma (Female)</div><div class="vdesc">Natural · English</div><span class="tag">Natural</span></div><button class="heart">♡</button></div>
        <div class="voice" data-lang="en" data-voice="enmale"><button class="vplay">▶</button><div class="face">👨🏻</div><div><div class="vname">James (Male)</div><div class="vdesc">Professional · English</div><span class="tag">Pro</span></div><button class="heart">♡</button></div>
      </div>
    </section>
    <section class="panel"><h3 style="font-size:15px;margin:0 0 12px">✨ គន្លឹះសម្រាប់សំឡេងល្អ</h3><div class="tips">• ប្រើសញ្ញាក្បៀស និងសញ្ញាចុច។<br>• ជ្រើសភាសាឱ្យត្រូវនឹងអត្ថបទ។<br>• កែសម្រួលល្បឿននៅពេលចាក់ស្តាប់។<br><br>ចំណាំ៖ gTTS ប្រើសំឡេងតាមភាសា មិនទាន់គាំទ្រការបញ្ជាអារម្មណ៍ ឬជ្រើសតួសំឡេងដាច់ដោយឡែកទេ។</div></section>
  </aside>
</div>
<nav class="mobilebar"><button data-target="editor"><b>⌂</b>ដើម</button><button data-target="voices"><b>🎙</b>សំឡេង</button><button data-target="audio"><b>♫</b>ស្នាដៃ</button><button data-target="settings"><b>⚙</b>កំណត់</button></nav>
<div class="toast" id="toast"></div>
<script>
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const text=$('#text'), player=$('#player'), toast=$('#toast');
let previous='',redoValue='',audioUrl='';
function note(s){toast.textContent=s;toast.classList.add('show');clearTimeout(note.timer);note.timer=setTimeout(()=>toast.classList.remove('show'),2800)}
function count(){ $('#count').textContent=text.value.length+' / 5000';$('#remain').textContent='នៅសល់ '+(5000-text.value.length)}
text.addEventListener('input',count);
$('#clear').onclick=()=>{previous=text.value;text.value='';count();text.focus()};
$('#example').onclick=()=>{previous=text.value;text.value=$('#lang').value==='km'?'សួស្តី! សូមស្វាគមន៍មកកាន់ AI Voice Studio។ ថ្ងៃនេះអ្នកសុខសប្បាយទេ?':'Hello! Welcome to AI Voice Studio. How are you today?';count()};
$('#undo').onclick=()=>{redoValue=text.value;text.value=previous;count()};
$('#redo').onclick=()=>{previous=text.value;text.value=redoValue;count()};
$('#paste').onclick=async()=>{try{text.value=await navigator.clipboard.readText();count();note('បានបិទភ្ជាប់អត្ថបទ')}catch(e){note('សូម Paste អត្ថបទដោយផ្ទាល់ក្នុងប្រអប់')}};
$('#theme').onclick=()=>{document.body.classList.toggle('dark');$('#theme').textContent=document.body.classList.contains('dark')?'☀':'☾'};
$('#speed').oninput=e=>{$('#speedval').textContent=Number(e.target.value).toFixed(1)+'x';player.playbackRate=Number(e.target.value)};
$('#pitch').oninput=e=>$('#pitchval').textContent=e.target.value;
$('#volume').oninput=e=>{$('#volumeval').textContent=e.target.value+'%';player.volume=Number(e.target.value)/100};
function filter(f){$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.filter===f));$$('.voice').forEach(v=>v.style.display=f==='all'||v.dataset.lang===f?'grid':'none')}
$$('.tab').forEach(t=>t.onclick=()=>{filter(t.dataset.filter);if(t.dataset.filter!=='all')$('#lang').value=t.dataset.filter});
$('#lang').onchange=()=>filter($('#lang').value);
$('#toplang').onchange=()=>{$('#lang').value=$('#toplang').value;filter($('#lang').value)};
$$('.voice').forEach(v=>{
 v.onclick=e=>{if(e.target.closest('.heart')||e.target.closest('.vplay'))return;$$('.voice').forEach(x=>x.classList.remove('selected'));v.classList.add('selected');$('#lang').value=v.dataset.lang;$('#toplang').value=v.dataset.lang;filter(v.dataset.lang);note('បានជ្រើសរើស '+v.querySelector('.vname').textContent)};
 v.querySelector('.heart').onclick=e=>{e.stopPropagation();e.currentTarget.classList.toggle('fav');e.currentTarget.textContent=e.currentTarget.classList.contains('fav')?'♥':'♡'};
 v.querySelector('.vplay').onclick=e=>{e.stopPropagation();note('gTTS មិនមាន voice preview ដាច់ដោយឡែកទេ — សូម Generate អត្ថបទដើម្បីស្តាប់')};
});
$('#generate').onclick=async()=>{
 const value=text.value.trim();
 if(!value){note('សូមបញ្ចូលអត្ថបទជាមុនសិន');text.focus();return}
 const btn=$('#generate');btn.disabled=true;btn.textContent='⏳ កំពុងបង្កើតសំឡេង...';$('#status').textContent='កំពុងដំណើរការ';
 try{
  const r=await fetch('/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:value,lang:$('#lang').value,emotion:$('#emotion').value})});
  if(!r.ok){let msg='មិនអាចបង្កើតសំឡេងបាន';try{msg=(await r.json()).error||msg}catch(e){}throw new Error(msg)}
  const blob=await r.blob();if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(blob);
  player.src=audioUrl;player.hidden=false;player.playbackRate=Number($('#speed').value);player.volume=Number($('#volume').value)/100;
  $('#hint').hidden=true;$('#status').textContent='រួចរាល់';await player.play().catch(()=>{});note('បានបង្កើតសំឡេងជោគជ័យ');
 }catch(e){$('#status').textContent='មានបញ្ហា';note(e.message+' — ពិនិត្យ Internet និង Backend')}
 finally{btn.disabled=false;btn.textContent='▥  បង្កើតសំឡេង (Generate Speech)'}
};
$('#play').onclick=()=>{if(!player.src){note('សូម Generate សំឡេងជាមុនសិន');return}if(player.paused)player.play();else player.pause()};
player.onplay=()=>$('#play').textContent='Ⅱ';player.onpause=()=>$('#play').textContent='▶';
$('#download').onclick=()=>{if(!audioUrl){note('សូមបង្កើតសំឡេងជាមុនសិន');return}const a=document.createElement('a');a.href=audioUrl;a.download='ai-voice.mp3';a.click()};
$('#delete').onclick=()=>{if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl='';player.pause();player.removeAttribute('src');player.load();player.hidden=true;$('#hint').hidden=false;$('#status').textContent='រង់ចាំអត្ថបទ';note('បានសម្អាតសំឡេង')};
$('#share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);note('បានចម្លងតំណ Website')}catch(e){note('សូមចម្លងតំណពី Browser')}}
$$('[data-target]').forEach(b=>b.onclick=()=>{const el=document.getElementById(b.dataset.target);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.target===b.dataset.target))});
</script>
</body>
</html>
"""

@app.get("/")
def index():
    return render_template_string(HTML)

@app.post("/tts")
def text_to_speech():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    lang = data.get("lang", "km")

    if not text:
        return jsonify(error="សូមបញ្ចូលអត្ថបទជាមុនសិន"), 400
    if len(text) > 5000:
        return jsonify(error="អត្ថបទវែងពេក។ អតិបរមា 5000 តួអក្សរ។"), 400
    if lang not in ("km", "en"):
        return jsonify(error="ភាសានេះមិនទាន់គាំទ្រទេ"), 400

    try:
        audio = BytesIO()
        gTTS(text=text, lang=lang, slow=False).write_to_fp(audio)
        audio.seek(0)
        return send_file(
            audio,
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name="ai-voice.mp3",
            max_age=0
        )
    except Exception as exc:
        app.logger.exception("TTS generation failed")
        return jsonify(error="បង្កើតសំឡេងមិនបាន។ សូមពិនិត្យ Internet ឬសាកម្ដងទៀត។"), 502

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port, debug=False)

