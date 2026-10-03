import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, Download,
  Globe2, Hand, Heart, Menu, Moon, MousePointer2, Plus,
  RotateCcw, Volume2, VolumeX, X,
} from 'lucide-react';
import PetGraphic, { type PetMood } from './components/PetGraphic';
import petLogo from './assets/clawdpet.svg';
import { langLabel, setLang, useLang, type Lang } from './i18n';

const repoUrl = 'https://github.com/Carlown/clawd-pet';
// 指向 latest 而不是写死某个版本的 exe 路径：
// 写死的话每发一版都得记得改这里，漏一次官网就在分发上一版的旧文件 ——
// 而这种漏改没人会发现，因为链接照样打得开，只是打开的是旧东西。
// latest 由 GitHub 自己解析成最新正式版，代价是点进去多一跳 release 页面。
const exeUrl = `${repoUrl}/releases/latest`;

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
  const { t } = useLang();
  return (
    <a className={`brand ${className}`} href="#top" aria-label={t('brand.aria')}>
      <img src={petLogo} alt="" width="42" height="32" />
      <span>ClawdPet</span>
    </a>
  );
}

// 语言切换：地球按钮弹下拉。首次打开按浏览器语言自动定，用户选过就以他的选择为准。
function LangMenu() {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (next: Lang) => {
    setLang(next);
    setOpen(false);
  };

  return (
    <div className="lang-menu" ref={wrapRef}>
      <button
        className="lang-trigger" ref={triggerRef} aria-haspopup="listbox" aria-expanded={open}
        aria-label={t('nav.lang')} onClick={() => setOpen((value) => !value)}
      >
        <Globe2 size={17} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="lang-options" role="listbox" aria-label={t('nav.lang')}
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {(['zh', 'en'] as const).map((option) => (
              <li key={option}>
                <button
                  role="option" aria-selected={lang === option} lang={option === 'zh' ? 'zh-CN' : 'en'}
                  className={lang === option ? 'is-active' : ''} onClick={() => pick(option)}
                >
                  {langLabel(option)}
                  {lang === option && <Check size={13} strokeWidth={2} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ onAdopt }: { onAdopt: () => void }) {
  const { t } = useLang();
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
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} id="main-navigation" aria-label={t('nav.label')}>
          <a href="#about" onClick={closeMenu}>{t('nav.about')}</a>
          <a href="#playground" onClick={closeMenu}>{t('nav.playground')}</a>
          <a href="#faq" onClick={closeMenu}>{t('nav.faq')}</a>
        </nav>
        <div className="header-actions">
          <LangMenu />
          <a className="github-link" href={repoUrl} target="_blank" rel="noreferrer" aria-label={t('nav.github')}>
            <GithubIcon />
            <span>GitHub</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
          <button className="button nav-adopt" onClick={() => { closeMenu(); onAdopt(); }}>
            <Download size={15} strokeWidth={1.8} aria-hidden="true" />{t('nav.adopt')}
          </button>
          <button className="menu-toggle icon-button" ref={menuButtonRef} onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="main-navigation" aria-label={menuOpen ? t('nav.menuClose') : t('nav.menuOpen')}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onAdopt }: { onAdopt: () => void }) {
  const { t } = useLang();
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
          <p className="hero-tagline">{t('hero.tagline1')}<br />{t('hero.tagline2')}<span className="accent-word">{t('hero.accent')}</span></p>
          <p className="hero-description">{t('hero.desc1')}<br />{t('hero.desc2')}</p>
          <div className="hero-cta">
            <button className="button button-dark" onClick={onAdopt}><Download size={17} strokeWidth={1.8} aria-hidden="true" />{t('hero.cta')}</button>
            <a className="button button-outline" href="#playground">{t('hero.ctaGhost')}<ArrowUpRight size={17} strokeWidth={1.6} aria-hidden="true" /></a>
          </div>
        </motion.div>
      </div>
      <motion.button className="hero-pet-button" aria-label={t('hero.petAria')} onClick={sayHello} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} whileHover={{ scale: 1.035, transition: { duration: 0.25, delay: 0 } }} whileTap={{ scale: 0.96, transition: { duration: 0.1, delay: 0 } }}>
        <motion.div animate={reducedMotion ? { rotate: -7 } : { y: [0, -15, 0], rotate: [-7, -4, -7] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}><PetGraphic mood={mood} /></motion.div>
      </motion.button>
      <p className="sr-only" aria-live="polite">{mood === 'wave' ? t('hero.waved') : ''}</p>
      <a className="scroll-hint" href="#about" aria-label={t('hero.scroll')}><ArrowDown size={18} strokeWidth={1.4} aria-hidden="true" /></a>
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
  const { t } = useLang();
  const features = [
    { variant: 'quiet' as const, title: t('feat.quiet.title'), description: t('feat.quiet.desc') },
    { variant: 'play' as const, title: t('feat.play.title'), description: t('feat.play.desc') },
    { variant: 'chat' as const, title: t('feat.chat.title'), description: t('feat.chat.desc') },
  ];
  return (
    <section className="about-section section-space" id="about" aria-labelledby="about-title">
      <div className="container">
        <Reveal className="section-heading centered-heading"><p className="eyebrow">{t('about.eyebrow')}</p><h2 id="about-title">{t('about.title')}</h2><p className="section-description">{t('about.desc')}</p></Reveal>
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
// 气泡里那句存的是 key 不是成品文案 —— 这样切语言时正在显示的那句也跟着翻。
type SayKey = 'say.hi' | 'say.hello' | 'say.pat' | 'say.nap' | 'say.reset' | 'play.drag';

function Playground() {
  const { t } = useLang();
  const reducedMotion = useReducedMotion();
  const desktopRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragJustEnded = useRef(false);
  const [mood, setMood] = useState<PetMood>('idle');
  const [activeAction, setActiveAction] = useState<Interaction | null>(null);
  const [said, setSaid] = useState<SayKey>('say.hi');
  const [soundOn, setSoundOn] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const interact = (action: Interaction) => {
    if (timer.current) clearTimeout(timer.current);
    setActiveAction(action);
    setMood(action === 'hello' ? 'wave' : action === 'nap' ? 'sleepy' : 'happy');
    setSaid(({ hello: 'say.hello', pat: 'say.pat', nap: 'say.nap' } as const)[action]);
    if (soundOn) playChime();
    timer.current = setTimeout(() => { setMood('idle'); setActiveAction(null); }, 3300);
  };

  const resetPet = () => {
    if (timer.current) clearTimeout(timer.current);
    setResetVersion((version) => version + 1);
    setMood('idle');
    setActiveAction(null);
    setSaid('say.reset');
  };

  const actions = [
    { id: 'hello' as const, label: t('play.hello'), icon: Hand },
    { id: 'pat' as const, label: t('play.pat'), icon: Heart },
    { id: 'nap' as const, label: t('play.nap'), icon: Moon },
  ];

  return (
    <section className="playground-section section-space" id="playground" aria-labelledby="playground-title">
      <div className="container playground-grid">
        <Reveal className="playground-copy">
          <p className="eyebrow">{t('play.eyebrow')}</p>
          <h2 id="playground-title">{t('play.title1')}<br />{t('play.title2')}</h2>
          <p className="section-description">{t('play.desc1')}<br />{t('play.desc2')}<br /><span className="playground-scope">{t('play.scope')}</span></p>
          <div className="interaction-buttons" aria-label={t('play.buttonsAria')}>
            {actions.map(({ id, label, icon: Icon }) => <button key={id} className={`interaction-button ${activeAction === id ? 'is-active' : ''}`} onClick={() => interact(id)} aria-pressed={activeAction === id}><Icon size={17} strokeWidth={1.6} aria-hidden="true" />{label}</button>)}
          </div>
          <span className="playground-note"><MousePointer2 size={14} aria-hidden="true" />{t('play.note')}</span>
        </Reveal>
        <Reveal className="desktop-wrap" delay={0.15}>
          <div className="desktop-window" ref={desktopRef}>
            <div className="desktop-toolbar">
              <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
              <span className="desktop-app-name">{t('play.appName')}</span>
              <div className="desktop-tools">
                <button className="desktop-tool" onClick={() => { if (!soundOn) playChime(); setSoundOn(!soundOn); }} aria-label={soundOn ? t('play.soundOff') : t('play.soundOn')} aria-pressed={soundOn} title={soundOn ? t('play.soundTitleOn') : t('play.soundTitleOff')}>{soundOn ? <Volume2 size={15} strokeWidth={1.6} /> : <VolumeX size={15} strokeWidth={1.6} />}</button>
                <button className="desktop-tool" onClick={resetPet} aria-label={t('play.reset')} title={t('play.resetTitle')}><RotateCcw size={14} strokeWidth={1.6} /></button>
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
              onDragEnd={() => { setSaid('play.drag'); window.setTimeout(() => { dragJustEnded.current = false; }, 100); }}
              onClick={() => { if (!dragJustEnded.current) interact('pat'); }}
              whileTap={{ cursor: 'grabbing' }} aria-label={t('play.petAria')}
            >
              <span className="desktop-pet-shadow" aria-hidden="true" />
              <AnimatePresence mode="wait"><motion.span className="pet-speech" key={said} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} aria-hidden="true">{t(said)}</motion.span></AnimatePresence>
              <motion.div animate={reducedMotion ? {} : mood === 'happy' ? { y: [0, -17, 0], rotate: [0, 5, -4, 0] } : { y: [0, -5, 0] }} transition={mood === 'happy' ? { duration: 0.6 } : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}><PetGraphic mood={mood} /></motion.div>
              <AnimatePresence>{mood === 'happy' && <motion.span className="pet-love" initial={{ opacity: 0, y: 4, scale: 0.6 }} animate={{ opacity: [0, 1, 0], y: -46, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.3 }} aria-hidden="true"><Heart size={24} strokeWidth={1.3} fill="currentColor" /></motion.span>}</AnimatePresence>
            </motion.button>
            <span className="desktop-demo-label">a little space for a little friend.</span>
          </div>
          <p className="desktop-caption">{t('play.caption')}</p>
          <p className="sr-only" aria-live="polite" aria-atomic="true">{t(said)}</p>
        </Reveal>
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useLang();
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const questions = [
    { question: t('faq.q1'), answer: t('faq.a1') },
    { question: t('faq.q2'), answer: t('faq.a2') },
    { question: t('faq.q3'), answer: t('faq.a3') },
    { question: t('faq.q4'), answer: t('faq.a4') },
  ];
  return (
    <section className="faq-section section-space" id="faq" aria-labelledby="faq-title">
      <div className="container faq-grid">
        <Reveal className="faq-heading"><p className="eyebrow">{t('faq.eyebrow')}</p><h2 id="faq-title">{t('faq.title1')}<br />{t('faq.title2')}</h2><p className="section-description">{t('faq.desc1')}<br />{t('faq.desc2')}</p></Reveal>
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
  const { t } = useLang();
  return (
    <section className="closing-section" aria-labelledby="closing-title">
      <Sparkle className="closing-sparkle closing-sparkle-left" /><Sparkle className="closing-sparkle closing-sparkle-right" />
      <Reveal className="closing-content">
        <img className="closing-pet" src={petLogo} width="86" height="64" alt="" />
        <p className="eyebrow">{t('closing.eyebrow')}</p>
        <h2 id="closing-title">{t('closing.title1')}<br />{t('closing.title2')}</h2>
        <button className="button button-orange" onClick={onAdopt}>{t('closing.cta')}<ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" /></button>
      </Reveal>
    </section>
  );
}

function Footer() {
  const { t } = useLang();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main"><Brand /><p className="footer-love">A small pet. A softer everyday.</p><nav className="footer-nav" aria-label={t('footer.navAria')}><a href="#about">{t('footer.about')}</a><a href="#playground">{t('footer.play')}</a><a href="#faq">{t('footer.faq')}</a><a href={repoUrl} target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={12} aria-hidden="true" /></a></nav></div>
        <div className="footer-bottom"><span>&copy; {new Date().getFullYear()} ClawdPet. {t('footer.rights')}</span><span>{t('footer.credit')}</span></div>
      </div>
    </footer>
  );
}

function AdoptDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const dialogRef = useRef<HTMLDivElement>(null);

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
        <button className="dialog-close icon-button" onClick={onClose} aria-label={t('dialog.close')}><X size={20} strokeWidth={1.5} /></button>
        <img className="dialog-pet" src={petLogo} width="94" height="70" alt="" />
        <p className="eyebrow">{t('dialog.eyebrow')}</p>
        <h2 id="adopt-title">{t('dialog.title')}</h2>
        <p className="dialog-description" id="adopt-description">{t('dialog.desc')}</p>
        <div className="platform-information">
          <h3>{t('dialog.infoTitle')}</h3>
          <p>{t('dialog.infoA')}<br />{t('dialog.infoB')}</p>
        </div>
        <a className="button button-dark dialog-primary" href={exeUrl} onClick={onClose}><Download size={17} strokeWidth={1.7} aria-hidden="true" />{t('dialog.download')}<ArrowRight size={17} strokeWidth={1.7} aria-hidden="true" /></a>
        <p className="download-note">{t('dialog.note')}</p>
        <button className="dialog-preview-link" onClick={startPreview}>{t('dialog.preview')}<ArrowRight size={14} strokeWidth={1.7} aria-hidden="true" /></button>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const { t } = useLang();
  const [adoptOpen, setAdoptOpen] = useState(false);
  const openAdopt = useCallback(() => setAdoptOpen(true), []);
  const closeAdopt = useCallback(() => setAdoptOpen(false), []);
  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className="site-shell">
        <a className="skip-link" href="#main-content">{t('skip')}</a>
        <Header onAdopt={openAdopt} />
        <main id="main-content"><Hero onAdopt={openAdopt} /><About /><Playground /><FAQ /><Closing onAdopt={openAdopt} /></main>
        <Footer />
        <AnimatePresence>{adoptOpen && <AdoptDialog onClose={closeAdopt} />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}