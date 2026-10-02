import petMarkup from '../assets/clawdpet.svg?raw';

export function downloadOfflinePet() {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClawdPet | 你的离线小伙伴</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;overflow:hidden;background:#f8f6ef;color:#34322f;font-family:system-ui,-apple-system,sans-serif}header{padding:28px 6vw;display:flex;align-items:center;gap:12px}header svg{width:40px;height:32px}header span{font:28px Georgia,serif}main{position:absolute;left:9vw;top:28vh;max-width:520px;pointer-events:none}h1{font:clamp(60px,9vw,110px)/1.03 Georgia,serif;letter-spacing:-5px;margin:0 0 28px}p{font-size:16px;line-height:1.9;color:#77726a}.halo{position:absolute;width:550px;height:550px;top:20%;right:8%;border-radius:50%;background:radial-gradient(circle,#f5dfc8,transparent 68%);pointer-events:none}.pet{position:absolute;width:clamp(180px,27vw,360px);touch-action:none;cursor:grab;border:0;background:none;padding:0;user-select:none;z-index:2}.pet:active{cursor:grabbing}.pet>svg{width:100%;display:block;filter:drop-shadow(0 22px 18px #60361112)}.pet-eye-left{transform-origin:397px 503px}.pet-eye-right{transform-origin:853px 503px}.pet-eye{animation:blink 6s infinite}.sleepy .pet-eye{animation:none;transform:scaleY(.12)}.happy>svg{animation:bounce .65s ease}.message{position:absolute;bottom:calc(100% + 18px);left:50%;transform:translateX(-50%);background:#fffdf8;padding:13px 20px;border:1px solid #e9e4da;border-radius:16px;white-space:nowrap;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none}.message.visible{opacity:1}.controls{position:fixed;bottom:50px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:3}.controls button{border:1px solid #ded9cf;border-radius:9px;background:#fffdf8;color:#49433b;padding:13px 20px;font:14px system-ui;cursor:pointer;white-space:nowrap}.controls button:hover{background:#f1e2d5;border-color:#c88765}.note{position:fixed;bottom:14px;width:100%;text-align:center;font-size:11px;color:#9b958c}@keyframes blink{0%,43%,47%,100%{transform:scaleY(1)}45%{transform:scaleY(.08)}}@keyframes bounce{0%,100%{transform:translateY(0) rotate(-4deg)}45%{transform:translateY(-25px) rotate(3deg)}}@media(max-width:650px){main{top:17vh;left:8vw;right:8vw}h1{font-size:clamp(36px,10.5vw,60px);letter-spacing:-2px;line-height:1.15}p{font-size:13px}.halo{top:35%;right:-140px}.controls{bottom:58px;gap:6px}.controls button{padding:12px}.note{font-size:10px;padding:0 20px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<header>${petMarkup}<span>ClawdPet</span></header>
<div class="halo"></div>
<main><h1>A little friend.<br>A little more joy.</h1><p>你的桌面，多了一点可爱。<br>点点我，也可以把我拖到你喜欢的地方。</p></main>
<button class="pet" id="pet" aria-label="摸摸 ClawdPet">${petMarkup}<span class="message" id="message" aria-live="polite"></span></button>
<div class="controls"><button id="hello">打个招呼</button><button id="cookie">把你拎起来</button><button id="quiet">打个盹</button></div>
<div class="note">ClawdPet 离线网页体验 · 不联网、不读取文件、不包含 AI 对话。桌面版（只在 Windows 上跑）到 GitHub 下载。</div>
<script>
const pet=document.getElementById('pet'),message=document.getElementById('message');
let x=innerWidth>650?innerWidth*.63:(innerWidth-pet.offsetWidth)/2,y=innerWidth>650?innerHeight*.39:innerHeight*.56,startX=0,startY=0,downX=0,downY=0,dragging=false,moved=false,timer,quiet=false;
function position(){x=Math.max(8,Math.min(innerWidth-pet.offsetWidth-8,x));y=Math.max(70,Math.min(innerHeight-pet.offsetHeight-135,y));pet.style.left=x+'px';pet.style.top=y+'px'}
function say(text,happy=true){clearTimeout(timer);message.textContent=text;message.classList.add('visible');pet.classList.toggle('happy',happy);timer=setTimeout(()=>{message.classList.remove('visible');pet.classList.remove('happy')},3500)}
position();addEventListener('resize',position);
pet.addEventListener('pointerdown',e=>{dragging=true;moved=false;downX=e.clientX;downY=e.clientY;startX=e.clientX-x;startY=e.clientY-y;pet.setPointerCapture(e.pointerId)});
pet.addEventListener('pointermove',e=>{if(!dragging)return;if(Math.abs(e.clientX-downX)+Math.abs(e.clientY-downY)>5)moved=true;x=e.clientX-startX;y=e.clientY-startY;position()});
pet.addEventListener('pointerup',()=>{dragging=false;if(!moved)say('被你摸摸，好开心！')});
pet.addEventListener('pointercancel',()=>{dragging=false});
pet.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();say('被你摸摸，好开心！')}const keys={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]};if(keys[e.key]){e.preventDefault();x+=keys[e.key][0];y+=keys[e.key][1];position()}});
document.getElementById('hello').onclick=()=>say('嗨！很高兴认识你。');
document.getElementById('cookie').onclick=()=>say('咿呀——别晃了！');
document.getElementById('quiet').onclick=e=>{quiet=!quiet;pet.classList.toggle('sleepy',quiet);e.currentTarget.textContent=quiet?'叫醒小家伙':'安静陪伴';say(quiet?'你忙你的，我在这里。':'睡醒了！又是元气满满的一天。',!quiet)};
</script>
</body>
</html>`;

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ClawdPet-offline.html';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}