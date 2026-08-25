# 个人可复用知识库（changelog）

提示词（prompts）、实战手册（playbooks）、经验教训（learnings）的沉淀仓库，
由 AI 会话中的 auto-changelog 流程自动维护，人与 agent 共用，已推送 GitHub。

## 入口

| 想做什么 | 去哪 |
|---------|------|
| 找内容 | [INDEX.md](INDEX.md)（总索引，唯一入口） |
| 整合 / 写入新条目 | [WORKFLOW.md](WORKFLOW.md)（类型路由、格式契约、七步流程） |
| 一致性校验 / 再生成索引 | `tools/sync-index.ps1` |

## 目录

```
prompts/       可直接复制使用的提示词模板
playbooks/     实战验证过的操作手册（步骤 + 命令 + 坑点）
learnings/     错误 / 教训 / 功能请求分轨日志（追加式）
skills/        第三方技能资产（self-improving-agent 完整体系）
archive/       与主题无关的归档（含旧版规则）
```

## 维护约定（摘要）

- 触发：对话中产出可脱离上下文独立使用的内容，或用户明示沉淀；
- 格式：单文件条目带 frontmatter（id/type/title/tags/status/source/created/updated）；
- git：只 add 本次写入的精确文件（禁 `add -A`），commit 后 push；
- 红线：凭证 / 密钥 / 内部地址永不入库。

完整契约见 [WORKFLOW.md](WORKFLOW.md)。
