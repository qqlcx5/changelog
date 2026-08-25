# WORKFLOW — auto-changelog 写入契约（v2）

> 本文件是 auto-changelog 流程的唯一权威定义。
> 全局规则（`.agents/rules/auto-changelog.md`）只负责触发判断并指向本文件；
> 任何写入本仓库的操作，流程、格式、ID、git 规范一律以本文件为准，禁止凭记忆即兴发挥。

## 1. 仓库定位与边界

- **定位**：个人可复用知识库——人可读、agent 可检索、进 git、跨工具共享。
- **与 agent memory 的分工**：memory 存用户偏好、项目约定、会话状态（agent 自动使用）；
  本库存人要用的提示词、实战手册、错误教训（人主动用，agent 按 INDEX 检索）。
- **红线（任何内容不得入库）**：凭证 / 密钥 / token、内部 IP / 域名、未脱敏的客户数据。

## 2. 内容类型与目录路由

| type | 落点 | 判定标准 |
|------|------|---------|
| prompt | `prompts/<slug>.md` | 可直接复制使用的提示词 / 模板 |
| playbook | `playbooks/<slug>.md` | 完整实操手册：步骤 + 命令 + 坑点，实战验证过 |
| learning | `learnings/LEARNINGS.md`（追加） | 单点认知：纠正 / 知识缺口 / 更好做法 |
| error | `learnings/ERRORS.md`（追加） | 命令失败、集成故障、踩坑记录 |
| feature-request | `learnings/FEATURE_REQUESTS.md`（追加） | 想要而还没有的能力 |

slug 规则：小写英文连字符；目录已表达类型，文件名**不带** `-prompt` 等后缀。

## 3. 触发判定（满足其一即整合）

- 产出了**可脱离原对话独立使用**的内容：完整操作步骤 / 命令 / 参数、提示词模板、踩坑与修复方案；
- 用户明示「整合 / 保存 / 沉淀 / 提交」。

**不触发**：纯闲聊、一次性结论、项目特定细节（归项目 memory）、红线内容。

## 4. 条目格式契约

### 4.1 单文件条目（prompt / playbook）

frontmatter 字段完整，字段顺序固定，正文保持原有内容形态：

```yaml
---
id: PB-20260825-001        # PR=prompt / PB=playbook + 首创日期 + 当日序号（NNN 从 001 起）
type: playbook             # prompt | playbook
title: Windows PATH 被 setx 覆盖后的恢复
tags: [windows, setx, registry, vss]   # 小写英文，≤4 个
status: verified           # draft=整理未验证 / verified=实战验证 / promoted=高频复用精华
source: conversation:2026-08-25        # 来源：conversation:日期 | web-collected:日期
created: 2026-08-25
updated: 2026-08-25
---
```

### 4.2 分轨条目（learning / error / feature-request）

追加到对应轨道文件末尾，格式：

```markdown
## [LRN-20260825-001] 一句话标题

**Logged**: 2026-08-25T13:00:00 | **Status**: pending | **Tags**: a, b

### Summary
一句话说明学到什么 / 错在哪。

### Details
完整上下文：发生了什么、为什么错、正确的是什么。

### Suggested Action
具体可执行的修复或改进。

---
```

- id 前缀：`LRN`（learning）/ `ERR`（error）/ `FEAT`（feature-request）。
- 相关条目互链：Metadata 区加 `See Also: ERR-20260825-001`。
- 已解决：`Status: pending` → `resolved`，条目内追加 `### Resolution`（日期 + 做了什么）。

## 5. 写入流程（7 步）

1. **查索引**：读 `INDEX.md`，按 tags / title 判断**新增**还是**更新**——已有同类条目则更新原文件并刷新其 `updated`，禁止建重复文件；
2. **定类型**：按第 2 节路由表确定 type 与落点；
3. **写入**：单文件条目按 4.1 格式；分轨条目按 4.2 追加；
4. **同步索引**：更新 `INDEX.md` 对应表格行 / learnings 统计行；
5. **校验**：运行 `tools/sync-index.ps1`（退出码 0 才继续；环境不允许时逐项人工核对 INDEX 与文件一致）；
6. **提交**：`git add <本次写入的精确文件列表，必须含 INDEX.md>`——**禁止 `add -A` / `add .`**；
7. **回报**：commit 并 push，格式 `add(playbook): <slug>` / `update(prompt): <slug>` / `learn(err): <一句话>` / `refactor: <主题>`；
   回报 1-2 行（写入的文件 + commit 摘要）。不 force push、不改历史。

## 6. 晋升机制（轻量）

- learnings 分轨条目同一 Pattern 复现 **≥3 次**（See Also 链接计数）→ 提炼为 playbook 单文件，原条目 `Status: promoted`；
- playbook 高频复用 → `status: promoted`，正文持续打磨；
- 广泛适用的认知 → 同步写入 agent memory（Qoder UpdateMemory 等），本仓库保留完整版。

## 7. 工具：tools/sync-index.ps1

- **校验模式**（默认）：frontmatter 完整性、id 格式与唯一性、type 与目录一致、status / 日期合法、INDEX 表格与文件双向一致（孤儿行 / 缺失行 / 字段漂移）、learnings 统计一致；发现 error 时退出码 1。
- **`-Sync` 模式**：以文件 frontmatter 为唯一真相源，重新生成 `INDEX.md` 三个表格区块。

## 8. 历史与关联

- 旧版全局规则（v1，2026-08-21 ~ 08-25 生效）：`archive/rules/auto-changelog-v1.md`；
- v1 元提示词（已被本文件取代，保留作历史参考）：`prompts/auto-changelog.md`；
- `skills/self-improving-agent/`：第三方完整体系（ID 状态机 / hook / 晋升流水线），第 4.2、6 节的分轨与晋升是其轻量实现；条目规模显著增长后可升级到该体系。
