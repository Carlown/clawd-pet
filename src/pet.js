// pet.js — 桌宠行为层：状态机 + 物理 + 交互 + 气泡。
// 只负责"这只小家伙现在该干嘛、怎么动"，画画全部交给 clawd.js。
// 同一份代码跑在网页调试台和 Electron 里，靠 window.petHost 探测宿主能力。
//
// 坐标系（重要）：
//   world —— 屏幕工作区坐标，桌宠在 world 里散步、掉落、被拖；
//   box   —— 画布（= Electron 窗口）本地坐标，绘制全部在这里；
//   cam   —— 窗口左上角在 world 里的位置，X()/Y() 负责两套坐标互转。
// 网页调试台里 cam 恒为 (0,0)、world 就是画布，所以行为完全一致。
'use strict';

// 台词全在 src/i18n.js（lines.*），按当前语言现取，切语言下一句话就变了。

const Pet = {
  ready: false,
  W: 0, H: 0,                                  // 画布（窗口）尺寸
  world: { w: 0, h: 0, floor: 0, x0: 0, y0: 0 },  // 所有显示器的虚拟包围盒
  disp: [], spans: [],                         // 显示器工作区 / 横向合并后的连续区
  cam: { x: 0, y: 0 },                          // 窗口左上角的屏幕绝对坐标
  camSeq: 0, camWant: null, camInFlight: false, curX: 0, hopTarget: 0, chasing: false, lastGround: null,
  chaseBest: Infinity, chaseStuck: 0,
  p: { x: 0, y: 0, vx: 0, vy: 0, s: 150, facing: 1, squash: 0, lift: 0, rot: 0, walk: 0 },
  state: 'idle', st: 0, dur: 0, next: 2,
  speed: 62,
  mood: null, moodT: 0,
  look: [0, 0],
  mx: -1, my: -1, hover: false,
  drag: null,
  bubble: null,
  chatOn: false,
  last: 0, raf: null,
  groundFn: null,

  // 探头张望用的临时"平台"：窗口标题栏那一行。plat 为 null 时站在正常地板上。
  plat: null, goal: 0, wallX: 0, climbFrom: 0, phase: '', peekTitle: '', peekFace: 1,
  watch: { title: '', locked: false, idle: 0, supported: false },
  watchSeen: false, away: 0,
  paused: false, pausedT: 0,                     // 右键菜单开着的时候先站住

  X(wx) { return wx - this.cam.x; },
  Y(wy) { return wy - this.cam.y; },

  /* ------------------------------------------------------------ 启动 */
  async init(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    useCanvas(canvas, undefined, () => this.resize());
    this.resize();
    window.addEventListener('resize', () => this.resize());
    await Settings.load();
    this.applySettings();

    if (window.petHost && window.petHost.getWindowInfo) {
      this.setWorld(await window.petHost.getWindowInfo());
      window.petHost.onWindowInfo((i) => this.setWorld(i));
      window.petHost.onCursor((c) => this.onCursor(c));
      // 桌面观察员：前台窗口标题（探头张望）+ 锁屏/空闲（回来打招呼）
      if (window.petHost.onWatch) window.petHost.onWatch((w) => this.onWatch(w));
    } else {
      this.setWorld({ displays: [{ id: 0, x: 0, y: 0, w: this.W, h: this.H }], x: 0, y: 0 });
    }

    this.p.s = Settings.bodySize();
    // 桌面版：主进程已经把窗口摆在鼠标那块屏上了，直接从窗口中间出现
    this.p.x = opts.x === undefined
      ? (window.petHost ? this.cam.x + this.W / 2 : this.world.w * 0.5)
      : this.world.w * opts.x;
    this.p.y = this.groundY();
    this.snapCam();
    this.bindPointer();
    if (window.petHost && window.petHost.onMenu) window.petHost.onMenu((id) => applyMenuAction(id));
    if (window.petHost && window.petHost.onMenuState) window.petHost.onMenuState((open) => { this.paused = !!open; this.pausedT = 0; });
    // 名牌输入窗确定的文字（只改文字，画不画看「显示名牌」那个开关）
    if (window.petHost && window.petHost.onName) window.petHost.onName((v) => Settings.save({ name: String(v == null ? '' : v).slice(0, 12) }));
    if (window.petHost && window.petHost.onChat) Chat.bind(window.petHost.onChat);
    this.ready = true;
    this.start();
    return this;
  },

  setWorld(i) {
    if (i.displays && i.displays.length) this.setDisplays(i.displays);
    if (!this.disp.length) this.setDisplays([{ id: 0, x: 0, y: 0, w: this.W, h: this.H }]);
    const wd = this.world;
    const x0 = Math.min(...this.disp.map((d) => d.x));
    const y0 = Math.min(...this.disp.map((d) => d.y));
    const x1 = Math.max(...this.disp.map((d) => d.x + d.w));
    const y1 = Math.max(...this.disp.map((d) => d.y + d.h));
    wd.x0 = x0; wd.y0 = y0;
    wd.w = x1 - x0; wd.h = y1 - y0;
    wd.floor = this.groundY();
    if (i.x !== undefined) this.cam.x = i.x;
    if (i.y !== undefined) this.cam.y = i.y;
  },

  // 多显示器：把横向相邻/重叠的工作区合并成连续区，桌宠就能无缝走过去
  setDisplays(list) {
    this.disp = list.slice().sort((a, b) => a.x - b.x);
    this.spans = [];
    for (const d of this.disp) {
      const last = this.spans[this.spans.length - 1];
      if (last && d.x <= last.x + last.w + 4) last.w = Math.max(last.w, d.x + d.w - last.x);
      else this.spans.push({ x: d.x, w: d.w });
    }
  },
  spanAt(x) {
    if (!this.spans.length) return { x: 0, w: this.W };
    for (const s of this.spans) if (x >= s.x - 1 && x <= s.x + s.w + 1) return s;
    return x < this.spans[0].x ? this.spans[0] : this.spans[this.spans.length - 1];
  },
  // 某个 x 落在哪块屏上（决定地板高度）
  displayAt(x) {
    if (!this.disp.length) return null;
    const hit = this.disp.filter((d) => x >= d.x - 2 && x <= d.x + d.w + 2);
    if (hit.length) return hit[0];
    return this.disp.reduce((a, b) => (Math.abs((b.x + b.w / 2) - x) < Math.abs((a.x + a.w / 2) - x) ? b : a));
  },

  // 鼠标跑到别的屏上了 → 追过去（相邻屏直接走过去过去，不相邻就在屏边翻过去）
  onCursor(c) {
    if (!c) return;
    this.curX = c.x;
    if (this.drag) return;
    const d = this.disp.find((z) => z.id === c.id);
    const cur = this.displayAt(this.p.x);
    if (!d || !cur || d.id === cur.id) {                 // 同一块屏：不管它
      if (this.chasing) {
        this.chasing = false;
        this.hopTarget = 0;
        if (this.state === 'walk') this.enter('idle');   // 追到了就别一直走
      }
      return;
    }
    this.abortPeek();                                    // 要换屏了，先从标题栏下来
    this.hopTarget = c.x;
    this.chasing = true;
    if (this.state === 'idle' || this.state === 'sleep' || this.state === 'land') this.enter('walk', 45);
    this.p.facing = this.hopTarget > this.p.x ? 1 : -1;
  },
  hopTo(target) {
    const s = this.spanAt(target);
    const m = this.p.s * 0.6;
    this.p.x = clamp(target, s.x + m, s.x + s.w - m);
    this.p.facing = target > this.p.x ? 1 : -1;
    this.p.vx = 0;
    this.enter('fall');
  },

  /* ------------------------------------------------ 桌面观察员：探头 / 打招呼 */
  // 主进程每秒推一次：{ title, rect, minimized, locked, idle, supported }
  onWatch(w) {
    if (!w) return;
    const prev = this.watch;
    this.watch = w;
    if (!this.watchSeen) { this.watchSeen = true; return; }   // 第一次只是对齐基准
    if (typeof w.idle === 'number') this.away = w.idle;
    if (w.locked && !prev.locked) return;                     // 刚锁屏，先不说话
    if (!w.locked && prev.locked) { this.welcomeBack(); return; }
    if (w.locked) return;
    // 已经站在某个窗口的标题栏上了，而那个窗口没了（被最小化/关掉/切走）
    // → 先把它放下来。必须放在下面那几道 early-return 前面：
    // 最小化时前台窗口会变成别的（或者读不到），那些 return 会直接把消息吃掉。
    if (this.dropIfPlatGone(w)) return;
    // 没锁屏，但你很久没碰鼠标又突然动了 —— 也当是回来打个招呼
    if (prev.idle > 180 && w.idle < 8) { this.welcomeBack(prev.idle); return; }
    if (!w.supported || w.minimized || !w.rect) return;
    const title = w.title || '';
    // 还是那个窗口就不折腾。有 hwnd 就认 hwnd（标题会变，句柄不会）；
    // 老环境没 hwnd 才退回比标题。
    if (w.hwnd && prev.hwnd) { if (w.hwnd === prev.hwnd) return; }
    else if (title === prev.title) return;
    this.tryPeek(w.rect, title, w.hwnd);
  },

  // 走到某个 x 就进入下一段（phase: wall = 走到墙根，top = 走到标题栏中间）
  chaseTo(x, phase) {
    this.goal = x;
    this.phase = phase || '';
    this.p.vx = 0;
    this.chaseBest = Infinity;   // 还没开始量
    this.chaseStuck = 0;
    this.enter('chase');
  },
  arrive() {
    if (this.phase === 'wall' || this.phase === 'down') { this.enter('climb'); return; }
    this.enter('peek', 4.5 + hr((B.t * 1000) | 0, 21) * 4);
    const ls = I18N.lines('lines.peek');
    this.say(ls[(hr((B.t * 1000) | 0, 22) * ls.length) | 0], 2.2);
  },

  // 你切窗口了 → 它爬到那个窗口的标题栏上去探头
  tryPeek(rect, title, hwnd) {
    if (!Settings.data.peek) return;
    if (this.drag || this.state === 'drag' || this.state === 'fall') return;
    if (this.state === 'chase' || this.state === 'climb' || this.state === 'peek') return;  // 已经在路上
    const d = this.displayAt(clamp(rect.x, this.world.x0, this.world.x0 + this.world.w - 1));
    if (!d) return;
    // 站上去之后头顶必须还在画面里：窗口最多只能顶到 wd.y0，再往上就没地方画了。
    // 所以标题栏贴屏幕最上沿（最大化窗口）时，把"平台"往下挤一点。
    const top = Math.max(d.y + 4, rect.y, this.world.y0 + this.headroom() + 2);
    if (this.floorY() - top < this.p.s * 0.75) return;         // 太高了，爬不上去
    // 平台 = 窗口标题栏那一行，左右各多给 m（= 下面横向夹边用的半宽）。
    // 这样“贴着窗边那面墙”刚好落在夹边公式的可达端点上，上/下的时候不会有一帧横向弹跳。
    const m = this.p.s * 0.55;
    const px0 = clamp(rect.x - m, d.x, Math.max(d.x, d.x + d.w - m * 2));
    const px1 = clamp(rect.x + rect.w + m, Math.min(d.x + d.w, d.x + m * 2), d.x + d.w);
    this.plat = { x: px0, w: Math.max(m * 2, px1 - px0), y: top };
    // 记下这个平台是从哪个矩形推出来的（原始 rect，没被上面那些 clamp 改过）。
    // 窗口被拖动时 rect 会变，而 plat 是一组固定坐标 —— 不比对的话，
    // 窗口滑走了桌宠还站在原地，看上去就是悬在半空。
    this.platRect = { x: rect.x, y: rect.y, w: rect.w };
    // 两面“墙”就是平台的两端 —— 走过去一定到得了，不会差着半截身子够不着
    const wallL = this.plat.x + m, wallR = this.plat.x + this.plat.w - m;
    this.wallX = Math.abs(this.p.x - wallL) <= Math.abs(this.p.x - wallR) ? wallL : wallR;
    this.climbFrom = this.p.y;
    this.climbTo = top;              // 先爬到标题栏高度
    this.climbThen = 'top';          // 到了再沿标题栏走到中间
    this.peekTitle = title || '';
    this.peekHwnd = hwnd || '';
    this.peekFace = this.p.x <= wallL ? 1 : -1;   // 从左边上来就朝右看
    this.chaseTo(this.wallX, 'wall');
  },

  // 探头期间那个窗口没了（被最小化/关掉/切走）或者被拖走了
  // → 别挂在空气里，直接掉下来。
  // 主进程每秒推一次样本：窗口一最小化，前台窗口就变成别的东西（或者干脆读不到），
  // 所以只要「现在的前台窗口已经不是刚才那个」就当作它没了；
  // 拖动则是同一个窗口、但 rect 变了 —— plat 是固定坐标，窗口一滑它就悬空了。
  dropIfPlatGone(w) {
    if (!this.plat) return false;
    if (!w || !w.supported || !!w.minimized || !w.rect) { this.leavePeek(true); return true; }
    // 同一个窗口怎么刷标题都不该掉：资源管理器里点进一个文件夹、浏览器换个标签页，
    // 标题会变但窗口一动没动。所以判身份只看 hwnd —— 句柄换了才是真换窗口了。
    // （拿不到 hwnd 的老环境下就退化成只看 rect，宁可多站一会儿，也别动不动就掉。）
    const mine = this.peekHwnd || '';
    if (mine && w.hwnd && w.hwnd !== mine) { this.leavePeek(true); return true; }
    // 拖动检测：容差 6px，躲开 rect 读取本身的抖动，但真拖一下就够抓到了
    const src = this.platRect;
    if (src) {
      const moved = Math.abs(w.rect.x - src.x) > 6 || Math.abs(w.rect.y - src.y) > 6
        || Math.abs(w.rect.w - src.w) > 6;
      if (moved) { this.leavePeek(true); return true; }
    }
    return false;
  },

  // 探头结束。默认是「原路返回」：先沿标题栏走回那面墙，再顺着爬下去。
  // 之前是一旦结束就直接掉回地面，看着就像闪现到任务栏 —— 太突傅。
  // immediate = 被打断（被拎起来 / 要跨屏追鼠标），那就别演了，直接落下来。
  leavePeek(immediate) {
    if (!this.plat || immediate) {
      const hadPlat = !!this.plat;
      this.plat = null;
      this.platRect = null;
      this.peekHwnd = '';
      this.phase = '';
      this.lastGround = null;
      if (hadPlat && Settings.data.gravity) { this.p.vy = 40; this.enter('fall'); }
      else { this.p.y = this.floorY(); this.enter('idle'); }
      return;
    }
    this.climbThen = 'floor';
    this.chaseTo(this.wallX, 'down');
  },

  // 爬回地面了：收起平台，恢复正常
  reachFloor() {
    this.plat = null;
    this.phase = '';
    this.p.y = this.floorY();
    this.lastGround = this.p.y;
    this.p.vx = 0;
    this.enter('idle');
  },

  abortPeek() {
    if (this.plat) this.leavePeek(true);
  },

  // 你锁屏走了一趟再回来 → 换个姿势跟你打个招呼
  welcomeBack(awaySec) {
    const long = (awaySec === undefined ? this.away : awaySec) > 300;
    this.away = 0;
    if (!Settings.data.idleGreet) return;
    if (this.drag || this.plat) return;
    if (this.state === 'chase' || this.state === 'climb' || this.state === 'peek' || this.state === 'fall') return;
    const lines = I18N.lines(long ? 'lines.backLong' : 'lines.back');
    this.setMood({ eyes: 'heart', mouth: 'grin', blushA: .85 }, 2.4);
    this.enter('greet', long ? 2.6 : 1.7);
    this.say(lines[(hr((B.t * 1000) | 0, 31) * lines.length) | 0], 3);
  },

  applySettings() {
    // 体型一定要过 Settings.bodySize()：size=0 时 s=0，不仅画不出来，
    // 命中检测里还要除以 0（全是 Infinity）→ 既看不见也点不到，只能杀进程。
    this.p.s = Settings.bodySize();
    this.chatOn = !!Settings.data.chat;
    this.p.y = Math.min(this.p.y, this.groundY());
    // 跳舞开关以前是个死开关：pet.js 里根本没人 enter('dance')，
    // 只有 dev.js 手动调过，所以勾上它啥也不会发生。现在真接上了。
    if (!!Settings.data.dance !== (this.state === 'dance')) this.setDance(!!Settings.data.dance);
  },

  // 打开就先当场跳一段给你看，关掉就停下来。
  // 忙的时候（被拎着/在爬/在走路）不打断，等它自己闲下来再由 idle 挑进去。
  setDance(on) {
    if (on) {
      const busy = this.drag || this.plat || this.state === 'fall' || this.state === 'land';
      if (!busy) this.enter('dance', 6);
    } else if (this.state === 'dance') this.enter('idle');
  },

  resize() {
    this.W = this.canvas.clientWidth || window.innerWidth;
    this.H = this.canvas.clientHeight || window.innerHeight;
    if (!this.disp.length) this.setWorld({ displays: [{ id: 0, x: 0, y: 0, w: this.W, h: this.H }], x: 0, y: 0 });
  },

  // 真正的地面（屏幕工作区底部）。探头时脚下还有个"平台"，别把两者混了。
  floorY() {
    if (this.groundFn) return this.groundFn(this.world.w, this.world.h);
    const d = this.displayAt(this.p.x || (this.disp[0] && this.disp[0].x));
    return d ? d.y + d.h : this.H;
  },
  groundY() { return this.plat ? this.plat.y : this.floorY(); },
  // 当前这一帧它到底踩在哪：爬墙/探头这段路在窗口上，其余时候在地板上
  onPlat() {
    if (!this.plat) return false;
    // 'down' 也是站在标题栏上往回走，算在平台里
    return this.state === 'climb' || this.state === 'peek'
      || (this.state === 'chase' && (this.phase === 'top' || this.phase === 'down'));
  },
  standY() { return this.onPlat() ? this.plat.y : this.floorY(); },

  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  // 「能不能聊天」总开关（设置里那个勾选）。它只管允许不允许，不负责开窗，
  // 所以菜单里「聊两句…」那行文字不会因为开关而变来变去。
  chatEnabled(on) {
    this.chatOn = !!on;
    if (on) this.say(I18N.t('pet.chatOn'), 2.4);
    else { this.clearBubble(); if (window.petHost) window.petHost.closeChat(); }
  },
  // 双击 / 菜单「聊两句…」：永远是"打开聊天窗"
  openChat() {
    if (this.state === 'sleep') this.wake();
    if (!Settings.data.chat) {
      this.setMood({ eyes: 'sad', mouth: 'w', blushA: .4 }, 2);
      this.say(I18N.t('pet.chatOff'), 3);
      return;
    }
    if (!window.petHost) { this.say(I18N.t('pet.webOnly'), 2.6); return; }
    window.petHost.openChat();
    this.setMood({ eyes: 'happy', mouth: 'smile', blushA: .5 }, 1.2);
  },
  recenter() {
    const d = this.displayAt(this.p.x) || this.disp[0];
    if (d) this.p.x = d.x + d.w / 2;
    this.p.vx = 0;
    this.snapCam();
    this.enter(Settings.data.gravity ? 'fall' : 'idle');
  },

  /* -------------------------------------------------------- 状态切换 */
  enter(s, dur) {
    this.state = s;
    this.st = 0;
    this.dur = dur || 0;
    if (s === 'idle') this.next = 2.2 + hr(this.seed(), 1) * 4.5;
    if (s === 'sleep') this.dur = 14 + hr(this.seed(), 2) * 22;
    if (s === 'walk') {
      this.dur = 2.5 + hr(this.seed(), 3) * 5;
      if (hr(this.seed(), 4) < 0.28) this.p.facing = -this.p.facing;
    }
    if (s === 'greet') this.dur = dur || 1.7;
    if (s === 'peek') this.dur = dur || 6;
    if (s === 'dance') this.dur = dur || 5 + hr(this.seed(), 12) * 5;
  },
  seed() { return (this.p.x * 13 + this.p.y * 7 + this.state.length * 31) | 0; },

  /* ------------------------------------------------------------ 更新 */
  update(dt) {
    B.t += dt;
    this.st += dt;
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) this.mood = null; }
    this.updateLook(dt);
    this.updateBubble(dt);
    this.syncHover();
    // 看门狗放在最前面：不管在什么状态下，只要按住不动太久就放它下来。
    // （之前它在下面，被 paused 的 early-return 遮住了，两个 bug 会叠在一起）
    if (this.drag && (this.drag.age += dt) > 4) this.onUp();
    // 不变量：'drag' 状态必须有对应的 this.drag。没有就说明哪条路漏了收尾，
    // 直接放它回地面——否则它会永远保持被拎起来的表情且一动不动。
    if (this.state === 'drag' && !this.drag) this.enter('idle');
    // 右键菜单开着：原地待机就行，别在菜单底下走开（窗口跟着动会让菜单和它错位）
    if (this.paused) {
      // 菜单关闭的 IPC 万一没收到，也不能让它永远站着不动
      this.pausedT += dt;
      if (this.pausedT > 20) { this.paused = false; this.pausedT = 0; }
      this.p.vx = 0;
      this.p.lift = Math.sin(B.t * 1.6) * 0.007;
      this.p.squash = lerp(this.p.squash, 0, dt * 6);
      this.p.rot = lerp(this.p.rot, 0, dt * 6);
      return;
    }
    const g = Settings.data;

    switch (this.state) {
      case 'idle': {
        this.p.vx *= Math.pow(0.02, dt);
        this.p.squash = lerp(this.p.squash, 0, dt * 8);
        this.p.lift = Math.sin(B.t * 1.6) * 0.007;
        this.p.rot = lerp(this.p.rot, 0, dt * 8);
        if (this.st > this.next) {
          const r = hr(this.seed(), 5);
          if (g.idle && r < 0.22) this.enter('sleep');
          else if (g.dance && r < 0.36) this.enter('dance');
          else if (g.walk && r < 0.78) this.enter('walk');
          else { this.enter('idle'); this.next = 2 + hr(this.seed(), 6) * 4; }
        }
        break;
      }
      case 'walk': {
        this.p.vx = lerp(this.p.vx, this.p.facing * this.speed, dt * 4.5);
        this.p.walk += (Math.abs(this.p.vx) / (0.75 * this.p.s)) * TAU * dt;
        this.p.lift = Math.abs(Math.sin(this.p.walk)) * 0.012;
        this.p.rot = lerp(this.p.rot, 0, dt * 6);
        const s = this.spanAt(this.p.x);
        const m = this.p.s * 0.62 + 6;
        if (this.p.x - m < s.x && this.p.facing < 0) {
          if (this.hopTarget && this.hopTarget < s.x - 4) { this.hopTo(this.hopTarget); break; }
          this.p.facing = 1; this.p.vx = 0;
          if (!this.chasing) this.hopTarget = 0;
        } else if (this.p.x + m > s.x + s.w && this.p.facing > 0) {
          if (this.hopTarget && this.hopTarget > s.x + s.w + 4) { this.hopTo(this.hopTarget); break; }
          this.p.facing = -1; this.p.vx = 0;
          if (!this.chasing) this.hopTarget = 0;
        }
        if (this.st > this.dur && !this.hopTarget) this.enter('idle');
        break;
      }
      case 'drag': {
        this.p.vx = 0; this.p.vy = 0;
        this.p.squash = lerp(this.p.squash, 0.06, dt * 6);
        this.p.rot = lerp(this.p.rot, clamp(this.drag.vx * 0.0016, -.3, .3), dt * 8);
        break;
      }
      case 'fall': {
        this.p.vy += 2100 * dt;
        this.p.vx *= Math.pow(0.35, dt);
        this.p.x += this.p.vx * dt;
        this.p.y += this.p.vy * dt;
        this.p.squash = lerp(this.p.squash, -0.07, dt * 4);
        this.p.rot = lerp(this.p.rot, 0, dt * 5);
        if (this.p.y >= this.groundY()) {
          this.p.y = this.groundY();
          this.p.landSquash = clamp(0.18 + this.p.vy * 0.00006, 0.18, 0.4);
          this.p.vy = 0;
          this.enter('land', 0.34);
        }
        break;
      }
      case 'land': {
        this.p.squash = this.p.landSquash * Math.exp(-7 * this.st);
        if (this.st > this.dur) { this.p.squash = 0; this.enter('idle'); }
        break;
      }
      case 'sleep': {
        this.p.vx *= Math.pow(0.02, dt);
        this.p.squash = lerp(this.p.squash, 0.02, dt * 3);
        this.p.lift = Math.sin(B.t * 0.9) * 0.012;
        if (this.st > this.dur) {
          const ls = I18N.lines('lines.wake');
          this.say(ls[(hr(this.seed(), 7) * ls.length) | 0], 2.2);
          this.enter('idle');
        }
        break;
      }
      case 'dance': {
        this.p.squash = lerp(this.p.squash, 0, dt * 6);
        this.p.lift = Math.abs(Math.sin(B.t * 6)) * 0.05;
        this.p.rot = Math.sin(B.t * 3) * 0.06;
        if (this.st > this.dur) this.enter('idle');      // 跳一段就停，否则会一直跳下去
        break;
      }
      case 'chase': {
        // 朝着目标点赶路（自己选的，不是随机散步）
        const dx = this.goal - this.p.x;
        this.p.facing = dx >= 0 ? 1 : -1;
        this.p.vx = lerp(this.p.vx, this.p.facing * this.speed * 1.3, dt * 5);
        this.p.walk += (Math.abs(this.p.vx) / (0.75 * this.p.s)) * TAU * dt;
        this.p.lift = Math.abs(Math.sin(this.p.walk)) * 0.014;
        this.p.rot = lerp(this.p.rot, 0, dt * 6);
        if (Math.abs(dx) < this.p.s * 0.4 && Math.abs(this.p.vx) < this.p.s) { this.p.vx = 0; this.arrive(); break; }
        // 放弃条件看的是「距离有没有在缩短」，不是「走了多久」：
        // 目标是屏幕另一头的时候本来就要走几十秒，一刀切的时间限制会把正经的赶路也砍掉。
        const dist = Math.abs(dx);
        if (dist < this.chaseBest - 4) { this.chaseBest = dist; this.chaseStuck = 0; }
        else this.chaseStuck += dt;
        if (this.chaseStuck > 2.5) {
          this.plat = null;
          this.lastGround = null;
          this.p.vx = 0;
          this.enter('idle');
        }
        break;
      }
      case 'climb': {
        // 贴着窗口侧边爬（climbThen 决定往上到标题栏，还是往下回地面）
        if (!this.plat) { this.enter('fall'); break; }      // 平台中途没了（被拎起来 / 中止），别硬爬
        const target = this.climbThen === 'floor' ? this.floorY() : this.climbTo;
        const dir = target < this.p.y ? -1 : 1;
        this.p.vx = 0;
        this.p.walk += dt * 12;
        this.p.lift = 0;
        this.p.y += dir * Math.min(Math.abs(target - this.p.y), this.p.s * 1.6 * dt);
        this.p.rot = Math.sin(this.p.walk) * 0.12;
        this.p.squash = lerp(this.p.squash, 0.03, dt * 5);
        if (Math.abs(target - this.p.y) < 0.6) {
          this.p.y = target;
          this.p.rot = 0;
          if (this.climbThen === 'floor') this.reachFloor();
          else this.chaseTo(this.plat.x + this.plat.w / 2, 'top');
        } else if (this.st > 10) { this.leavePeek(true); }   // 爬不到就别耗着
        break;
      }
      case 'peek': {
        // 站在标题栏上往屏幕里瞅，脑袋左右慢慢晃
        this.p.vx *= Math.pow(0.02, dt);
        this.p.walk += dt * 2;
        this.p.lift = Math.sin(B.t * 1.4) * 0.01;
        this.p.rot = lerp(this.p.rot, 0, dt * 6);
        const k = Math.min(1, this.st / 0.7);
        this.p.squash = lerp(this.p.squash, -0.11 * k, dt * 5);   // 踮脚拉长
        this.p.facing = this.peekFace;
        this.look[0] = lerp(this.look[0], Math.sin(this.st * 1.6) * 0.5 * k, dt * 6);
        this.look[1] = lerp(this.look[1], 0.7 * k, dt * 6);          // 往屏幕里看
        if (this.st > this.dur) this.leavePeek();                    // 看完了就原路走回地面
        break;
      }
      case 'greet': {
        // 你回来啦 → 原地蹦两下
        this.p.vx *= Math.pow(0.02, dt);
        this.p.squash = Math.abs(Math.sin(this.st * 5.4)) * 0.14;
        this.p.lift = Math.abs(Math.sin(this.st * 5.4)) * 0.035;
        this.p.rot = Math.sin(this.st * 2.7) * 0.08;
        if (this.st > this.dur) { this.p.squash = 0; this.p.rot = 0; this.enter('idle'); }
        break;
      }
    }

    if (this.state === 'walk' || this.state === 'idle' || this.state === 'sleep' || this.state === 'dance' || this.state === 'chase') {
      this.p.x += this.p.vx * dt;
    }
    // 探头时踩在窗口标题栏那个"平台"上，边界和地板都以它为准
    const plat = this.onPlat();
    if (this.state !== 'climb') {              // 爬的时候横向是钉死的（贴着那面墙），别夹它
      const sp = plat ? this.plat : this.spanAt(this.p.x);
      const m = this.p.s * 0.55;
      this.p.x = sp.w > m * 2.2
        ? clamp(this.p.x, sp.x + m, sp.x + sp.w - m)
        : sp.x + sp.w / 2;
    }
    // 换屏了就掉下去（两块屏高度不同时）。在平台上时不算，它本来就该高高的。
    const gy = this.standY();
    if (!plat) {
      if (this.lastGround === null) this.lastGround = gy;
      else if (Math.abs(gy - this.lastGround) > 2 && this.state !== 'drag' && this.state !== 'fall') this.enter('fall');
      this.lastGround = gy;
    }
    // climb 要自己控制高度（不然一帧就被按回地板上了）
    if (this.state !== 'drag' && this.state !== 'fall' && this.state !== 'climb') this.p.y = gy;

    this.followCam();
  },

  /* ------------------------------------------------------ 窗口跟随 */
  // 期望的窗口左上角：让桌宠待在盒子中间那片区域，走到边上就把窗口推着走
  // 它头顶会伸到哪儿（相对脚下那一点）。bodyTop = -0.94s，帽子最多再占 0.45s，
  // 探头时会拉长（squash<0 把 y 放大），所以再留一点余量。这个值必须跟着体型走，
  // 不然大尺寸往上爬的时候脑袋会顶出画布上沿被切掉。
  // 实测值（带上最高的派对帽，扫画布第一行非透明像素量出来的）：站着 1.40s，探头拉伸后 1.55s。
  headroom() { return clamp(this.p.s * 1.55 + 8, 90, Math.max(90, this.H - 60)); },
  // 脚下要留的空间：影子（±0.06s）+ 一点余量
  bottomPad() { return clamp(this.p.s * 0.1 + 14, 20, Math.max(20, this.H * 0.4)); },

  wantCam() {
    const bw = this.W, bh = this.H, wd = this.world;
    const p = this.p;
    const mx = clamp(p.s * 0.8, 90, bw * 0.42);
    const myTop = this.headroom(), myBot = this.bottomPad();
    let cx = this.cam.x, cy = this.cam.y;
    const rx = p.x - cx;
    if (rx < mx) cx = p.x - mx; else if (rx > bw - mx) cx = p.x - (bw - mx);
    const ry = p.y - cy;
    if (ry < myTop) cy = p.y - myTop;
    else if (ry > bh - myBot) cy = p.y - (bh - myBot);
    return {
      x: clamp(cx, wd.x0, Math.max(wd.x0, wd.x0 + wd.w - bw)),
      y: clamp(cy, wd.y0, Math.max(wd.y0, wd.y0 + wd.h - bh + 14)),   // 底部多留 14px 给影子
    };
  },
  snapCam() {
    const c = this.wantCam();
    this.cam.x = c.x;
    this.cam.y = c.y;
    if (window.petHost && window.petHost.moveWindow) {
      window.petHost.moveWindow(c.x, c.y).catch(() => {});
    }
  },
  // 窗口位置和绘制位置必须用同一个值：先把 cam 乐观地改掉再去要窗口移动，
  // 等 IPC 回来再校准。否则每帧差 1~2px，桌宠看起来就在抖。
  followCam() {
    const c = this.wantCam();
    const nx = Math.round(c.x), ny = Math.round(c.y);
    if (nx === Math.round(this.cam.x) && ny === Math.round(this.cam.y)) return;
    this.cam.x = nx; this.cam.y = ny;                  // 先乐观更新，绘制不能等 IPC
    if (!window.petHost || !window.petHost.moveWindow) return;
    // 一帧一个 invoke，主进程一忙（比如菜单的嵌套消息循环）就会积一大堆过期请求，
    // 等它缓过来还得一个个 setBounds，窗口会明显抽一下。所以一次只放一个在飞：
    // 有请求在路上时只记住最新目标，等它回来再发。
    this.camWant = { x: nx, y: ny };
    if (this.camInFlight) return;
    this.camInFlight = true;
    const send = () => {
      const t = this.camWant;
      if (!t) { this.camInFlight = false; return; }
      this.camWant = null;
      const seq = ++this.camSeq;
      window.petHost.moveWindow(t.x, t.y).then((b) => {
        if (seq === this.camSeq && (b.x !== t.x || b.y !== t.y)) {
          this.cam.x = b.x;                            // 被系统夹住了才回弹
          this.cam.y = b.y;
        }
        send();                                        // 还有新目标就接着发
      }).catch(() => { this.camInFlight = false; });
    };
    send();
  },

  /* -------------------------------------------------------- 眼神跟随 */
  updateLook(dt) {
    if (this.mx < 0 || !Settings.data.look) { this.look[0] = lerp(this.look[0], 0, dt * 6); this.look[1] = lerp(this.look[1], 0, dt * 6); return; }
    const dx = (this.mx - this.p.x) / (this.p.s * 2.2);
    const dy = (this.my - (this.p.y - this.p.s * 0.55)) / (this.p.s * 2.2);
    this.look[0] = lerp(this.look[0], clamp(dx, -1, 1), dt * 7);
    this.look[1] = lerp(this.look[1], clamp(dy, -1, 1), dt * 7);
  },

  /* ------------------------------------------------------------ 气泡 */
  say(text, dur) {
    if (!text) return;
    if (!Settings.data.bubble) return;
    this.bubble = { text: String(text), shown: 0, t: 0, life: dur === undefined ? Infinity : dur, fromChat: false };
  },
  sayChat(text) {
    const t = String(text == null ? '' : text);
    if (!t) return;
    this.bubble = { text: t, shown: 0, t: 0, life: Infinity, fromChat: true, thinking: false };
  },
  // 「在思考」：三个跳动的小点。比一条还没打完的空长条好看
  thinking(on) {
    if (on) {
      if (!Settings.data.bubble) return;
      if (this.bubble && this.bubble.thinking) return;
      this.bubble = { text: '', shown: 1, t: 0, life: Infinity, fromChat: true, thinking: true };
      return;
    }
    if (this.bubble && this.bubble.thinking) this.bubble = null;
  },
  clearBubble() { this.bubble = null; },
  updateBubble(dt) {
    const b = this.bubble;
    if (!b) return;
    b.t += dt;
    if (b.thinking) { b.shown = 1; return; }
    if (b.shown < b.text.length) b.shown = Math.min(b.text.length, b.shown + dt * 42);
    else if (b.life !== Infinity && b.t > b.life) this.bubble = null;
  },

  /* ------------------------------------------------------------ 表情 */
  face() {
    if (this.mood && this.moodT > 0) return this.mood;
    switch (this.state) {
      case 'sleep': return { eyes: 'closed', mouth: 'o', blink: false, blush: false };
      case 'drag': return { eyes: 'wide', mouth: 'o', blink: false, blushA: .3 };
      case 'fall': return { eyes: 'wide', mouth: 'o', blushA: .3 };
      case 'land': return { eyes: 'happy', mouth: 'smile' };
      case 'dance': return { eyes: 'happy', mouth: 'grin' };
      case 'greet': return { eyes: 'heart', mouth: 'grin' };
      case 'peek': return { eyes: 'happy', mouth: 'o' };
      case 'climb': return { eyes: 'open', mouth: 'w' };
      default: return { eyes: 'open', mouth: 'smile' };
    }
  },
  setMood(m, dur) { this.mood = m; this.moodT = dur || 1.6; },

  /* ------------------------------------------------------------ 绘制 */
  draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, this.W, this.H);        // 透明窗口：不清会叠出一串残影
    const f = this.face();
    // 腿部动画要跟着「在动」的状态走。以前只有 walk 才给相位，
    // 于是 chase（赶去窗口那边）和 climb（爬墙）里 p.walk 明明在推进，
    // 画的时候却被当成 null 丢掉 —— 表现就是它一路滑过去、贴着墙往上飘，腿是直的。
    // peek 不算：那时候它已经站在标题栏上不动了，腿就该站直。
    const stepping = this.state === 'walk' || this.state === 'chase' || this.state === 'climb';
    const o = {
      walk: stepping ? this.p.walk : null,
      squash: this.p.squash,
      lift: this.p.lift,
      rot: this.p.rot,
      flip: this.p.facing < 0,
      eyes: f.eyes,
      mouth: this.state === 'dance' ? f.mouth : (f.mouth === 'o' ? singMouth(B.t) * 0.8 + 0.2 : f.mouth),
      look: this.look,
      blink: f.blink,
      blush: f.blush !== false,
      blushA: f.blushA,
      dangle: this.state === 'drag',
      hat: Settings.data.hat,
      color: Settings.data.color || undefined,
    };
    if (this.state === 'dance') Object.assign(o, dancePose(B.t, 1));
    if (this.state === 'fall') o.walk = null;

    clawd(this.X(this.p.x), this.Y(this.p.y), this.p.s, o);

    if (this.state === 'sleep') zzz(this.X(this.p.x + this.p.s * 0.34), this.Y(this.p.y - this.p.s * 0.95), B.t, this.p.s * 0.34);
    if (this.state === 'land' && this.st < 0.18) this.drawDust();
    this.drawName();
    if (this.bubble) this.drawBubble();
  },

  drawDust() {
    const k = 1 - this.st / 0.18;
    const cx = this.X(this.p.x), cy = this.Y(this.p.y);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      const r = this.p.s * (0.5 + (1 - k) * 0.5);
      dot(cx + Math.cos(a) * r, cy - Math.abs(Math.sin(a)) * 4 - 2, (1.2 + k * 2) * this.p.s / 150, PAL.ink, 0.22 * k);
    }
  },

  // 名牌：贴在身体下半部分（脸下面那块空地），像一张贴纸，不跟着身体镜像
  drawName() {
    const nm = (Settings.data.name || '').trim();
    if (!nm || !Settings.data.showName) return;
    const s = this.p.s;
    const size = clamp(s * 0.085, 10, 22);
    const w = handWidth(nm, size) + size * 0.85;
    const h = size * 1.36;
    const cx = this.X(this.p.x) + (this.p.facing < 0 ? 0.05 * s : -0.05 * s);
    const cy = this.Y(this.p.y) - s * 0.36;            // clawd 身体下缘在 -0.20s，嘴角在 -0.54s，中间这块刚好
    const m = MX.chain(MX.T(cx, cy), MX.R(this.p.rot - 0.07));
    const lw = Math.max(1.4, s * 0.015);
    alpha(.22, () => fillP(MX.ap(m, rrectPts(-w / 2 + 1.5, -h / 2 + 2, w, h, h * 0.3, 3)), PAL.ink, { amp: .6, tex: null, seed: 299 }));
    sh(MX.ap(m, rrectPts(-w / 2, -h / 2, w, h, h * 0.3, 3)), { fill: PAL.white, stroke: PAL.ink, w: lw, amp: .5, famp: .9, tex: null, seed: 300 });
    fillP(MX.ap(m, rectPts(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.2)), PAL.red, { amp: .35, tex: null, seed: 301 });
    ctx.save();
    ctx.transform(...m);
    hand(nm, 0, size * 0.36, { size, color: PAL.ink, jit: .4, seed: 302 });
    ctx.restore();
  },

  // 气泡最多这么多行。完整回复在聊天窗里，气泡只管“它在说什么”——
  // 不限制的话一句长回复能擑到 29 行、比 480 高的窗口还高（英文一句顶中文两三句，尤其实）。
  fitLines(text, size, maxW) {
    const lines = handWrap(text, size, maxW);
    const MAX = 7;
    if (lines.length <= MAX) return lines;
    const cut = lines.slice(lines.length - MAX);
    cut[0] = '…' + cut[0];
    // 加了省略号可能又超宽，从左边再收一点
    while (cut[0].length > 2 && handWidth(cut[0], size) > maxW) cut[0] = cut[0].slice(1);
    return cut;
  },
  // 气泡摆在哪：默认头顶，头顶放不下就翻到脚下，两边都放不下就夹在画布里。
  // 以前只有「头顶放不下就翻到脚下」一步 —— 而窗口只有 480 高（h=345 时头顶的起点
  // 已经是 -47），翻到脚下直接掉到 849，整块看不见。英文句子一长就特别容易触发。
  placeBubble(py, s, h) {
    const top = 4, bottom = this.H - 4;
    const aboveAt = py - s * 1.12 - h;
    const belowAt = py + s * 0.25;
    if (aboveAt >= top) return { y: aboveAt, below: false };
    if (belowAt + h <= bottom) return { y: belowAt, below: true };
    return { y: clamp(bottom - h, top, Math.max(top, aboveAt)), below: false };
  },

  drawBubble() {
    const b = this.bubble;
    if (!b) return;
    if (b.thinking) return this.drawThinking();
    if (b.shown < 1) return;                  // 第一个字还没出来就先别吹泡泡
    const s = this.p.s;
    const size = clamp(s * 0.085, 11, 22);
    const maxW = Math.min(clamp(s * 3.1, 130, 460), Math.max(80, this.W - 20));
    const shown = b.text.slice(0, Math.floor(b.shown));
    const lines = this.fitLines(shown, size, maxW);
    const pad = size * 0.62;
    let w = 0;
    for (const l of lines) w = Math.max(w, handWidth(l, size));
    w = Math.min(Math.max(w + pad * 2, size * 2.4), this.W - 10);
    const lh = size * 1.32;
    const h = lines.length * lh + pad * 1.1;
    const lw = Math.max(1.6, s * 0.019);
    const px = this.X(this.p.x), py = this.Y(this.p.y);
    const at = this.placeBubble(py, s, h);
    const x = clamp(px - w / 2, 5, Math.max(5, this.W - w - 5));
    const y = at.y;
    this.bubbleBox = { x, y, w, h, below: at.below, lines: lines.length };   // 自检要看这个
    const tx = clamp(px, x + w * 0.28, x + w * 0.72);
    const tail = at.below
      ? [[tx - 10, y - 2], [tx, y - 13], [tx + 10, y - 2]]
      : [[tx - 10, y + h - 1], [tx, y + h + 12], [tx + 10, y + h - 1]];
    sh(tail, { fill: PAL.white, stroke: PAL.ink, w: lw, amp: .5, famp: .8, tex: null, seed: 320 });
    sh(rrectPts(x, y, w, h, 12, 3), { fill: PAL.white, stroke: PAL.ink, w: lw, amp: .7, famp: 1.1, tex: null, seed: 321 });
    for (let i = 0; i < lines.length; i++) {
      hand(lines[i], x + w / 2, y + pad * 0.75 + size * 0.85 + i * lh, { size, color: PAL.ink, jit: .5, seed: 330 + i });
    }
  },

  // 等回复时的小泡泡：三个依次跳起来的小点
  drawThinking() {
    const s = this.p.s;
    const size = clamp(s * 0.085, 11, 22);
    const w = size * 2.7, h = size * 1.75;
    const lw = Math.max(1.6, s * 0.019);
    const px = this.X(this.p.x), py = this.Y(this.p.y);
    const at = this.placeBubble(py, s, h);
    const x = clamp(px - w / 2, 5, Math.max(5, this.W - w - 5));
    const y = at.y;
    const tx = clamp(px, x + w * 0.3, x + w * 0.7);
    const tail = at.below
      ? [[tx - 9, y - 2], [tx, y - 12], [tx + 9, y - 2]]
      : [[tx - 9, y + h - 1], [tx, y + h + 11], [tx + 9, y + h - 1]];
    sh(tail, { fill: PAL.white, stroke: PAL.ink, w: lw, amp: .5, famp: .8, tex: null, seed: 340 });
    sh(rrectPts(x, y, w, h, h * 0.46, 3), { fill: PAL.white, stroke: PAL.ink, w: lw, amp: .6, famp: .9, tex: null, seed: 341 });
    const cy = y + h * 0.54;
    for (let i = 0; i < 3; i++) {
      const ph = ((B.t * 2.4 - i * 0.26) % 1.5 + 1.5) % 1.5;   // 错开相位，看起来是一波一波的
      const k = Math.sin(ph / 1.5 * Math.PI);
      dot(x + w * (0.29 + i * 0.21), cy - Math.max(0, k) * size * 0.28,
        size * 0.115 * (1 + Math.max(0, k) * 0.18), PAL.ink, 0.4 + Math.max(0, k) * 0.6);
    }
  },

  /* ---------------------------------------------------- 命中 / 指针 */
  hitWorld(wx, wy) {
    const s = this.p.s;
    const dx = (wx - this.p.x) / (s * 0.78);
    const dy = (wy - (this.p.y - s * 0.47)) / (s * 0.72);
    return dx * dx + dy * dy <= 1;
  },
  hit(mx, my) { return this.hitWorld(mx + this.cam.x, my + this.cam.y); },

  bindPointer() {
    const cv = this.canvas;
    cv.addEventListener('mousemove', (e) => this.onMove(e.clientX, e.clientY));
    cv.addEventListener('mousedown', (e) => {
      if (e.button === 2) return;
      this.onDown(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', (e) => this.onUp(e.clientX, e.clientY));
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.hit(e.clientX, e.clientY)) return;
      if (window.petHost) window.petHost.openMenu(menuSpec());
      else showDomMenu(e.clientX, e.clientY);
    });
    cv.addEventListener('dblclick', (e) => {
      if (!this.hit(e.clientX, e.clientY)) return;
      // 双击的第二次 mousedown 会把它「拎起来」，而那次 mouseup 往往落到刚弹出的聊天窗上，
      // 本窗口收不到 → this.drag 永远解不掉，桌宠就卡在拖拽状态不动了。这里先松手。
      if (this.drag) this.onUp();
      if (this.state === 'sleep') this.wake();
      else this.openChat();
    });
    // 兜底：窗口失焦 / 指针被系统抢走 / 页面藏了，都把拖拽解开
    window.addEventListener('blur', () => { if (this.drag) this.onUp(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.drag) this.onUp(); });
    cv.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this.onMove(t.clientX, t.clientY);
      this.onDown(t.clientX, t.clientY);
    }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      this.onMove(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchend', () => this.onUp());
  },

  onMove(x, y) {
    this.mx = x + this.cam.x;
    this.my = y + this.cam.y;
    this.syncHover();
    if (this.drag) {
      this.drag.age = 0;
      const nx = clamp(x + this.cam.x + this.drag.dx, 0, this.world.w);
      const ny = clamp(y + this.cam.y + this.drag.dy, 0, this.world.h);
      const vx = (nx - this.p.x) * 60;
      const vy = (ny - this.p.y) * 60;
      this.drag.vx = lerp(this.drag.vx, vx, 0.5);
      this.drag.vy = lerp(this.drag.vy, vy, 0.5);
      this.drag.moved += Math.abs(nx - this.p.x) + Math.abs(ny - this.p.y);
      this.p.x = nx; this.p.y = ny;
    } else if (this.hover && this.state === 'sleep') {
      this.wake(true);
    }
  },

  // 命中检测 + 鼠标穿透开关。除了 mousemove，每帧也查一次——
  // 桌宠自己走开而鼠标没动时，Chromium 不会再发 mousemove，靠这个才能把穿透恢复回去。
  syncHover() {
    const over = this.mx >= 0 ? this.hitWorld(this.mx, this.my) : false;
    if (over === this.hover) return;
    this.hover = over;
    if (!window.petHost) document.body.style.cursor = over ? 'grab' : 'default';
    if (window.petHost && window.petHost.setClickThrough) {
      window.petHost.setClickThrough(Settings.data.clickThrough ? !over : false);
    }
  },

  onDown(x, y) {
    if (this.paused) return;                        // 右键菜单开着，别把它拎起来
    if (this.state === 'sleep') { this.wake(); return; }
    if (!Settings.data.drag || !this.hit(x, y)) return;
    this.drag = { dx: this.p.x - (x + this.cam.x), dy: this.p.y - (y + this.cam.y), vx: 0, vy: 0, moved: 0, age: 0 };
    this.abortPeek();                       // 被拎起来了就别再挂在标题栏上
    this.enter('drag');
    if (!window.petHost) document.body.style.cursor = 'grabbing';
  },

  onUp(x, y) {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    if (!window.petHost) document.body.style.cursor = this.hover ? 'grab' : 'default';
    if (d.moved < 7) {
      this.poke();
      // 单击 = 摸头。但别忘了把状态从 'drag' 里放出来！
      // 以前这里直接 return，this.drag 已经置空而 state 还留在 'drag'：
      //   face() 永远返回 eyes:'wide'（就是那个睁大眼睛的表情），
      //   update() 的 drag 分支把 vx/vy 按死，它再也不会走路，
      //   而拖拽看门狗查的是 this.drag（已是 null），救不回来。
      this.enter(this.p.y >= this.groundY() - 1 || !Settings.data.gravity ? 'idle' : 'fall');
      return;
    }
    if (Settings.data.gravity) {
      this.p.vx = clamp(d.vx, -900, 900);
      this.p.vy = clamp(d.vy, -1400, 400);
      this.enter('fall');
    } else {
      this.p.y = this.groundY();
      this.enter('idle');
    }
    void x; void y;
  },

  poke() {
    this.setMood({ eyes: 'heart', mouth: 'grin', blushA: .9 }, 2.4);
    this.p.squash = 0.1;
    const ls = I18N.lines('lines.poke');
    this.say(ls[(hr((B.t * 1000) | 0, 3) * ls.length) | 0], 2);
  },

  wake(quiet) {
    if (this.state !== 'sleep') return;
    this.enter('idle');
    this.setMood({ eyes: 'happy', mouth: 'w', blushA: .7 }, 1.2);
    if (!quiet) {
      const ls = I18N.lines('lines.wake');
      this.say(ls[(hr((B.t * 1000) | 0, 9) * ls.length) | 0], 2.2);
    }
  },
};
