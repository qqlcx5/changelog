# Changelog & 个人活动日志 提示词库

本仓库收录从全网整理的、可直接复制使用的提示词（Prompt），覆盖两类场景：

1. **Changelog 生成** —— 从 git 历史 / 提交记录自动产出用户友好的变更说明、版本发布笔记、周报月报。
2. **个人活动日志** —— 记录"做了什么 / 查了什么 / 问了什么 / 想了什么"等多维度的个人日报与复盘。

## 目录

| 文件 | 用途 |
|------|------|
| `changelog-prompt.md` | 每日 changelog、版本发布说明、周/月报提示词 |
| `activity-log-prompt.md` | 个人多维活动日志 + 知识复盘子模板 |
| `auto-changelog-prompt.md` | 自动整合对话内容 → 写入本目录 → 提交的元提示词 |

## 自动整合规则

本仓库的"对话内容 → 落盘 → 提交"流程由全局用户规则驱动：

`C:\Users\t-liaochunxin\.agents\rules\auto-changelog.md`

该规则是给 AI 的指令：在对话中检测到可复用的提示词/模板/调研结论时，
自动整合到本仓库并提交。它**不会**在对话结束后自动触发，需 AI 在对话内主动执行。

## 来源

- changelog-generator 技能（ComposioHQ / 鱼皮AI导航）
- LLM + Git 日志自动化方案（Calpa Liu, 2025-04-25）
- AI 日报/月报实战模板（CSDN, 2026-06）
- 个人生产力系统提示词案例（AISort.net, 2026-08）
- 下载/整理日期：2026-08-21
