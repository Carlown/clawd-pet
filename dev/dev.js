// dev.js — 网页调试台：?mode=sheet 看蜡笔质感/表情矩阵，?mode=scene 跑真实桌宠（假桌面）
'use strict';

const mode = new URLSearchParams(location.search).get('mode') || 'sheet';
const cv = document.getElementById('stage');
const hint = document.getElementById('hint');

function labelL(t, x, y, size, color) {           // 左对齐（hand 是居中的）
  hand(t, x + handMetrics(t, size || 12) / 2, y, { size: size || 12, color: color || '#8a7f6d', jit: .3, seed: 7 });
}

/* ------------------------------------------------------------ 表情矩阵 */
function sheet() {
  const t0 = performance.now();
  useCanvas(cv);
  const EYES = ['open', 'wide', 'happy', 'closed', 'star', 'heart', 'x', 'sad', 'tear'];
  const MOUTHS = ['smile', 'grin', 'o', 0.9, 'w', 'frown'];
  const HATK = ['', 'party', 'beret', 'hard', 'cap', 'crown', 'night', 'headphones'];

  const row = (title, items, s, drawOne) => {
    ctx.fillStyle = '#d9d2c5';
    ctx.fillRect(24, row.y - 12, innerWidth - 48, 1);
    labelL(title, 24, row.y, 15, '#2f2721');
    const y = row.y + 22 + s * 0.95;
    items.forEach((it, i) => {
      const x = 50 + i * (s * 1.3);
      drawOne(x, y, s, it, i);
      labelL(String(it === '' ? 'none' : it), x, y + 18, 11);
    });
    row.y = y + 34;
  };
  row.y = 40;

  const loop = () => {
    B.t = (performance.now() - t0) / 1000;
    ctx.fillStyle = '#f6f1e6';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    const s = Math.min(62, Math.max(36, (innerWidth - 140) / 15));
    row.y = 40;

    row('① eyes 眼型', EYES, s, (x, y, sz, e, i) =>
      clawd(x, y, sz, { eyes: e, mouth: 'smile', seed: 11 + i, blink: false, blush: e !== 'star' && e !== 'x' }));
    row('② mouth 嘴型', MOUTHS, s, (x, y, sz, m, i) =>
      clawd(x, y, sz, { eyes: 'open', mouth: m, seed: 40 + i, blink: false }));
    row('③ hat 帽子', HATK, s, (x, y, sz, h, i) =>
      clawd(x, y, sz, { eyes: 'happy', mouth: 'smile', hat: h, seed: 70 + i, blink: false }));
    row('④ walk / dangle / lift / squash', ['a', 'b', 'c', 'd', 'e', 'drag', 'lift', 'squash+', 'squash-'], s, (x, y, sz, k, i) => {
      if (k === 'drag') clawd(x, y, sz, { dangle: true, eyes: 'wide', mouth: 'o', seed: 11, blink: false });
      else if (k === 'lift') clawd(x, y, sz, { lift: .18, eyes: 'open', mouth: 'w', seed: 11, blink: false });
      else if (k === 'squash+') clawd(x, y, sz, { squash: .25, eyes: 'happy', mouth: 'grin', seed: 11, blink: false });
      else if (k === 'squash-') clawd(x, y, sz, { squash: -.15, eyes: 'open', mouth: 'o', seed: 11, blink: false });
      else clawd(x, y, sz, { walk: i / 4 * TAU, eyes: 'open', mouth: 'smile', seed: 11, hat: 'cap' });
    });

    // 尺寸：笔触应保持像素级，不随体型放大
    ctx.fillStyle = '#d9d2c5';
    ctx.fillRect(24, row.y - 12, innerWidth - 48, 1);
    labelL('⑤ size 尺寸（笔触应是像素级，不随体型变粗）', 24, row.y, 15, '#2f2721');
    const zy = row.y + 22 + 220;
    [60, 100, 150, 210].forEach((sz, i) => {
      const x = 70 + i * (sz * 0.8 + 78);
      clawd(x, zy, sz, { eyes: 'happy', mouth: 'grin', hat: 'beret', seed: 11, blink: false });
      labelL(sz + 'px', x, zy + 20, 12);
    });

    // 睡觉 / 名牌 / 气泡
    const by = zy + 40;
    ctx.fillStyle = '#d9d2c5';
    ctx.fillRect(24, by - 26, innerWidth - 48, 1);
    labelL('⑥ zzz / 名牌 / 气泡', 24, by - 6, 15, '#2f2721');
    clawd(80, by + 74, 70, { eyes: 'closed', mouth: 'o', seed: 11, blink: false, blush: false });
    zzz(98, by + 6, B.t, 26);

    const nm = 'Claude', ns = 13, nw = handMetrics(nm, ns) + ns * .9, nh = ns * 1.5;
    sh(rrectPts(180, by + 40, nw, nh, nh * .34, 3), { fill: PAL.white, stroke: PAL.ink, w: 1.6, amp: .6, famp: 1, tex: null, seed: 300 });
    fillP(rectPts(182, by + 42, nw - 4, nh * .2), PAL.red, { amp: .4, tex: null, seed: 301 });
    hand(nm, 180 + nw / 2, by + 40 + nh * .8, { size: ns, color: PAL.ink, jit: .4, seed: 302 });

    const txt = '我是一只蜡笔小螃蟹，摸我会脸红';
    const bs = 14, lines = handWrap(txt, bs, 200);
    const bw = 220, bh = lines.length * bs * 1.32 + 18;
    sh([[380, by + 8 + bh - 1], [396, by + 8 + bh + 13], [412, by + 8 + bh - 1]], { fill: PAL.white, stroke: PAL.ink, w: 1.8, amp: .5, tex: null, seed: 320 });
    sh(rrectPts(370, by + 8, bw, bh, 12, 3), { fill: PAL.white, stroke: PAL.ink, w: 1.8, amp: .7, famp: 1.1, tex: null, seed: 321 });
    lines.forEach((l, i) => hand(l, 370 + bw / 2, by + 8 + 14 + i * bs * 1.32, { size: bs, color: PAL.ink, jit: .5, seed: 330 + i }));

    // 等待回复时的三个跳动小点
    labelL('在思考…（三个跳动小点）', 380, by + bh + 46, 12);
    const tw = bs * 2.7, th = bs * 1.75;
    sh([[398, by + bh + 60 + th - 1], [410, by + bh + 60 + th + 11], [422, by + bh + 60 + th - 1]], { fill: PAL.white, stroke: PAL.ink, w: 1.6, amp: .5, famp: .8, tex: null, seed: 340 });
    sh(rrectPts(380, by + bh + 60, tw, th, th * .46, 3), { fill: PAL.white, stroke: PAL.ink, w: 1.6, amp: .6, famp: .9, tex: null, seed: 341 });
    for (let i = 0; i < 3; i++) {
      const ph = ((B.t * 2.4 - i * 0.26) % 1.5 + 1.5) % 1.5;
      const k = Math.max(0, Math.sin(ph / 1.5 * Math.PI));
      dot(380 + tw * (0.29 + i * 0.21), by + bh + 60 + th * 0.54 - k * bs * 0.28,
        bs * 0.115 * (1 + k * 0.18), PAL.ink, 0.4 + k * 0.6);
    }

    // 放大细看：描边/纹理
    ctx.save();
    ctx.translate(innerWidth - 250, by - 10);
    ctx.scale(2.4, 2.4);
    clawd(40, 70, 58, { eyes: 'happy', mouth: 'grin', seed: 11, blink: false, hat: 'crown' });
    ctx.restore();
    labelL('⑦ 240% 细看笔触', innerWidth - 250, by - 16, 12);

    requestAnimationFrame(loop);
  };
  hint.textContent = 'mode=sheet · 蜡笔质感调试图：改 src/engine.js 刷新即可';
  loop();
}

/* ------------------------------------------------------------ 假桌面 */
async function scene() {
  hint.innerHTML = 'mode=scene · 假桌面。左键拖拽 / 单击摸头 / 双击聊天 / 右键菜单　'
    + '快捷键 <b>W</b> 散步 · <b>D</b> 跳舞 · <b>H</b> 换帽子 · <b>N</b> 名牌 · <b>L</b> 切语言 · <b>P</b> 假装探头 · <b>G</b> 打招呼 · <b>空格</b> 说话';
  const floor = () => innerHeight - 90;
  Pet.groundFn = floor;
  useCanvas(cv);

  // 假桌面背景 + 一条"任务栏"
  // 注意：Pet.draw 自己每帧会 clearRect 一次（透明窗口不清会叠出残影），
  // 所以背景得先画、再把这一次 clearRect 冻住，否则刚画的桌面就被自己擦了。
  const origDraw = Pet.draw.bind(Pet);
  Pet.draw = function () {
    const g = ctx.createLinearGradient(0, 0, 0, innerHeight);
    g.addColorStop(0, '#dfe9f3');
    g.addColorStop(1, '#f3ece0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillRect(60, 70, 340, 200);
    ctx.fillStyle = 'rgba(0,0,0,.07)';
    ctx.fillRect(60, 70, 340, 16);
    const realClear = ctx.clearRect;
    ctx.clearRect = function () {};
    try { origDraw(); } finally { ctx.clearRect = realClear; }
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(0, floor() + 1, innerWidth, innerHeight - floor());
  };

  await Pet.init(cv, { x: 0.42 });
  Pet.groundFn = floor;
  Pet.p.y = floor();

  window.addEventListener('keydown', async (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w') await Settings.save({ walk: !Settings.data.walk });
    else if (k === 'd') { await Settings.save({ dance: !Settings.data.dance }); Pet.enter(Settings.data.dance ? 'dance' : 'idle'); }
    else if (k === 'h') {
      const order = HATS.map((h) => h[0]);
      await Settings.save({ hat: order[(order.indexOf(Settings.data.hat) + 1) % order.length] });
    } else if (k === 'n') {
      const v = prompt(I18N.t('menu.namePrompt'), Settings.data.name);
      if (v !== null) await Settings.save({ name: v });            // 不再连 showName 一起改
    } else if (k === 'l') {
      await Settings.save({ lang: Settings.data.lang === 'en' ? 'zh' : 'en' });   // 切换语言
      hint.textContent = 'lang = ' + Settings.data.lang;
    } else if (k === 'p') {
      // 假装有个前台窗口，调探头张望的逻辑用（网页版没 Win32 读不到真窗口）
      Pet.tryPeek({ x: innerWidth * 0.3, y: floor() - 260, w: 520, h: 400 }, '测试窗口');
    } else if (k === 'g') {
      Pet.away = 420; Pet.welcomeBack();
    } else if (k === ' ') {
      e.preventDefault();
      const ls = I18N.lines('lines.idle');
      Pet.say(ls[(Math.random() * ls.length) | 0], 2.4);
    }
  });
}

if (mode === 'scene') scene();
else sheet();
