// sign.mjs — 给 dist 里的 exe 做 Authenticode 自签名。
// electron-builder 那条路（winCodeSign\signtool.exe）在这台机器上解不开（要建符号链接），
// 所以：openssl 生成证书 → resedit（纯 JS）按 Authenticode 规范签名 → certutil 装进当前用户信任库。
//
// 证书是正经的两级：自签根 CA（CA:TRUE，装进「受信任的根」）+ 它签发的代码签名证书
// （CA:FALSE + codeSigning EKU，装进「受信任的发布者」）。
// 早先试过"一张自签证书兼当根和签名者"，Windows 会拒：
// "A certificate's basic constraint extension has not been observed" —— Authenticode 不接受 CA 证书当签名者。
//
// 用法: node tools/sign.mjs [--no-trust] [--force]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as ResEdit from 'resedit';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build');
const CERT = path.join(BUILD, 'cert.pem');
const KEY = path.join(BUILD, 'key.pem');
const CA_CERT = path.join(BUILD, 'ca.pem');
const CA_KEY = path.join(BUILD, 'ca.key.pem');
const TRUST = !process.argv.includes('--no-trust');

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

function ensureCert() {
  if (fs.existsSync(CERT) && fs.existsSync(KEY) && fs.existsSync(CA_CERT) && fs.existsSync(CA_KEY)) return;
  fs.mkdirSync(BUILD, { recursive: true });
  console.log('生成证书（openssl）…');
  // 1) 自签根 CA
  run('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '3650', '-nodes',
    '-keyout', CA_KEY, '-out', CA_CERT, '-subj', '/CN=ClawdPet Local CA/O=ClawdPet',
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
    '-addext', 'subjectKeyIdentifier=hash',
  ]);
  // 2) 代码签名证书（末端实体，CA:FALSE）
  run('openssl', [
    'req', '-new', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', KEY, '-out', path.join(BUILD, 'csr.pem'),
    '-subj', '/CN=ClawdPet/O=ClawdPet',
  ]);
  const ext = path.join(BUILD, 'signer.ext');
  fs.writeFileSync(ext, 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=codeSigning\nsubjectKeyIdentifier=hash\n');
  run('openssl', [
    'x509', '-req', '-in', path.join(BUILD, 'csr.pem'),
    '-CA', CA_CERT, '-CAkey', CA_KEY, '-CAcreateserial',
    '-days', '3650', '-sha256', '-out', CERT, '-extfile', ext,
  ]);
  fs.rmSync(path.join(BUILD, 'csr.pem'), { force: true });
  // 私钥别提交
  const gi = path.join(ROOT, '.gitignore');
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, 'node_modules/\ndist/\nbuild/*.pem\nbuild/*.cer\n');
}

function makeSigner() {
  const key = crypto.createPrivateKey(fs.readFileSync(KEY));
  const certDer = new crypto.X509Certificate(fs.readFileSync(CERT)).raw;
  // resedit 传的是自定义 Iterator（只有 .next()），不是可迭代对象
  const collect = (it) => {
    const chunks = [];
    for (let r = it.next(); !r.done; r = it.next()) chunks.push(Buffer.from(r.value));
    return Buffer.concat(chunks);
  };
  return {
    getDigestAlgorithm: () => 'sha256',
    getEncryptionAlgorithm: () => 'rsa',
    getCertificateData: () => certDer,
    // resedit 要求这两个返回 PromiseLike
    digestData: (it) => Promise.resolve(crypto.createHash('sha256').update(collect(it)).digest()),
    // Authenticode 的 PKCS#1 v1.5：对 resedit 给的 DigestInfo 做裸 RSA 私钥加密
    encryptData: (it) => Promise.resolve(crypto.privateEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, collect(it))),
  };
}

function targets() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (args.length) return args;
  // 只签最终产物。win-unpacked 里的 exe 是给 SFX 解包用的中间件，它的段布局
  // （被打包器改过）会让 Authenticode 哈希对不上，签了也验不过，徒增疑惑。
  const dist = path.join(ROOT, 'dist');
  return fs.readdirSync(dist).filter((f) => f.toLowerCase().endsWith('.exe')).map((f) => path.join(dist, f));
}

// 已经签过的不能再签一遍：Authenticode 的证书表会被追加两份，Windows 算哈希会把旧的也算进去 → HashMismatch
// （签名不在 PE 资源里，而在 IMAGE_DIRECTORY_ENTRY_SECURITY，只能问 Windows 自己）
function isSigned(file) {
  const ps = `$s = Get-AuthenticodeSignature '${file.replace(/'/g, "''")}'; Write-Output $s.Status`;
  try {
    const out = run('powershell', ['-NoProfile', '-Command', ps]).toString().trim();
    return !!out && out !== 'NotSigned';
  } catch (e) {
    return false;
  }
}

async function signOne(file) {
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
  const out = await ResEdit.generateExecutableWithSign(exe, makeSigner());
  fs.writeFileSync(file, Buffer.from(out));
}

// 用 Windows 自己判定最靠谱：Get-AuthenticodeSignature
function verify(file) {
  const ps = `$s = Get-AuthenticodeSignature '${file.replace(/'/g, "''")}';`
    + ` Write-Output ($s.Status.ToString() + ' | ' + $s.SignerCertificate.Subject)`;
  try {
    return run('powershell', ['-NoProfile', '-Command', ps]).toString().trim();
  } catch (e) {
    return '验证失败: ' + e.message.split('\n')[0];
  }
}

function installTrust() {
  run('certutil', ['-user', '-addstore', 'Root', CA_CERT]);
  run('certutil', ['-user', '-addstore', 'TrustedPublisher', CERT]);
}

ensureCert();
const list = targets();
if (!list.length) { console.error('dist 里没有 exe，先 npm run dist'); process.exit(1); }
for (const f of list) {
  if (isSigned(f) && !process.argv.includes('--force')) {
    console.log(`· ${path.relative(ROOT, f)} 已经签过了，跳过（要重签请删掉 dist 重新 npm run dist）`);
    continue;
  }
  await signOne(f);
  console.log(`✓ 已签名 ${path.relative(ROOT, f)}`);
  console.log(`  Windows 验证：${verify(f)}`);
}
if (TRUST) {
  installTrust();
  console.log('✓ 根 CA 已装进当前用户「受信任的根证书颁发机构」，签名证书已装进「受信任的发布者」');
}
console.log('私钥在 build/key.pem 与 build/ca.key.pem，只在你本机，别提交上去。');
