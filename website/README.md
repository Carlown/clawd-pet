# ClawdPet 官网

[ClawdPet](https://github.com/Carlown/clawd-pet) 的官网，一个纯静态的单页站。跟仓库根目录那套 Electron 桌宠**没有任何依赖关系**——构建出来只有一个 HTML 文件，扔到哪儿都能打开。

```bash
npm install
npm run dev        # 本地开发（Vite）
npm run build      # → dist/index.html（单文件，JS/CSS 全部内联，约 400 KB）
npm run preview    # 预览构建产物
```

用了 `vite-plugin-singlefile`，所以 `dist/` 里就一个 `index.html`：双击也能开，不需要服务器、没有外部资源、没有后端。想挂到 GitHub Pages 或任何静态托管上，把那一个文件放上去就行。

## 结构

```
src/App.tsx                 整站（Hero / 三个特性 / 可交互的桌面预览 / FAQ / 领养弹窗 / 页脚）
src/components/PetGraphic   小螃蟹 SVG，多个同页共存时给渐变 ID 加前缀（useId）
src/lib/downloadPet.ts      在浏览器里拼出一份离线 HTML，点了直接下载
src/assets/clawdpet.svg     角色本体，和桌面版同一只
public/favicon.svg
```

## 站上只说 Windows 版本

桌宠要读前台窗口的标题，用的是 Win32 接口，所以**只支持 Windows**。站里不列别的系统，下载按钮直指 release 上那个真实的 exe：

```ts
const exeUrl = `${repoUrl}/releases/download/v0.1.0/ClawdPet-0.1.0.exe`;
```

文案也按实际功能写，不写做不到的事：它不接 Claude、不读文件内容，聊天是默认关掉的、开了才用你自己填的接口。所以 FAQ 里说的是「每秒读一次前台窗口的标题文本」，不是「不读取任何信息」。

自签名会弹 SmartScreen 蓝框这件事，写在了下载按钮正下方——那是用户第一次遇到就会卡住的地方，不写等于骗人。

## 改文案

只有 `src/App.tsx` 和 `index.html` 里那几段。特性卡片的插画变体名跟着卡片走（`feature-art-quiet` / `-play` / `-chat`），改名字要连 `src/index.css` 一起改。