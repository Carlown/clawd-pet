// settings.js — 配置：浏览器里存 localStorage，Electron 里走主进程（userData/settings.json）
'use strict';

const SETTINGS_KEY = 'clawd.settings';

// 体型档位。右键菜单和设置窗下拉框必须用同一份 ——
// 以前两边各写各的（菜单是 100/150/200/260，设置窗是 90/120/150/200/260），
// 于是「右键选 100px → 去设置窗点保存」这一下：下拉框里没有 100，
// 浏览器会把 value 置空，Number('') = 0，桌宠当场消失而且再也点不到。
const SIZE_CHOICES = [90, 120, 150, 200, 260];

const DEFAULTS = {
  // ---- 行为开关（右键菜单里可逐个勾掉）----
  walk: true,          // 自主散步
  drag: true,          // 可拖拽
  gravity: true,       // 重力落地
  look: true,          // 眼神跟随鼠标
  idle: true,          // 待机小动作 / 犯困睡觉
  bubble: true,        // 说话气泡
  dance: false,        // 踩点跳舞
  peek: true,          // 你切窗口时它爬到那个标题栏上探头张望
  idleGreet: true,     // 你锁屏离开再回来，它换个姿势打招呼
  chat: false,         // 「能不能聊天」总开关（双击/右键「聊两句…」会看这个）
  showName: true,      // 名牌开/关（与名牌文字分开）

  // ---- 外观 ----
  lang: 'zh',          // 界面语言：zh | en（只认这两个，其它值一律当 zh）
  hat: '',             // party beret hard cap crown night headphones
  color: '',           // 自定义体色，空 = 默认黏土橙
  size: 150,           // 身体宽度 px
  name: 'Claude',      // 名牌文字

  // ---- 宿主窗口 ----
  clickThrough: true,  // 平时鼠标穿透，不挡桌面；关掉就是整层可交互
  alwaysOnTop: true,
  autoLaunch: false,

  // ---- 对话（base / key / 模型全部可自定义，不绑定官方）----
  apiProvider: 'auto', // auto | anthropic | openai
  apiBase: 'https://api.anthropic.com',
  apiKey: '',
  apiModel: '',
  temperature: 0.8,
  // 默认人设按语言给（英文版在 src/i18n.js 的 sysPrompt）。这里放中文那份当底，
// Settings.syncPrompt() 会在「还是默认值」时跟着当前语言换成对应那版。
systemPrompt: I18N.promptFor('zh'),
};

const Settings = {
  data: Object.assign({}, DEFAULTS),
  get(k) { return this.data[k]; },
  set(k, v) { this.data[k] = v; },

  // settings.json 是可能被手改过的（旧版本、手滑、别的工具写进去的）。
  // 而 size=0 会让桌宠既画不出来（s=0）又点不到（命中检测除以 0 → 全是 Infinity），
  // 进了这个状态就只能杀进程重开。这里把坏值掰回最近的合法档位。
  sanitize() {
    const d = this.data;
    const sz = Number(d.size);
    if (!isFinite(sz)) d.size = DEFAULTS.size;
    else if (SIZE_CHOICES.indexOf(sz) < 0) {
      // 不在列表里（比如旧版菜单里的 100px）：就近归一，不丢用户设置
      d.size = SIZE_CHOICES.reduce((a, b) => (Math.abs(b - sz) < Math.abs(a - sz) ? b : a));
    } else d.size = sz;
    const tp = Number(d.temperature);
    d.temperature = isFinite(tp) ? Math.max(0, Math.min(2, tp)) : DEFAULTS.temperature;
    if (I18N.LANGS.indexOf(d.lang) < 0) d.lang = 'zh';
    return d;
  },

  // 人设默认文案是按语言给的（src/i18n.js 的 sysPrompt）。
  // 但只在这个值「还是某一版默认值」时才跟着语言换 —— 用户自己改过的永远不动，
  // 否则一切换语言就把人家写的人设冲掉了。
  syncPrompt() {
    const cur = this.data.systemPrompt;
    if (!cur || cur === I18N.promptFor('zh') || cur === I18N.promptFor('en')) {
      this.data.systemPrompt = I18N.defaultPrompt();
    }
  },
  // 语言是全局的：改完立刻让 i18n 表生效，DOM 上的 data-i18n 也跟着刷。
  applyLang() {
    const l = I18N.setLang(this.data.lang);
    I18N.applyI18n(document);
    return l;
  },
  async load() {
    try {
      if (window.petHost && window.petHost.getSettings) {
        const got = await window.petHost.getSettings();
        this.data = Object.assign({}, DEFAULTS, got || {});
      } else {
        this.data = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
      }
    } catch (e) {
      this.data = Object.assign({}, DEFAULTS);
    }
    this.sanitize();
    this.applyLang();
    this.syncPrompt();
    return this.data;
  },
  async save(patch) {
    Object.assign(this.data, patch || {});
    this.sanitize();
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'lang')) {
      this.applyLang();
      this.syncPrompt();
    }
    try {
      if (window.petHost && window.petHost.saveSettings) await window.petHost.saveSettings(this.data);
      else localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data));
    } catch (e) { /* 存不了就算了，不影响跑 */ }
    return this.data;
  },
  reset() {
    this.data = Object.assign({}, DEFAULTS);
    this.applyLang();
    return this.save({});
  },
  // 桌宠最终采用的体型。Settings.sanitize() 已经滤过一次，这里再兜一层：
  // 万一有人绕过 Settings 直接改 Settings.data.size，Pet 也不能画成 0。
  bodySize() {
    const s = Number(this.data.size);
    if (!isFinite(s)) return DEFAULTS.size;
    return Math.max(SIZE_CHOICES[0], Math.min(SIZE_CHOICES[SIZE_CHOICES.length - 1], s));
  },
};
