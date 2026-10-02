// chat.js — 对话。渲染进程不碰 API Key，请求由 Electron 主进程发，流式增量推回来喂给气泡。
'use strict';

const Chat = {
  streaming: false,
  buf: '',
  history: [],
  bound: false,

  bind(register) {
    if (this.bound || typeof register !== 'function') return;
    this.bound = true;
    register((m) => this.onEvent(m));
  },

  onEvent(m) {
    if (!m || !m.type) return;
    if (m.type === 'start') { this.streaming = true; this.buf = ''; Pet.thinking(true); }
    else if (m.type === 'delta') {
      this.buf += m.text;
      if (this.buf) { Pet.thinking(false); Pet.sayChat(this.buf); }   // 第一个字一到就把小点收掉
    } else if (m.type === 'done') {
      this.streaming = false;
      Pet.thinking(false);
      if (this.buf) this.history.push({ role: 'assistant', content: this.buf });
    } else if (m.type === 'error') {
      this.streaming = false;
      Pet.thinking(false);
      Pet.sayChat(I18N.t('chat.hmm') + String(m.text || I18N.t('chat.err')).slice(0, 60));
    }
  },

  async send(text) {
    text = String(text || '').trim();
    if (!text || this.streaming) return;
    if (!(window.petHost && window.petHost.chatSend)) {
      Pet.say(I18N.t('chat.webNoApi'), 2.6);
      return;
    }
    if (!Settings.data.apiKey) {
      Pet.say(I18N.t('chat.noKey'), 2);
      window.petHost.openSettings();
      return;
    }
    this.history.push({ role: 'user', content: text });
    this.streaming = true;
    this.buf = '';
    Pet.thinking(true);              // 先吹三个小点，别吹一条空白长条
    try {
      await window.petHost.chatSend(text);
    } catch (e) {
      this.streaming = false;
      Pet.thinking(false);
      Pet.sayChat(I18N.t('chat.hmm') + String(e && e.message || e).slice(0, 60));
    }
  },

  stop() {
    if (window.petHost && window.petHost.chatStop) window.petHost.chatStop();
    this.streaming = false;
    Pet.thinking(false);
  },
};
