// engine.js — 蜡笔涂鸦渲染引擎，clawd.js 依赖的底层全部在这里。
// 全部为经典脚本的顶层声明，靠 <script> 顺序共享全局作用域，clawd.js 一行不改。
'use strict';

// clawd.js 直接使用全局 ctx，这里由 useCanvas() 注入
let ctx = null;
const B = { t: 0 };                       // 全局时间（秒），clawd 用 B.t
const TAU = Math.PI * 2;
const PAL = {
  ink: '#2f2721',   // 暖调近黑，蜡笔轮廓
  clay: '#e8894c',  // 主角黏土橙
  clayD: '#c2632b', // 暗部
  pink: '#ffa3b3',
  rose: '#ff5f7a',
  sky: '#8ed2f7',
  lav: '#c4a8ff',
  butter: '#ffd75e',
  gold: '#f0a92c',
  blue: '#5aa0f0',
  navy: '#2c3c6b',
  red: '#e04a4a',
  white: '#fffaf0',
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// 确定性哈希随机：同一个 (a,b) 永远返回同一个值，保证蜡笔抖动每帧一致不闪
function hr(a, b) {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const rnd = (seed) => hr(seed, 0x5bf03635);

// 画布挂到全局 ctx。onResize 只在尺寸真的变了的时候报一次。
// 用 ResizeObserver 而不是只听 window.resize：调试台那种"元素先有、后布局"的场景，
// 第一次 measure 会量到 0×0，光等 resize 事件就永远停在 1×1 的空白画布上。
function useCanvas(el, dpr, onResize) {
  const fit = () => {
    const d = dpr || window.devicePixelRatio || 1;
    const cw = el.clientWidth || window.innerWidth || 1;
    const ch = el.clientHeight || window.innerHeight || 1;
    const w = Math.max(1, Math.round(cw * d));
    const h = Math.max(1, Math.round(ch * d));
    const changed = el.width !== w || el.height !== h;
    // 改 width/height 会清空画布并重置 transform，所以只在真变了的时候动
    if (changed) { el.width = w; el.height = h; }
    ctx = el.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (changed && onResize) onResize(cw, ch);
  };
  fit();
  window.addEventListener('resize', fit);
  if (window.ResizeObserver && !el.__useCanvasRO) {
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    el.__useCanvasRO = ro;
  }
  // 布局晚到的情况再兜两下
  requestAnimationFrame(fit);
  setTimeout(fit, 60);
  setTimeout(fit, 300);
  return ctx;
}

/* ------------------------------------------------------------------ 矩阵
   6 元组 [a,b,c,d,e,f]，语义与 ctx.transform 完全一致，可直接展开传入。 */
const MX = {
  T: (x, y) => [1, 0, 0, 1, x, y || 0],
  R: (a) => { const c = Math.cos(a || 0), s = Math.sin(a || 0); return [c, s, -s, c, 0, 0]; },
  S: (x, y) => [x, 0, 0, y === undefined ? x : y, 0, 0],
  mul(a, b) {
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5],
    ];
  },
  chain(...ms) { return ms.reduce((a, b) => MX.mul(a, b)); },
  pt: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
  ap(m, pts) {
    const o = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) o[i] = MX.pt(m, pts[i][0], pts[i][1]);
    return o;
  },
};

/* -------------------------------------------------------------- 几何取点 */
function rectPts(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

function rrectPts(x, y, w, h, r, steps) {
  steps = steps || 3;
  r = Math.min(r, w / 2, h / 2);
  const cs = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  const pts = [];
  for (const [cx, cy, a0] of cs) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

function ellPts(cx, cy, rx, ry, n) {
  n = n || 16;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

function starPts(cx, cy, r1, r2, n, rot) {
  n = n || 5;
  rot = rot || 0;
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function heartPts(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const t = (i / 26) * TAU;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([cx + (x / 16) * r, cy + (y / 16) * r * 0.92]);
  }
  return pts;
}

// 向心 Catmull-Rom 平滑，用于嘴/笑眼/眼镜腿
function catmull(pts, steps) {
  steps = steps || 4;
  if (!pts || pts.length < 3) return (pts || []).slice();
  const p = [pts[0]].concat(pts, [pts[pts.length - 1]]);
  const out = [];
  for (let i = 0; i < p.length - 3; i++) {
    const p0 = p[i], p1 = p[i + 1], p2 = p[i + 2], p3 = p[i + 3];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

/* ------------------------------------------------------------ 蜡笔光栅器
   核心思路：沿弧长等距重采样 → 沿法线按确定性谐波噪声偏移 → 得到手抖的路径。
   抖动是纯函数（只吃 arclength + seed），所以每帧同一条边抖动一致，不会闪烁。 */
function _wob(u, seed, freq) {
  return (
    Math.sin(u * TAU * freq + hr(seed, 3) * TAU) * 0.58 +
    Math.sin(u * TAU * (freq * 2.17) + hr(seed, 4) * TAU) * 0.3 +
    Math.sin(u * TAU * (freq * 4.63) + hr(seed, 5) * TAU) * 0.12
  );
}

function _sketch(pts, closed, amp, seed, step) {
  step = step || 5;
  const src = closed ? pts.concat([pts[0]]) : pts;
  // 1) 弧长重采样
  const out = [];
  let total = 0;
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i], b = src[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ x: a[0] + dx * t, y: a[1] + dy * t, s: total + len * t });
    }
    total += len;
  }
  const last = src[src.length - 1];
  out.push({ x: last[0], y: last[1], s: total });
  if (out.length < 2) return null;
  // 2) 频率与路径长度挂钩（手绘抖动应该是固定的空间尺度，不是固定点数）
  let freq = total / 62;
  if (closed) freq = Math.max(2, Math.round(freq));      // 闭合路径必须是整数圈，否则接缝跳变
  else freq = clamp(freq, 1.5, 14);
  // 3) 法向偏移
  const n = out.length, res = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = out[i];
    const a = out[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = out[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const L = Math.hypot(tx, ty) || 1;
    tx /= L; ty /= L;
    const d = amp * _wob(p.s / (total || 1), seed, freq);
    res[i] = [p.x - ty * d, p.y + tx * d];
  }
  if (closed && res.length > 1) res.pop();   // 闭合环不重复首点
  return { pts: res, closed, path: _toPath(res, closed) };
}

function _toPath(pts, closed) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  if (closed) p.closePath();
  return p;
}

function _bounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1 };
}

// 蜡笔纹理：'hatchL' 左倾斜线，'dotsL' 点阵
function _texture(path2d, kind, a, seed, w, bnd) {
  if (!a || a <= 0 || !ctx) return;
  const ga0 = ctx.globalAlpha;
  ctx.save();
  ctx.beginPath();
  ctx.clip(path2d);
  ctx.strokeStyle = PAL.ink;
  ctx.fillStyle = PAL.ink;
  if (kind === 'hatchL') {
    const ang = -0.62;                                  // 约 -35°
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy, ny = dx;
    const cx = (bnd.x0 + bnd.x1) / 2, cy = (bnd.y0 + bnd.y1) / 2;
    const rad = Math.hypot(bnd.x1 - bnd.x0, bnd.y1 - bnd.y0) / 2 + 3;
    const gap = 8;
    const n = Math.ceil(rad / gap);
    ctx.lineWidth = Math.max(0.7, (w || 2) * 0.16);
    ctx.lineCap = 'round';
    for (let k = -n; k <= n; k++) {
      if (hr(seed, k + 130) < 0.14) continue;           // 蜡笔会漏笔，留白
      const jit = (hr(seed, k + 50) - 0.5) * 3;
      const ox = cx + nx * (k * gap + jit), oy = cy + ny * (k * gap + jit);
      ctx.globalAlpha = ga0 * a * (0.35 + 0.9 * hr(seed, k + 90));
      // 每一笔断成 2~3 段，笔画不贯通才像蜡笔
      const runs = 2 + ((hr(seed, k + 70) * 2) | 0);
      ctx.beginPath();
      for (let r = 0; r < runs; r++) {
        const t0 = -1 + (2 * r) / runs + (hr(seed, k * 7 + r) - 0.5) * 0.12;
        const t1 = t0 + 2 / runs - 0.04 - hr(seed, k * 11 + r) * 0.12;
        if (t1 <= t0) continue;
        const segs = 3;
        for (let i = 0; i <= segs; i++) {
          const t = t0 + (t1 - t0) * (i / segs);
          const wob = Math.sin(t * 3.4 + k * 1.7) * 1.1;
          const px = ox + dx * rad * t + nx * wob, py = oy + dy * rad * t + ny * wob;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
      }
      ctx.stroke();
    }
  } else if (kind === 'dotsL') {
    const gap = 5;
    for (let y = bnd.y0; y <= bnd.y1 + gap; y += gap) {
      const row = Math.round((y - bnd.y0) / gap);
      for (let x = bnd.x0 + (row % 2) * gap * 0.5; x <= bnd.x1 + gap; x += gap) {
        const h1 = hr(seed, Math.round(x * 3 + y * 11));
        const h2 = hr(seed, Math.round(x * 7 + y * 5));
        ctx.globalAlpha = ga0 * a * (0.45 + 0.7 * h1);
        ctx.beginPath();
        ctx.arc(x + (h2 - 0.5) * 2, y + (h1 - 0.5) * 2, 0.7 + h2 * 0.9, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = ga0;
}

function alpha(a, fn) {
  if (!ctx) { fn(); return; }
  const g = ctx.globalAlpha;
  ctx.globalAlpha = g * a;
  try { fn(); } finally { ctx.globalAlpha = g; }
}

// 只填充（+可选纹理），边沿手抖
function fillP(pts, color, o) {
  o = o || {};
  if (!ctx || !pts || pts.length < 3) return;
  const sk = _sketch(pts, true, o.amp === undefined ? 1.4 : o.amp, o.seed === undefined ? 1 : o.seed, 5);
  if (!sk) return;
  ctx.fillStyle = color;
  ctx.fill(sk.path);
  if (o.tex) _texture(sk.path, o.tex, o.texA === undefined ? 0.2 : o.texA, (o.seed || 1) + 7, o.w, _bounds(sk.pts));
}

// 纯手绘线条（不填充）
function ink(pts, o) {
  o = o || {};
  const closed = o.closed !== false;
  _stroke(pts, {
    closed, amp: o.amp === undefined ? 0.7 : o.amp, w: o.width || o.w || 2,
    color: o.color, seed: o.seed === undefined ? 3 : o.seed, off: o.off, dbl: o.dbl,
  });
}

function _stroke(pts, o) {
  if (!ctx || !pts || pts.length < 2) return;
  const sk = _sketch(pts, o.closed, o.amp, o.seed, 4.5);
  if (!sk) return;
  const p = sk.pts;
  const off = o.off;
  const ox = off ? off[0] : 0, oy = off ? off[1] : 0;
  const ga0 = ctx.globalAlpha;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = o.color || PAL.ink;
  const trace = (dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(p[0][0] + ox + dx, p[0][1] + oy + dy);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0] + ox + dx, p[i][1] + oy + dy);
    if (o.closed) ctx.closePath();
  };
  // 第一遍：主线
  ctx.globalAlpha = ga0 * 0.95;
  ctx.lineWidth = o.w;
  trace(0, 0);
  ctx.stroke();
  if (o.dbl !== false) {
    // 第二遍：错位的细线，蜡笔反复描的叠影
    ctx.globalAlpha = ga0 * 0.26;
    ctx.lineWidth = o.w * 0.45;
    trace(o.w * 0.17, -o.w * 0.11);
    ctx.stroke();
    // 第三遍：断续的飞白，笔尖不匀
    ctx.globalAlpha = ga0 * 0.3;
    ctx.lineWidth = o.w * 0.34;
    ctx.setLineDash([2.5 + hr(o.seed, 1) * 4, 1.8 + hr(o.seed, 2) * 5]);
    ctx.lineDashOffset = hr(o.seed, 3) * 6;
    trace(-o.w * 0.1, o.w * 0.12);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  ctx.globalAlpha = ga0;
}

// 蜡笔涂鸦三件套：抖动填充 + 纹理 + 偏移手绘描边
function sh(pts, o) {
  o = o || {};
  if (!ctx || !pts || pts.length < 3) return;
  const seed = o.seed === undefined ? 1 : o.seed;
  fillP(pts, o.fill, {
    amp: o.famp === undefined ? 1.4 : o.famp,
    seed, tex: o.tex, texA: o.texA === undefined ? 0.2 : o.texA, w: o.w,
  });
  if (o.stroke !== null) {
    _stroke(pts, {
      closed: true, amp: o.amp === undefined ? 1.3 : o.amp, w: o.w || 2,
      color: o.stroke || PAL.ink, seed: seed + 1, off: o.off,
    });
  }
}

function dot(x, y, r, color, a) {
  if (!ctx) return;
  const g = ctx.globalAlpha;
  ctx.globalAlpha = g * (a === undefined ? 1 : a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.2, r), 0, TAU);
  ctx.fill();
  ctx.globalAlpha = g;
}

/* -------------------------------------------------------------- 手写字 */
const HAND_FONT = '"Segoe Print", "Comic Sans MS", "Bradley Hand", "Kaiti SC", "楷体", cursive, sans-serif';
const _wCache = new Map();
function handMetrics(text, size) {
  const key = size + '|' + text;
  let w = _wCache.get(key);
  if (w === undefined) {
    ctx.save();
    ctx.font = size + 'px ' + HAND_FONT;
    w = ctx.measureText(text).width;
    ctx.restore();
    if (_wCache.size > 900) _wCache.clear();
    _wCache.set(key, w);
  }
  return w;
}

// hand() 是逐字符画的，每两个字符之间还插了一个 gap，而且每个字符会随机缩放一点。
// 直接 measureText(整句) 量出来的宽度会比实际画出来的窄一截：
// 69 个字符的英文行差 52px（中文短行只差 7px，所以一直没人发现），
// 拿它去算气泡宽度 → 字直接捅出气泡两边。这里按 hand() 同一套算法量。
const _hwCache = new Map();
function handWidth(text, size) {
  const key = size + '|' + text;
  let w = _hwCache.get(key);
  if (w === undefined) {
    const chars = String(text);
    const gap = size * 0.06;
    w = 0;
    for (let i = 0; i < chars.length; i++) w += handMetrics(chars[i], size) + (i ? gap : 0);
    if (_hwCache.size > 900) _hwCache.clear();
    _hwCache.set(key, w);
  }
  return w;
}

// 逐字符随机旋转/偏移的手写字，文字本身就是"画"出来的
function hand(text, x, y, o) {
  o = o || {};
  if (!ctx || text === undefined || text === null || text === '') return;
  text = String(text);
  const size = o.size || 20;
  const jit = o.jit === undefined ? 0.35 : o.jit;
  const seed = o.seed === undefined ? 0 : o.seed;
  const gap = size * 0.06;
  let total = 0;
  const chars = text.split('');
  for (const c of chars) total += handMetrics(c, size) + gap;
  total -= gap;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = size + 'px ' + HAND_FONT;
  ctx.lineJoin = 'round';
  let cx = x - total / 2;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c !== ' ') {
      const w = handMetrics(c, size);
      const rot = (hr(seed, i + 11) - 0.5) * jit * 0.5;
      const dy = (hr(seed, i + 57) - 0.5) * size * 0.09;
      const sc = 1 + (hr(seed, i + 91) - 0.5) * jit * 0.12;
      ctx.save();
      ctx.translate(cx + w / 2, y + dy);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      if (o.outline) {
        ctx.lineWidth = o.ow || 3;
        ctx.strokeStyle = o.outline;
        ctx.strokeText(c, 0, 0);
      }
      ctx.fillStyle = o.color || PAL.ink;
      ctx.fillText(c, 0, 0);
      ctx.restore();
    }
    cx += handMetrics(c, size) + gap;
  }
  ctx.restore();
}

// 断行：中文按「字」断，英文按「单词」断。
// 以前是一律按字符断（只对中文成立），英文一进来整句被拦腰截断：
//   "Still clocking in tod" / "ay and the deadlin" / "e is tomorrow mor" / "ning"
// 单词比汉字长得多，所以 token 不能整个塞进去时就再按字符硬断一下。
const _CJK = /[\u1100-\u11ff\u2e80-\u9fff\u3000-\u303f\uac00-\ud7af\uff00-\uffef]/;
function handWrap(text, size, maxW) {
  const out = [];
  const emit = (line) => out.push(line.replace(/[ \t]+$/, ''));
  const hardSplit = (tk) => {
    let piece = '';
    for (const ch of tk) {
      const t = piece + ch;
      if (piece && handWidth(t, size) > maxW) { out.push(piece); piece = ch; }
      else piece = t;
    }
    return piece;
  };
  for (const para of String(text).split('\n')) {
    // 切成 token：CJK 逐字，其余连续的非空白字符（拉丁词/数字）整块，空格单独一块
    const toks = [];
    let buf = '';
    for (const ch of para) {
      if (ch === ' ' || ch === '\t') { if (buf) { toks.push(buf); buf = ''; } toks.push(' '); continue; }
      if (_CJK.test(ch)) { if (buf) { toks.push(buf); buf = ''; } toks.push(ch); continue; }
      buf += ch;
    }
    if (buf) toks.push(buf);
    let line = '';
    for (const tk of toks) {
      if (tk === ' ') {
        if (!line) continue;                       // 行首空格丢了
        line += ' ';
        if (handWidth(line, size) > maxW) { emit(line); line = ''; }
        continue;
      }
      const t = line + tk;
      if (line && handWidth(t, size) > maxW) { emit(line); line = tk; }
      else if (!line && handWidth(tk, size) > maxW) line = hardSplit(tk);   // 单个词就超宽（长 URL）
      else line = t;
    }
    emit(line);
  }
  // 流式输出时末尾常带换行，会多画一行空白
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

/* ------------------------------------------------------------ 节拍时钟 */
let BPM = 112;
const setBPM = (v) => { BPM = clamp(v, 40, 220); };
function beatInfo(t, bpm) {
  const per = 60 / (bpm || BPM);
  const x = (t === undefined ? B.t : t) / per;
  const i = Math.floor(x);
  return { i, ph: x - i, per, bpm: bpm || BPM };
}
// 虚拟频段能量：驱动 singMouth，不需要真实音频
function band(name, t) {
  t = t === undefined ? B.t : t;
  const b = beatInfo(t);
  const kick = Math.exp(-9 * b.ph * b.per) * (b.i % 2 ? 0.7 : 1);
  if (name === 'bass') return clamp(0.35 + 0.5 * Math.sin(t * 2.0) + kick * 0.4);
  if (name === 'high') return clamp(0.25 + 0.35 * Math.sin(t * 7.3 + 1.2) + Math.exp(-26 * ((t / (b.per / 2)) % 1) * (b.per / 2)) * 0.5);
  return clamp(0.3 + 0.28 * Math.sin(t * 3.1) + 0.22 * Math.sin(t * 5.7 + 2) + kick * 0.5);
}
