// i18n.js — 中英文文案表。
// 同一份表两处用：
//   渲染进程（经典脚本，app/index.html / dev/index.html / app/*.html）：顶层 const I18N；
//   主进程（CommonJS）：require('../src/i18n.js') —— 托盘菜单、窗口标题、原生对话框、
//   对话报错全在主进程，那边没有 DOM，两边共用一份字符串才不会漏翻。
// 查不到 key 时回退中文，再查不到就把 key 原样吐出来（宁可露 key 也不要露空）。
'use strict';

const LANGS = ['zh', 'en'];
const FALLBACK = 'zh';

const STRINGS = {
  zh: {
    // ---- 人设（跟着语言走：没自定义过的人设会随语言切）----
    sysPrompt: '你是桌宠「小蟹」——一只黏土橙色的蜡笔小螃蟹，说话简短、有点憨憨、爱用短句。不要用 markdown，不要列清单。',

    // ---- 桌宠台词 ----
    'lines.idle': ['今天也搬砖呢', '摸鱼中……', '螃蟹也会腰疼', '在呢在呢', '要不要休息一下',
      '我在这儿盯着呢', '喝水了吗', '别一直坐着呀', '刚刚是不是叫我', '在摸了'],
    'lines.poke': ['嘿嘿，痒', '再摸一下下', '壳都红了', '舒服～', '别戳了啦'],
    'lines.wake': ['唔……我睡着了？', '几点了', '我梦到海了'],
    'lines.back': ['诶，你回来啦', '你终于回来了', '我等你好久了', '嘿！刚在想你'],
    'lines.backLong': ['哇——好久不见！', '你消失了好久哦', '回来啦！我都快睡着了'],
    'lines.peek': ['在看什么呢', '这个窗口我认识', '让我瞅瞅', '在忙什么呀'],
    'pet.chatOn': '想聊就双击我',
    'pet.chatOff': '还没开聊天功能，右键里勾上就行',
    'pet.webOnly': '网页版聊不了，得用桌面版',

    // ---- 对话（桌宠气泡里的那几句）----
    'chat.err': '出错了',
    'chat.hmm': '唔…',
    'chat.webNoApi': '网页版连不上 API，聊天要去桌面版哦',
    'chat.noKey': '还没配 Key 呢',

    // ---- 右键菜单 ----
    'menu.hat': '帽子',
    'menu.color': '颜色',
    'menu.size': '大小',
    'menu.lang': '语言 / Language',
    'menu.walk': '自主散步',
    'menu.drag': '可以拖拽',
    'menu.gravity': '重力落地',
    'menu.look': '眼神跟随鼠标',
    'menu.idle': '待机小动作',
    'menu.bubble': '说话气泡',
    'menu.dance': '踩点跳舞',
    'menu.showName': '显示名牌',
    'menu.peek': '切窗口就探头',
    'menu.idleGreet': '回来时打招呼',
    'menu.chat': '聊两句…',
    'menu.name': '名牌文字…',
    'menu.clickThrough': '鼠标穿透（不挡桌面）',
    'menu.alwaysOnTop': '总在最前',
    'menu.autoLaunch': '开机自启',
    'menu.settings': '设置…',
    'menu.recenter': '重新放回屏幕底部',
    'menu.webOnly': '在网页里只能看看（聊天/设置需要桌面版）',
    'menu.quit': '退出',
    'menu.namePrompt': '名牌上写什么？（留空清空文字；要不要显示用「显示名牌」开关）',

    // ---- 帽子 / 体色（菜单和设置窗共用）----
    'hat.none': '不戴帽子',
    'hat.party': '派对帽',
    'hat.beret': '贝雷帽',
    'hat.hard': '安全帽',
    'hat.cap': '棒球帽',
    'hat.crown': '小皇冠',
    'hat.night': '睡帽',
    'hat.headphones': '耳机',
    'color.none': '黏土橙',
    'color.yellow': '柠檬黄',
    'color.blue': '天空蓝',
    'color.lavender': '薰衣草',
    'color.mint': '薄荷绿',
    'color.pink': '草莓粉',
    'color.cream': '牛奶灰',

    // ---- 语言名（两种语言里都写成各自的母语）----
    'lang.zh': '中文',
    'lang.en': 'English',

    // ---- 托盘 ----
    'tray.toggle': '显示 / 隐藏桌宠',
    'tray.recenter': '重新放回屏幕底部',
    'tray.settings': '设置…',
    'tray.sheet': '调试表情表',
    'tray.quit': '退出',

    // ---- 窗口标题 / 原生对话框 ----
    'win.settings': 'ClawdPet 设置',
    'win.name': '名牌文字',
    'win.chat': '跟小蟹聊两句',
    'win.dev': 'clawd 调试台',
    'dev.missing': '调试文件没打包进来',
    'dev.missingHint': '找不到 dev/index.html。',
    'dev.missingFix': '在源码目录跑 npm run dist 重新打包即可（package.json 的 build.files 要含 dev/**/*）。',
    'confirm.cancel': '取消',
    'confirm.ok': '确定',
    'confirm.def': '确定吗？',

    // ---- 主进程里的对话报错 ----
    'err.noKey': '还没填 API Key，去设置里配一下',
    'err.noModel': '还没填模型名，去设置里填一个（任意 id 都行）',
    'err.request': '请求失败',
    'err.noKeyShort': '还没填 API Key',
    'err.noModelShort': '还没填模型名',
    'err.failed': '失败',
    'err.fallback': 'Anthropic 格式不通，换 OpenAI 格式重试…',
    'test.hello': '你好',

    // ---- 聊天窗 ----
    'chat.noModel': '未设模型',
    'chat.noKeySys': '还没填 API Key，点桌宠右键「设置…」配一下',
    'chat.failed': '失败',
    'chat.greeting': '在呢，说吧。',
    'chat.ph': '说点什么…',
    'chat.send': '发送',
    'chat.stop': '停',

    // ---- 名牌窗 ----
    'name.ph': '留空就没有文字',
    'name.cancel': '取消',
    'name.ok': '确定',
    'name.hint': '画不画这个名牌由右键菜单里的「显示名牌」开关决定。',

    // ---- 设置窗 ----
    'set.sub': '改完点「保存」，桌宠立刻生效。',
    'set.h.behavior': '它的一举一动',
    'set.l.walk': '自主散步（没人管它也会自己走）',
    'set.l.drag': '可以拖拽（拎起来会晃腿，丢下去会弹一下）',
    'set.l.gravity': '重力落地',
    'set.l.look': '眼神跟着鼠标',
    'set.l.idle': '待机小动作（久坐会睡着冒 z）',
    'set.l.bubble': '说话气泡',
    'set.l.dance': '踩点跳舞',
    'set.l.peek': '切窗口就探头（它会爬到那个窗口的标题栏上张望）',
    'set.l.idleGreet': '回来时打招呼（你锁屏走开再回来，它换个姿势迎你）',
    'set.l.showName': '显示名牌（名字写在下面那栏）',
    'set.peek.testing': '正在检测能不能读到前台窗口…',
    'set.peek.ok': '✓ 能读到前台窗口（当前：{title}）',
    'set.peek.bad': '✗ 读不到前台窗口，探头张望不会动：{err}',
    'set.peek.nomain': '✗ 问不到主进程',
    'set.f.peekGap': '探头间隔（秒）',
    'set.hint.peekGap': '探完一次要歇这么多秒才会去探下一个窗口。关窗口、开窗口挨着来的时候，调大一点它就不跟着每个窗口跑了。',
    'set.h.look': '长什么样',
    'set.f.hat': '帽子',
    'set.f.none': '不戴',
    'set.f.color': '体色',
    'set.f.size': '大小 px',
    'set.f.name': '名牌文字',
    'set.f.namePh': '留空就没有文字',
    'set.f.lang': '语言',
    'set.h.win': '窗口',
    'set.l.clickThrough': '鼠标穿透（平时不挡桌面，鼠标碰到它才可点）',
    'set.l.alwaysOnTop': '总在最前',
    'set.l.autoLaunch': '开机自动启动',
    'set.h.chat': '说话（API 随便填，不限官方）',
    'set.l.chat': '启用对话功能（关掉后，双击它和右键「聊两句…」都不会开聊天窗）',
    'set.f.provider': '格式',
    'set.f.providerAuto': '自动探测（先 Anthropic，不通换 OpenAI）',
    'set.f.providerAnthropic': 'Anthropic 格式 /v1/messages',
    'set.f.providerOpenAI': 'OpenAI 格式 /v1/chat/completions',
    'set.f.apiBase': '接口地址',
    'set.f.apiBasePh': 'https://api.anthropic.com 或你的中转地址',
    'set.f.apiModel': '模型名',
    'set.f.apiModelPh': '例如 claude-sonnet-4-5 / gpt-4o / 你的中转模型 id',
    'set.f.apiKey': 'API Key',
    'set.f.apiKeyPh': '用系统钥匙串加密后存本地',
    'set.f.temperature': '温度',
    'set.f.systemPrompt': '人设',
    'set.hint.api': '地址可以只写到 https://xxx.com、https://xxx.com/v1，也可以直接粘完整的 /v1/messages 或 /v1/chat/completions。Key 只存在本机，用 Electron safeStorage 加密。',
    'set.save': '保存',
    'set.test': '测试连接',
    'set.reset': '恢复默认',
    'set.saved': '已保存 ✓',
    'set.testing': '测试中…',
    'set.testOk': '连上了 ✓ 用的 {via} 格式，模型 {model}',
    'set.resetQ': '恢复默认设置？',
    'set.resetD': 'API Key 也会被清掉。',
    'set.resetDone': '已恢复默认',
  },

  en: {
    sysPrompt: 'You are "Clawd", a clay-orange crayon crab living on the desktop. Keep replies short, a little dopey, prefer short sentences. No markdown, no bullet lists.',

    'lines.idle': ['Still clocking in', 'Slacking off…', 'Crabs get backaches too', "I'm here", 'Take a break?',
      "I'm just watching", 'Had some water?', "Don't just sit there", 'Did you call me?', 'Patting'],
    'lines.poke': ['Hehe, ticklish', 'One more pat', 'My shell is red now', 'So comfy', 'Stop poking me'],
    'lines.wake': ['Mm… did I fall asleep?', "What time is it?", 'I was dreaming of the sea'],
    'lines.back': ['Hey, you are back', 'You finally came back', 'I waited so long', 'Hi! I was thinking of you'],
    'lines.backLong': ['Whoa—ages away!', 'You vanished for ages', "You're back! I nearly fell asleep"],
    'lines.peek': ['Whatcha looking at', 'I know that window', 'Let me peek', 'Whatcha busy with'],
    'pet.chatOn': 'Double-click me to chat',
    'pet.chatOff': 'Chat is off — tick it in the right-click menu',
    'pet.webOnly': 'The web build can’t chat — use the desktop app',

    'chat.err': 'Something went wrong',
    'chat.hmm': 'hmm…',
    'chat.webNoApi': 'The web build can’t reach the API — chat lives in the desktop app',
    'chat.noKey': 'No API key yet',

    'menu.hat': 'Hat',
    'menu.color': 'Colour',
    'menu.size': 'Size',
    'menu.lang': 'Language / 语言',
    'menu.walk': 'Wander on its own',
    'menu.drag': 'Let me be dragged',
    'menu.gravity': 'Gravity',
    'menu.look': 'Eyes follow the mouse',
    'menu.idle': 'Idle fidgeting',
    'menu.bubble': 'Speech bubbles',
    'menu.dance': 'Dance to the beat',
    'menu.showName': 'Show name tag',
    'menu.peek': 'Peek when you switch windows',
    'menu.idleGreet': 'Greet you when you’re back',
    'menu.chat': 'Chat a little…',
    'menu.name': 'Name tag…',
    'menu.clickThrough': 'Click-through (don’t block the desktop)',
    'menu.alwaysOnTop': 'Always on top',
    'menu.autoLaunch': 'Launch at login',
    'menu.settings': 'Settings…',
    'menu.recenter': 'Put it back at the bottom',
    'menu.webOnly': 'In the browser you can only look around (chat & settings need the desktop app)',
    'menu.quit': 'Quit',
    'menu.namePrompt': 'What should the name tag say? (blank clears it; use "Show name tag" to toggle it)',

    'hat.none': 'No hat',
    'hat.party': 'Party hat',
    'hat.beret': 'Beret',
    'hat.hard': 'Hard hat',
    'hat.cap': 'Cap',
    'hat.crown': 'Tiny crown',
    'hat.night': 'Nightcap',
    'hat.headphones': 'Headphones',
    'color.none': 'Clay orange',
    'color.yellow': 'Lemon yellow',
    'color.blue': 'Sky blue',
    'color.lavender': 'Lavender',
    'color.mint': 'Mint green',
    'color.pink': 'Strawberry pink',
    'color.cream': 'Milk grey',

    'lang.zh': '中文',
    'lang.en': 'English',

    'tray.toggle': 'Show / hide the pet',
    'tray.recenter': 'Put the pet back at the bottom',
    'tray.settings': 'Settings…',
    'tray.sheet': 'Expression sheet',
    'tray.quit': 'Quit',

    'win.settings': 'ClawdPet Settings',
    'win.name': 'Name tag',
    'win.chat': 'Chat with the crab',
    'win.dev': 'clawd dev console',
    'dev.missing': 'Dev files were not packaged',
    'dev.missingHint': 'dev/index.html is missing.',
    'dev.missingFix': 'Run npm run dist from the source tree to repackage (build.files must include dev/**/*).',
    'confirm.cancel': 'Cancel',
    'confirm.ok': 'OK',
    'confirm.def': 'Are you sure?',

    'err.noKey': 'No API key yet — set one in Settings',
    'err.noModel': 'No model name yet — any id works, add one in Settings',
    'err.request': 'Request failed',
    'err.noKeyShort': 'No API key',
    'err.noModelShort': 'No model name',
    'err.failed': 'Failed',
    'err.fallback': 'Anthropic format failed, retrying with the OpenAI format…',
    'test.hello': 'Hello',

    'chat.noModel': 'no model',
    'chat.noKeySys': 'No API key yet — set one via right-click → Settings…',
    'chat.failed': 'Failed',
    'chat.greeting': "I'm here. Go ahead.",
    'chat.ph': 'Say something…',
    'chat.send': 'Send',
    'chat.stop': 'Stop',

    'name.ph': 'Blank = no text',
    'name.cancel': 'Cancel',
    'name.ok': 'OK',
    'name.hint': 'Whether the tag is drawn is controlled by "Show name tag" in the right-click menu.',

    'set.sub': 'Hit Save and the pet picks it up immediately.',
    'set.h.behavior': 'Behaviour',
    'set.l.walk': 'Wander on its own (it walks even when nobody’s watching)',
    'set.l.drag': 'Let me be dragged (legs dangle when lifted, it bounces when dropped)',
    'set.l.gravity': 'Gravity',
    'set.l.look': 'Eyes follow the mouse',
    'set.l.idle': 'Idle fidgeting (falls asleep with little z’s)',
    'set.l.bubble': 'Speech bubbles',
    'set.l.dance': 'Dance to the beat',
    'set.l.peek': 'Peek when you switch windows (it climbs onto that window’s title bar)',
    'set.l.idleGreet': 'Greet you back (after you lock the screen and return)',
    'set.l.showName': 'Show name tag (type it below)',
    'set.peek.testing': 'Checking whether the foreground window is readable…',
    'set.peek.ok': '✓ Foreground window readable (now: {title})',
    'set.peek.bad': '✗ Can’t read the foreground window — peeking won’t move: {err}',
    'set.peek.nomain': '✗ No answer from the main process',
    'set.f.peekGap': 'Gap between peeks (s)',
    'set.hint.peekGap': 'How long it rests after one peek before peeking at the next window. Raise it if opening and closing windows sets it off every time.',
    'set.h.look': 'Appearance',
    'set.f.hat': 'Hat',
    'set.f.none': 'None',
    'set.f.color': 'Colour',
    'set.f.size': 'Size px',
    'set.f.name': 'Name tag',
    'set.f.namePh': 'Leave blank for no text',
    'set.f.lang': 'Language',
    'set.h.win': 'Window',
    'set.l.clickThrough': 'Click-through (the mouse passes through until you point at it)',
    'set.l.alwaysOnTop': 'Always on top',
    'set.l.autoLaunch': 'Launch at login',
    'set.h.chat': 'Chat (any API, not just the official ones)',
    'set.l.chat': 'Enable chat (with it off, double-clicking the pet and "Chat a little…" do nothing)',
    'set.f.provider': 'Format',
    'set.f.providerAuto': 'Auto-detect (Anthropic first, OpenAI as fallback)',
    'set.f.providerAnthropic': 'Anthropic format /v1/messages',
    'set.f.providerOpenAI': 'OpenAI format /v1/chat/completions',
    'set.f.apiBase': 'Base URL',
    'set.f.apiBasePh': 'https://api.anthropic.com or your proxy',
    'set.f.apiModel': 'Model',
    'set.f.apiModelPh': 'e.g. claude-sonnet-4-5 / gpt-4o / your proxy model id',
    'set.f.apiKey': 'API key',
    'set.f.apiKeyPh': 'Encrypted with the OS keychain, stored locally',
    'set.f.temperature': 'Temperature',
    'set.f.systemPrompt': 'Persona',
    'set.hint.api': 'The URL can stop at https://xxx.com or https://xxx.com/v1, or you can paste the full /v1/messages or /v1/chat/completions endpoint. The key stays on this machine, encrypted with Electron safeStorage.',
    'set.save': 'Save',
    'set.test': 'Test connection',
    'set.reset': 'Reset to defaults',
    'set.saved': 'Saved ✓',
    'set.testing': 'Testing…',
    'set.testOk': 'Connected ✓ via {via}, model {model}',
    'set.resetQ': 'Reset all settings?',
    'set.resetD': 'The API key will be cleared too.',
    'set.resetDone': 'Defaults restored',
  },
};

let _lang = FALLBACK;

function norm(l) { return LANGS.indexOf(l) >= 0 ? l : FALLBACK; }
function getLang() { return _lang; }
function setLang(l) { _lang = norm(l); return _lang; }

function pick(key, lang) {
  const b = STRINGS[norm(lang)];
  if (b && b[key] !== undefined) return b[key];
  const f = STRINGS[FALLBACK];
  return (f && f[key] !== undefined) ? f[key] : undefined;
}
function fmt(s, vars) {
  if (!vars) return s;
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}
function t(key, vars) {
  const v = pick(key, _lang);
  return v === undefined ? key : fmt(v, vars);
}
function tIn(lang, key, vars) {
  const v = pick(key, lang);
  return v === undefined ? key : fmt(v, vars);
}
function lines(key) { const v = pick(key, _lang); return Array.isArray(v) ? v : []; }
function linesIn(lang, key) { const v = pick(key, lang); return Array.isArray(v) ? v : []; }
function htmlLang() { return _lang === 'en' ? 'en' : 'zh-CN'; }
// 人设默认值：跟着语言走。Settings 那边只在「还是默认人设」时才跟着换，
// 自己改过的不会被覆盖。
function promptFor(lang) { return pick('sysPrompt', lang); }
function defaultPrompt() { return pick('sysPrompt', _lang); }

// 把 HTML 里标了 data-i18n / data-i18n-ph 的地方刷成当前语言。
// 注意别把 data-i18n 标在含 input 的 label 上——textContent 会把 input 一起抹掉。
function applyI18n(root) {
  const r = root || (typeof document !== 'undefined' ? document : null);
  if (!r || !r.querySelectorAll) return;
  if (r.documentElement) r.documentElement.lang = htmlLang();
  r.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.getAttribute('data-i18n')); });
  r.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.setAttribute('placeholder', t(e.getAttribute('data-i18n-ph'))); });
}

const I18N = { LANGS, STRINGS, getLang, setLang, t, tIn, lines, linesIn, htmlLang, promptFor, defaultPrompt, applyI18n };

// 主进程用 require() 拿这份表；渲染进程走顶层 const I18N。
if (typeof module !== 'undefined' && module.exports) module.exports = I18N;