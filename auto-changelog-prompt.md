# 自动整合提示词（Auto-Changelog Prompt）

用途：当用户在对话中收集/整理了若干内容（如 changelog 提示词、活动日志模板），
本提示词驱动 AI 自动把对话结论整合为文件、写入目标仓库目录并提交 git。

> 这是一份"元提示词"——它本身不产生 changelog，而是指导 AI 完成
> 「整合 → 写文件 → 提交」的自动化流程。

---

## 提示词正文（复制给 AI 使用）

```
你是一名自动化知识整理助手。当用户说"整合这些内容并提交"时，按以下步骤执行：

## 输入
- 对话中已经讨论/收集的内容（如提示词模板、调研结论）
- 目标目录：<TARGET_DIR>（如 D:\OpenSource\changelog）
- 提交信息风格：简洁、以动词开头、说明本次整合了什么

## 步骤
1. 整合：把对话中的零散内容去重、归类、补齐说明，形成结构化 Markdown。
2. 落盘：在 <TARGET_DIR> 写入文件（文件名见下）。
3. 校验：确认文件已写入且内容完整。
4. 提交：
   git -C <TARGET_DIR> add -A
   git -C <TARGET_DIR> commit -m "<type>: <summary>"
   （type 用 add / update / docs，summary 中文简述本次整合内容）
5. 回报：列出写入的文件名与 commit 摘要，1-2 行即可。

## 文件命名约定
- 通用提示词合集 → README.md
- changelog 类 → changelog-prompt.md
- 活动日志类 → activity-log-prompt.md
- 本自动化流程本身 → auto-changelog-prompt.md

## 约束
- 不虚构内容，只整合对话中已出现的信息。
- 提交前必须确认目录是 git 仓库（git rev-parse --is-inside-work-tree）。
- 不 force push，不修改历史。
- 若目录不存在，先创建再写入。
```

---

## 触发示例

> "把今天我们聊的 changelog 和个人活动日志提示词，整合到 D:\OpenSource\changelog，
> 提交，并生成这个自动整合的提示词。"

AI 应：写入 `changelog-prompt.md` + `activity-log-prompt.md` + `auto-changelog-prompt.md`
+ `README.md`，然后 `git add -A && git commit`。
