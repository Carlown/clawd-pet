// boot.js — 桌宠窗口启动
'use strict';

(async function boot() {
  const cv = document.getElementById('stage');
  await Pet.init(cv, { x: 0.72 });
  // 设置窗口里改的东西实时生效
  window.petHost.onSettings((s) => {
    Settings.data = Object.assign({}, Settings.data, s || {});
    // 语言跟着走：设置窗或托盘那边改了 lang，这里把 i18n 表和 DOM 一起刷过来
    Settings.applyLang();
    Pet.applySettings();
  });
  // 主进程改语言（托盘里的语言菜单）也会广播过来。
  // 注意得先把 data.lang 写回去：这个广播不跟着 settings:changed 走，
  // 只调 applyLang() 的话它会拿旧 lang 又刷回去。
  if (window.petHost.onLang) {
    window.petHost.onLang((l) => { Settings.data.lang = l; Settings.applyLang(); Pet.applySettings(); });
  }
  // 对话总开关：这里只同步状态，不开窗（菜单里的「聊两句…」才负责开）
  setTimeout(() => {
    if (Pet.bubble) return;
    const ls = I18N.lines('lines.idle');
    Pet.say(ls[(Math.random() * ls.length) | 0], 2.6);
  }, 1200);
})();