// winwatch.js — 主进程侧的「桌面观察员」。
// 两件事：
//   1. 用 koffi 调 Win32 读前台窗口的标题和矩形 —— 给渲染进程做「爬到窗口标题栏探头张望」。
//   2. 用 Electron 自带的 powerMonitor 拿锁屏/解锁 + 系统空闲秒数 —— 给「你回来啦」打招呼。
// koffi 装不上或者调用失败都只降级不崩：supported=false 时桌宠照常跑，只是这两个新动作不出来。
'use strict';
// electron 延迟到 start() 里再 require：这样 Win32 那一层可以在普通 node 里单独跑，方便调。
let powerMonitor = null;

let K = null;
let loadErr = '';

const WM_GETTEXT = 0x000d;
const SMTO_ABORTIFHUNG = 0x0002;
const SMTO_BLOCK = 0x0001;
const DWMWA_EXTENDED_FRAME_BOUNDS = 9;
const MSG_TIMEOUT_MS = 120;          // 读不到的窗口最多等这么点时间，绝不拖住主进程

function load() {
  if (K || loadErr) return K;
  try {
    const koffi = require('koffi');
    const u = koffi.load('user32.dll');
    let dwm = null;
    try { dwm = koffi.load('dwmapi.dll'); } catch (e) { dwm = null; }
    try { koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' }); }
    catch (e) { /* 这个名字已经定义过了（重复 require），忽略 */ }
    K = {
      koffi,
      fg: u.func('void* __stdcall GetForegroundWindow()'),
      // 关键：不能用 GetWindowTextW。跨进程读标题内部是 SendMessage(WM_GETTEXT)，
      // 对方窗口所在线程一忙（卡住、在跑重活、无响应）这边就会**无限期阻塞**，
      // 而这是主进程——整个桌宠连同窗口跟随、托盘、IPC 全部一起冻住。
      // SendMessageTimeoutW + SMTO_ABORTIFHUNG 是官方给这种情况的解法：超时就返回。
      textTimeout: u.func('intptr __stdcall SendMessageTimeoutW(void* hWnd, uint32 msg, intptr wParam, intptr lParam, uint32 flags, uint32 timeout, uintptr* result)'),
      hung: u.func('bool __stdcall IsHungAppWindow(void* hWnd)'),
      // 矩形优先走 DWM：它读的是窗口的属性，不发跨进程消息，不会阻塞
      dwmRect: dwm ? dwm.func('int __stdcall DwmGetWindowAttribute(void* hWnd, uint32 attr, RECT* pvAttribute, uint32 cbAttribute)') : null,
      rect: u.func('int __stdcall GetWindowRect(void* hWnd, RECT* lpRect)'),
      iconic: u.func('bool __stdcall IsIconic(void* hWnd)'),
      visible: u.func('bool __stdcall IsWindowVisible(void* hWnd)'),
      post: u.func('bool __stdcall PostMessageW(void* hWnd, uint32 msg, int wParam, int lParam)'),
      buf: Buffer.alloc(1024),   // 复用，别每次分配
      bufPtr: 0,
      out: koffi.alloc('uintptr', 1),
      rp: koffi.alloc('RECT', 1),
    };
    K.bufPtr = Number(koffi.address(K.buf));
  } catch (e) {
    loadErr = String((e && e.message) || e);
    console.warn('[winwatch] 读不了前台窗口，「探头张望」停用：', loadErr);
  }
  return K;
}

// 带超时的取标题：拿不到就返回空字符串，绝不阻塞
function titleOf(k, h) {
  const r = k.textTimeout(h, WM_GETTEXT, 512, k.bufPtr,
    SMTO_ABORTIFHUNG | SMTO_BLOCK, MSG_TIMEOUT_MS, k.out);
  if (!r) return '';                                        // 超时 / 窗口没了
  const n = Number(k.koffi.decode(k.out, 'uintptr')) || 0;
  if (n <= 0) return '';
  return k.buf.toString('utf16le', 0, Math.min(n, 511) * 2).replace(/\0+$/, '');
}

function rectOf(k, h) {
  if (k.dwmRect && k.dwmRect(h, DWMWA_EXTENDED_FRAME_BOUNDS, k.rp, 16) === 0) {
    const r = k.koffi.decode(k.rp, 'RECT');
    return { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top };
  }
  if (!k.rect(h, k.rp)) return null;
  const r = k.koffi.decode(k.rp, 'RECT');
  return { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top };
}

// 读一次前台窗口。ownHwnd 是我们自己窗口的原生句柄集合，别把自己的聊天窗当成前台。
function foreground(ownHwnd) {
  const k = load();
  if (!k) return null;
  try {
    const h = k.fg();
    if (!h) return null;
    if (ownHwnd && ownHwnd.has(String(h))) return null;
    // 已经卡住的窗口直接跳过：既省时间，也避开"刚好在检查之后卡住"那道窄缝
    if (k.hung(h)) return { title: '', rect: null, minimized: true, visible: true, hung: true, hwnd: String(h) };
    const title = titleOf(k, h);
    return {
      title,
      hwnd: String(h),
      rect: rectOf(k, h),
      minimized: !!k.iconic(h),
      visible: !!k.visible(h),
      hung: false,
    };
  } catch (e) {
    return null;
  }
}

/**
 * 每秒采一次样推给渲染进程。start(app 起来之后调用)。
 * onSample({ title, hwnd, rect, idle, locked, supported })
 *   idle    —— 距离上次键鼠输入的秒数
 *   locked  —— 锁屏 / 解锁的那一刻会立刻推一次（不用等下一个 tick）
 */
function start(onSample, ownHwnd) {
  if (!powerMonitor) powerMonitor = require('electron').powerMonitor;
  let locked = false;
  let timer = null;
  let slow = 0;                       // 连续几次采样很慢就自己降频
  let gap = 1000;
  // 读不到（卡住 / 无响应）的时候沿用上一次的结果，免得标题一会儿有一会儿没，
  // 让渲染进程以为你一直在切窗口
  let lastTitle = '', lastRect = null, lastHwnd = '';
  const push = (force) => {
    let idle = 0;
    try { idle = powerMonitor.getSystemIdleTime(); } catch (e) { idle = 0; }
    const t0 = Date.now();
    const fg = foreground(ownHwnd);
    const cost = Date.now() - t0;
    if (fg && !fg.hung) { lastTitle = fg.title; lastRect = fg.rect; lastHwnd = fg.hwnd || ''; }
    onSample({
      title: lastTitle,
      hwnd: lastHwnd,
      rect: lastRect,
      minimized: !fg || fg.hung ? true : fg.minimized,   // 卡住/没窗口就当它不在前台，别去爬
      locked,
      idle,
      supported: !!load(),
      force: !!force,
      cost,
    });
    // 有些窗口就是读得慢（远程桌面、卡住的程序）。连续慢了就把轮询拉长，
    // 别让它每次都去蹭那个超时。
    if (cost > MSG_TIMEOUT_MS * 0.6) {
      if (++slow >= 3 && gap < 5000) { gap = Math.min(5000, gap * 2); retime(); slow = 0; }
    } else slow = 0;
  };
  const retime = () => {
    if (timer) clearInterval(timer);
    timer = setInterval(push, gap);
    if (timer.unref) timer.unref();
  };
  const onLock = () => { locked = true; push(true); };
  const onUnlock = () => { locked = false; push(true); };
  powerMonitor.on('lock-screen', onLock);
  powerMonitor.on('unlock-screen', onUnlock);
  retime();
  push(false);
  return () => {
    if (timer) clearInterval(timer);
    powerMonitor.removeListener('lock-screen', onLock);
    powerMonitor.removeListener('unlock-screen', onUnlock);
  };
}

// 原生窗口句柄 → 可以直接喂给 Win32 的数字。Buffer 直接 String() 出来是乱码，不能拿去调 API。
function hwndOf(w) {
  try {
    const b = w.getNativeWindowHandle();
    if (!b || !b.length) return 0n;
    return b.length >= 8 ? b.readBigUInt64LE(0) : BigInt(b.readUInt32LE(0));
  } catch (e) {
    return 0n;
  }
}

// 自检用：给某个窗口投一个 WM_CANCELMODE，把原生弹出菜单的模态循环收掉。
// 只影响我们自己那个窗口，不会动别的程序。
function dismissMenu(hwnd) {
  const k = load();
  if (!k) return false;
  try { return !!k.post(hwnd, 0x001f /* WM_CANCELMODE */, 0, 0); } catch (e) { return false; }
}

module.exports = { start, foreground, hwndOf, dismissMenu, supported: () => !!load(), error: () => loadErr };
