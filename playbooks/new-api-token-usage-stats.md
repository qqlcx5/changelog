---
id: PB-20260907-002
type: playbook
title: New API 用量与 token 统计落地配置（看板 / 倍率 / 查询 API / 长期留存）
tags: [new-api, token-stats, billing, ai-gateway]
status: draft
source: web-collected:2026-09-07
created: 2026-09-07
updated: 2026-09-07
---

# New API 用量与 token 统计落地配置

## 0. 先分清两个口径

- **原始 token 数**：日志里的 `prompt_tokens` / `completion_tokens`，来自上游 usage。
- **额度 quota（计费单位）**：New API 内部结算单位，`1 USD = 500,000 quota`。看板/账单看的是 quota。

## 1. 开箱即用的统计入口

| 入口 | 路径 | 能看到什么 |
|---|---|---|
| 数据看板 | `/console`（管理员） | 全平台消耗趋势折线图、各用户消耗占比，悬停看每日数值 |
| 日志与统计 | `/console/log`（管理员） | 全平台调用记录，可按时间/用户名/模型/渠道/令牌名筛选；管理员视图多「用户名」「渠道名」两列 |
| 使用日志 | 用户控制台 | 自己账号的请求记录；另有绘图日志、任务日志（视频/音乐等异步任务，含退款状态） |

## 2. 先把倍率配准，否则统计数字没意义

系统设置 → **倍率设置**（模型倍率 ModelRatio / 补全倍率 CompletionRatio / 分组倍率 GroupRatio），支持 JSON 或可视化编辑、一键上游同步。

```
额度消耗 = (输入 tokens + 输出 tokens × 补全倍率) × 模型倍率 × 分组倍率
按次计费：额度 = 模型固定价 × 分组倍率 × 500,000
```

- 示例：gpt-4o 模型倍率 1.25、补全倍率 4（输出单价是输入 4 倍）；gpt-4o-mini 0.075 / 4。
- 未配置倍率的模型：自用模式按默认 37.5 计，商务模式直接报「未配置倍率或价格」。
- 计费机制是**预扣 + 后扣差额调整**：按估算 token 预扣，结束后按实际 token 重算并自动补退。

## 3. 程序化查询

```bash
curl -X GET https://<your-newapi>/api/usage/token \
  -H "Authorization: Bearer $NEWAPI_API_KEY"
```

返回 `total_granted` / `total_used` / `total_available` / `unlimited_quota` / `model_limits` / `expires_at`（-1 归一化为 0）。
注：`sk-` 前缀可有可无；缺 Authorization 返回 401，令牌失效返回 `token not found`。

## 4. 准确性与排障

- token 数取决于**上游是否返回 usage**：流式场景需要上游支持 usage 回传（OpenAI 系需 `stream_options.include_usage`），否则只能按估算计费 → 用日志里的 token 字段抽样核对。
- 日志表增长很快：SQLite 单文件会膨胀拖慢查询；有对账/多节点需求改 MySQL，并定期归档。
- 数据量大时按用户/模型/渠道维度用日志筛选，别全表扫描。

## 5. 外部看板（可选）

- `newapi-stats`（VS Code 扩展）：配 baseUrl + userId + session cookie，实时显示余额、今日/总消耗、请求数、提示/完成 token；转换因子默认 500000。
- 直连数据库查 `logs` 表（`prompt_tokens` / `completion_tokens` / `quota` / `model_name` / `channel` / `use_time`；具体字段以实际版本 schema 为准）做自定义报表。

## See Also

- PB-20260907-001（AI 网关选型对比：CLIProxyAPI vs New API vs Sub2API）
