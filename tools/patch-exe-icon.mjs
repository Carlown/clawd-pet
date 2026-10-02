// patch-exe-icon.mjs — 给 dist 里的 exe 换图标。
// electron-builder 默认用 winCodeSign 里的 rcedit.exe 改图标，而解包它要建符号链接，
// 没开开发者模式的 Windows 上会直接失败。这里改用 electron-builder 自带的纯 JS 库 resedit，
// 不需要任何特权。用法: node tools/patch-exe-icon.mjs [exe ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ResEdit from 'resedit';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICON = path.join(ROOT, 'build', 'icon.ico');
const RT_GROUP_ICON = 14;

function targets() {
  const args = process.argv.slice(2);
  if (args.length) return args;
  const dist = path.join(ROOT, 'dist');
  const out = [];
  for (const f of fs.readdirSync(dist)) if (f.toLowerCase().endsWith('.exe')) out.push(path.join(dist, f));
  const un = path.join(dist, 'win-unpacked');
  if (fs.existsSync(un)) {
    for (const f of fs.readdirSync(un)) if (f.toLowerCase().endsWith('.exe')) out.push(path.join(un, f));
  }
  return out;
}

function patchOne(file) {
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ICON));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, iconFile.icons.map((i) => i.data));
  res.outputResource(exe);
  const out = Buffer.from(exe.generate());   // resedit 1.x 返回的是 ArrayBuffer
  fs.writeFileSync(file, out);
  return { size: out.length, count: iconFile.icons.length };
}

// 把刚写进去的图标再读回来，存成 png，方便肉眼确认真的换上了
function verify(file) {
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (!groups.length) return null;
  const items = groups[0].getIconItemsFromEntries(res.entries);
  let best = null;
  for (const it of items) {
    const bin = Buffer.from(it.bin || []);
    if (bin[0] === 0x89 && bin.toString('ascii', 1, 4) === 'PNG' && (!best || bin.length > best.length)) best = bin;
  }
  return best;
}

if (!fs.existsSync(ICON)) {
  console.error('先跑 node tools/make-icon.mjs 生成 build/icon.ico');
  process.exit(1);
}
for (const f of targets()) {
  const { size, count } = patchOne(f);
  const back = verify(f);
  console.log(`✓ ${path.relative(ROOT, f)}  ${(size / 1048576).toFixed(1)}MB  ${count} 个尺寸  回读 ${back ? back.length + ' 字节' : '失败'}`);
  if (back) fs.writeFileSync(path.join(ROOT, 'build', 'icon-roundtrip.png'), back);
}
console.log('回读图已存 build/icon-roundtrip.png（肉眼确认图标换上没）');
