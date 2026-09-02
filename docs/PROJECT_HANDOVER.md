# 3D 飞行棋 · 项目总结与移交文档

> 浏览器端 Three.js 单机对战游戏 · 第四版（固定 45° 摆正视角 + 太空深色背景）
> 单文件 `index.html` · three.js 0.160 本地化 · 零构建步骤 · 四色独立启用 · 人类 + AI 混战

---

## 1. 项目概览

一个纯前端的 3D 飞行棋（Ludo / Aeroplane Chess）游戏。整个游戏是**一个 HTML 文件**，内嵌全部 CSS 与 JavaScript，无构建工具、无框架、无后端。Three.js 已下载到 `public/vendor/`，可由任意静态服务器或 Cloudflare 直接托管。

| 项 | 值 |
|---|---|
| 项目路径 | `/Users/zm/Documents/GitHub/AeroplaneChess/` |
| 主文件 | `public/index.html`（含 HTML + CSS + ES Module 脚本） |
| 依赖 | `public/vendor/three.module.js`（three@0.160，1.2 MB，本地离线可用） |
| 运行方式 | `python3 -m http.server 8099 --directory public` 后访问本机 8099 端口 |
| 视觉验证 | headless Chrome + `--enable-unsafe-swiftshader` 截图（本机已跑通） |

## 2. 文件结构

```
AeroplaneChess/
├─ public/
│  ├─ index.html           主程序（单文件）
│   ├─ <style>             全部 UI 样式（玻璃拟态面板、设置面板、结果面板）
│   ├─ <body>              canvas + HUD + 设置/结果浮层
│   └─ <script type="module">
│       ├─ 常量与坐标系     第 283-355 行
│       ├─ 相机系统         第 383-445 行
│       ├─ 太空背景         第 447-561 行
│       ├─ 棋盘贴图烘焙     第 565-719 行
│       ├─ 棋子 / 骰子建模  第 721-825 行
│       ├─ 交互控制         第 827-869 行
│       ├─ 设置面板         第 883-943 行
│       ├─ 规则引擎         第 1044-1128 行
│       ├─ AI 决策          第 1242-1284 行
│       └─ 动画 / 主循环    第 1286-1516 行
│  └─ vendor/
│     └─ three.module.js   three@0.160
├─ docs/PROJECT_HANDOVER.md
├─ README.md
└─ wrangler.jsonc          Cloudflare Workers Static Assets 可选配置
```

## 3. 棋盘几何与坐标系

棋盘是 **15×15 格**的逻辑网格，映射到世界坐标 XZ 平面，格边长 1 单位。

| 常量 / 函数 | 含义 |
|---|---|
| `GRID = 15` | 棋盘 15×15 格 |
| `HALF = 7` | 半宽，格坐标 → 世界坐标的偏移量 |
| `gridToWorld(c, r)` | `(c-7, y, r-7)`，棋盘中心即世界原点 |
| `PATH[52]` | 共享航道 52 格；四侧轨道位于第 5/9 列或行，每象限 13 格 |
| `PATH_LEN = 52` | 共享航道坐标总数，用于全局索引循环 |
| `HOME_LEN = 6` | 归航道格数 |
| `HOME_ENTRY_PROG = 50` | 与本方专属归航道正对的共享航道入口；不触发同色快进 |
| `HOME_START_PROG = 51` | 归航道第一格；修正入口后多走一格的问题 |
| `TOTAL = 56` | 各色专属终点（归航道第 6 格；中心圆盘仅为装饰） |
| `STARTS = [0,13,26,39]` | 红/绿/黄/蓝四家起飞机位在 PATH 上的索引 |
| `HOMES[4][6]` | 四家归航道的 6 个格坐标 |
| `BASE_SIZE = 5` | 四家机库均为 5×5 格 |
| `BASE_ORIGIN` | 四家机库原点：`[0,0] / [10,0] / [10,10] / [0,10]` |
| `BASE_SLOTS` | 机库内 4 个对称停机位：`[1.1,1.1] / [2.9,1.1] / [1.1,2.9] / [2.9,2.9]` |
| `pathColor(globalIndex)` | 从正对红方归航道的 `PATH[50]` 起顺时针循环红/绿/黄/蓝，即 `(globalIndex + 2) % 4`；每色 13 格 |
| `FLIGHT_ROUTES[4]` | 四色快速通道；私人进度统一从 18 飞至 30，横跨对面玩家归航道第四格 |
| `globalIdx(seat, prog)` | 玩家私有进度 → PATH 全局索引，`(STARTS[seat] + prog) % 52` |
| `posToWorld(seat, prog)` | 进度 → 世界坐标（自动区分外圈 / 归航道 / 终点） |

**棋子状态机**：`base`（基地）→ `track`（共享航道，prog 0-50）→ `home`（归航道，prog 51-55）→ `done`（本色归航道末格，prog 56）。`prog` 是玩家私有进度，不随座位不同而改变含义。

共享航道位于坐标 5/9，专属归航道位于坐标 7；两者中心坐标差为 2，中间留一整列或一整行空白。机库缩小后通过每侧 `5 + 5 + 3` 格的连接结构保持共享航道总数为 52；`STARTS` 与四色铺色无需调整，但私人进度 50 的本方归航入口需明确排除同色快进。

公共航道不使用端点覆盖表。按棋盘几何上与专属归航道正对齐的公共格计算，四个入口分别为红 `PATH[50]`、绿 `PATH[11]`、黄 `PATH[24]`、蓝 `PATH[37]`，均与本方颜色一致。出生格颜色仅由 `pathColor()` 决定，格内绘制沿 `PATH` 前进方向的箭头，不再绘制飞机字符。

快捷飞行虚线使用实际飞行者颜色，不跟随端点公共格颜色：黄方跨红方归航道、蓝方跨绿方归航道、红方跨黄方归航道、绿方跨蓝方归航道。公共航道着色与快捷通道归属必须保持为两个独立概念。

视觉采用透明亚克力体系：渲染器启用 ACES 色调映射，棋盘底图使用冷白底与保留色相的四色混色，顶面叠加独立 `MeshPhysicalMaterial` 透明覆层和冷蓝发光边缘；飞机使用低粗糙度 clearcoat 亮面材质。HUD 与设置面板使用低不透明度蓝黑玻璃、饱和模糊和内侧高光。黄色采用更清透的暖金渐变并保留深金箭头，避免白色图案丢失。

## 4. 游戏规则实现

| 规则 | 实现位置与逻辑 |
|---|---|
| 掷 6 起飞 | `legalMoves()`：仅当 `dice === 6` 时产出 `kind:'launch'`；允许与己机叠放，且起飞不触发同色快进 |
| 连掷 6 | `endTurn()`：`dice === 6 && sixStreak < 2` 则再掷一次，上限连掷 2 次 |
| 撞子 | `resolveLanding()` 在所有共享航道格调用 `enemiesAt()`；起飞格也不受保护，同色快进的触发格与最终格分别结算 |
| 同色快进 | 正常走骰停在本色共享格后自动逐格 `+4` 一次；不连锁；私人进度 50 是本方归航入口，即使同色也不触发快进 |
| 快速穿越 | 直接或经 `+4` 到私人进度 18 时飞至 30；直接落入口时穿越优先于该格的 `+4`，途中可击落对面归航道第四格的全部飞机 |
| 终点折返 | 点数超过 `TOTAL` 时先移动到终点，再按多余点数沿归航道退回；只有刚好停在 `TOTAL` 才算抵达 |
| 己方叠放 | 所有位置允许己机同格；每架仍独立选择和移动，敌方撞入时同格己机全部回基地 |
| 胜负判定 | 4 机全部抵达 → 记名次；`checkGameOver()` 剩 1 家未完成时收尾 |
| 无棋可走 | `legalMoves()` 返回空 → 提示后直接换手 |

**回合状态机**

```
setup → idle → rolling → choosing → anim → (endTurn) → idle → ... → over
```

- `nextStep()`：轮到某家，AI 自动延迟 430-810ms 后掷骰，人类等待点击
- `doRoll()`：掷骰 → 3D 骰子翻滚动画 → 计算合法走法 → 0 个换手 / 1 个直接走 / 多个进入 `choosing`
- `applyMove()`：骰子逐格动画 → 首落点结算 → 可选同色 `+4` → 可选快速穿越及中途撞击 → 最终落点结算 → 终点判定 → `endTurn()`

## 5. AI 决策

两档难度。`level 1`（简单）纯随机；`level 2`（聪明）走评分启发式（`aiChoose()`）：

聪明电脑在评分前执行两层硬优先级：有精确抵达终点的动作时必选终点；已有飞机进入归航道但无法精确抵达时，只要基地或共享航道仍有合法动作，就排除归航道内的普通前进和折返。简单电脑不使用这些优先级，始终在全部合法动作中随机选择。

| 评分项 | 分值 | 说明 |
|---|---|---|
| 击落敌机 | +100 / 落点 | 快进前后两次撞击分别计分，每台敌机再按其进度 +0.35/步 |
| 抵达终点 | +95 | `kind === 'finish'` |
| 起飞 | +34 | `kind === 'launch'` |
| 快速穿越 | +42 | `mv.flight`，中途及出口撞击另外计分 |
| 进入归航道 | +26 + 2/格 | 越深入归航道越加分 |
| 落点受威胁 | −22 / 敌机 | `threatAt()` 统计 1-6 步内能打到该格的敌机数 |
| 逃离危险格 | +16 / 敌机 | 当前格不安全时，移走加分 |
| 推进距离 | +0.45 / 步 | 基础前进奖励 |
| 随机扰动 | 0-5 | 避免同分僵化 |

> AI 只有单层评分、无搜索。若要提升棋力，可改为 1-2 层 minimax 或蒙特卡洛 rollout。

## 6. 相机系统（第四版重点）

用户明确要求：**棋盘摆正、45° 俯视固定、棋盘落在浏览器靠底部正中央**。

```js
const PITCH_45    = Math.PI / 4;      // 俯角 45°（视线与水平面夹角）
const THETA_FIX   = -Math.PI / 2;     // 相机固定 -z 方向，棋盘对称不旋转
const SHIFT_RATIO = 0.06;             // 棋盘中心轻微下移到屏幕约 56% 高度处

// 视锥上移 → 内容下移，实现"底部居中"
shiftPx = Math.round(h * SHIFT_RATIO);
camera.setViewOffset(w, h, 0, -shiftPx, w, h);

// 自动算出刚好装下棋盘的距离
function fitDist(phi) {
  const halfSpan = HALF + 1.25;
  const vTan = Math.tan(camera.fov * Math.PI / 360);
  const nearDepth = halfSpan * Math.sin(phi);
  const bottomRoom = Math.max(0.42, 1 - 2 * SHIFT_RATIO);
  const needV = nearDepth + halfSpan * Math.cos(phi) / (vTan * bottomRoom);
  const needH = nearDepth + halfSpan / (vTan * Math.max(0.46, camera.aspect));
  return clamp(Math.max(needV, needH) * 1.02, 15, 58);
}
```

| 函数 | 作用 |
|---|---|
| `viewDefault()` | 固定 45° 摆正视角（默认，开局时调用） |
| `viewTop()` | 接近正上方俯视（同样摆正 + 底部居中） |
| `focusSeat(seat)` | 跟随模式（默认关闭）：转到当前玩家一侧 |
| `applyCam()` | 球坐标 → 笛卡尔，`lookAt(0,0,0)` 并 `updateMatrixWorld` |
| `resize()` | 重算 aspect、viewOffset、fitDist |

> ⚠️ **历史坑（勿重犯）**：第三版曾把 `lookAt` 目标点偏到基地内部 0.46 处，导致整个棋盘被推出视野、只剩一角。修复原则是 `lookAt` 永远指向棋盘中心 `(0,0,0)`，想让己方靠近就用方位角 `theta`，不要用目标点偏移。

## 7. 太空背景

- **底色**：`scene.background = 0x04060f`，雾 `Fog(0x04060f, 52, 120)`
- **穹顶**：半径 180 球体 + `BackSide`，贴图为 256×512 Canvas 渐变（深空 → 紫蓝地平线 → 深空），叠加 5 块径向星云斑（紫 / 蓝 / 粉 / 青）
- **星空**：两层 Points，远层 2600 颗（r 95-168，size 0.62）+ 近层 420 颗（r 58-104，size 1.45），6 种淡彩随机染色，AdditiveBlending
- **行星**：蓝色大行星 r=7.2 在 `(-78, 46, -112)`，橙色小行星 r=3.4 在 `(96, 30, -96)`，均带 Sprite 光晕
- **动效**：主循环里星空缓慢自转（远层 0.00007 / 近层 0.00013 rad/帧）
- **棋盘底座**：`Cylinder(15.5, 15.2, 0.6)` 深空金属色 + `RingGeometry` 蓝色边缘光环（透明度 0.10±0.05 呼吸）

## 8. 交互与点击

| 交互 | 实现 |
|---|---|
| 旋转视角 | pointerdown/move/up 拖拽改 `camTarget.theta / phi`（阻尼插值跟随） |
| 缩放 | 滚轮 + 双指 pinch，`clamp(dist, 12, 44)` |
| 点击 3D 飞机 | Raycaster + **隐形 hitbox**：每架飞机内嵌 `SphereGeometry(0.45)`，`opacity:0 / depthTest:false`，raycast 命中后沿 `.parent` 回溯到飞机 group |
| 兜底按钮面板 | `buildPickPanel()` 底部生成彩色飞机按钮，完全绕开 3D raycast |
| 落点预测 | 悬停时脚下显示脉冲圆环 + 落点标记 |
| 选棋高亮 | 可走飞机放大 1.18 + 脚下黄色脉冲环 + 底部按钮发光 |

> ⚠️ **关键修复**：raycast 前必须 `camera.updateMatrixWorld(true)` 并对所有飞机 `updateMatrixWorld(true)`，否则用的是过期矩阵导致点击失效。飞机本体（cone+box）在屏幕上太小，**隐形 hitbox 不能删**。

## 9. URL 快捷参数

| 参数 | 取值 | 说明 |
|---|---|---|
| `n` | 2 / 3 / 4 | 旧链接兼容参数；新配置无需填写人数 |
| `t` | `h,o,a,o` | 红/绿/黄/蓝四席类型（h=人类，a=电脑，o=关闭） |
| `l` | `2,2,1,1` | 各座位 AI 难度（1=简单，2=聪明） |
| `test` | 1 | 开启 TEST MODE（仅整局第一次掷骰固定为 6，后续规则不变） |
| `auto` | 1 | 跳过设置面板，延迟 500ms 直接开局 |

```
index.html?t=h,h,h,h&auto=1            四色全人类，自动开局
index.html?t=o,h,o,a&l=2,2,2,2&auto=1  绿方人类 vs 蓝方聪明电脑
index.html?t=h,a,a,a&test=1            TEST MODE 快速验证
```

## 10. 已知限制与待办

| # | 项目 | 说明 |
|---|---|---|
| 1 | 叠机不成编队 | 己机可任意同格，但按确认规则仍逐架独立移动 |
| 2 | 无音效 | 掷骰、起飞、撞子、抵达均无声音反馈 |
| 3 | 无联机 | 仅本地热座 + AI，无网络对战 |
| 4 | 移动端未真机验证 | 已用 pointer 事件支持触摸旋转，但未在手机/平板上实测 |
| 5 | AI 无搜索 | 仅单层评分启发式，棋力有限 |
| 6 | 归航道动画简陋 | 进入终点只有简单飞行动画，无粒子/烟花特效 |
| 7 | 无存档 | 刷新页面即丢失进度 |
| 8 | 无"己方视角"提示 | 固定视角下需自行辨认己方颜色，可考虑加高亮描边 |

## 11. 用户偏好（交接必读）

- 反馈问题时期望**直接给根因 → 修复方案**，不要铺垫和寒暄
- 视觉/布局问题会**直接发截图**，要求看图定位而不是猜
- 交付物偏好 **HTML 格式**（可一键导 PDF），要求高对比度排版
- 修改后**必须实际截图验证**，不能只说"应该没问题"
- UI 问题坚持真机/真实浏览器实测，不接受"编译通过就算完成"

---

## 12. 移交 Prompt

复制以下 Markdown 全文，粘贴给新的 AI 会话即可无缝继续开发。

````markdown
你接手一个已开发完成、可正常游玩的浏览器 3D 飞行棋项目。请先读完下面的上下文，再动手。

## 一、项目位置与运行方式
- 项目根目录：/Users/zm/Documents/GitHub/AeroplaneChess/
- 主文件：public/index.html（单文件，内嵌全部 CSS 与 JS，无构建步骤、无框架、无后端）
- 依赖：public/vendor/three.module.js（three@0.160，已本地化）
- 运行：在仓库根目录执行 python3 -m http.server 8099 --directory public，访问 http://localhost:8099/
- 视觉验证方法（本机已跑通，务必沿用）：
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-sandbox \
  --disable-dev-shm-usage --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size=1280,720 --virtual-time-budget=12000 \
  --screenshot=/tmp/fc.png "http://localhost:8099/index.html?t=h,h,h,h&auto=1"
  然后用 Read 工具看截图，确认改动生效。

## 二、当前已完成的功能（第四版，已通过截图验证）
1. 相机固定 45° 俯视、棋盘摆正、棋盘落在浏览器靠底部正中央
2. 太空深色背景：深空渐变穹顶 + 星云斑 + 两层星空（约 3000 颗）+ 2 颗远行星 + 平台边缘蓝色光环
   棋盘采用冷白高对比底图 + 独立透明亚克力覆层，飞机与界面同步使用亮面/玻璃材质
3. 红/绿/黄/蓝四席始终显示，每席以“人类 / 简单电脑 / 聪明电脑 / 关闭”四个互斥选项直接配置；至少开启两席
4. 完整规则：掷 6 起飞、连掷 6、四色共享航道、同色 `+4`、快速穿越、己机叠放、多阶段撞子、终点超点折返、名次判定
5. 交互：拖拽旋转、滚轮/双指缩放、点击 3D 飞机移动（靠隐形 hitbox）、底部兜底按钮面板、落点预测环
6. TEST MODE 开关：仅保证整局第一次掷骰为 6；后续骰子随机，仍严格遵守“掷 6 起飞”

## 三、代码结构锚点（函数名优先于行号，行号会漂移）
坐标系与常量（约 283-355 行）
  GRID=15 / HALF=7 / PATH[52] / STARTS=[0,13,26,39] / HOMES[4][6] / HOME_ENTRY_PROG=50 / HOME_START_PROG=51 / TOTAL=56
  HOME_ENTRY_PROG=50 / FLIGHT_ENTRY_PROG=18 / FLIGHT_EXIT_PROG=30 / FLIGHT_ROUTES[4]
  gridToWorld(c,r) = (c-7, y, r-7)；pathColor(globalIndex)；globalIdx(seat,prog)；posToWorld(seat,prog)
相机系统（约 383-445 行）
  PITCH_45=π/4 / THETA_FIX=-π/2 / SHIFT_RATIO=0.06
  fitDist(phi) / viewDefault() / viewTop() / focusSeat(seat) / applyCam() / resize()
太空背景（约 447-561 行）
  dotTexture() / starField() / buildSpace()（IIFE）/ spaceGroup
棋盘与建模（约 565-825 行）
  buildBoardTexture()（Canvas 2D 烘焙棋盘贴图）/ makePlane()（飞机）/ diceFaceTexture()
规则引擎（约 1044-1222 行）
  legalMoves(p,dice) / enemiesAt() / previewHitStage() / previewFlightHitStage() / resolveLanding() / resolveFlightCrossing() / nextStep() / doRoll() / applyMove() / endTurn() / checkGameOver()
AI（约 1242-1284 行）
  aiChoose(p,moves)（评分启发式）/ threatAt(seat,g)
动画与主循环（约 1286-1516 行）
  hop() / flyShortcut() / knockBack() / flyToFinish() / buildPickPanel() / showPickIndicators() / layoutStacks() / loop()

## 四、必须遵守的约束（改坏了会被打回）
1. 相机必须是「固定 45° 俯视 + 棋盘摆正 + 底部居中」，不要改回「每回合跟随当前玩家自动旋转」。
   关键：lookAt 永远指向棋盘中心 (0,0,0)，靠 theta 方位角控制朝向，不要偏移 lookAt 目标点
   （历史坑：第三版把 lookAt 目标偏到基地内部，导致整个棋盘被推出视野只剩一角）。
2. 背景必须保持太空深色风格（星空 / 星云 / 行星），不要改回浅色。
3. 每架飞机内部的 SphereGeometry(0.45) 隐形 hitbox 不能删 —— 飞机本体太小，删了就点不中。
4. Raycast 前必须先 camera.updateMatrixWorld(true) 并对所有飞机 updateMatrixWorld(true)，否则点击失效。
5. 保留 TEST MODE 开关（设置面板按钮 + URL 参数 &test=1）。
6. 改完必须实际截图验证，不能只说「应该没问题」。

## 五、已知限制（可作为下一步改进方向）
- 己方棋子允许叠放，但按当前确认规则仍逐架独立移动
- 无音效、无联机、无存档
- AI 只有单层评分启发式，无搜索（可升级为 1-2 层 minimax）
- 移动端触摸已用 pointer 事件支持，但未真机验证
- 固定视角下己方颜色需自行辨认，可考虑加己方高亮描边

## 六、协作方式偏好
- 反馈问题直接说「根因 → 修复方案」，不要寒暄和铺垫
- 布局/视觉问题我会直接发截图，请对照截图定位
- 交付物偏好 HTML 格式（可一键导 PDF），排版要高对比度

## 七、本次任务
（在这里填写你接下来要我做的具体事情）
````

---

*3D 飞行棋 · 项目总结与移交文档 · 第四版 · 生成于 2026-09-01*
*主文件：`public/index.html` · three.js 0.160 本地化*
