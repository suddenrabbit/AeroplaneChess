# RabbitPlaneChess

一个无需构建步骤的飞行棋网页游戏。RabbitPlaneChess 是统一品牌，不限定视觉风格；现已提供「3D 亚克力」与「2D 卡通」两个完整可玩的主题，共用规则与 AI。项目使用原生 HTML、CSS、JavaScript，可直接部署为静态网站。

线上地址：https://fxq.srabbitwork.site/ 。GitHub 仓库目录仍为 `AeroplaneChess`，Cloudflare Worker 仍为 `aeroplanechess`，两者属于部署标识，不随展示品牌更名。

## 目录结构

```text
AeroplaneChess/
├── public/
│   ├── index.html           统一首页、设置、游戏 UI
│   ├── js/                  共用坐标、规则、回合、导航与生命周期
│   ├── themes/              Three.js / SVG 表现与主题配置
│   ├── styles/app.css
│   ├── previews/
│   ├── manifest.webmanifest
│   ├── icons/                 SVG 源图及安装图标
│   └── vendor/three.module.js
├── scripts/export-icons.cjs   开发用图标导出工具
├── docs/PROJECT_HANDOVER.md
├── wrangler.jsonc
└── README.md
```

`public/` 是唯一需要对外发布的目录；交接文档不会被 Cloudflare 静态站点公开。

## 本地运行

```bash
python3 -m http.server 8099 --directory public
```

浏览器访问 <http://localhost:8099/>。

## 推送到 GitHub

仓库当前使用 `main` 分支。创建 GitHub 远端仓库后执行：

```bash
git remote add origin git@github.com:<YOUR_GITHUB_ACCOUNT>/AeroplaneChess.git
git push -u origin main
```

如果使用 HTTPS，请将远端地址替换为 GitHub 提供的 HTTPS 地址。

## Cloudflare Pages（推荐）

在 Cloudflare 控制台进入 **Workers & Pages → Create application → Pages → Import an existing Git repository**，选择该 GitHub 仓库，并使用以下设置：

| 配置项 | 值 |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | `exit 0` |
| Build output directory | `public` |

首次部署后会获得 `*.pages.dev` 地址。以后推送到 `main` 会自动更新正式站点，Pull Request 会生成预览部署。

## Cloudflare Workers Static Assets（可选）

仓库中的 `wrangler.jsonc` 已指向 `public/`。安装 Node.js 后可直接使用：

```bash
npx wrangler dev
npx wrangler deploy
```

首次部署时 Wrangler 会要求登录 Cloudflare 并确认 Worker 名称。此方式与 Pages 二选一即可，不需要同时部署。

## 开发说明

### 品牌与添加到桌面

- 网页标题、设置页和安装后的应用名统一为 `RabbitPlaneChess`。
- 图标为白兔、蓝色飞机和四色棋格组合，不绑定当前的太空或 3D 风格。
- `public/manifest.webmanifest` 提供 `standalone` 独立窗口、192/512 PNG 和 maskable 图标；另提供 180 PNG Apple Touch Icon 与 SVG/32 PNG favicon。
- 在 HTTPS 站点通过浏览器的安装应用/添加到桌面功能使用；具体入口取决于浏览器。已安装的旧快捷方式可能需要移除后重新添加才能更新名称和图标。
- 根路径及安装入口打开主题首页；两个主题按需加载，首页和 2D 不加载 Three.js。没有 Service Worker、离线缓存或断线存档。
- 编辑 `public/icons/icon.svg` 后，在安装了 `sharp` 的开发环境运行 `node scripts/export-icons.cjs` 重新导出 PNG。上线不需要安装依赖或执行构建。

### 代码入口

- 正式入口：`public/index.html`，通过原生 ES Modules 加载本地静态资源，无构建步骤。
- Three.js 已保存在本地，不依赖 CDN。
- 完整规则、坐标和维护说明见 `docs/PROJECT_HANDOVER.md`。


## 主题与导航

统一入口 → 选择主题 → 独立设置四种颜色 → 开始游戏。

- `/?theme=acrylic`：3D 亚克力，保留太空背景、透明棋盘、飞机、3D/俯视/跟随及拖拽缩放。
- `/?theme=cartoon`：2D 卡通，红兔、绿蛙、黄猫、蓝企鹅，SVG 正面棋盘与独立编号选择。
- 无主题参数、但包含 `n/t/l/test/auto` 的旧配置链接自动落到 3D，沿用原解析方式。
- 四色各自可选择人类、简单电脑、聪明电脑或关闭；至少开启两方。`n=2` 的红黄映射仅用于旧短链接兼容。
- `t=o,h,o,a&l=2,2,2,1` 表示绿方人类与蓝方简单电脑。`test=1` 只固定整局第一次掷骰为 6；`auto=1` 跳过设置开始新局。
- 对局使用 `#play`；普通刷新或直达旧 `#play` 返回对应主题设置。明确带 `auto=1` 的链接在刷新时重新开局。
- 返回首页、设置、重开或浏览器后退离开活跃对局均需确认。取消后保留当前局；确认后旧 AI、动画与监听被取消。前进到已销毁的对局历史记录会回到设置。
- PC 对局中，当轮到人类且处于可掷骰状态时，可按 Enter 快速掷骰；输入控件、按钮或选棋操作获得焦点时不会抢占其回车行为。
- 2D 卡通主题的回合标题跟随当前方颜色；左侧棋子状态中，已到终点的方块使用该方深色并显示对勾。
- 无存档。刷新/关闭提示使用浏览器原生 `beforeunload`，是否显示受浏览器交互策略限制。

## 回归验证

规则测试需要 Node.js 22.7+（建议 Node.js 24）：

```bash
node --test tests/rules.test.mjs
```

浏览器验收使用现有 Playwright 安装，不是网站运行依赖。先运行本地静态服务器，再执行：

```bash
python3 -m http.server 8107 --bind 127.0.0.1 --directory public
# 在另一终端运行
node tests/browser.cjs
node tests/browser-interactions.cjs
```

可用 `PLAYWRIGHT_MODULE` 指向已有 Playwright 包目录，`CHROME_PATH` 指定 Chrome，`TEST_BASE_URL` 指定服务地址。默认使用 macOS Google Chrome 与本机 8107 端口。

测试包含原规则基线对照、同色快进、多阶段撞子、归航/折返、任意颜色组合、TEST MODE、重复操作与取消旧任务；浏览器覆盖两个桌面尺寸、高 DPI、导航与两套真实表现器的完整同种子 AI 对局。完整对局测试加速了表现时长，规则和控制器未替换。截图及记录见 `docs/theme-validation/`，设计稿见 `docs/theme-design/`。

本次未 push 或部署；仓库、Worker、域名配置和品牌图标保持不变。
