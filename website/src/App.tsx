import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, Download,
  Hand, Heart, Menu, Moon, MousePointer2, Plus,
  RotateCcw, Volume2, VolumeX, X,
} from 'lucide-react';
import PetGraphic, { type PetMood } from './components/PetGraphic';
import petLogo from './assets/clawdpet.svg';
import { downloadOfflinePet } from './lib/downloadPet';

const repoUrl = 'https://github.com/Carlown/clawd-pet';
// v0.1.0 的真实产物：单文件 portable，自签名，68MB，不用安装。
const exeUrl = `${repoUrl}/releases/download/v0.1.0/ClawdPet-0.1.0.exe`;

function GithubIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.8-1.33-3.8-1.33-.5-1.3-1.24-1.64-1.24-1.64-1.02-.7.08-.69.08-.69 1.12.08 1.71 1.15 1.71 1.15 1 1.72 2.62 1.22 3.26.93.1-.73.4-1.23.71-1.51-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.23 1.15-3.02-.12-.28-.5-1.43.11-2.98 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.61 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.55.23 2.7.12 2.98.72.79 1.15 1.8 1.15 3.02 0 4.33-2.64 5.28-5.15 5.56.41.36.77 1.04.77 2.09v3.11c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z" /></svg>;
}

function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 3C20 14 25 20 37 20C25 20 20 26 20 37C20 26 14 20 3 20C14 20 20 14 20 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Brand({ className = '' }: { className?: string }) {
  return (
    <a className={`brand ${className}`} href="#top" aria-label="ClawdPet 首页">
      <img src={petLogo} alt="" width="42" height="32" />
      <span>ClawdPet</span>
    </a>
  );
}

function Header({ onAdopt }: { onAdopt: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} id="main-navigation" aria-label="主导航">
          <a href="#about" onClick={closeMenu}>认识 ClawdPet</a>
          <a href="#playground" onClick={closeMenu}>和它玩玩</a>
          <a href="#faq" onClick={closeMenu}>常见问题</a>
        </nav>
        <div className="header-actions">
          <a className="github-link" href={repoUrl} target="_blank" rel="noreferrer" aria-label="在 GitHub 上查看 ClawdPet 的源码">
            <GithubIcon />
            <span>GitHub</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
          <button className="button nav-adopt" onClick={() => { closeMenu(); onAdopt(); }}>
            <Download size={15} strokeWidth={1.8} aria-hidden="true" />领养一只
          </button>
          <button className="menu-toggle icon-button" ref={menuButtonRef} onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="main-navigation" aria-label={menuOpen ? '关闭菜单' : '打开菜单'}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onAdopt }: { onAdopt: () => void }) {
  const reducedMotion = useReducedMotion();
  const [mood, setMood] = useState<PetMood>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const sayHello = () => {
    if (timer.current) clearTimeout(timer.current);
    setMood('wave');
    timer.current = setTimeout(() => setMood('idle'), 3200);
  };

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-art" aria-hidden="true">
        <div className="hero-halo" />
        <svg className="hero-linework" viewBox="0 0 1440 650" fill="none" preserveAspectRatio="xMidYMid slice">
          <motion.ellipse cx="1062" cy="326" rx="316" ry="186" transform="rotate(-24 1062 326)" stroke="#CBBBA5" strokeWidth="1" initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 0.52, pathLength: 1 }} transition={{ duration: reducedMotion ? 0 : 2, delay: 0.45 }} />
          <path d="M914 522C1006 554 1119 554 1229 507" stroke="#D5C7B5" strokeWidth="1" opacity="0.45" />
        </svg>
        <Sparkle className="hero-sparkle sparkle-one" />
        <Sparkle className="hero-sparkle sparkle-two" />
        <span className="hero-tiny-star">+</span>
        <motion.div className="hero-pet-shadow" animate={reducedMotion ? {} : { scaleX: [1, 0.87, 1], opacity: [0.22, 0.14, 0.22] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <div className="container hero-inner">
        <motion.div className="hero-copy" initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}>
          <h1 className="hero-brand" id="hero-title">ClawdPet<span className="brand-period">.</span></h1>
          <p className="hero-tagline">你的桌面，<br />多了一点<span className="accent-word">可爱。</span></p>
          <p className="hero-description">一只住在 Windows 桌面上的蜡笔小螃蟹。<br />自己散步、久坐打盹，还会爬上你的窗口探头张望。</p>
          <div className="hero-cta">
            <button className="button button-dark" onClick={onAdopt}><Download size={17} strokeWidth={1.8} aria-hidden="true" />领养 ClawdPet</button>
            <a className="button button-outline" href="#playground">先认识一下<ArrowUpRight size={17} strokeWidth={1.6} aria-hidden="true" /></a>
          </div>
        </motion.div>
      </div>
      <motion.button className="hero-pet-button" aria-label="和 ClawdPet 打个招呼" onClick={sayHello} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} whileHover={{ scale: 1.035, transition: { duration: 0.25, delay: 0 } }} whileTap={{ scale: 0.96, transition: { duration: 0.1, delay: 0 } }}>
        <motion.div animate={reducedMotion ? { rotate: -7 } : { y: [0, -15, 0], rotate: [-7, -4, -7] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}><PetGraphic mood={mood} /></motion.div>
      </motion.button>
      <p className="sr-only" aria-live="polite">{mood === 'wave' ? 'ClawdPet 向你挥了挥小手，很高兴认识你！' : ''}</p>
      <a className="scroll-hint" href="#about" aria-label="向下了解 ClawdPet"><ArrowDown size={18} strokeWidth={1.4} aria-hidden="true" /></a>
    </section>
  );
}

function FeatureArt({ variant }: { variant: 'quiet' | 'play' | 'chat' }) {
  return (
    <div className={`feature-art feature-art-${variant}`} aria-hidden="true">
      {variant === 'quiet' && <svg className="monitor-drawing" viewBox="0 0 250 150" fill="none"><rect x="31" y="16" width="126" height="83" rx="5" stroke="currentColor" strokeWidth="1.5" /><path d="M32 82H156M82 99V115M106 99V115M65 116H122M17 129H230" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M51 40H90M51 49H110M51 58H77" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" /></svg>}
      {variant === 'play' && <><Heart className="feature-heart heart-one" size={21} strokeWidth={1.4} /><Heart className="feature-heart heart-two" size={13} strokeWidth={1.4} /><span className="feature-floor" /></>}
      {variant === 'chat' && <><Sparkle className="feature-sparkle" /><MousePointer2 className="feature-cursor" size={32} strokeWidth={1.3} /><svg className="feature-orbit" viewBox="0 0 250 150" fill="none"><ellipse cx="122" cy="77" rx="90" ry="47" transform="rotate(-19 122 77)" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" /></svg></>}
      <div className="feature-mini-pet"><PetGraphic mood={variant === 'quiet' ? 'sleepy' : variant === 'play' ? 'happy' : 'idle'} /></div>
    </div>
  );
}

function About() {
  const features = [
    { variant: 'quiet' as const, title: '不挡事，也不打扰', description: '平时鼠标穿透，谁也点不到它；\n真挡到哪儿了，它自己会走开。' },
    { variant: 'play' as const, title: '摸一下，拎起来', description: '单击是摸头，拖它四条腿会乱晃，\n甩出去还会弹一下。' },
    { variant: 'chat' as const, title: '想聊的话，它也能开口', description: '双击开聊天窗，接口地址和模型自己填，\n官方或中转都行；不填就只是一只安静的螃蟹。' },
  ];
  return (
    <section className="about-section section-space" id="about" aria-labelledby="about-title">
      <div className="container">
        <Reveal className="section-heading centered-heading"><p className="eyebrow">SMALL PET, BIG COMPANY</p><h2 id="about-title">小小一只，刚刚好的陪伴。</h2><p className="section-description">不用一直说话。只要你回头时，它刚好在。</p></Reveal>
        <div className="features-grid">
          {features.map((feature, index) => <Reveal className="feature" key={feature.variant} delay={index * 0.1}><FeatureArt variant={feature.variant} /><h3>{feature.title}</h3><p>{feature.description}</p></Reveal>)}
        </div>
      </div>
    </section>
  );
}

function playChime() {
  if (!window.AudioContext) return;
  const context = new AudioContext();
  if (context.state === 'suspended') void context.resume();
  const gain = context.createGain();
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.16);
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(0.045, context.currentTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.45);
  oscillator.onended = () => { void context.close(); };
}

type Interaction = 'hello' | 'pat' | 'nap';

function Playground() {
  const reducedMotion = useReducedMotion();
  const desktopRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragJustEnded = useRef(false);
  const [mood, setMood] = useState<PetMood>('idle');
  const [activeAction, setActiveAction] = useState<Interaction | null>(null);
  const [message, setMessage] = useState('嗨，终于见到你啦！');
  const [soundOn, setSoundOn] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const interact = (action: Interaction) => {
    if (timer.current) clearTimeout(timer.current);
    setActiveAction(action);
    setMood(action === 'hello' ? 'wave' : action === 'nap' ? 'sleepy' : 'happy');
    setMessage({ hello: '嗨！今天也一起好好生活吧。', pat: '被你摸摸，心情一下就变好了。', nap: '你忙你的，我在这儿打个盹。' }[action]);
    if (soundOn) playChime();
    timer.current = setTimeout(() => { setMood('idle'); setActiveAction(null); }, 3300);
  };

  const resetPet = () => {
    if (timer.current) clearTimeout(timer.current);
    setResetVersion((version) => version + 1);
    setMood('idle');
    setActiveAction(null);
    setMessage('回到小角落，继续陪着你。');
  };

  const actions = [
    { id: 'hello' as const, label: '打招呼', icon: Hand },
    { id: 'pat' as const, label: '摸摸头', icon: Heart },
    { id: 'nap' as const, label: '打个盹', icon: Moon },
  ];

  return (
    <section className="playground-section section-space" id="playground" aria-labelledby="playground-title">
      <div className="container playground-grid">
        <Reveal className="playground-copy">
          <p className="eyebrow">A HELLO GOES A LONG WAY</p>
          <h2 id="playground-title">先别急着走，<br />它想认识你。</h2>
          <p className="section-description">给它一点小小的关心，<br />它会还你一整天的好心情。<br /><span className="playground-scope">页面上这只是预览：桌面版还会自己散步、久坐打盹、爬到你的窗口上张望。</span></p>
          <div className="interaction-buttons" aria-label="与 ClawdPet 互动">
            {actions.map(({ id, label, icon: Icon }) => <button key={id} className={`interaction-button ${activeAction === id ? 'is-active' : ''}`} onClick={() => interact(id)} aria-pressed={activeAction === id}><Icon size={17} strokeWidth={1.6} aria-hidden="true" />{label}</button>)}
          </div>
          <span className="playground-note"><MousePointer2 size={14} aria-hidden="true" />也可以直接点点它、拖动它。</span>
        </Reveal>
        <Reveal className="desktop-wrap" delay={0.15}>
          <div className="desktop-window" ref={desktopRef}>
            <div className="desktop-toolbar">
              <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
              <span className="desktop-app-name">ClawdPet Playground</span>
              <div className="desktop-tools">
                <button className="desktop-tool" onClick={() => { if (!soundOn) playChime(); setSoundOn(!soundOn); }} aria-label={soundOn ? '关闭互动声音' : '打开互动声音'} aria-pressed={soundOn} title={soundOn ? '关闭声音' : '打开声音'}>{soundOn ? <Volume2 size={15} strokeWidth={1.6} /> : <VolumeX size={15} strokeWidth={1.6} />}</button>
                <button className="desktop-tool" onClick={resetPet} aria-label="让宠物回到原位" title="回到原位"><RotateCcw size={14} strokeWidth={1.6} /></button>
              </div>
            </div>
            <div className="desktop-wallpaper" aria-hidden="true">
              <span className="wallpaper-title">hello,<br /><em>human.</em></span>
              <svg className="wallpaper-sun" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="18" stroke="currentColor" strokeWidth="1.3" /><path d="M50 15V23M50 77V85M15 50H23M77 50H85M25 25L31 31M69 69L75 75M25 75L31 69M69 31L75 25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              <svg className="wallpaper-hills" viewBox="0 0 620 220" fill="none" preserveAspectRatio="none"><path d="M-20 156C99 84 192 207 326 139C453 73 513 79 640 116V240H-20Z" fill="#D8E1D1" /><path d="M-20 187C166 109 274 225 454 176C530 155 588 174 640 161V240H-20Z" fill="#CBD8C4" opacity="0.75" /></svg>
            </div>
            <motion.button
              key={resetVersion} className="desktop-pet" drag dragConstraints={desktopRef}
              dragElastic={0.08} dragMomentum={false}
              onDragStart={() => { dragJustEnded.current = true; }}
              onDragEnd={() => { setMessage('这里也不错，就在这儿陪你。'); window.setTimeout(() => { dragJustEnded.current = false; }, 100); }}
              onClick={() => { if (!dragJustEnded.current) interact('pat'); }}
              whileTap={{ cursor: 'grabbing' }} aria-label="摸摸 ClawdPet，也可以拖动它"
            >
              <span className="desktop-pet-shadow" aria-hidden="true" />
              <AnimatePresence mode="wait"><motion.span className="pet-speech" key={message} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} aria-hidden="true">{message}</motion.span></AnimatePresence>
              <motion.div animate={reducedMotion ? {} : mood === 'happy' ? { y: [0, -17, 0], rotate: [0, 5, -4, 0] } : { y: [0, -5, 0] }} transition={mood === 'happy' ? { duration: 0.6 } : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}><PetGraphic mood={mood} /></motion.div>
              <AnimatePresence>{mood === 'happy' && <motion.span className="pet-love" initial={{ opacity: 0, y: 4, scale: 0.6 }} animate={{ opacity: [0, 1, 0], y: -46, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.3 }} aria-hidden="true"><Heart size={24} strokeWidth={1.3} fill="currentColor" /></motion.span>}</AnimatePresence>
            </motion.button>
            <span className="desktop-demo-label">a little space for a little friend.</span>
          </div>
          <p className="desktop-caption">一个小小的交互预览，一段可爱的陪伴。桌面版的它要住在你的 Windows 桌面上。</p>
          <p className="sr-only" aria-live="polite" aria-atomic="true">{message}</p>
        </Reveal>
      </div>
    </section>
  );
}

const questions = [
  { question: 'ClawdPet 是什么？', answer: 'ClawdPet 是把 clawd.js 那只蜡笔小螃蟹做成的 Windows 桌面宠物。没人管它的时候，它自己在屏幕上散步、撞到边缘就转身，坐久了会睡着冒 z；你切到别的窗口，它会爬到那个窗口边上探头张望。页面上这一只是网页预览，可以先点点玩。' },
  { question: '可以在哪些设备上使用？', answer: '只支持 Windows。桌宠要读前台窗口的标题才知道该爬到哪个窗口上，用的是 Win32 接口，暂时没有其他系统的版本。不想先装东西的话，也可以下载那个无需联网的 HTML 体验文件，双击就能看。' },
  { question: '它会读取我的文件或个人信息吗？', answer: '桌面版每秒读一次前台窗口的标题文本和位置，用途就是决定爬哪个窗口——不读文件内容，也不上传。锁屏和空闲时间由系统接口读。你填的 API Key 用 Windows 钥匙串加密后存在本地。这个网页和离线体验文件不联网、不读任何东西。' },
  { question: '需要账号或者 API Key 吗？', answer: '不需要。v0.1.0 默认不开聊天，双击只会提示你去右键里打开。真想聊的话，在设置窗里填接口地址、Key 和模型名就行，官方或中转都可以，不绑定 Anthropic。不填的话，它就是一只只会散步的小螃蟹。' },
];

function FAQ() {
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  return (
    <section className="faq-section section-space" id="faq" aria-labelledby="faq-title">
      <div className="container faq-grid">
        <Reveal className="faq-heading"><p className="eyebrow">A FEW LITTLE THINGS</p><h2 id="faq-title">一点点好奇，<br />一点点解答。</h2><p className="section-description">关于你的新朋友，<br />你可能还想知道这些。</p></Reveal>
        <Reveal className="faq-list" delay={0.1}>
          {questions.map(({ question, answer }, index) => (
            <div className={`faq-item ${openQuestion === index ? 'is-open' : ''}`} key={question}>
              <h3><button aria-expanded={openQuestion === index} aria-controls={`faq-answer-${index}`} id={`faq-question-${index}`} onClick={() => setOpenQuestion(openQuestion === index ? null : index)}><span>{question}</span><Plus size={20} strokeWidth={1.4} aria-hidden="true" /></button></h3>
              <AnimatePresence initial={false}>{openQuestion === index && <motion.div className="faq-answer" id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: 'easeInOut' }}><p>{answer}</p></motion.div>}</AnimatePresence>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function Closing({ onAdopt }: { onAdopt: () => void }) {
  return (
    <section className="closing-section" aria-labelledby="closing-title">
      <Sparkle className="closing-sparkle closing-sparkle-left" /><Sparkle className="closing-sparkle closing-sparkle-right" />
      <Reveal className="closing-content">
        <img className="closing-pet" src={petLogo} width="86" height="64" alt="" />
        <p className="eyebrow">MAKE ROOM FOR A LITTLE JOY</p>
        <h2 id="closing-title">给你的桌面，<br />留一个可爱的位置。</h2>
        <button className="button button-orange" onClick={onAdopt}>把 ClawdPet 带回家<ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" /></button>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main"><Brand /><p className="footer-love">A small pet. A softer everyday.</p><nav className="footer-nav" aria-label="页脚导航"><a href="#about">关于</a><a href="#playground">体验</a><a href="#faq">常见问题</a><a href={repoUrl} target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={12} aria-hidden="true" /></a></nav></div>
        <div className="footer-bottom"><span>&copy; {new Date().getFullYear()} ClawdPet. 只支持 Windows，MIT 开源。</span><span>蜡笔小螃蟹出自 clawd.js，与 Anthropic 无官方关联。</span></div>
      </div>
    </footer>
  );
}

function AdoptDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); previousFocus?.focus({ preventScroll: true }); };
  }, [onClose]);

  const startPreview = () => {
    onClose();
    window.setTimeout(() => document.getElementById('playground')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 180);
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div className="adopt-dialog" role="dialog" aria-modal="true" aria-labelledby="adopt-title" aria-describedby="adopt-description" tabIndex={-1} ref={dialogRef} initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.25 }}>
        <button className="dialog-close icon-button" onClick={onClose} aria-label="关闭领养窗口"><X size={20} strokeWidth={1.5} /></button>
        <img className="dialog-pet" src={petLogo} width="94" height="70" alt="" />
        <p className="eyebrow">YOUR LITTLE FRIEND AWAITS</p>
        <h2 id="adopt-title">领养你的 ClawdPet</h2>
        <p className="dialog-description" id="adopt-description">Windows 桌面版 v0.1.0 已发布，先从一份小小的陪伴开始。</p>
        <div className="platform-information">
          <h3>一个 exe，免安装。</h3>
          <p>v0.1.0 · 68 MB，双击就跑，不写注册表，卸载就是删掉这个文件。<br />它用的是自签名证书，所以 Windows 会弹「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」就行。</p>
        </div>
        <a className="button button-dark dialog-primary" href={exeUrl} onClick={onClose}><Download size={17} strokeWidth={1.7} aria-hidden="true" />下载 Windows 版（.exe）<ArrowRight size={17} strokeWidth={1.7} aria-hidden="true" /></a>
        <button className="button button-outline dialog-download" onClick={() => { downloadOfflinePet(); setDownloaded(true); }}>{downloaded ? <Check size={17} strokeWidth={1.7} /> : <Download size={17} strokeWidth={1.7} />}{downloaded ? '再次下载离线体验' : '下载离线网页体验 (.html)'}</button>
        <p className="download-note" aria-live="polite">{downloaded ? '体验文件已生成，双击 HTML 文件就能见到它。' : '暂时不想装东西？下面这个离线文件不需要安装、不联网，双击就能看。'}</p>
        <button className="dialog-preview-link" onClick={startPreview}>还是先在网页里玩玩<ArrowRight size={14} strokeWidth={1.7} aria-hidden="true" /></button>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [adoptOpen, setAdoptOpen] = useState(false);
  const openAdopt = useCallback(() => setAdoptOpen(true), []);
  const closeAdopt = useCallback(() => setAdoptOpen(false), []);
  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className="site-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Header onAdopt={openAdopt} />
        <main id="main-content"><Hero onAdopt={openAdopt} /><About /><Playground /><FAQ /><Closing onAdopt={openAdopt} /></main>
        <Footer />
        <AnimatePresence>{adoptOpen && <AdoptDialog onClose={closeAdopt} />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}