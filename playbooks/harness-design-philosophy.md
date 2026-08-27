---
id: PB-20260827-001
type: playbook
title: DeepSeek Harness 设计哲学 · 思维框架
tags: [deepseek-harness, architecture, design-philosophy, cordis]
status: draft
source: conversation:2026-08-27
created: 2026-08-27
updated: 2026-08-27
---

# DeepSeek Harness 设计哲学 · 思维框架

> 蒸馏自 deepseek-harness 仓库文档（AGENTS.md / docs/architecture.md / cordis-primer / capability-seams / defensive-patterns / testing / packages/AGENTS.md）。用于在该 harness 中做设计决策、加能力、改扩展点、评审架构时调用。完整版 agent skill 存于 `deepseek-harness/.agents/skills/harness-framework/`。

## 框架概览

核心一句话：**没有特权的核心，只有 Cordis 上下文 + 一串平等插件；一切行为都挂在文档化的扩展点上，并由可回滚的副作用注册。**

两条承重墙：

1. **插件即架构**。运行时由 `cordis.yml` 的 profile → bundle → 插件两层无环图组合而成。能力来自插件，不是写死在 spine。改 spine（尤其是 `agent-loop`）是 rare event，必须同步改 `docs/architecture.md`；加插件是常态。
2. **会话日志是唯一真相源**。任何"模型可见"的输入都必须能从会话日志重建；fork、resume、transcript、遥测全部派生自此流。模型可见 ⟺ 已记录。

## 心智模型（Mental Models）

### MM1 — 没有特权的核心：一切皆插件
- 扩展 = 把插件挂到别的插件旁边，不是打补丁核心。能力默认来自插件。
- 思考"功能放哪"时默认答案：新插件/新 bundle，不是改 spine。

### MM2 — 注册即可逆副作用
- 提示段、工具 schema、适配器、监听器都经 `ctx.effect()` / `ctx.on()` 注册，卸载时统一回滚，每个注册返回 disposer。
- 测试中必须证明销毁（HMR-safety）。

### MM3 — 能力缝合 = 定义 + 提供 + 消费（三者齐备）
- 一个"缝合点"是可替换能力，由 Service Definition + Provider + Consumer 三角色组成，缺一不算缝合点。三角色分处不同包，当且仅当各自独立演化。
- 为**所有当前 Consumer** 设计 SD；不让单个 Consumer 独裁契约。

### MM4 — 模型可见 ⟺ 已记录
- 任何到达模型请求的输入必须能从会话日志重建。新增模型可见输入 ⇒ 新增会话事件。`deriveMessages()` 从日志投影历史。

### MM5 — 事件是扩展点，waterfall 必须 next()
- 会话事件（持久可回放）/代理事件（实时可丢）/能力事件（策略/适配）三族分层。Waterfall 监听器**必须调 `next()`** 委托，否则短路整条链。封闭联合以 `assertNever` 收尾，可扩展联合走 documented default。

### MM6 — 显式优于隐式（包边界铁律）
- 部署可变的取舍是经验证的 `Config` 字段，可从 cordis.yml 改。`DEFAULT_*` 常量或测试钩子**不是**可配置性。默认化是拥有方实现里的显式 `resolve(request): Spec` 步骤，不是 `run()` 里藏 `?? default`。

### MM7 — 同进程信任类型，边界处校验
- 静态接口已要求的返回值不加运行时校验/fallback。只在 parser/config、queued、model/tool JSON、durable/file、worker、process、wire 这些边界校验。

### MM8 — 善终优先：销毁要到静默
- 清理要异步，`kill → await done`，并在 kill 前关闭监听/通知注册表，让迟到完成保持静默。正交结果（`timedOut`/`signal`/`exitCode`）独立上报，绝不嵌套。异步状态不是同步状态。

### MM9 — 地基优于兼容壳（发布前姿态）
- 无外部消费者时优先正确地基而非兼容垫片。可自由重命名/重打包但要把每个引用一起更新。后端拒绝旧的磁盘格式；schema 版本单调。

## 决策启发式（Decision Heuristics）

- 要加新能力 → 先画 SD/Provider/Consumer 三角；为所有当前 Consumer 设计 SD。
- 某物会到达模型 → 加一条会话事件，确保能从日志重建。
- 要改 `agent-loop` → 先更新 `docs/architecture.md`，再动代码。
- 引入可变开关/默认 → 做成 `Config` 字段，别用 `?? default` 藏进 `run()`。
- 跨边界 id → 用 `Branded<B>`，不用裸 `string`。
- 校验该不该加 → 在 7 类边界加；同进程类型化值不加。
- 写 teardown → `kill → await done`，先关注册表。
- 非平凡改动 → 同 PR 写 Agent Note；改了过时行为要改其测试。
- 新行为 → 挂到文档化扩展点；不确定有没有扩展点就先查 `docs/architecture.md`。
- 测试策略 → 真实入口路径 + 无 key 快照覆盖模型/协议/人可见输出 + 验证"世界"而非自报。

## 流派 / 张力对比（Schools & Tensions）

本哲学内部存在可命名的张力，决策时常在两端之间权衡：

| 张力 | 一端 | 另一端 | 默认落点 |
|---|---|---|---|
| 插件纯度 vs 产品务实 | 一切都拆成独立包/三角色 | 能一起变就同目录、少抽象 | 看演化独立性（MM3） |
| 静态信任 vs 边界校验 | 同进程信任 TypeScript | 在 7 类边界强硬校验 | 按边界类型分流（MM7） |
| 地基 vs 兼容壳 | 做对、自由改名 | 保留兼容垫片 | 发布前优先地基（MM9） |
| 显式 vs 简洁 | 一切走 `Config`/`resolve` | 少写样板 | 部署可变者必显式（MM6） |
| 模型可见自由 vs 日志纪律 | 想加啥加啥 | 凡模型可见必入日志 | 日志纪律优先（MM4） |
| 能力集中 vs 消费方自治 | SD 定义全契约 | Consumer 各自扩展 | SD 为所有 Consumer 设计 |

评审时用第二、三列框定争论，再用"默认落点"收口。

## 应用工作流（设计决策协议）

1. **归类**：能力 / 扩展点 / 生命周期 / 配置？对应 MM1–MM9 哪条？
2. **找扩展点**：查 `docs/architecture.md`，确认有没有现成扩展点能承载；没有才考虑 spine 改动（并同步文档）。
3. **画三角**：若是能力，列 SD / Provider / Consumer，确认每角归属与当前 Consumer 证据。
4. **查模型可见性**：会出现在 prompt/tool/结果里吗？会 → 加会话事件，确保可重建。
5. **定边界**：可变开关 → `Config` + `resolve`；跨边界 id → `Branded`；校验只在 7 类边界。
6. **想善终**：有生命周期/并发 → 按 `docs/defensive-patterns.md` 设计到静默的销毁与正交上报。
7. **验世界**：规划测试——真实入口路径 + 无 key 快照 + 世界验证；同 PR 补 Agent Note。
8. **对称自查**：平行值是否对称？非对称是否意味着漏了一个抽取？

## 诚实边界

- 这是**发布前**哲学：明确偏好地基而非兼容，外部消费者出现后部分取舍会变。
- 高度 opinionated，假设你在同仓工作、熟悉 Cordis 与 TypeScript 严格模式；跨仓/跨语言需裁剪。
- 框架给方向，不给具体 API 签名；落实到代码前以当前 `docs/` 与源码为准。
- "张力对比"里的"默认落点"是倾向，不是规则；用证据（当前 Consumer、演化独立性）推翻它。

## 智识谱系

- **Cordis（vendored）**：插件上下文 + 声明合并 + 可逆副作用，脊梁直接来源。
- **事件溯源**：会话日志作为唯一真相源、`deriveMessages` 投影。
- **基于能力的架构**：能力缝合三角色、可替换 Provider。
- **插件 / 微内核架构**："没有特权的核心"。
- **静态类型即规范**：类型化同进程边界信任编译器。
