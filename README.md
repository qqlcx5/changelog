# 个人可复用知识库（changelog）

> 人可读、agent 可检索、进 git、跨工具共享的沉淀仓库。
> 由 AI 会话中的 auto-changelog 流程自动维护，人也随时可用。

## 现状速览

| 类型 | 数量 | 说明 |
|------|------|------|
| prompts | 3 | 可直接复制使用的提示词 / 模板 |
| playbooks | 27 | 实战手册（步骤 + 命令 + 坑点） |
| learnings | 8 | 单点认知：纠正 / 缺口 / 更好做法 |
| errors | 35 | 命令失败、集成故障、踩坑记录 |

数字可能与实际有漂移，以 [INDEX.md](INDEX.md) 为准。

## 入口

| 想做什么 | 去哪 |
|---------|------|
| 找内容 | [INDEX.md](INDEX.md)（总索引，唯一入口） |
| 写入 / 整合新条目 | [WORKFLOW.md](WORKFLOW.md)（类型路由、格式契约、七步流程） |
| 校验一致性 | `tools/sync-index.ps1`（退出码 0 即通过） |
| 重建索引 | `tools/sync-index.ps1 -Sync`（以 frontmatter 为真相源） |

## 目录

```
prompts/       可直接复制使用的提示词模板（单文件 + frontmatter）
playbooks/     实战验证过的操作手册（步骤 + 命令 + 坑点）
learnings/     分轨追加日志：
               ERRORS.md            踩坑记录
               LEARNINGS.md         单点认知
               FEATURE_REQUESTS.md  想要而还没有的能力
skills/        第三方技能资产（self-improving-agent 完整体系）
archive/       历史归档（含旧版规则 auto-changelog-v1）
```

## 使用方式

**人**：打开 `INDEX.md`，按 tags / title 定位 → 读对应文件。playbook 直接照步骤执行。

**agent**：会话中遇到可复用产出时按 `WORKFLOW.md` 七步流程写入；检索时先读 `INDEX.md` 再读条目，不凭记忆猜测条目内容。

## 维护约定（摘要）

- **触发**：产出可脱离原对话独立使用的内容（完整步骤 / 命令 / 提示词模板 / 踩坑修复），或用户明示「整合 / 保存 / 沉淀 / 提交」；纯闲聊、一次性结论、项目特定细节不触发。
- **格式**：单文件条目带完整 frontmatter（id / type / title / tags / status / source / created / updated）；分轨条目按固定 markdown 结构追加。
- **判重**：写入前必查 `INDEX.md`，已有同类条目则更新原文件并刷新 `updated`，禁止建重复文件。
- **git**：只 add 本次写入的精确文件列表（含 INDEX.md），禁 `add -A`；commit 后 push，不 force push、不改历史。
- **红线**：凭证 / 密钥 / token、内部 IP / 域名、未脱敏客户数据，永不入库。

## 晋升机制（轻量）

1. error / learning 轨道同一 Pattern 复现 ≥3 次 → 提炼为 playbook 单文件，原条目标 `promoted`；
2. playbook 高频复用 → `status: promoted`，正文持续打磨；
3. 广泛适用的认知 → 同步写入 agent memory，本仓库保留完整版。

条目规模显著增长后，可升级到 `skills/self-improving-agent/` 完整体系（ID 状态机 / hook / 晋升流水线）。

## 与 agent memory 的分工

| | 本仓库 | agent memory |
|---|---|---|
| 内容 | 提示词、实战手册、错误教训 | 用户偏好、项目约定、会话状态 |
| 使用者 | 人主动用，agent 按 INDEX 检索 | agent 自动使用 |
| 存储形态 | git 仓库，跨工具跨机器共享 | 单工具内持久化 |

## 历史

- v1 全局规则（2026-08-21 ~ 08-25）：`archive/rules/auto-changelog-v1.md`
- v1 元提示词（已被 WORKFLOW.md 取代）：`prompts/auto-changelog.md`
- 现行权威契约：[WORKFLOW.md](WORKFLOW.md)（v2，2026-08-25 起）
