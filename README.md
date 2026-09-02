# Aeroplane Chess

一个无需构建步骤的 3D 飞行棋网页游戏。项目使用原生 HTML、CSS、JavaScript 和本地化的 Three.js，可直接部署为静态网站。

## 目录结构

```text
AeroplaneChess/
├── public/
│   ├── index.html
│   └── vendor/three.module.js
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

- 正式入口：`public/index.html`
- Three.js 已保存在本地，不依赖 CDN。
- 完整规则、坐标和维护说明见 `docs/PROJECT_HANDOVER.md`。

