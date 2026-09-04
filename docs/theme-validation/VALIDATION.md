# 主题实现验收记录

2026-09-04，本机 Chrome，静态 public 服务。未推送或部署。

## 已通过

- `tests/rules.test.mjs`：12 项全部通过。2,000 个随机局面与原合法动作/AI 函数一致，1,200 个合法动作的最终状态与原异步移动执行器一致。
- 单独覆盖 +4、直接穿越、+4 后穿越、入口/快进落点/中点/出口撞子、同格全撞回、归航 50→51、56 折返/精确完成、出生格无保护、独立叠放、缺少对面方、两档 AI、关闭席、红绿/绿蓝组合、连续第三个 6 换手、TEST 首掷、重复操作锁。
- 取消等待测试：在 AI 延迟、掷骰、移动阶段结束会话后，旧状态与更新次数不再改变。
- `tests/browser.cjs`：首页、两主题设置与对局的 1280×720、1440×810 布局；两主题真实掷骰/选择；退出取消/确认；旧链接；刷新；前进后退；无效主题；多次重开/切换；resize；3D 俯视/跟随/默认控制；DPR2。
- 两套实际表现器使用同一随机种子完成四方混合 AI 对局，所有棋子、回合、名次等最终状态完全一致。完整对局测试加速了动画/等待时长，没有替换核心 Game、规则或表现器。
- `tests/browser-interactions.cjs`：3D raycast 直接点中棋子；四枚同格棋子的独立键盘选择；两主题以真实动画时长展示 +4 后穿越，以及各阶段撞子，最终状态一致。
- 最终控制台检查无 error，主要浏览器验收没有 pageerror 或 HTTP 4xx/5xx。2D 网络清单没有 Three.js；首页不创建 canvas 或 WebGL 场景。
- 3D DPR2 的 CSS 1280×720 对应绘图缓冲区 2560×1440；2D 使用 SVG viewBox。
- 品牌图标与改造前副本逐字节一致；manifest name/short_name=RabbitPlaneChess，id/start_url=/；wrangler.jsonc 未改。
- `git diff --check` 通过。

## 交付图

- home-1280.png、home-1440.png：统一首页。
- setup-cartoon-*.png、setup-acrylic-*.png：两主题设置。
- cartoon-*.png、cartoon-choosing-*.png：2D 正常及选择状态。
- acrylic-1280.png、acrylic-1440.png：保留的 3D 场景。
- cartoon-dpr2.png：高 DPI 检查时截图。
- stack-selection-1280.png：测试构造的叠放局面，仅用于命中/独立选择检查。
- browser-results.json：完整同种子对局的最终状态和浏览器验收结果。

## 未验证与范围边界

Safari、Firefox、移动设备真机、实际安装后的独立窗口未实测。安装名称与默认入口已核对 manifest；未引入 Service Worker 或离线缓存。没有联网、音效或对局存档。浏览器原生离开提示受浏览器交互策略限制。

原有未提交改动保留，新增/修改均留在工作区；未 commit、push 或发布。
