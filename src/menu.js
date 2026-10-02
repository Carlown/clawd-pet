// menu.js — 右键菜单：一处定义菜单规格，网页版渲染成 DOM 菜单，Electron 版交给主进程做原生菜单。
'use strict';

const HATS = [
  ['', 'hat.none'], ['party', 'hat.party'], ['beret', 'hat.beret'], ['hard', 'hat.hard'],
  ['cap', 'hat.cap'], ['crown', 'hat.crown'], ['night', 'hat.night'], ['headphones', 'hat.headphones'],
];
const COLORS = [
  ['', 'color.none'], ['#f2c14e', 'color.yellow'], ['#8ed2f7', 'color.blue'], ['#c4a8ff', 'color.lavender'],
  ['#7ecb8f', 'color.mint'], ['#ff9db3', 'color.pink'], ['#d9d2c5', 'color.cream'],
];
// 尺寸档位统一从 Settings 拿（src/settings.js 的 SIZE_CHOICES）——
// 设置窗那个下拉框里也是这几档，两边不一致就会出现「菜单能选、设置窗选不回来」
// 然后保存时变成空值 → size=0 的坑。
const SIZES = SIZE_CHOICES;

// 一层子菜单
function sub(label, items) { return { type: 'submenu', label, items }; }
function check(label, on, id) { return { type: 'checkbox', label, checked: !!on, id }; }
function item(label, id) { return { type: 'normal', label, id }; }
function sep() { return { type: 'separator' }; }

function menuSpec() {
  const d = Settings.data;
  const t = I18N.t;
  return [
    sub(t('menu.hat'), HATS.map(([v, k]) => check(t(k), d.hat === v, 'hat:' + v))),
    sub(t('menu.color'), COLORS.map(([v, k]) => check(t(k), (d.color || '') === v, 'color:' + v))),
    sub(t('menu.size'), SIZES.map((v) => check(v + 'px', d.size === v, 'size:' + v))),
    sub(t('menu.lang'), I18N.LANGS.map((v) => check(t('lang.' + v), d.lang === v, 'lang:' + v))),
    sep(),
    check(t('menu.walk'), d.walk, 'toggle:walk'),
    check(t('menu.drag'), d.drag, 'toggle:drag'),
    check(t('menu.gravity'), d.gravity, 'toggle:gravity'),
    check(t('menu.look'), d.look, 'toggle:look'),
    check(t('menu.idle'), d.idle, 'toggle:idle'),
    check(t('menu.bubble'), d.bubble, 'toggle:bubble'),
    check(t('menu.dance'), d.dance, 'toggle:dance'),
    check(t('menu.showName'), d.showName, 'toggle:showName'),
    check(t('menu.peek'), d.peek, 'toggle:peek'),
    check(t('menu.idleGreet'), d.idleGreet, 'toggle:idleGreet'),
    sep(),
    // 「聊两句…」永远是打开聊天窗，不跟着开关换文案；
    // 开没开对话功能看下面那个勾选（没开的时候点了它会自己告诉你）
    item(t('menu.chat'), 'chat'),
    item(t('menu.name'), 'name'),
    sep(),
    ...(window.petHost
      ? [check(t('menu.clickThrough'), d.clickThrough, 'toggle:clickThrough'),
         check(t('menu.alwaysOnTop'), d.alwaysOnTop, 'toggle:alwaysOnTop'),
         check(t('menu.autoLaunch'), d.autoLaunch, 'toggle:autoLaunch'),
         sep(),
         item(t('menu.settings'), 'settings'),
         item(t('menu.recenter'), 'recenter')]
      : [item(t('menu.webOnly'), 'noop', true)]),
    sep(),
    item(t('menu.quit'), 'quit'),
  ];
}

// 把菜单动作应用到宠物 + 配置。id 形如 'hat:cap' / 'toggle:walk'
function applyMenuAction(id) {
  if (!id) return;
  const [kind, val] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
  if (kind === 'hat') { Settings.save({ hat: val }); Pet.setHat(val); return; }
  if (kind === 'color') { Settings.save({ color: val }); return; }
  if (kind === 'size') { Settings.save({ size: Number(val) }); return; }
  // 切语言：Settings.save 会 applyLang（刷 i18n 表 + DOM），主进程那边靠 settings:changed
  // 收到新 lang 后重建托盘菜单、改窗口标题，再广播 lang:changed 给其它小窗。
  if (kind === 'lang') { Settings.save({ lang: val }); return; }
  if (kind === 'toggle') {
    const on = !Settings.data[val];
    Settings.save({ [val]: on });
    if (val === 'alwaysOnTop' || val === 'autoLaunch' || val === 'clickThrough') {
      if (window.petHost) window.petHost.applyWindowPrefs();
    }
    if (val === 'chat') Pet.chatEnabled(on);
    if (val === 'dance') Pet.setDance(on);          // 勾上就当场跳一段，不是个死开关
    if (val === 'showName' && on && !Settings.data.name) Settings.save({ name: 'Claude' });
    return;
  }
  switch (id) {
    case 'chat': Pet.openChat(); break;
    case 'name': {
      // 桌面版开一个小输入窗；Electron 里 window.prompt 是不支持的（点了没反应）
      if (window.petHost && window.petHost.openName) { window.petHost.openName(); break; }
      const v = window.prompt(I18N.t('menu.namePrompt'), Settings.data.name || '');
      // showName 是独立开关，这里不再跟着文字一起改
      if (v !== null) Settings.save({ name: v.slice(0, 12) });
      break;
    }
    case 'settings': if (window.petHost) window.petHost.openSettings(); break;
    case 'recenter': Pet.recenter(); break;
    case 'quit': if (window.petHost) window.petHost.quit(); else window.close(); break;
    default: break;
  }
}

/* --------- 网页版：把同一份规格渲染成 DOM 菜单（桌面版走原生 Menu，这里只给开发用） --------- */
function showDomMenu(x, y) {
  const old = document.getElementById('clawd-menu');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'clawd-menu';
  Object.assign(box.style, {
    position: 'fixed', left: x + 'px', top: y + 'px', zIndex: 99,
    background: '#fffaf0', color: '#2f2721', border: '2px solid #2f2721', borderRadius: '10px',
    padding: '4px', font: '13px/1.5 "Microsoft YaHei", sans-serif', minWidth: '150px',
    boxShadow: '4px 5px 0 rgba(47,39,33,.25)', userSelect: 'none',
  });
  const build = (items) => {
    for (const it of items) {
      if (it.type === 'separator') {
        const s = document.createElement('div');
        Object.assign(s.style, { height: '1px', background: '#d9d2c5', margin: '4px 6px' });
        box.appendChild(s);
      } else if (it.type === 'submenu') {
        const d = document.createElement('div');
        d.textContent = (it.checked ? '✓ ' : '') + it.label + '  ▸';
        Object.assign(d.style, { padding: '4px 8px', cursor: 'default', opacity: .75 });
        const sub = document.createElement('div');
        Object.assign(sub.style, {
          position: 'absolute', left: '100%', top: '-4px', display: 'none',
          background: '#fffaf0', border: '2px solid #2f2721', borderRadius: '10px', padding: '4px', minWidth: '130px',
        });
        for (const ch of it.items) {
          const c = document.createElement('div');
          c.textContent = (ch.checked ? '✓ ' : '') + ch.label;
          Object.assign(c.style, { padding: '3px 8px', cursor: 'pointer' });
          c.onmouseenter = () => { c.style.background = '#ffe9c9'; };
          c.onmouseleave = () => { c.style.background = 'transparent'; };
          c.onclick = (e) => { e.stopPropagation(); hide(); applyMenuAction(ch.id); };
          sub.appendChild(c);
        }
        d.onmouseenter = () => { sub.style.display = 'block'; };
        d.onmouseleave = () => { sub.style.display = 'none'; };
        const wrap = document.createElement('div');
        Object.assign(wrap.style, { position: 'relative' });
        wrap.appendChild(d); wrap.appendChild(sub);
        box.appendChild(wrap);
      } else {
        const d = document.createElement('div');
        d.textContent = it.type === 'checkbox' ? (it.checked ? '✓ ' : '') + it.label : it.label;
        Object.assign(d.style, { padding: '4px 8px', cursor: it.enabled === false ? 'default' : 'pointer', opacity: it.enabled === false ? .45 : 1 });
        if (it.enabled !== false) {
          d.onmouseenter = () => { d.style.background = '#ffe9c9'; };
          d.onmouseleave = () => { d.style.background = 'transparent'; };
          d.onclick = () => { hide(); applyMenuAction(it.id); };
        }
        box.appendChild(d);
      }
    }
  };
  const hide = () => { box.remove(); document.removeEventListener('mousedown', outside, true); };
  const outside = (e) => { if (!box.contains(e.target)) hide(); };
  build(menuSpec());
  document.body.appendChild(box);
  const r = box.getBoundingClientRect();
  box.style.left = Math.min(x, innerWidth - r.width - 6) + 'px';
  box.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
}
