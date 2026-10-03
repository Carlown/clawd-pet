// main.js — Electron 主进程：透明置顶桌宠窗口、点击穿透、托盘、原生菜单、设置、流式对话。
'use strict';
const { app, BrowserWindow, ipcMain, Menu, Tray, screen, safeStorage, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const winwatch = require('./winwatch');
// 文案表：托盘菜单、窗口标题、原生对话框、对话报错都在主进程，这里没 DOM，
// 所以直接 require 渲染进程用的同一份（src/i18n.js 末尾导出 CommonJS 版）。
const I18N = require('../src/i18n.js');

// 自检 / 调试表换一个独立的 userData 目录：
//   1. 不会跟你正在跑的桌宠抢单实例锁和 Chromium 缓存（不然自检直接起不来）；
//   2. 自检里那些会写设置的测试不会污染你真实的 settings.json。
if (process.argv.includes('--selftest') || process.argv.includes('--sheet')) {
  app.setPath('userData', path.join(os.tmpdir(), 'clawd-pet-selftest'));
}

// 单实例
if (!app.requestSingleInstanceLock()) app.quit();

const STORE = () => path.join(app.getPath('userData'), 'settings.json');
const BOX = { w: 560, h: 480 };            // 桌宠窗口尺寸：只罩住桌宠，不挡整个桌面
const GROUND_PAD = 14;                     // 窗口底部多探出工作区一点，给影子留位置
let win = null, tray = null, settingsWin = null, chatWin = null, nameWin = null, clickThrough = true;
let userHidden = false;
let abortCtl = null;

const DEFAULT_MODEL_HINT = 'claude-sonnet-4-5';

/* --------------------------------------------------------------- 设置 */
// 人设的默认文案按语言走（src/i18n.js 的 sysPrompt）。但只在这个值「还是某一版默认值」
// 时才跟着语言换 —— 用户自己改过的永远不动，否则一切换语言就把人家写的人设冲掉了。
// 这件事必须在主进程做：真正发请求时读的是这里的设置，渲染进程换完只是内存里的值，
// 磁盘上还抂着上一种语言的人设（那时候切了语言也照样用中文人设回答）。
function reconcilePrompt(s) {
  const cur = s.systemPrompt;
  if (!cur || cur === I18N.promptFor('zh') || cur === I18N.promptFor('en')) {
    s.systemPrompt = I18N.promptFor(s.lang);
  }
  return s;
}

function readSettings() {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(STORE(), 'utf8')); } catch (e) { raw = {}; }
  if (raw.apiKeyEnc) {
    try {
      raw.apiKey = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(raw.apiKeyEnc, 'base64')) : '';
    } catch (e) { raw.apiKey = ''; }
    delete raw.apiKeyEnc;
  }
  I18N.setLang(raw.lang);
  return reconcilePrompt(raw);
}

function writeSettings(patch) {
  const cur = readSettings();
  const next = reconcilePrompt(Object.assign({}, cur, patch || {}));
  const key = next.apiKey || '';
  delete next.apiKey;
  if (key) {
    try {
      next.apiKeyEnc = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(key).toString('base64') : Buffer.from(key, 'utf8').toString('base64');
    } catch (e) { /* 加密不可用就不存 key */ }
  }
  try {
    fs.mkdirSync(path.dirname(STORE()), { recursive: true });
    fs.writeFileSync(STORE(), JSON.stringify(next, null, 2));
  } catch (e) { console.error('保存设置失败', e); }
  I18N.setLang(next.lang);
  const out = Object.assign({}, next, { apiKey: key });
  delete out.apiKeyEnc;                 // 别把密文也抖回渲染进程，跟以前保持一致
  return reconcilePrompt(out);
}

/* ------------------------------------------------------------- 桌宠窗 */
function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

function createPetWindow() {
  // 初始显示器 = 鼠标当前所在的那块（没鼠标就主屏），桌宠生成在它 72% 的地方
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const x = Math.round(wa.x + wa.width * 0.72 - BOX.w / 2);
  const y = Math.round(wa.y + wa.height - BOX.h + GROUND_PAD);
  win = new BrowserWindow({
    x: clampInt(x, wa.x, wa.x + wa.width - BOX.w),
    y: clampInt(y, wa.y, wa.y + wa.height - BOX.h + GROUND_PAD),
    width: BOX.w, height: BOX.h,
    transparent: true, frame: false, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, focusable: false,
    alwaysOnTop: true, backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  clickThrough = true;
  win.loadFile(path.join(__dirname, 'index.html'));
  // 鼠标在哪块屏，它就去哪块（透明穿窗收不到全局鼠标事件，所以主进程轮询）
  setInterval(() => {
    if (!win || win.isDestroyed() || userHidden) return;
    const p = screen.getCursorScreenPoint();
    const d = screen.getDisplayNearestPoint(p);
    win.webContents.send('win:cursor', { x: p.x, y: p.y, id: d.id });
  }, 350);
  win.on('closed', () => { win = null; });

  // Win+D（显示桌面）会把窗口最小化/隐藏，这里给拉回来
  const revive = (delay) => setTimeout(() => {
    if (!win || win.isDestroyed() || userHidden) return;
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.showInactive();
  }, delay);
  win.on('minimize', () => revive(60));
  win.on('hide', () => revive(80));
  win.on('restore', () => { if (win && !win.isDestroyed()) win.moveTop(); });
  trackOwn(win);
  return win;
}

function clampInt(v, a, b) { return Math.max(a, Math.min(b, v)); }

// 快照落盘位置：开发时写 build/，打包后代码在 asar 里，build/ 不可写，改写 userData。
function shotDir() {
  return app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..', 'build');
}
function saveShot(name, dataUrl) {
  const b64 = String(dataUrl || '').split(',')[1] || '';
  if (!b64) return '';
  try { fs.mkdirSync(shotDir(), { recursive: true }); fs.writeFileSync(path.join(shotDir(), name), Buffer.from(b64, 'base64')); }
  catch (e) { console.log('SNAPSHOT-ERR', e.message); return ''; }
  return path.join(shotDir(), name);
}

// 所有显示器的工作区（绝对屏幕坐标）
function allDisplays() {
  return screen.getAllDisplays().map((d) => ({ id: d.id, x: d.workArea.x, y: d.workArea.y, w: d.workArea.width, h: d.workArea.height }));
}

function virtualBox() {
  const ds = allDisplays();
  if (!ds.length) return { x: 0, y: 0, w: 1920, h: 1080 };
  const x0 = Math.min(...ds.map((d) => d.x));
  const y0 = Math.min(...ds.map((d) => d.y));
  const x1 = Math.max(...ds.map((d) => d.x + d.w));
  const y1 = Math.max(...ds.map((d) => d.y + d.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// 桌宠窗口当前位置 + 所有显示器工作区，渲染进程靠它建立 world/cam 两套坐标
function windowInfo() {
  const b = win ? win.getBounds() : { x: 0, y: 0, width: BOX.w, height: BOX.h };
  return { x: b.x, y: b.y, w: b.width, h: b.height, displays: allDisplays() };
}

function moveWindowTo(x, y) {
  if (!win || win.isDestroyed()) return windowInfo();
  const v = virtualBox();
  const b = win.getBounds();
  win.setBounds({
    x: Math.round(clampInt(x, v.x, v.x + v.w - b.width)),
    y: Math.round(clampInt(y, v.y, v.y + v.h - b.height + GROUND_PAD)),
    width: b.width, height: b.height,
  });
  const n = win.getBounds();
  return { x: n.x, y: n.y };
}

// 开机自启要指向「用户双击的那个 exe」，而不是 process.execPath。
// 这个包是 electron-builder 的 portable 目标：启动时它会把自己解包到临时目录再从里面跑，
// 所以 process.execPath 指的是 %TEMP% 下一个用完就会被删掉的路径 ——
// 注册它开机必然启动不了（而且用户看到的是「勾了没用」）。
// portable.nsi 会把真身路径写进 PORTABLE_EXECUTABLE_FILE，这里优先用它。
function loginItemPath() {
  const real = process.env.PORTABLE_EXECUTABLE_FILE;
  return (real && fs.existsSync(real)) ? real : app.getPath('exe');
}

function applyAutoLaunch() {
  const want = !!readSettings().autoLaunch;
  const path = loginItemPath();
  try {
    // openAsHidden 让开机启动时直接进托盘，不弹一个窗出来
    app.setLoginItemSettings({ openAtLogin: want, openAsHidden: true, path, args: ['--hidden'] });
  } catch (e) {
    console.warn('[开机自启] 设置失败：', e && e.message);
    return false;
  }
  return true;
}

function applyWindowPrefs() {
  if (!win) return;
  const s = readSettings();
  win.setAlwaysOnTop(!!s.alwaysOnTop, 'screen-saver');
  applyAutoLaunch();
  if (!s.clickThrough) setClickThrough(false);
  if (win && !win.isDestroyed()) win.webContents.send('win:info', windowInfo());
}

function setClickThrough(v) {
  clickThrough = !!v;
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(clickThrough, { forward: true });
}

function syncWindowToDisplay() {
  if (!win) return;
  moveWindowTo(win.getBounds().x, win.getBounds().y);
  if (win && !win.isDestroyed()) {
    win.webContents.send('win:info', windowInfo());
    const p = screen.getCursorScreenPoint();
    win.webContents.send('win:cursor', { x: p.x, y: p.y, id: screen.getDisplayNearestPoint(p).id });
  }
}

/* ------------------------------------------------------------- 托盘 */
function iconPath() {
  const png = path.join(__dirname, '..', 'build', 'icon.png');
  const ico = path.join(__dirname, '..', 'build', 'icon.ico');
  return fs.existsSync(png) ? png : ico;
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(iconPath());
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 20, height: 20 }));
  } catch (e) {
    tray = new Tray(nativeImage.createEmpty());
  }
  tray.setToolTip('ClawdPet');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => { if (!win) return; userHidden = win.isVisible(); userHidden ? win.hide() : win.showInactive(); });
}

// 托盘菜单单独抽出来：切语言后要重建一次（setContextMenu 会立即替换）
function buildTrayMenu() {
  const cur = readSettings().lang || 'zh';
  return Menu.buildFromTemplate([
    { label: I18N.t('tray.toggle'), click: () => { if (!win) return; userHidden = win.isVisible(); userHidden ? win.hide() : win.showInactive(); } },
    { label: I18N.t('tray.recenter'), click: () => send('menu', 'recenter') },
    { type: 'separator' },
    { label: I18N.t('menu.lang'), submenu: I18N.LANGS.map((l) => ({
      label: I18N.t('lang.' + l), type: 'radio', checked: cur === l,
      click: () => { writeSettings({ lang: l }); applyLang(l); },
    })) },
    { label: I18N.t('tray.settings'), click: () => openSettings() },
    { label: I18N.t('tray.sheet'), click: () => openDevWindow('sheet') },
    { type: 'separator' },
    { label: I18N.t('tray.quit'), click: () => app.quit() },
  ]);
}

// 换语言后的收尾：主进程换表 → 重建托盘 → 改各窗口标题 → 广播给所有窗口刷 data-i18n。
// 桌宠窗口自己画的是画布（台词现取），所以广播主要是给设置/聊天/名牌三个小窗用的。
function applyLang(lang) {
  const l = I18N.setLang(lang);
  try { if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu()); } catch (e) { /* noop */ }
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.setTitle(I18N.t('win.settings'));
  if (chatWin && !chatWin.isDestroyed()) chatWin.setTitle(I18N.t('win.chat'));
  if (nameWin && !nameWin.isDestroyed()) nameWin.setTitle(I18N.t('win.name'));
  for (const w of [win, settingsWin, chatWin, nameWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('lang:changed', l);
  }
  return l;
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

/* ------------------------------------------------------------ 调试窗口 */
// 托盘里的「调试表情表」。打包时如果忘了把 dev/ 收进 files，这里就只会开一片空白页，
// 什么都看不出来；所以先检查文件在不在。
function openDevWindow(mode) {
  const file = path.join(__dirname, '..', 'dev', 'index.html');
  const dw = new BrowserWindow({ width: 1280, height: 900, title: I18N.t('win.dev') });
  if (!fs.existsSync(file)) {
    dw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<body style="font:14px/1.8 Microsoft YaHei;padding:40px;color:#2f2721;background:#f6f1e6">'
      + '<h2>' + I18N.t('dev.missing') + '</h2><p>' + I18N.t('dev.missingHint') + '</p>'
      + '<p>' + I18N.t('dev.missingFix') + '</p></body>'));
    return;
  }
  dw.loadFile(file, { query: { mode } });
  trackOwn(dw);                                  // 调试窗也不算「前台窗口」
  return dw;
}

/* --------------------------------------------------------- 设置 / 聊天窗 */
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 520, height: 620, title: I18N.t('win.settings'),
    backgroundColor: '#f6f1e6', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  trackOwn(settingsWin);
  settingsWin.on('closed', () => { settingsWin = null; });
}

// 名牌文字：开一个小窗，而不是 window.prompt（Electron 不支持后者，点了不会有任何反应）
function openNamePrompt() {
  if (nameWin && !nameWin.isDestroyed()) { nameWin.focus(); return; }
  const b = (win && !win.isDestroyed()) ? win.getBounds() : screen.getPrimaryDisplay().workArea;
  nameWin = new BrowserWindow({
    width: 300, height: 168, title: I18N.t('win.name'),
    x: Math.round(b.x + b.width / 2 - 150), y: Math.round(b.y + b.height / 2 - 84),
    resizable: false, minimizable: false, maximizable: false, autoHideMenuBar: true,
    backgroundColor: '#f6f1e6',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  nameWin.loadFile(path.join(__dirname, 'name.html'));
  trackOwn(nameWin);
  nameWin.on('closed', () => { nameWin = null; });
}

function openChat() {
  if (chatWin && !chatWin.isDestroyed()) { chatWin.show(); chatWin.focus(); return; }
  chatWin = new BrowserWindow({
    width: 400, height: 520, title: I18N.t('win.chat'),
    backgroundColor: '#f6f1e6', autoHideMenuBar: true, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  chatWin.loadFile(path.join(__dirname, 'chat.html'));
  trackOwn(chatWin);
  chatWin.on('closed', () => { chatWin = null; });
}

/* ------------------------------------------------------- 桌面观察员 */
// 我们自己这几个窗口别被当成「前台窗口」，不然探头张望会去爬自己的聊天窗
const ownHwnd = new Set();
function trackOwn(w) {
  if (!w || w.isDestroyed()) return;
  const h = winwatch.hwndOf(w);
  if (h) ownHwnd.add(String(h));
  w.on('closed', () => ownHwnd.delete(String(h)));
}

// 标题栏位置要落在屏幕里：最大化窗口 GetWindowRect 会给出 top=-8 那条不可见的缩放边框
function clipRect(rect) {
  if (!rect) return null;
  const d = screen.getDisplayMatching({
    x: Math.round(rect.x + rect.w / 2), y: Math.round(rect.y + Math.min(rect.h, 60) / 2),
    width: Math.max(1, Math.round(rect.w)), height: Math.max(1, Math.round(Math.min(rect.h, 60))),
  });
  const wa = d.workArea;
  const x = clampInt(rect.x, wa.x, wa.x + wa.width - 24);
  return {
    x, w: Math.max(24, Math.min(rect.w, wa.width * 2)),
    y: Math.max(wa.y, Math.min(rect.y, wa.y + wa.height - 1)),   // 标题栏那一行
  };
}

function startWatch() {
  // 主进程只要被卡住一下，整个桌宠（窗口跟随、托盘、右键菜单）就都是僵的。
  // 这里盯一下事件循环的迟到量，以后再出现就一眼能看出是不是这个原因。
  let expected = 0;
  winwatch.start((s) => {
    const late = expected ? Date.now() - expected : 0;
    if (late > 2000) console.warn('[winwatch] 主进程被阻塞了约 ' + Math.round(late / 1000) + 's（这段时间桌宠是僵的）');
    expected = Date.now() + 1000;
    if (!win || win.isDestroyed() || userHidden) return;
    win.webContents.send('win:watch', Object.assign({}, s, { rect: clipRect(s.rect) }));
  }, ownHwnd);
}

/* --------------------------------------------------------------- 对话 */
function joinUrl(base, pathSuffix) {
  let b = String(base || '').trim().replace(/\/+$/, '');
  if (!b) b = 'https://api.anthropic.com';
  if (/\/messages$/.test(b) || /\/chat\/completions$/.test(b)) return b;   // 用户直接粘了完整端点
  if (/\/v1$/.test(b)) return b + pathSuffix.replace(/^\/v1/, '');
  return b + pathSuffix;
}

function sseLines(body, onEvent) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  return (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line || line[0] !== 'd') continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try { onEvent(JSON.parse(payload)); } catch (e) { /* 半行，忽略 */ }
      }
    }
  })();
}

// <think>…</think> 过滤器（流式安全）。
// 有些网关（sharellm 之类）不把思考放进 reasoning_content，而是直接用 <think> 标签
// 混在 delta.content 里一句一句吐出来 —— 用户就在气泡里看见模型的自言自语了。
// 难点在于标签本身会被切断：'…>你叫' + '<thi' + 'nk>我出来…'，
// 所以每段先拼到缓冲里，确认不是半个标签才吐出去。
const THINK_OPEN = /<think(?:ing)?>/i;
const THINK_CLOSE = /<\/think(?:ing)?>/i;
const TAG_KEEP = 16;                 // 尾部留这么多字，用来判断「标签还没吐完」
function makeThinkFilter() {
  let buf = '', inThink = false;
  return {
    push(s) {
      buf += String(s == null ? '' : s);
      let out = '';
      for (;;) {
        if (inThink) {
          const m = buf.match(THINK_CLOSE);
          if (!m) {                                   // 整段都是思考，丢掉，只留尾巴
            if (buf.length > TAG_KEEP) buf = buf.slice(-TAG_KEEP);
            return out;
          }
          buf = buf.slice(m.index + m[0].length);
          inThink = false;
          continue;
        }
        const m = buf.match(THINK_OPEN);
        if (m) { out += buf.slice(0, m.index); buf = buf.slice(m.index + m[0].length); inThink = true; continue; }
        const lt = buf.lastIndexOf('<');              // 结尾可能是半个 '<'，扣住等下一段
        if (lt >= 0 && buf.length - lt < TAG_KEEP) { out += buf.slice(0, lt); buf = buf.slice(lt); }
        else { out += buf; buf = ''; }
        return out;
      }
    },
    flush() {                                          // 流收尾：思考没闭合就丢掉，闭合了就吐剩下的
      const rest = inThink ? '' : buf;
      buf = ''; inThink = false;
      return rest;
    },
  };
}

async function callAnthropic(s, text, signal, delta) {
  const res = await fetch(joinUrl(s.apiBase, '/v1/messages'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': s.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: s.apiModel || DEFAULT_MODEL_HINT,
      max_tokens: 1024,
      stream: true,
      temperature: s.temperature === undefined ? 0.8 : s.temperature,
      system: s.systemPrompt || undefined,
      messages: [{ role: 'user', content: text }],
    }),
    signal,
  });
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status + ' ' + (await res.text().catch(() => '')).slice(0, 200));
    err.status = res.status;
    throw err;
  }
  // extended thinking：thinking 块整块丢掉（delta.text 里也可能有 <think> 标签，再过一道）
  const tf = makeThinkFilter();
  let inThinking = false;
  await sseLines(res.body, (e) => {
    if (e.type === 'content_block_start') {
      const t = e.content_block && e.content_block.type;
      inThinking = (t === 'thinking' || t === 'redacted_thinking');
      return;
    }
    if (e.type === 'content_block_stop') { inThinking = false; return; }
    if (e.type !== 'content_block_delta' || !e.delta) return;
    if (inThinking || e.delta.type === 'thinking_delta' || e.delta.type === 'signature_delta') return;
    if (!e.delta.text) return;
    const out = tf.push(e.delta.text);
    if (out) delta(out);
  });
  const tail = tf.flush();
  if (tail) delta(tail);
}

async function callOpenAI(s, text, signal, delta) {
  const res = await fetch(joinUrl(s.apiBase, '/v1/chat/completions'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.apiKey },
    body: JSON.stringify({
      model: s.apiModel || DEFAULT_MODEL_HINT,
      stream: true,
      temperature: s.temperature === undefined ? 0.8 : s.temperature,
      messages: [
        ...(s.systemPrompt ? [{ role: 'system', content: s.systemPrompt }] : []),
        { role: 'user', content: text },
      ],
    }),
    signal,
  });
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status + ' ' + (await res.text().catch(() => '')).slice(0, 200));
    err.status = res.status;
    throw err;
  }
  // 思考字段（reasoning_content / reasoning）本来就是分开的，不碰；
  // 但有些网关会把 <think> 标签混在 content 里，所以还要过一道过滤器。
  const tf = makeThinkFilter();
  await sseLines(res.body, (e) => {
    const d = e.choices && e.choices[0] && e.choices[0].delta;
    if (!d) return;
    let c = d.content;
    if (Array.isArray(c)) c = c.map((b) => (b && (b.text || b.content)) || '').join('');   // 少数网关给数组
    if (!c) return;
    const out = tf.push(c);
    if (out) delta(out);
  });
  const tail = tf.flush();
  if (tail) delta(tail);
}

// auto：先按 Anthropic 格式打，打不通（网络错 / 端点不存在）再退回 OpenAI 格式
function worthFallback(e) {
  if (!e.status) return true;                       // 网络层错误：多半是 base 写成了另一种格式的服务
  return [404, 405, 422, 501].includes(e.status);
}

async function runChat(text) {
  const s = readSettings();
  if (!s.apiKey) throw new Error(I18N.t('err.noKey'));
  if (!s.apiModel) throw new Error(I18N.t('err.noModel'));
  abortCtl = new AbortController();
  const delta = (t) => { send('chat:event', { type: 'delta', text: t }); if (chatWin) chatWin.webContents.send('chat:event', { type: 'delta', text: t }); };
  const order = s.apiProvider === 'openai' ? ['openai'] : s.apiProvider === 'anthropic' ? ['anthropic'] : ['anthropic', 'openai'];
  let last = null;
  for (const p of order) {
    try {
      send('chat:event', { type: 'start' });
      if (chatWin) chatWin.webContents.send('chat:event', { type: 'start' });
      await (p === 'anthropic' ? callAnthropic : callOpenAI)(s, text, abortCtl.signal, delta);
      send('chat:event', { type: 'done' });
      if (chatWin) chatWin.webContents.send('chat:event', { type: 'done' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') { send('chat:event', { type: 'done' }); if (chatWin) chatWin.webContents.send('chat:event', { type: 'done' }); return; }
      last = e;
      if (order.length > 1 && worthFallback(e)) {
        send('chat:event', { type: 'note', text: p === 'anthropic' ? I18N.t('err.fallback') : '' });
        continue;
      }
      break;
    }
  }
  throw last || new Error(I18N.t('err.request'));
}

/* --------------------------------------------------------------- IPC */
ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:save', (_e, patch) => {
  const before = readSettings().lang || 'zh';
  const r = writeSettings(patch);
  applyWindowPrefs();
  send('settings:changed', r);
  // 语言变了才做那套善后（重建托盘、改标题、广播），否则每次改个帽子都重建一遍
  if ((r.lang || 'zh') !== before) applyLang(r.lang);
  return r;
});
ipcMain.handle('settings:clearKey', () => writeSettings({ apiKey: '' }));
ipcMain.on('win:click-through', (_e, v) => setClickThrough(v));
ipcMain.handle('win:info', () => windowInfo());
ipcMain.handle('win:move', (_e, pos) => moveWindowTo(pos.x, pos.y));
// 注意：以前 win:visible 注册了两个处理器（一个改 userHidden 再 showInactive，
// 一个 show/hide）。Electron 不会「后注册的覆盖先注册的」——两个都会跑，
// 同一个开关被处理两次，userHidden 也被算了两遍。
ipcMain.on('win:visible', (_e, v) => { if (win) { userHidden = !v; v ? win.showInactive() : win.hide(); } });
ipcMain.on('win:apply-prefs', () => applyWindowPrefs());
let menuOpen = false, menuFinish = null, lastMenu = null;

// 弹出桌宠的右键菜单。onClosed 在菜单关掉（或者兵例触发）之后调一次。
// 关键：桌宠窗口是 focusable:false 的。原生弹出菜单挂在一个不能聚焦的窗口上时，
// 点它收不到、菜单也关不掉，主进程的嵌套消息循环就一直转下去 —— 表现出来就是
// 「右键点了就卡死，它也不动了」（IPC 全被堵住，窗口不再跟着它走）。
// 所以弹出前临时让它可聚焦，菜单关了再还原。
function showPetMenu(spec, onClosed) {
  if (!win || win.isDestroyed() || menuOpen) { if (onClosed) onClosed(false); return false; }
  const build = (items) => items.map((it) => {
    if (it.type === 'separator') return { type: 'separator' };
    if (it.type === 'submenu') return { label: it.label, submenu: build(it.items) };
    // 菜单的 click 回调是在嵌套消息循环里跑的，开窗/退出这种事推到循环外面再做，
    // 不然在菜单自己还没收起时就去开新窗口，容易出怪毛病。
    const o = { label: it.label, click: () => setTimeout(() => send('menu:action', it.id), 0) };
    if (it.type === 'checkbox') { o.type = 'checkbox'; o.checked = !!it.checked; }
    else o.enabled = it.enabled !== false;
    return o;
  });
  const menu = Menu.buildFromTemplate(build(spec || []));
  lastMenu = menu;
  const wasFocusable = win.isFocusable();
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    menuOpen = false;
    lastMenu = null;
    send('menu:state', false);
    if (win && !win.isDestroyed()) {
      // 先把焦点让出去再收回「不可聚焦」：不然焦点可能留在我们身上，
      // 而你接下来敲键盘就跟掉进黑洞一样（看着也像卡死）
      try { if (!wasFocusable) win.blur(); } catch (e) { /* noop */ }
      try { win.setFocusable(wasFocusable); } catch (e) { /* noop */ }
    }
    if (onClosed) onClosed(true);
  };
  try { win.setFocusable(true); } catch (e) { /* noop */ }
  menuOpen = true;
  menuFinish = finish;
  send('menu:state', true);              // 让桌宠先站住，别在菜单底下走开
  menu.popup({ window: win, callback: finish });
  return true;
}

ipcMain.on('menu:open', (_e, spec) => {
  // 万一下一次弹出菜单时状态还卡在「开着」，先把它收干净。
  // 不这么做的话，只要有一次 callback 没回来，右键就永远没反应了。
  if (menuOpen) {
    try { if (lastMenu) lastMenu.closePopup(win); } catch (e) { /* noop */ }
    if (menuFinish) menuFinish();
  }
  showPetMenu(spec);
  // 兜底：菜单真的很久没关（比如你开了菜单就去干别的了），把状态复位，
  // 但不去强行关掉屏幕上那个菜单——那可能是你正在看的。
  setTimeout(() => {
    if (!menuOpen) return;
    if (win && !win.isDestroyed()) winwatch.dismissMenu(winwatch.hwndOf(win));
    if (menuFinish) menuFinish();
  }, 30000);
});
ipcMain.on('ui:settings', () => openSettings());
ipcMain.on('ui:name', () => openNamePrompt());
// 渲染进程要确认框就走这里（原生对话框），不要用 window.confirm
ipcMain.handle('ui:confirm', async (e, o) => {
  const parent = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showMessageBox(parent && !parent.isDestroyed() ? parent : undefined, {
    type: 'question',
    buttons: [I18N.t('confirm.cancel'), I18N.t('confirm.ok')],
    defaultId: 1, cancelId: 0, noLink: true,
    message: String((o && o.message) || I18N.t('confirm.def')),
    detail: (o && o.detail) ? String(o.detail) : undefined,
  });
  return r.response === 1;
});
ipcMain.handle('name:get', () => readSettings().name || '');
ipcMain.on('name:submit', (_e, v) => {
  const name = String(v == null ? '' : v).slice(0, 12);
  writeSettings({ name });            // 只改文字，showName 是独立开关，别跟着一起动
  send('name:set', name);
  if (nameWin && !nameWin.isDestroyed()) nameWin.close();
});
ipcMain.on('name:cancel', () => { if (nameWin && !nameWin.isDestroyed()) nameWin.close(); });
ipcMain.on('ui:chat', (_e, act) => (act === 'close' ? (chatWin && !chatWin.isDestroyed() ? chatWin.close() : null) : openChat()));
ipcMain.on('app:quit', () => app.quit());
ipcMain.handle('chat:send', async (_e, text) => {
  // 网络卡住时别让聊天窗的「正在回复」和小点永远转下去
  const guard = setTimeout(() => {
    if (abortCtl) { try { abortCtl.abort(); } catch (e) { /* noop */ } }
  }, 120000);
  try { await runChat(String(text || '')); return { ok: true }; }
  catch (e) {
    const msg = String((e && e.message) || e);
    send('chat:event', { type: 'error', text: msg });
    if (chatWin) chatWin.webContents.send('chat:event', { type: 'error', text: msg });
    return { ok: false, error: msg };
  } finally {
    clearTimeout(guard);
  }
});
ipcMain.on('chat:stop', () => { if (abortCtl) abortCtl.abort(); });
ipcMain.handle('win:watch-now', () => {
  const t0 = Date.now();
  const fg = winwatch.foreground(ownHwnd);
  return {
    ok: winwatch.supported(), error: winwatch.error(), cost: Date.now() - t0,
    fg: fg ? { title: fg.title, rect: clipRect(fg.rect), hung: !!fg.hung } : null,
  };
});
ipcMain.handle('chat:test', async (_e, text) => {
  const s = readSettings();
  if (!s.apiKey) return { ok: false, error: I18N.t('err.noKeyShort') };
  if (!s.apiModel) return { ok: false, error: I18N.t('err.noModelShort') };
  const order = s.apiProvider === 'openai' ? ['openai'] : s.apiProvider === 'anthropic' ? ['anthropic'] : ['anthropic', 'openai'];
  let last = null;
  for (const p of order) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25000);
    let got = '';
    try {
      await (p === 'anthropic' ? callAnthropic : callOpenAI)(
        Object.assign({}, s, { systemPrompt: '' }), String(text || I18N.t('test.hello')), ac.signal, (x) => { got += x; });
      clearTimeout(timer);
      return { ok: true, via: p, model: s.apiModel, sample: got.slice(0, 40) };
    } catch (e) {
      clearTimeout(timer);
      last = e;
      if (order.length > 1 && worthFallback(e)) continue;
      break;
    }
  }
  return { ok: false, error: String((last && last.message) || I18N.t('err.failed')) };
});

/* --------------------------------------------------------------- 启动 */
app.on('second-instance', () => { if (win) { win.show(); } });
app.whenReady().then(() => {
  // 先把语言定下来再建窗口，否则先开出来的那个标题/菜单是中文的
  I18N.setLang(readSettings().lang);
  createPetWindow();
  createTray();
  applyWindowPrefs();
  startWatch();
  const hidden = process.argv.includes('--hidden');
  if (hidden && win) { userHidden = true; win.hide(); }
  screen.on('display-metrics-changed', syncWindowToDisplay);
  screen.on('display-added', syncWindowToDisplay);
  screen.on('display-removed', syncWindowToDisplay);

  // 单独验托盘里那个「调试表情表」窗口：--sheet
  if (process.argv.includes('--sheet')) {
    const dw = openDevWindow('sheet');
    const logs = [];
    dw.webContents.on('console-message', (_e, lv, m, ln, src) => logs.push(lv + ':' + m + ' @' + String(src).split('/').pop() + ':' + ln));
    dw.webContents.once('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 2500));
      const info = await dw.webContents.executeJavaScript(
        "JSON.stringify({mode:new URLSearchParams(location.search).get('mode'),B:typeof B,"
        + "cw:document.getElementById('stage').clientWidth,ch:document.getElementById('stage').clientHeight,"
        + "t:typeof B!=='undefined'?+B.t.toFixed(1):-1})").catch((e) => 'ERR ' + e.message);
      console.log('SHEET', info, '| console:', JSON.stringify(logs).slice(0, 400));
      const url = await dw.webContents.executeJavaScript("document.getElementById('stage').toDataURL('image/png')").catch(() => '');
      if (url && url.length > 200) console.log('SHEET-SNAPSHOT', saveShot('sheet-snapshot.png', url));
      app.exit(0);
    });
    setTimeout(() => { console.log('SHEET-TIMEOUT'); app.exit(0); }, 12000);
  }

  // 自检：拉起窗口 → 跑 2.5 秒 → 把渲染进程里的真实状态吐到 stdout → 退出
  if (process.argv.includes('--selftest')) {
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log('RENDERER[' + level + ']', message, String(sourceId).split('/').slice(-1)[0] + ':' + line);
    });
    win.webContents.once('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 2500));
      const probe = `(async () => {
        const out = { state: Pet.state, t: +B.t.toFixed(2), x: Math.round(Pet.p.x), y: Math.round(Pet.p.y),
                      w: Pet.W, h: Pet.H, s: Pet.p.s, dpr: devicePixelRatio, hat: Settings.data.hat,
                      world: Pet.world.w + 'x' + Pet.world.h, cam: Math.round(Pet.cam.x) + ',' + Math.round(Pet.cam.y),
                      drawn: Math.round(Pet.X(Pet.p.x)) + ',' + Math.round(Pet.Y(Pet.p.y)) };
        // 模拟一次拖拽（40 帧连续移动），用来验证透明窗口不会叠出残影
        const cx = Pet.X(Pet.p.x), cy = Pet.Y(Pet.p.y);
        Pet.onDown(cx, cy);
        for (let i = 1; i <= 40; i++) { Pet.onMove(cx - i * 5, cy - i * 3); Pet.update(0.016); Pet.draw(); }
        window.dispatchEvent(new MouseEvent('mouseup', { clientX: cx - 200, clientY: cy - 120 }));
        await new Promise((r) => setTimeout(r, 120));
        Pet.update(0.016); Pet.draw();
        out.afterDrag = { state: Pet.state, x: Math.round(Pet.p.x), y: Math.round(Pet.p.y) };
        out.displays = Pet.disp.map((d) => d.id + ':' + d.x + ',' + d.y + ' ' + d.w + 'x' + d.h).join(' | ');
        out.spans = Pet.spans.map((s) => s.x + '+' + s.w).join(' | ');
        out.ground = Math.round(Pet.groundY());
        // 探头张望：造一个假前台窗口，看它能不能走过去 → 爬上去 → 探头 → 自己下来
        for (let i = 0; i < 200 && Pet.state !== 'idle'; i++) Pet.update(1 / 60);   // 先等它落地
        Pet.tryPeek({ x: 200, y: Math.round(Pet.floorY()) - 300, w: 420, h: 400 }, '自检窗口');
        out.peekStart = Pet.state;
        const seq = [];
        let lastSt = '';
        // 全程盯着单帧纵向跳变："看完了突然掉回任务栏"就是这一下大跳
        let maxJump = 0, jumpAt = '';
        for (let i = 0; i < 2400; i++) {
          const y0 = Pet.p.y;
          Pet.update(1 / 60);
          const jump = Math.abs(Pet.p.y - y0);
          if (jump > maxJump) { maxJump = jump; jumpAt = Pet.state + '/' + (Pet.phase || '-'); }
          if (Pet.state !== lastSt) { seq.push(Pet.state + (Pet.phase ? '/' + Pet.phase : '')); lastSt = Pet.state; }
          if (seq.length && seq[seq.length - 1] === 'idle' && seq.length > 2) break;
        }
        out.peek = {
          seq: seq.join('>'), endPlat: !!Pet.plat, endY: Math.round(Pet.p.y), floor: Math.round(Pet.floorY()),
          // 上限 8px/帧（就是爬墙的速度），超了就说明又变成"直接掉下去"了
          maxJump: Math.round(maxJump) + 'px@' + jumpAt,
          smooth: maxJump <= 8,
          // 必须有一段往下爬，不能只有 fall
          walkedBackDown: seq.some((s) => s.startsWith('chase/down')) && seq.some((s) => s.startsWith('climb')),
        };
        // 空闲回来打招呼
        Pet.away = 400; Pet.welcomeBack();
        out.greet = Pet.state + '/' + (Pet.bubble && Pet.bubble.text);
        for (let i = 0; i < 200; i++) Pet.update(1 / 60);
        out.greetAfter = Pet.state;
        // 等回复的小点
        Pet.thinking(true); Pet.update(1 / 60); Pet.draw();
        out.thinking = !!(Pet.bubble && Pet.bubble.thinking);
        Pet.sayChat('嗨'); Pet.update(1 / 60);
        out.thinkingOff = !!(Pet.bubble && !Pet.bubble.thinking);
        out.watch = await window.petHost.watchNow();
        // 头部会不会被切：把"平台"顶到屏幕最上沿（最大化窗口就是这种），再扫画布第一行有没有像素。
        // 以前 wantCam 的上下留白是写死的 bh*0.26，大尺寸往上爬时脑袋会顶出画布。
        const savedHat2 = Settings.data.hat, savedSize = Settings.data.size;
        Settings.data.hat = 'party';                 // 最高的那顶帽子，最坏情况
        const stage = document.getElementById('stage');
        // 用一块独立的小画布看画布顶部几行有没有像素（直接对主 ctx 反复 getImageData 会被
        // Chromium 提醒 willReadFrequently，看着很吓人）
        const scan = document.createElement('canvas');
        scan.width = stage.width; scan.height = 4;
        const sctx = scan.getContext('2d', { willReadFrequently: true });
        const cutRows = () => {
          sctx.clearRect(0, 0, scan.width, scan.height);
          sctx.drawImage(stage, 0, 0, scan.width, 4, 0, 0, scan.width, 4);
          const d = sctx.getImageData(0, 0, scan.width, 4).data;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return (i / 4 / scan.width) | 0;
          return -1;
        };
        // 每个尺寸都拿"最大化窗口的标题栏"（贴着屏幕最上沿）试一遍，头顶都不能出界
        out.highPeek = [90, 120, 150, 200, 260].map((sz) => {
          Settings.data.size = sz; Pet.p.s = sz;
          Pet.plat = null; Pet.lastGround = null; Pet.enter('idle');
          Pet.p.y = Pet.floorY(); Pet.snapCam();
          Pet.tryPeek({ x: 0, y: Pet.world.y0, w: Pet.world.w, h: 900 }, '最大化窗口');
          // 这里只验「站上去之后头顶会不会被切」，不贑它真的走过去（那段路验在 peek.seq 里），
          // 所以直接把它摆到 tryPeek 算出来的平台上
          if (Pet.plat) {
            Pet.p.x = Pet.plat.x + Pet.p.s * 0.55;
            Pet.p.y = Pet.plat.y;
            Pet.enter('peek', 8);
          }
          for (let i = 0; i < 60; i++) Pet.update(1 / 60);        // 让探头拉伸到位
          Pet.draw();
          const cut = cutRows();
          return sz + ':' + (Pet.state === 'peek' ? (cut < 0 ? 'ok' : 'CUT@' + cut) : Pet.state)
            + '(top' + Math.round(Pet.Y(Pet.p.y) - Pet.headroom()) + ',feet' + Math.round(Pet.Y(Pet.p.y)) + ')';
        }).join(' ');
        Settings.data.hat = savedHat2; Settings.data.size = savedSize; Pet.p.s = savedSize;
        Pet.plat = null; Pet.lastGround = null; Pet.enter('idle'); Pet.p.y = Pet.floorY(); Pet.snapCam();
        // 造一个双屏布局验一下多屏逻辑：相邻屏应该合并成一段，鼠标在另一块屏时它会走过去
        const savedDisp = Pet.disp.slice(), savedX = Pet.p.x, savedState = Pet.state;
        Pet.setDisplays([{ id: 1, x: 0, y: 0, w: 1920, h: 1080 }, { id: 2, x: 1920, y: 120, w: 1280, h: 1000 }]);
        Pet.p.x = 400; Pet.p.vx = 0; Pet.enter('idle');
        const g1 = Math.round(Pet.groundY());
        Pet.onCursor({ x: 2600, y: 500, id: 2 });
        const want = Pet.hopTarget;
        for (let i = 0; i < 1200 && Pet.p.x < 2200; i++) Pet.update(0.033);
        out.multi = { spans: Pet.spans.map((s) => s.x + '+' + s.w).join('|'), groundL: g1, groundR: Math.round(Pet.groundY()),
                      hopTarget: Math.round(want), crossedX: Math.round(Pet.p.x), state: Pet.state };
        Pet.setDisplays(savedDisp); Pet.p.x = savedX; Pet.p.vx = 0; Pet.enter(savedState); Pet.snapCam();
        // 顺手量一下帧时间，走路卡不卡看得见数字
        const ft = []; let lp = performance.now();
        await new Promise((res) => { let n = 0; const f = () => { const now = performance.now(); ft.push(now - lp); lp = now; if (++n < 70) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
        const tail = ft.slice(12);
        out.frameMs = +(tail.reduce((a, b) => a + b, 0) / tail.length).toFixed(1);
        out.getSettings = await window.petHost.getSettings();
        out.saved = await window.petHost.saveSettings({ hat: (out.getSettings || {}).hat || '' });
        out.menuItems = menuSpec().length;
        // ---- i18n：两种语言都得能取到非空文案，切过去菜单/台词要真的变，切回来能复原 ----
        const lang0 = (out.getSettings || {}).lang || 'zh';
        const L = {
          cur: I18N.getLang(),
          zhMenu: I18N.tIn('zh', 'menu.walk'), enMenu: I18N.tIn('en', 'menu.walk'),
          zhPet: I18N.tIn('zh', 'pet.chatOn'), enPet: I18N.tIn('en', 'pet.chatOn'),
          zhLines: I18N.linesIn('zh', 'lines.idle').length, enLines: I18N.linesIn('en', 'lines.idle').length,
        };
        // 别出现「key 没建、把 key 本身显示出来」的情况
        L.differs = L.zhMenu !== L.enMenu && L.zhPet !== L.enPet;
        L.complete = [L.zhMenu, L.enMenu, L.zhPet, L.enPet].every((x) => !!x && !/^(menu|pet|chat|err)\\./.test(x));
        // 真切一次：右键菜单规格和桌宠台词都得跟着换
        I18N.setLang('en'); Settings.data.lang = 'en';
        L.enSpec = (menuSpec().find((i) => i.id === 'toggle:walk') || {}).label;
        L.enBubble = I18N.lines('lines.idle')[0];
        I18N.setLang(lang0); Settings.data.lang = lang0;
        L.zhSpec = (menuSpec().find((i) => i.id === 'toggle:walk') || {}).label;
        L.restored = I18N.getLang() === lang0;
        // 存盘 → 主进程 → 读回这一整圈也要通（自检用的是独立的 userData，不会碰你的设置）
        await window.petHost.saveSettings({ lang: 'en' });
        L.saved = (await window.petHost.getSettings()).lang;
        await window.petHost.saveSettings({ lang: lang0 });
        L.persisted = (await window.petHost.getSettings()).lang;
        I18N.setLang(lang0); Settings.data.lang = lang0;
        L.ok = L.differs && L.complete && L.enSpec === L.enMenu && L.zhSpec === L.zhMenu
          && L.restored && L.saved === 'en' && L.persisted === lang0
          && L.zhLines >= 3 && L.enLines >= 3 && !!L.enBubble;
        out.i18n = L;
        // ---- 下面这堆是“自己查出来、自己修掉”的 bug 的回归断言 ----
        const Q = {};
        const S0 = JSON.parse(JSON.stringify(Settings.data));
        // B1/B2 右键菜单的尺寸列表以前是 [100,150,200,260]，设置窗下拉是 [90,120,150,200,260]。
        // 在菜单里选 100px 再去设置窗保存，下拉框没有这一项 → value 被置空 →
        // Number('')=0 → s=0，既画不出来也点不到，只能杀进程。现在两边同一份列表。
        Q.sizeChoices = SIZE_CHOICES.join(',');
        Q.menuSizes = SIZES.join(',');
        Q.sameList = Q.sizeChoices === Q.menuSizes;
        const badSize = (v) => { Settings.data.size = v; Settings.sanitize(); return Settings.data.size; };
        Q.from100 = badSize(100);          // 旧菜单选出来的值：就近归一，不能丢设置
        Q.from0 = badSize(0);
        Q.fromNaN = badSize('abc');
        Q.fromHuge = badSize(9999);
        Q.fromMinus = badSize(-50);
        Settings.data.temperature = 'x'; Settings.sanitize();
        Q.temp = Settings.data.temperature;
        Settings.data.lang = 'fr'; Settings.sanitize();
        Q.lang = Settings.data.lang;
        Q.allSane = [Q.from100, Q.from0, Q.fromNaN, Q.fromHuge, Q.fromMinus].indexOf(0) < 0
          && SIZE_CHOICES.indexOf(Q.from100) >= 0 && Q.temp === 0.8 && Q.lang === 'zh';
        // 万一有人绕过 Settings 直接改 Settings.data.size，Pet 自己也得兜住
        Settings.data.size = 0; Pet.applySettings();
        Q.petS0 = Pet.p.s;
        Q.petHit0 = Pet.hit(Pet.X(Pet.p.x), Pet.Y(Pet.p.y) - Pet.p.s * 0.47);
        Settings.data = S0; Pet.applySettings();
        // B3 英文断行：单词不能被拦腰截断（中文按字断不受影响）
        const enSrc = 'Still clocking in today and the deadline is tomorrow morning';
        const wrapped = handWrap(enSrc, 14, 140);
        Q.wrapEn = wrapped.join(' | ');
        // 拼回去（中间用单空格）应该等于原文：说明只在空格处断过行
        Q.wrapWordSafe = wrapped.join(' ').replace(/ +/g, ' ') === enSrc;
        const cnSrc = '今天也搬砖呢，摸鱼中，螃蟹也会腰疼';
        const wcn = handWrap(cnSrc, 14, 140);
        Q.wrapCnOk = wcn.join('') === cnSrc && wcn.length > 1;
        // B4 长回复的气泡不能整块掉出画布（以前会翻到脚下 y=504，窗口才 480 高）
        Pet.plat = null; Pet.enter('idle'); Pet.p.y = Pet.floorY(); Pet.snapCam();
        const longEn = 'This is a fairly long english reply streaming back from the model and it simply keeps going on and on and on ';
        Pet.sayChat(longEn.repeat(16));
        Pet.bubble.shown = Pet.bubble.text.length;   // 跳过逐字动画，直接量成品
        Pet.draw();
        const bb = Pet.bubbleBox || {};
        Q.bubble = { lines: bb.lines, y: Math.round(bb.y || 0), h: Math.round(bb.h || 0), below: !!bb.below, H: Pet.H };
        Q.bubbleInside = !!bb.y && bb.y >= 0 && bb.y + bb.h <= Pet.H + 1 && bb.x >= 0 && bb.x + bb.w <= Pet.W + 1;
        Q.linesCapped = bb.lines >= 1 && bb.lines <= 7;    // 超长回复只留最后 7 行（完整内容在聊天窗）
        Pet.bubble.shown = 0; Pet.sayChat(longEn.repeat(2)); Pet.draw();
        const bb2 = Pet.bubbleBox || {};
        Q.bubbleShort = { lines: bb2.lines, below: !!bb2.below };
        Q.bubbleNormal = bb2.lines >= 1 && !bb2.below;
        // B8 气泡必须真的包住字：hand() 是逐字符画的（字符间还有 gap），
        // measureText(整句) 会少算 50px 左右，拿它算宽度 → 字捅出气泡两边
        const sz8 = clamp(Pet.p.s * 0.085, 11, 22);
        const mw8 = Math.min(clamp(Pet.p.s * 3.1, 130, 460), Math.max(80, Pet.W - 20));
        const txt8 = longEn.repeat(4);
        let widest8 = 0;
        for (const l of handWrap(txt8, sz8, mw8)) widest8 = Math.max(widest8, handWidth(l, sz8));
        Pet.sayChat(txt8); Pet.bubble.shown = Pet.bubble.text.length; Pet.draw();
        const bb8 = Pet.bubbleBox || {};
        Q.textFits = { widestLine: Math.round(widest8), boxW: Math.round(bb8.w || 0), boxH: Math.round(bb8.h || 0), over: Math.round(widest8 - (bb8.w || 0)) };
        Q.textFitsOk = widest8 <= (bb8.w || 0) + 0.5;
        Pet.clearBubble(); Pet.bubbleBox = null;
        // ---- B9 探头期间窗口被最小化 → 必须掉下来（不能悬在空中）----
        // 复现用户说的那个场景：它正好站在弹窗标题栏上，用户把那个弹窗最小化了。
        // 之前 onWatch 里 minimized 直接 return，plat 留着，桌宠就永远挂在半空。
        Pet.plat = null; Pet.lastGround = null; Pet.enter('idle'); Pet.p.y = Pet.floorY(); Pet.snapCam();
        for (let i = 0; i < 120 && Pet.state !== 'idle'; i++) Pet.update(1 / 60);
        Pet.tryPeek({ x: 200, y: Math.round(Pet.floorY()) - 300, w: 420, h: 400 }, '会被最小化的窗口');
        // 推到它已经站上标题栏（peek）为止
        for (let i = 0; i < 3000 && Pet.state !== 'peek'; i++) Pet.update(1 / 60);
        const minBefore = { state: Pet.state, onPlat: !!Pet.plat, y: Math.round(Pet.p.y) };
        // 现在那个窗口被最小化了：前台变成别的东西，标题也不一样了
        Pet.onWatch({ title: '别的窗口', rect: { x: 900, y: 400, w: 500, h: 300 }, minimized: false, locked: false, idle: 3, supported: true });
        const minAfterEvent = { state: Pet.state, plat: !!Pet.plat };
        // 跑完整个下落过程
        let landed = false;
        for (let i = 0; i < 600; i++) { Pet.update(1 / 60); if (!Pet.plat && Pet.state === 'idle') { landed = true; break; } }
        const minAfter = { state: Pet.state, plat: !!Pet.plat, y: Math.round(Pet.p.y), floor: Math.round(Pet.floorY()) };
        Q.minimizeDrops = {
          before: minBefore, afterEvent: minAfterEvent, after: minAfter,
          wasOnPlat: minBefore.onPlat,
          droppedImmediately: !minAfterEvent.plat && minAfterEvent.state !== 'peek',
          reachedFloor: landed && Math.abs(minAfter.y - minAfter.floor) < 2,
        };
        Q.minimizeDropsOk = minBefore.onPlat && Q.minimizeDrops.droppedImmediately && Q.minimizeDrops.reachedFloor;

        // ---- B10 走路/赶路/爬墙时腿必须在动 ----
        // 以前 draw() 只在 state==='walk' 时把 p.walk 传给 clawd，
        // chase 和 climb 里相位明明在推进却画成静止的腿（直着滑过去）。
        const legPhase = (st) => {
          const keep = Pet.state, keepPlat = Pet.plat, keepWalk = Pet.p.walk;
          Pet.state = st; Pet.plat = keepPlat;
          Pet.draw();
          // clawd 收到的 o.walk 就是相位；直接复算一遍判定条件
          const stepping = st === 'walk' || st === 'chase' || st === 'climb';
          Pet.state = keep; Pet.plat = keepPlat; Pet.p.walk = keepWalk;
          return stepping;
        };
        Q.legs = { walk: legPhase('walk'), chase: legPhase('chase'), climb: legPhase('climb'), peek: legPhase('peek') };
        Q.legsOk = Q.legs.walk && Q.legs.chase && Q.legs.climb && !Q.legs.peek;
        // 相位本身要真的在推进（不然给了也是死的）
        Pet.plat = null; Pet.enter('idle'); Pet.p.y = Pet.floorY();
        Pet.chaseTo(Pet.p.x + 400, 'wall');
        const w0 = Pet.p.walk;
        for (let i = 0; i < 30; i++) Pet.update(1 / 60);
        Q.legs.chasePhaseMoved = Math.abs(Pet.p.walk - w0) > 0.1;
        Pet.enter('idle'); Pet.hopTarget = 0;

        // B5 切语言后人设要真的跟着换（主进程那一侧），而且改过的人设不能被冲掉
        const p0 = (await window.petHost.getSettings()).systemPrompt;
        await window.petHost.saveSettings({ lang: 'en' });
        const pEn = (await window.petHost.getSettings()).systemPrompt;
        await window.petHost.saveSettings({ lang: L.cur });
        const pBack = (await window.petHost.getSettings()).systemPrompt;
        await window.petHost.saveSettings({ systemPrompt: 'MY OWN PERSONA' });
        await window.petHost.saveSettings({ lang: L.cur === 'zh' ? 'en' : 'zh' });
        const pKeep = (await window.petHost.getSettings()).systemPrompt;
        await window.petHost.saveSettings({ systemPrompt: p0, lang: L.cur });
        Q.promptFollowsLang = pEn === I18N.promptFor('en') && pEn !== p0 && pBack === p0;
        Q.promptKeptCustom = pKeep === 'MY OWN PERSONA';
        // B6 报错前缀也得跟着语言走
        Q.hmm = { zh: I18N.tIn('zh', 'chat.hmm'), en: I18N.tIn('en', 'chat.hmm') };
        Q.hmmOk = !!Q.hmm.zh && !!Q.hmm.en && Q.hmm.zh !== Q.hmm.en;
        Settings.data = S0; Pet.applySettings(); I18N.setLang(L.cur);
        Q.ok = Q.sameList && Q.allSane && Q.petS0 > 0 && Q.petHit0 && Q.wrapWordSafe && Q.wrapCnOk
          && Q.bubbleInside && Q.linesCapped && Q.bubbleNormal && Q.textFitsOk
          && Q.promptFollowsLang && Q.promptKeptCustom && Q.hmmOk
          && Q.minimizeDropsOk && Q.legsOk && Q.legs.chasePhaseMoved;
        out.sanity = Q;
        out.chatNoKey = await window.petHost.chatSend('hi');
        out.chatNoModel = (await window.petHost.testApi('hi')).error;
        return JSON.stringify(out);
      })()`;
      try {
        console.log('SELFTEST', await win.webContents.executeJavaScript(probe));
        // 菜单开着时它应该站住不动（右键卡死那个 bug 的配套行为）
        send('menu:state', true);
        await new Promise((r) => setTimeout(r, 150));
        const pausedOn = await win.webContents.executeJavaScript(
          "(()=>{const x=Pet.p.x;for(let i=0;i<60;i++)Pet.update(1/60);return JSON.stringify({paused:Pet.paused,held:Math.abs(Pet.p.x-x)<0.01});})()");
        send('menu:state', false);
        await new Promise((r) => setTimeout(r, 150));
        const pausedOff = await win.webContents.executeJavaScript('String(Pet.paused)');
        // 验 name:set 这条 IPC。注意：它落到的是你真实的设置文件，
        // 所以测完必须改回去（之前这里把用户的名牌直接改成了「自检蟹」）。
        const nameBefore = (await win.webContents.executeJavaScript('String(Settings.data.name)')) || '';
        send('name:set', '自检蟹');
        await new Promise((r) => setTimeout(r, 150));
        const named = await win.webContents.executeJavaScript('JSON.stringify({n:Settings.data.name,s:Settings.data.showName})');
        send('name:set', nameBefore);
        await new Promise((r) => setTimeout(r, 150));
        const restored = await win.webContents.executeJavaScript('String(Settings.data.name)');
        console.log('IPC', JSON.stringify({
          menuState: JSON.parse(pausedOn), pausedOff, named: JSON.parse(named),
          nameRestored: restored === nameBefore,
        }));

        // 右键菜单不能再卡死：弹出来 → 用 WM_CANCELMODE 收掉 → callback 必须回来。
        // 以前窗口是 focusable:false，菜单的模态循环收不回来，callback 永远不触发，
        // 主进程的所有 IPC 就堵死了（桌宠也不动了）。
        const focusBefore = win.isFocusable();
        const oneMenu = () => new Promise((resolve) => {
          const t0 = Date.now();
          let armed = false;
          const t = setTimeout(() => {
            armed = true;                       // 确认菜单真的开着才动手收，否则就成了自我验证
            winwatch.dismissMenu(winwatch.hwndOf(win));
          }, 700);
          const dead = setTimeout(() => { clearTimeout(t); resolve({ r: 'STUCK', ms: Date.now() - t0 }); }, 6000);
          const ok = showPetMenu([{ type: 'normal', label: '自检项', id: 'noop' }], () => {
            clearTimeout(t); clearTimeout(dead);
            resolve({ r: 'closed-ok', ms: Date.now() - t0, viaDismiss: armed });
          });
          if (!ok) { clearTimeout(t); clearTimeout(dead); resolve({ r: 'not-opened', ms: 0 }); }
        });
        // 连开两轮：第二轮能开，说明上一轮的状态确实复位了（否则右键就永久失灵）
        const menuTest = await oneMenu();
        const menuTest2 = await oneMenu();
        await new Promise((r) => setTimeout(r, 200));
        console.log('MENU', JSON.stringify(Object.assign(menuTest, {
          again: menuTest2.r, focusBefore, focusAfter: win.isFocusable(),
          menuOpen, petPaused: await win.webContents.executeJavaScript('Pet.paused'),
        })));

        // 两个看门狗：菜单关闭通知丢了、或者拖拽的 mouseup 没收到的时时候，
        // 都不能让桌宠永远定在那里。
        const guard = await win.webContents.executeJavaScript(`(() => {
          const out = {};
          // 〇 单击（摸头）不能把状态永远留在 'drag'。以前它只 poke() 不换状态，
          //   结果就是永远睁着大眼睛（face() 的 drag 分支）且再也不走路。
          Pet.plat = null; Pet.paused = false; Pet.p.s = Settings.data.size;
          Pet.p.y = Pet.floorY(); Pet.enter('idle'); Pet.drag = null;
          const cx = Pet.X(Pet.p.x), cy = Pet.Y(Pet.p.y);
          Pet.onDown(cx, cy);                       // 按下
          const wasDrag = Pet.state === 'drag';
          Pet.onUp(cx, cy);                         // 原地松开 = 摸头
          out.tapReleased = wasDrag && Pet.state !== 'drag' && !Pet.drag;
          out.tapFace = Pet.face().eyes;
          // 再跑一会儿，确认它真的能自己走起来
          for (let i = 0; i < 60 * 30 && Pet.state === 'idle'; i++) Pet.update(1 / 60);
          out.tapCanMove = Pet.state !== 'drag';
          // ① 不变量：state === 'drag' 但没有 this.drag，必须自己回地面
          Pet.drag = null; Pet.state = 'drag';
          Pet.update(1 / 60);
          out.orphanDragHealed = Pet.state !== 'drag';
          // ② 跳舞能进也能出（以前 pet.js 里根本没人 enter('dance')，是个死开关）
          Pet.plat = null; Pet.enter('idle'); Pet.p.y = Pet.floorY(); Pet.snapCam();
          Pet.setDance(true);
          out.danceEntered = Pet.state === 'dance';
          for (let i = 0; i < 60 * 15 && Pet.state === 'dance'; i++) Pet.update(1 / 60);
          out.danceExited = Pet.state !== 'dance';
          Pet.setDance(false);
          // ④ 长距离赶路不能被「放弃」逻辑砍断：从屏幕一头走到另一头本来就要几十秒
          Pet.plat = null; Pet.paused = false; Pet.p.s = Settings.data.size;
          Pet.enter('idle'); Pet.p.y = Pet.floorY(); Pet.p.vx = 0;
          Pet.p.x = Pet.world.x0 + 80;
          const farGoal = Pet.world.x0 + Pet.world.w - 80;
          const x0 = Pet.p.x;
          Pet.chaseTo(farGoal, 'top');
          let frames = 0;
          while (frames < 60 * 90 && Pet.state === 'chase') { Pet.update(1 / 60); frames++; }
          out.longChase = { frames, traveled: Math.round(Pet.p.x - x0), arrived: Math.abs(Pet.p.x - farGoal) < Pet.p.s };
          Pet.plat = null; Pet.enter('idle'); Pet.p.y = Pet.floorY();
          // ③ chase 目标够不到时不能永远追（探头时窗口被屏幕边界挡住就会这样）
          // 从左边边缘附近出发，这样一秒就能抵到墙、再花 2.5 秒确认“到不了”
          Pet.plat = null; Pet.enter('idle'); Pet.p.y = Pet.floorY();
          Pet.p.x = Pet.world.x0 + 90;
          Pet.chaseTo(-99999, 'wall');
          out.chaseStarted = Pet.state === 'chase';
          for (let i = 0; i < 60 * 12 && Pet.state === 'chase'; i++) Pet.update(1 / 60);
          out.chaseGaveUp = Pet.state !== 'chase';
          // ① 暂停超时自愈
          Pet.paused = true; Pet.pausedT = 0;
          for (let i = 0; i < 60 * 25; i++) Pet.update(1 / 60);
          out.pauseHealed = !Pet.paused;
          // ② 拖拽看门狗（而且暂停中也要生效——它以前被 paused 的 early-return 挡住了）
          Pet.paused = true; Pet.pausedT = 0; Pet.enter('idle');
          Pet.p.s = Settings.data.size; Pet.p.y = Pet.floorY();
          Pet.drag = { dx: 0, dy: 0, vx: 0, vy: 0, moved: 0, age: 5 };
          Pet.update(1 / 60);
          out.dragDropped = !Pet.drag && Pet.state !== 'drag';
          Pet.paused = false; Pet.update(1 / 60);
          return JSON.stringify(out);
        })()`);
        console.log('GUARD', guard);

        // 聊天窗：等回复时必须是「三个点的小气泡」，不是一条空长条。
        // 直接从主进程推真的 chat:event（走 preload 的 onChat），再量 DOM 宽度。
        openChat();
        await new Promise((r) => {
          if (!chatWin || chatWin.isDestroyed()) return r();
          if (!chatWin.webContents.isLoading()) return r();
          chatWin.webContents.once('did-finish-load', r);
          setTimeout(r, 4000);
        });
        await new Promise((r) => setTimeout(r, 500));
        const chatEval = (js) => chatWin.webContents.executeJavaScript(js);
        const dims = `(() => { const log = document.getElementById('log');
          const e = log.lastElementChild;
          return JSON.stringify({ logW: Math.round(log.clientWidth),
            w: e ? Math.round(e.getBoundingClientRect().width) : -1,
            cls: e ? e.className : '', text: e ? e.textContent : '',
            dots: e ? e.querySelectorAll('i').length : 0 }); })()`;
        const chatOut = {};
        await chatEval('document.getElementById("log").innerHTML = ""');
        chatWin.webContents.send('chat:event', { type: 'start' });
        await new Promise((r) => setTimeout(r, 200));
        Object.assign(chatOut, { waiting: JSON.parse(await chatEval(dims)) });
        // 存一张「等回复」时聊天窗的图，方便肉眼看是不是小气泡
        await new Promise((r) => setTimeout(r, 250));
        try {
          const shot = await chatWin.webContents.capturePage();
          console.log('CHAT-SHOT', saveShot('chat-thinking.png', 'data:image/png;base64,' + shot.toPNG().toString('base64')));
        } catch (e) { console.log('CHAT-SHOT-ERR', e.message); }
        chatWin.webContents.send('chat:event', { type: 'delta', text: '你好呀' });
        await new Promise((r) => setTimeout(r, 200));
        Object.assign(chatOut, { afterFirst: JSON.parse(await chatEval(dims)) });
        chatWin.webContents.send('chat:event', { type: 'delta', text: '，我在呢' });
        chatWin.webContents.send('chat:event', { type: 'done' });
        await new Promise((r) => setTimeout(r, 200));
        Object.assign(chatOut, { afterDone: JSON.parse(await chatEval(dims)) });
        // 一个字都没回：三个点得自己收掉，不能留个空气泡
        chatWin.webContents.send('chat:event', { type: 'start' });
        await new Promise((r) => setTimeout(r, 150));
        chatWin.webContents.send('chat:event', { type: 'done' });
        await new Promise((r) => setTimeout(r, 200));
        chatOut.emptyDone = JSON.parse(await chatEval(dims));
        // 窄气泡：宽度得明显小于整行（以前是块级元素，会占满一整行）
        chatOut.thinkingIsTiny = chatOut.waiting.w > 0 && chatOut.waiting.w < chatOut.waiting.logW * 0.4;
        chatOut.hasThreeDots = chatOut.waiting.dots === 3;
        console.log('CHAT', JSON.stringify(chatOut));
        if (chatWin && !chatWin.isDestroyed()) { chatWin.close(); chatWin = null; }

        // 设置窗的中英切换：静态文案全靠 data-i18n，这里最容易漏（主进程标题也得跟着换）
        openSettings();
        await new Promise((r) => {
          if (!settingsWin || settingsWin.isDestroyed()) return r();
          if (!settingsWin.webContents.isLoading()) return r();
          settingsWin.webContents.once('did-finish-load', r);
          setTimeout(r, 4000);
        });
        await new Promise((r) => setTimeout(r, 600));
        const uiOut = {};
        const setEval = (js) => settingsWin.webContents.executeJavaScript(js).catch((e) => 'ERR ' + e.message);
        const snapUi = async (tag) => {
          uiOut[tag] = JSON.parse(await setEval(
            "JSON.stringify({save:document.getElementById('save').textContent,"
            + "h2:document.querySelector('h2').textContent,"
            + "hat:document.getElementById('hat').options[1].textContent,"
            + "ph:document.getElementById('name').placeholder,"
            + "html:document.documentElement.lang,docTitle:document.title})"));
          uiOut[tag].winTitle = settingsWin.getTitle();
        };
        await snapUi('zh');
        // 改下拉框 → 保存 → 主进程 applyLang → 广播 → 这个窗自己刷一遍
        await setEval("(()=>{const e=document.getElementById('lang');e.value='en';e.dispatchEvent(new Event('change'));document.getElementById('save').click();})()");
        await new Promise((r) => setTimeout(r, 500));
        await snapUi('en');
        await setEval("(()=>{const e=document.getElementById('lang');e.value='zh';document.getElementById('save').click();})()");
        await new Promise((r) => setTimeout(r, 500));
        await snapUi('back');
        uiOut.switched = uiOut.zh.save !== uiOut.en.save && uiOut.zh.save === uiOut.back.save;
        uiOut.sameLang = uiOut.en.html === 'en' && uiOut.zh.html === 'zh-CN' && uiOut.back.html === 'zh-CN';
        uiOut.titlesDiffer = uiOut.en.winTitle !== uiOut.zh.winTitle;
        uiOut.ok = uiOut.switched && uiOut.sameLang && uiOut.titlesDiffer
          && uiOut.en.hat === 'Party hat' && uiOut.zh.hat === '派对帽' && !!uiOut.en.ph;
        console.log('UI', JSON.stringify(uiOut));
        if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.close(); settingsWin = null; }
        // 顺手把桌宠窗口的画布存一张，方便核对透明窗口里到底长什么样（有没有残影等）
        const dataUrl = await win.webContents.executeJavaScript("document.getElementById('stage').toDataURL('image/png')");
        console.log('SNAPSHOT', saveShot('pet-snapshot.png', dataUrl) || '(没截到)');
      } catch (e) {
        console.log('SELFTEST-ERR', e.message);
      }
      app.exit(0);            // 自检跑完就退，不占着单实例锁
    });
    setTimeout(() => { console.log('SELFTEST-TIMEOUT'); app.exit(1); }, 30000);
  }
});

app.on('window-all-closed', (e) => { /* 桌宠常驻，不退出 */ void e; });
app.on('before-quit', () => { if (tray) tray.destroy(); });
