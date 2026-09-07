---
id: PB-20260907-001
type: playbook
title: AI 网关选型对比——CLIProxyAPI vs New API vs Sub2API（含服务器开销）
tags: [ai-gateway, cliproxyapi, new-api, sub2api]
status: draft
source: web-collected:2026-09-07
created: 2026-09-07
updated: 2026-09-07
---

# AI 网关选型对比——CLIProxyAPI vs New API vs Sub2API（含服务器开销）

一句话：三者都把上游 AI 能力统一暴露成 API，但层级不同——
CLIProxyAPI 是**协议桥接器**（接入层）、New API 是**网关治理平台**（管理层）、Sub2API 是**订阅分发运营平台**（运营层）。

## 结论速查（按服务器开销排序）

| 维度 | CLIProxyAPI | New API | Sub2API |
|---|---|---|---|
| 定位 | CLI/OAuth 订阅 → 标准 API 桥接 | 多供应商渠道聚合 + 令牌/计费治理 | 订阅配额池化、Key 分发、并发限流、内置支付 |
| 依赖 | 无（单二进制 + 配置热更新） | SQLite 起步，可选 MySQL/PG + Redis | **强制 PostgreSQL 15+ 与 Redis 7+** |
| 资源占用 | 最低：程序 ~10MB、内存 <10~50MB | 低：1C1G 可跑 | 高：Go + PG + Redis 三件套；1C1G 实测首字响应 3 分钟，建议 2C2G+ |
| 上游 | Gemini CLI / Codex / Claude Code / Qwen 等 CLI/OAuth 账号 | OpenAI / Claude / Azure 等标准 API | Claude / OpenAI / Gemini 等订阅账号池 |
| 运维故障面 | OAuth 过期、CLI 协议变动（风险在上游） | 规模化后渠道/计费治理 | 环境变量 + DB/Redis 配置敏感（Nginx 需 `underscores_in_headers on;` 否则粘性会话失效） |

## 选型

1. **自用 / 个人开发者**：CLIProxyAPI——最小开销，小水管 VPS 可跑。
2. **团队统一网关（计费/权限/多渠道）**：New API——SQLite 起步最省心。
3. **多人分发 Key / 拼车运营**：Sub2API——功能最全（Token 级计费、用户/账号级并发、EasyPay/支付宝/Stripe），但服务器预算给足。
4. 分层组合（接入→治理→运营）只在三层能力都真需要时上，复杂度显著上升。

## 备注

- Sub2API 有 `RUN_MODE=simple` 简易模式：隐藏 SaaS 功能、跳过计费，个人/内部团队可减负。
- 合规：CLIProxyAPI / Sub2API 涉及订阅共享，可能违反上游服务条款（封号风险）；New API 接标准 API 渠道相对可控。
- 来源：CSDN 对比文（2026-07）、51CTO 对比文（2026-04）、Sub2API 官方 README_CN、zhihu 实测帖（2026-03）、lusipad CLIProxyAPI 教程（v6）。
