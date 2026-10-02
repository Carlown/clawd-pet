// name.js — 名牌文字输入窗。用一个小窗口代替 window.prompt：
// Electron 里 prompt() 是明确不支持的（只会在控制台报一句警告然后返回 undefined），
// 所以之前在右键菜单点「名牌文字…」是完全没有反应的。
'use strict';

const input = document.getElementById('v');

window.petHost.nameGet().then((v) => {
  input.value = v || '';
  input.focus();
  input.select();
}).catch(() => input.focus());

// 切语言：只刷按钮/占位符，光标和已输入的文字不动
function localize(lang) {
  I18N.setLang(lang);
  I18N.applyI18n(document);
}
if (window.petHost.onLang) window.petHost.onLang((l) => localize(l));
window.petHost.getSettings().then((s) => localize(s.lang)).catch(() => localize('zh'));

const submit = () => window.petHost.nameSubmit(input.value);
const cancel = () => window.petHost.nameCancel();

document.getElementById('ok').onclick = submit;
document.getElementById('cancel').onclick = cancel;
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submit(); }
  else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
});
