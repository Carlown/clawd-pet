// settings.js — 设置窗逻辑：读写走主进程，改完立刻热更新到桌宠。
// 文案全在 ../src/i18n.js（和桌宠窗口、托盘共用一份），这里只管把 data-i18n 刷上去。
'use strict';

const IDS = ['walk', 'drag', 'gravity', 'look', 'idle', 'bubble', 'dance', 'peek', 'idleGreet', 'showName',
  'hat', 'color', 'size', 'name', 'lang', 'clickThrough', 'alwaysOnTop', 'autoLaunch',
  'chat', 'apiProvider', 'apiBase', 'apiModel', 'apiKey', 'temperature', 'systemPrompt'];
const NUM = { size: Number, temperature: Number };
const el = (id) => document.getElementById(id);
const msg = (t, bad) => { const m = el('msg'); m.textContent = t; m.style.color = bad ? '#b4453a' : '#5a7d4a'; };

function fill(s) {
  for (const id of IDS) {
    const e = el(id);
    if (!e) continue;
    if (e.type === 'checkbox') { e.checked = !!s[id]; continue; }
    const v = s[id] === undefined || s[id] === null ? '' : s[id];
    e.value = v;
    // 下拉框里没有这一项时，浏览器会把 value 静默置空 —— 那就等于把设置改坏了
    // （size 被置空 → Number('')=0 → 桌宠既画不出来也点不到）。改回第一项。
    if (e.tagName === 'SELECT' && e.value !== String(v)) e.value = e.options[0].value;
  }
}

function collect() {
  const out = {};
  for (const id of IDS) {
    const e = el(id);
    if (!e) continue;
    out[id] = e.type === 'checkbox' ? e.checked : (NUM[id] ? NUM[id](e.value) : e.value);
  }
  return out;   // showName 是独立开关，不再跟着文字一起被抹掉
}

// 切语言：刷一遍 data-i18n + <html lang>，顺便把探头检测的状态重跑一次（那句也是本地化的）
function localize(lang) {
  I18N.setLang(lang);
  I18N.applyI18n(document);
  probePeek();
}

async function probePeek() {
  const w = el('peekStatus');
  if (!w) return;
  w.textContent = I18N.t('set.peek.testing');
  try {
    const r = await window.petHost.watchNow();
    w.textContent = r && r.ok
      ? I18N.t('set.peek.ok', { title: (r.fg && r.fg.title) || I18N.tIn(I18N.getLang(), 'set.f.none') })
      : I18N.t('set.peek.bad', { err: (r && r.error) || '?' });
  } catch (e) {
    w.textContent = I18N.t('set.peek.nomain');
  }
}

async function save() {
  const r = await window.petHost.saveSettings(collect());
  fill(r);
  // 语言可能刚在这一步被改掉：先切过来再写状态文案，否则提示还是上一种语言
  I18N.setLang(r.lang);
  msg(I18N.t('set.saved'));
}

el('save').onclick = save;

el('test').onclick = async () => {
  msg(I18N.t('set.testing'));
  const r = await window.petHost.testApi(I18N.t('test.hello'));
  msg(r.ok ? I18N.t('set.testOk', { via: r.via, model: r.model }) : '✗ ' + r.error, !r.ok);
};

el('reset').onclick = async () => {
  // 用主进程的原生对话框，不要用 window.confirm（Electron 对它的实现不可靠）
  const yes = await window.petHost.confirmBox({ message: I18N.t('set.resetQ'), detail: I18N.t('set.resetD') });
  if (!yes) return;
  await window.petHost.clearApiKey();
  const r = await window.petHost.saveSettings({});
  fill(r);
  I18N.setLang(r.lang);
  msg(I18N.t('set.resetDone'));
};

// 托盘菜单那边改了语言也会广播过来（onSettings 只在设置窗自己保存时触发）
if (window.petHost.onLang) window.petHost.onLang((l) => localize(l));

window.petHost.getSettings().then((s) => {
  localize(s.lang);
  fill(s);
});