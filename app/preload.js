// preload.js — 渲染进程能看到的全部能力，就这些。
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petHost', {
  isHost: true,
  platform: process.platform,

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  clearApiKey: () => ipcRenderer.invoke('settings:clearKey'),
  onSettings: (cb) => ipcRenderer.on('settings:changed', (_e, s) => cb(s)),
  // 切语言时主进程会广播（托盘菜单或另一个窗口改的），各窗刷自己的 data-i18n
  onLang: (cb) => ipcRenderer.on('lang:changed', (_e, l) => cb(l)),

  setClickThrough: (v) => ipcRenderer.send('win:click-through', v),
  getWindowInfo: () => ipcRenderer.invoke('win:info'),
  moveWindow: (x, y) => ipcRenderer.invoke('win:move', { x, y }),
  onWindowInfo: (cb) => ipcRenderer.on('win:info', (_e, i) => cb(i)),
  onCursor: (cb) => ipcRenderer.on('win:cursor', (_e, c) => cb(c)),
  applyWindowPrefs: () => ipcRenderer.send('win:apply-prefs'),
  showPet: (v) => ipcRenderer.send('win:visible', v),
  onWatch: (cb) => ipcRenderer.on('win:watch', (_e, s) => cb(s)),
  watchNow: () => ipcRenderer.invoke('win:watch-now'),

  openMenu: (spec) => ipcRenderer.send('menu:open', spec),
  onMenu: (cb) => ipcRenderer.on('menu:action', (_e, id) => cb(id)),
  onMenuState: (cb) => ipcRenderer.on('menu:state', (_e, v) => cb(v)),

  openSettings: () => ipcRenderer.send('ui:settings'),
  // 不要用渲染进程的 window.confirm/alert：Electron 对这几个的实现不可靠，
  // 统一走主进程的原生对话框
  confirmBox: (opts) => ipcRenderer.invoke('ui:confirm', opts),
  openName: () => ipcRenderer.send('ui:name'),
  nameGet: () => ipcRenderer.invoke('name:get'),
  nameSubmit: (v) => ipcRenderer.send('name:submit', v),
  nameCancel: () => ipcRenderer.send('name:cancel'),
  onName: (cb) => ipcRenderer.on('name:set', (_e, v) => cb(v)),
  openChat: () => ipcRenderer.send('ui:chat', 'open'),
  closeChat: () => ipcRenderer.send('ui:chat', 'close'),

  chatSend: (text) => ipcRenderer.invoke('chat:send', text),
  chatStop: () => ipcRenderer.send('chat:stop'),
  testApi: (text) => ipcRenderer.invoke('chat:test', text),
  onChat: (cb) => ipcRenderer.on('chat:event', (_e, m) => cb(m)),

  quit: () => ipcRenderer.send('app:quit'),
});
