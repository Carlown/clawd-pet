import { useSyncExternalStore } from 'react';

export type Lang = 'zh' | 'en';

// 中文是基准。英文表按 `typeof zh` 标注，少一个 key 就编译不过。
const zh = {
  'brand.aria': 'ClawdPet 首页',
  'skip': '跳到主要内容',

  'nav.label': '主导航',
  'nav.about': '认识 ClawdPet',
  'nav.playground': '和它玩玩',
  'nav.faq': '常见问题',
  'nav.adopt': '领养一只',
  'nav.github': '在 GitHub 上查看 ClawdPet 的源码',
  'nav.lang': '切换语言',
  'nav.menuOpen': '打开菜单',
  'nav.menuClose': '关闭菜单',

  'hero.tagline1': '你的桌面，',
  'hero.tagline2': '多了一点',
  'hero.accent': '可爱。',
  'hero.desc1': '一只住在 Windows 桌面上的蜡笔小螃蟹。',
  'hero.desc2': '自己散步、久坐打盹，还会爬上你的窗口探头张望。',
  'hero.cta': '领养 ClawdPet',
  'hero.ctaGhost': '先认识一下',
  'hero.petAria': '和 ClawdPet 打个招呼',
  'hero.waved': 'ClawdPet 向你挥了挥小手，很高兴认识你！',
  'hero.scroll': '向下了解 ClawdPet',

  'about.eyebrow': 'SMALL PET, BIG COMPANY',
  'about.title': '小小一只，刚刚好的陪伴。',
  'about.desc': '不用一直说话。只要你回头时，它刚好在。',
  'feat.quiet.title': '不挡事，也不打扰',
  'feat.quiet.desc': '平时鼠标穿透，谁也点不到它；\n真挡到哪儿了，它自己会走开。',
  'feat.play.title': '摸一下，拎起来',
  'feat.play.desc': '单击是摸头，拖它四条腿会乱晃，\n甩出去还会弹一下。',
  'feat.chat.title': '想聊的话，它也能开口',
  'feat.chat.desc': '双击开聊天窗，接口地址和模型自己填，\n官方或中转都行；不填就只是一只安静的螃蟹。',

  'play.eyebrow': 'A HELLO GOES A LONG WAY',
  'play.title1': '先别急着走，',
  'play.title2': '它想认识你。',
  'play.desc1': '给它一点小小的关心，',
  'play.desc2': '它会还你一整天的好心情。',
  'play.scope': '页面上这只是预览：桌面版还会自己散步、久坐打盹、爬到你的窗口上张望。',
  'play.buttonsAria': '与 ClawdPet 互动',
  'play.hello': '打招呼',
  'play.pat': '摸摸头',
  'play.nap': '打个盹',
  'play.note': '也可以直接点点它、拖动它。',
  'play.soundOn': '打开互动声音',
  'play.soundOff': '关闭互动声音',
  'play.soundTitleOn': '关闭声音',
  'play.soundTitleOff': '打开声音',
  'play.reset': '让宠物回到原位',
  'play.resetTitle': '回到原位',
  'play.appName': 'ClawdPet Playground',
  'play.drag': '这里也不错，就在这儿陪你。',
  'play.petAria': '摸摸 ClawdPet，也可以拖动它',
  'play.caption': '一个小小的交互预览，一段可爱的陪伴。桌面版的它要住在你的 Windows 桌面上。',
  'say.hi': '嗨，终于见到你啦！',
  'say.hello': '嗨！今天也一起好好生活吧。',
  'say.pat': '被你摸摸，心情一下就变好了。',
  'say.nap': '你忙你的，我在这儿打个盹。',
  'say.reset': '回到小角落，继续陪着你。',

  'faq.eyebrow': 'A FEW LITTLE THINGS',
  'faq.title1': '一点点好奇，',
  'faq.title2': '一点点解答。',
  'faq.desc1': '关于你的新朋友，',
  'faq.desc2': '你可能还想知道这些。',
  'faq.q1': 'ClawdPet 是什么？',
  'faq.a1': 'ClawdPet 是把 clawd.js 那只蜡笔小螃蟹做成的 Windows 桌面宠物。没人管它的时候，它自己在屏幕上散步、撞到边缘就转身，坐久了会睡着冒 z；你切到别的窗口，它会爬到那个窗口边上探头张望。页面上这一只是网页预览，可以先点点玩。',
  'faq.q2': '可以在哪些设备上使用？',
  'faq.a2': '只支持 Windows。桌宠要读前台窗口的标题才知道该爬到哪个窗口上，用的是 Win32 接口，暂时没有其他系统的版本。',
  'faq.q3': '它会读取我的文件或个人信息吗？',
  'faq.a3': '桌面版每秒读一次前台窗口的标题文本和位置，用途就是决定爬哪个窗口——不读文件内容，也不上传。锁屏和空闲时间由系统接口读。你填的 API Key 用 Windows 钥匙串加密后存在本地。这个网页自己不联网、不读任何东西。',
  'faq.q4': '需要账号或者 API Key 吗？',
  'faq.a4': '不需要。v0.1.0 默认不开聊天，双击只会提示你去右键里打开。真想聊的话，在设置窗里填接口地址、Key 和模型名就行，官方或中转都可以，不绑定 Anthropic。不填的话，它就是一只只会散步的小螃蟹。',

  'closing.eyebrow': 'MAKE ROOM FOR A LITTLE JOY',
  'closing.title1': '给你的桌面，',
  'closing.title2': '留一个可爱的位置。',
  'closing.cta': '把 ClawdPet 带回家',

  'footer.navAria': '页脚导航',
  'footer.about': '关于',
  'footer.play': '体验',
  'footer.faq': '常见问题',
  'footer.rights': '只支持 Windows，MIT 开源。',
  'footer.credit': '蜡笔小螃蟹出自 clawd.js，与 Anthropic 无官方关联。',

  'dialog.close': '关闭领养窗口',
  'dialog.eyebrow': 'YOUR LITTLE FRIEND AWAITS',
  'dialog.title': '领养你的 ClawdPet',
  'dialog.desc': 'Windows 桌面版 v0.1.0 已发布，先从一份小小的陪伴开始。',
  'dialog.infoTitle': '一个 exe，免安装。',
  'dialog.infoA': 'v0.1.0 · 68 MB，双击就跑，不写注册表，卸载就是删掉这个文件。',
  'dialog.infoB': '它用的是自签名证书，所以 Windows 会弹「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」就行。',
  'dialog.download': '下载 Windows 版（.exe）',
  'dialog.note': '只支持 Windows · MIT 开源',
  'dialog.preview': '还是先在网页里玩玩',
} as const;

const en: Record<keyof typeof zh, string> = {
  'brand.aria': 'ClawdPet home',
  'skip': 'Skip to main content',

  'nav.label': 'Main navigation',
  'nav.about': 'Meet ClawdPet',
  'nav.playground': 'Play with it',
  'nav.faq': 'FAQ',
  'nav.adopt': 'Adopt one',
  'nav.github': 'View the ClawdPet source on GitHub',
  'nav.lang': 'Switch language',
  'nav.menuOpen': 'Open menu',
  'nav.menuClose': 'Close menu',

  'hero.tagline1': 'Your desktop,',
  'hero.tagline2': 'just got a little ',
  'hero.accent': 'cuter.',
  'hero.desc1': 'A crayon crab that lives on your Windows desktop.',
  'hero.desc2': 'It wanders on its own, dozes off when idle, and climbs up your windows to peek inside.',
  'hero.cta': 'Adopt ClawdPet',
  'hero.ctaGhost': 'Meet it first',
  'hero.petAria': 'Say hello to ClawdPet',
  'hero.waved': 'ClawdPet waves a little claw — nice to meet you!',
  'hero.scroll': 'Scroll down to meet ClawdPet',

  'about.eyebrow': 'SMALL PET, BIG COMPANY',
  'about.title': 'A tiny crab, just the right company.',
  'about.desc': 'It never needs to talk. It is simply there when you look up.',
  'feat.quiet.title': 'Out of the way, and quiet',
  'feat.quiet.desc': 'The mouse passes straight through it most of the time.\nIf it ever ends up in the way, it wanders off by itself.',
  'feat.play.title': 'Poke it, pick it up',
  'feat.play.desc': 'A single click is a head pat. Drag it and its legs go floppy,\nand it bounces when you let go.',
  'feat.chat.title': 'If you want to talk, it can answer',
  'feat.chat.desc': 'Double-click for the chat window and bring your own endpoint and model.\nLeave it blank and it is just a quiet crab.',

  'play.eyebrow': 'A HELLO GOES A LONG WAY',
  'play.title1': "Don't go yet —",
  'play.title2': 'it wants to meet you.',
  'play.desc1': 'Give it a little attention,',
  'play.desc2': 'and it hands you a good mood for the whole day.',
  'play.scope': 'This page is only the preview. On your desktop it also wanders, dozes off, and peeks over your windows.',
  'play.buttonsAria': 'Interact with ClawdPet',
  'play.hello': 'Say hi',
  'play.pat': 'Head pat',
  'play.nap': 'Take a nap',
  'play.note': 'Or just click and drag it directly.',
  'play.soundOn': 'Turn on interaction sounds',
  'play.soundOff': 'Turn off interaction sounds',
  'play.soundTitleOn': 'Mute',
  'play.soundTitleOff': 'Unmute',
  'play.reset': 'Bring the pet back to its spot',
  'play.resetTitle': 'Reset position',
  'play.appName': 'ClawdPet Playground',
  'play.drag': 'Here works too. I will keep you company from here.',
  'play.petAria': 'Pat ClawdPet, or drag it around',
  'play.caption': 'A small interactive preview. The desktop version lives on your actual Windows desktop.',
  'say.hi': 'Hi! Finally we meet.',
  'say.hello': 'Hi! Let us have a good day too.',
  'say.pat': 'One little pat and my whole mood improves.',
  'say.nap': 'You do your thing. I will nap right here.',
  'say.reset': 'Back in my little corner, still keeping you company.',

  'faq.eyebrow': 'A FEW LITTLE THINGS',
  'faq.title1': 'A little curiosity,',
  'faq.title2': 'a little answer.',
  'faq.desc1': 'About your new friend,',
  'faq.desc2': 'here is what else you may be wondering.',
  'faq.q1': 'What is ClawdPet?',
  'faq.a1': 'ClawdPet turns the crayon crab from clawd.js into a Windows desktop pet. Left alone it wanders around the screen, turns when it reaches an edge, and falls asleep with little z’s if it sits too long. Switch to another window and it climbs up that window’s edge to peek inside. The crab on this page is the web preview — have a poke at it.',
  'faq.q2': 'Which systems does it run on?',
  'faq.a2': 'Windows only. The pet reads the title of your foreground window to know which window to climb, and that goes through Win32 APIs, so there is no build for any other OS for now.',
  'faq.q3': 'Does it read my files or personal information?',
  'faq.a3': 'The desktop version reads the title text and position of your foreground window once a second, purely to decide which window to climb — it does not read file contents and nothing is uploaded. Lock and idle times come from system APIs. The API key you type in is encrypted with the Windows keychain and stays local. This page itself connects to nothing and reads nothing.',
  'faq.q4': 'Do I need an account or an API key?',
  'faq.a4': 'No. Chat is off by default in v0.1.0 — double-clicking just points you at the right-click menu. If you do want to talk, fill in an endpoint, a key and a model in the settings window; official or a proxy, no Anthropic lock-in. Leave it blank and it is just a crab that walks around.',

  'closing.eyebrow': 'MAKE ROOM FOR A LITTLE JOY',
  'closing.title1': 'Leave a little room',
  'closing.title2': 'for something cute.',
  'closing.cta': 'Take ClawdPet home',

  'footer.navAria': 'Footer navigation',
  'footer.about': 'About',
  'footer.play': 'Try it',
  'footer.faq': 'FAQ',
  'footer.rights': 'Windows only, MIT licensed.',
  'footer.credit': 'The crayon crab comes from clawd.js. Not officially affiliated with Anthropic.',

  'dialog.close': 'Close this dialog',
  'dialog.eyebrow': 'YOUR LITTLE FRIEND AWAITS',
  'dialog.title': 'Adopt your ClawdPet',
  'dialog.desc': 'The Windows desktop version v0.1.0 is out. Start with a little company.',
  'dialog.infoTitle': 'One exe. Nothing to install.',
  'dialog.infoA': 'v0.1.0 · 68 MB. Double-click and it runs, and it writes nothing to the registry — uninstalling means deleting the file.',
  'dialog.infoB': 'It is self-signed, so Windows shows “Windows protected your PC”. Choose More info → Run anyway.',
  'dialog.download': 'Download for Windows (.exe)',
  'dialog.note': 'Windows only · MIT licensed',
  'dialog.preview': 'Or play with it here first',
};

const table: Record<Lang, Record<keyof typeof zh, string>> = { zh, en };

const STORAGE_KEY = 'clawdpet.site.lang';
const TITLES: Record<Lang, string> = {
  zh: 'ClawdPet · 桌面上的一只蜡笔小螃蟹（Windows）',
  en: 'ClawdPet · A crayon crab on your Windows desktop',
};

const LABELS: Record<Lang, string> = { zh: '中文', en: 'English' };
export const langLabel = (lang: Lang) => LABELS[lang];

// 模块级的小 store：切语言不需要 props 往下传，任何组件 useLang() 都能拿到。
let current: Lang = detect();
const listeners = new Set<() => void>();

// 顺序：本地选过的 > 浏览器首选语言 > 中文。zh-* 一律当中文，其它一律当英文。
function detect(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    /* 隐私模式下读不到，继续往下走 */
  }
  const preferred = typeof navigator === 'undefined' ? '' : navigator.languages?.[0] ?? navigator.language ?? '';
  return /^zh/i.test(preferred) ? 'zh' : 'en';
}

function applyDocumentLang(lang: Lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = TITLES[lang];
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* 无痕模式下写不进去，内存里切着就行，刷新回到中文 */
  }
  applyDocumentLang(lang);
  listeners.forEach((onChange) => onChange());
}

export function useLang() {
  const lang = useSyncExternalStore(subscribe, () => current, () => current);
  return {
    lang,
    t: (key: keyof typeof zh): string => table[lang][key] ?? zh[key],
    toggle: () => setLang(lang === 'zh' ? 'en' : 'zh'),
  };
}

// 首屏就把 <html lang> 和标题摆对，别等用户点。
applyDocumentLang(current);