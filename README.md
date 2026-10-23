# 个人主页 · 喜茶留白

Astro 静态站。所有文字内容都在 **一个文件** 里：[`src/content/site.yaml`](src/content/site.yaml)。

## 日常更新内容

**最简单：** 在 GitHub 网页上打开 `src/content/site.yaml` → 点铅笔图标编辑 → Commit。
大约一两分钟后，GitHub Actions 会自动构建并同时发布到你的服务器和 GitHub Pages。

- 简历 PDF、手写标题图等文件放进 `public/`，在 yaml 里用 `/resume.pdf` 这样的路径引用。
- 链接的 `href` 留空就不显示，不会再出现点了没反应的假链接。
- yaml 写错（比如漏了必填项）时构建会失败并提示是哪一行，线上旧版本不受影响。

## 摄影画廊（/gallery）

独立页面，暗房风格，不加载主页的手绘样式。内容在 [`src/content/gallery.yaml`](src/content/gallery.yaml)。

换照片：
1. 把原图放进 `src/assets/gallery/`（相机或手机导出的原图即可，不用自己压缩）。
2. 在 `gallery.yaml` 的 `photos` 里按顺序写上文件名，标题、地点、时间、器材都可选。
3. 全部换成自己的照片后，把 `draft` 改成 `false`（之后搜索引擎才会收录，页脚的「示例照片」说明也会消失），再删掉不用的示例图。

构建时每张照片会自动生成 480–2400px 多档 AVIF / WebP、一张模糊预览和主色调，全部自托管。
横图、竖图、方图会自动排成错落版式，调换顺序就能得到不同的节奏。

交互：整屏是一面无限平铺的照片墙，拖动、滚轮、触控板或方向键都能朝任意方向移动，松手后带惯性滑停，每列速度略有不同，
照片会彼此错动。点开任意一张进入全屏浏览：照片从墙上原位放大，背景是这张照片的模糊色调；左右滑、滚轮、方向键或底部缩略图切换，
新照片从侧面擦入；下拉、Esc 或点空白处放回墙上。地址 `#p3` 可直接打开第 3 张。系统开启「减弱动态效果」时只保留淡入淡出。

**本地预览（可选）：** 需要 Node 22+。

```bash
npm install
npm run dev      # http://localhost:4321 ，改 yaml 后刷新即可
npm run build    # 产物在 dist/
```

## 目录

```
src/content/site.yaml     ← 主页内容（你只需要改这里）
src/content/gallery.yaml  ← 画廊内容；照片原图放 src/assets/gallery/
src/pages/index.astro     页面结构
src/pages/gallery.astro   画廊页（样式 src/styles/gallery.css，照片墙和全屏浏览在 src/scripts/gallery/）
src/styles/global.css     样式
src/scripts/nav.ts        导航「顶栏 → 左侧手绘框」变形动画
scripts/subset-font.mjs   构建前把手写字体裁剪成只含用到的字（约 10 KB）
fonts-src/                小赖字体 GB2312 常用字子集（SIL OFL 授权，可商用）
deploy/                   服务器配置样例（Caddy / nginx）
.github/workflows/        自动部署
```

## 部署：服务器为主站，GitHub Pages 做镜像

一次 push 同时发两处。正式域名解析到韩国服务器，给国内访客用；`*.github.io` 作为免运维的备份。
两边页面都把 canonical 指向正式域名，搜索引擎不会把镜像当重复内容。

### 一次性设置

1. **建仓库并推送本项目**，默认分支 `main`。
2. **GitHub Pages：** 仓库 Settings → Pages → Source 选 **GitHub Actions**。
3. **服务器：**
   ```bash
   # 在服务器上
   sudo mkdir -p /var/www/personal-page && sudo chown $USER /var/www/personal-page
   # 装 Caddy（自动 HTTPS），把 deploy/Caddyfile 里的 ruofu.site 换成你的域名
   sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
   ```
   在本机生成一对部署专用密钥：`ssh-keygen -t ed25519 -f deploy_key -N ""`，
   把 `deploy_key.pub` 追加到服务器的 `~/.ssh/authorized_keys`。
4. **仓库 Settings → Secrets and variables → Actions：**
   - Secrets：`SSH_HOST`（服务器 IP）、`SSH_USER`、`SSH_PRIVATE_KEY`（`deploy_key` 的全部内容）、`DEPLOY_PATH`（`/var/www/personal-page`）、`SSH_PORT`（非 22 时才填）
   - Variables：`DEPLOY_SERVER` = `true`
   - 想停掉 Pages 镜像：Variables 里加 `DEPLOY_PAGES` = `false`
5. 在 `site.yaml` 的 `meta.url` 填上正式域名（如 `https://example.com`）。

没有域名也能先跑：只开 Pages，服务器那一路等域名到位再开（`DEPLOY_SERVER` 不设就会跳过）。

### 关于国内访问速度

- 境外服务器不需要备案。韩国到国内的延迟一般在 40–80 ms，但**晚高峰质量取决于线路**（CN2 / 精品网 vs 普通 BGP）。
  上线后用 itdog.cn 或 17ce.com 测一下各地 ping 和丢包，就知道够不够用。
- 不建议套 Cloudflare 免费版：它在国内常常比直连韩国更慢。
- 真要国内秒开，唯一的根本办法是国内 CDN，但那需要域名备案。个人主页通常不值得。

## 相对原单页版修了什么

- 4 张手写标题图（`title-项目.png` 等）从未随文件提供，页面上全是裂图。改为默认用手写字体渲染标题；有图时在 yaml 里填 `titleImage` 即可替换。
- 屏宽 981–1243px 时左侧导航框压在正文上（实测 1100px 宽时与正文重叠）。左栏模式改为 ≥1280px 才启用，此时与正文至少留 64px。
- 主标题逐字拆分时副标题被拆了两遍，生成了嵌套的字符 span（实测 11 处），歪斜角度叠加。改为构建时拆分，不再依赖浏览器脚本。
- 读屏软件原本会逐字念标题；现在读到的是完整句子。
- Google Fonts 在国内慢或打不开，手写字体常常退回楷体。改为自托管、按需裁剪（约 10 KB），不再请求境外字体服务。
- 「下载简历」「GitHub」是点了没反应的占位链接。改为 href 留空就隐藏。
- 手机上当前栏目的粉色下划线被导航的横向滚动裁掉，看不见。已修复。
- 键盘 Tab 时完全没有焦点框（`outline: none`）。补上了焦点样式和「跳到正文」链接。
- 导航由顶栏变为左栏时，占位块高度从 72px 变 0，页面内容会跳一下。改为固定预留高度。
- 动画进行中若快速回滚，导航可能停在错误状态；现在动画结束后会重新校准。跨越断点（缩放窗口、旋转手机）时直接切换，不再飞行。
- 刷新时若页面已在中间位置，导航直接以左栏出现，不再播放一次飞入动画。
- 正文里中文句子间因 HTML 换行多出的空格（如「落地过。 现在」）已消除。
- 补上 meta description、分享卡片信息、favicon、404 页；「最后更新」改为构建时自动生成。
