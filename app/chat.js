// chat.js — 聊天窗逻辑。请求由主进程发，这里只负责显示和输入。
'use strict';

const log = document.getElementById('log');
const inp = document.getElementById('in');
const btnSend = document.getElementById('send');
const btnStop = document.getElementById('stop');
const who = document.getElementById('who');

// 一条回复 = 一个「回合」，用回合号把气泡钉死。
// 以前这里只有一个全局 cur，而 note（格式回退）/ done / error / send() 收尾
// 都会把它重置。任何这类事件插在流式中间，下一段字就会另开一个气泡 ——
// 表现出来就是「一句话被拆成两条分开发出来」（而且看时机，复现不了几次）。
// 现在只有 start 能开回合，回合收尾之后迟到的增量直接丢掉，绝不再开第二个泡。
let streaming = false, cur = null;
let turn = 0, turnOpen = false;

function add(cls, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
function sys(text) { return add('sys', text); }

// 等回复时先放一个「在想…」的小气泡（三个跳动的点）。
// 以前这里是 add('ai', '')，摆一个空气泡出去 —— 块级元素会占满整行，看着就是一条空长条。
function showThinking() {
  if (cur) return cur;
  cur = document.createElement('div');
  cur.className = 'msg ai thinking';
  cur.innerHTML = '<i></i><i></i><i></i>';
  log.appendChild(cur);
  log.scrollTop = log.scrollHeight;
  return cur;
}

function isThinking() { return !!(cur && cur.classList && cur.classList.contains('thinking')); }

// 三个点收掉，换成真正能写字的空气泡（第一个字到的时候用）
function bentoBubble() {
  if (cur && !isThinking()) return cur;
  if (cur) { cur.remove(); cur = null; }
  cur = add('ai', '');
  return cur;
}

// 出错了 / 被中止了：别留个空气泡或永远转的三个点在那儿
function dropThinking() {
  if (isThinking()) { cur.remove(); cur = null; return true; }
  if (cur && !cur.textContent) { cur.remove(); cur = null; return true; }
  return false;
}

// 开一个新回合。sticky=true 表示「上一个气泡里已经有字了」，
// 这次 start 只是主进程换格式重试，后半句要接着写进同一个泡里，不能另起一个。
// 已经在等的三个点也要留着（主进程会重复发 start），不然会多出一个转不掉的空气泡。
function openTurn(sticky) {
  turn++;
  turnOpen = true;
  const keep = cur && (isThinking() || (sticky && cur.textContent));
  if (!keep) cur = null;
}
function closeTurn() { turnOpen = false; }

async function refreshWho() {
  const s = await window.petHost.getSettings();
  who.textContent = (s.apiModel || I18N.t('chat.noModel')) + ' @ ' + (s.apiBase || '');
}

// 切语言：刷 DOM + 顶栏那行模型信息。历史消息是模型自己说的话，不跟着翻。
function localize(lang) {
  I18N.setLang(lang);
  I18N.applyI18n(document);
  refreshWho();
}
if (window.petHost.onLang) window.petHost.onLang((l) => localize(l));

async function send() {
  const text = inp.value.trim();
  if (!text || streaming) return;
  inp.value = '';
  add('me', text);
  const s = await window.petHost.getSettings();
  if (!s.apiKey) { sys(I18N.t('chat.noKeySys')); window.petHost.openSettings(); return; }
  streaming = true;
  btnSend.disabled = true; btnStop.disabled = false;
  openTurn(false);
  showThinking();
  let r = null;
  try { r = await window.petHost.chatSend(text); }
  catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
  if (!r || !r.ok) { closeTurn(); dropThinking(); sys('✗ ' + ((r && r.error) || I18N.t('chat.failed'))); }
  else { closeTurn(); dropThinking(); }
  streaming = false;
  btnSend.disabled = false; btnStop.disabled = true;
  cur = null;
}

btnSend.onclick = send;
btnStop.onclick = () => window.petHost.chatStop();
inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) send(); };

window.petHost.onChat((m) => {
  if (!m || !m.type) return;
  if (m.type === 'start') {
    // 格式回退（Anthropic 不通 → 换 OpenAI 重来）时主进程会连发两次 start。
    // 第一个回合可能已经写进气泡一半了，这时第二次 start 要接着写，不能另开一个泡。
    openTurn(!!(cur && !isThinking() && cur.textContent));
    showThinking();
  } else if (m.type === 'delta') {
    if (!turnOpen || !m.text) return;      // 回合已收尾：迟到的增量，别再开泡
    const b = bentoBubble();               // 第一个字一到，就把三个点换成真气泡
    b.textContent += m.text;
    log.scrollTop = log.scrollHeight;
  } else if (m.type === 'done') {
    closeTurn();
    dropThinking();                        // 一个字都没回：三个点自己收掉，不留空气泡
  } else if (m.type === 'error') {
    closeTurn();
    dropThinking();
    sys('✗ ' + m.text);
  } else if (m.type === 'note' && m.text) {
    sys(m.text);
  }
});

window.petHost.getSettings().then((s) => {
  localize(s.lang);
  add('ai', I18N.t('chat.greeting'));
});
inp.focus();
