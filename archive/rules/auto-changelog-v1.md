# Rule: 对话内容自动整合到 changelog 仓库（v1，已归档）

> 归档说明：本规则自 2026-08-21 生效、2026-08-25 被 v2 取代（触发器瘦身 + WORKFLOW.md 契约外置）。
> v2 见 `.agents/rules/auto-changelog.md` 与仓库根 `WORKFLOW.md`。保留本文件作历史参考。

当用户在对话中整理、收集或调研出可复用内容（如提示词模板、调研结论、工作流说明）时，主动执行以下流程，无需等待用户再次确认"要不要保存"：

## 触发条件
- 对话中产出了结构化的提示词 / 模板 / 调研结论。
- 用户明确要求"整合""保存""提交""生成提示词"到本地目录或仓库。

## 执行流程（参考 D:\OpenSource\changelog\auto-changelog-prompt.md）
1. **整合**：去重、归类、补齐说明，形成结构化 Markdown。只整合对话中已出现的信息，不虚构。
2. **落盘**：写入 `D:\OpenSource\changelog\`，文件名按约定：
   - 通用合集 → `README.md`
   - changelog 类 → `changelog-prompt.md`
   - 活动日志类 → `activity-log-prompt.md`
   - 自动化流程本身 → `auto-changelog-prompt.md`
   - 其他主题 → 见名知意的 `<topic>-prompt.md`
3. **校验**：确认文件写入且内容完整。
4. **提交**：
   ```
   git -C D:\OpenSource\changelog add -A
   git -C D:\OpenSource\changelog commit -m "<type>: <中文简述本次整合内容>"
   ```
   type 用 `add` / `update` / `docs`。
5. **回报**：列出写入的文件名与 commit 摘要，1-2 行。

## 约束
- 提交前确认目录是 git 仓库（`git -C <dir> rev-parse --is-inside-work-tree`）。
- 不 force push，不修改历史，自动提交远端。
- 目录不存在时先创建再写入。
- 不处理与版本无关的纯闲聊；仅当内容具备"可复用 / 可沉淀"价值时才触发。

## v1 的已知缺陷（v2 修复项）
- `git add -A` 曾把无关文件（stock_quotes_famous.json）连带提交进仓库；
- 文件平铺无分类、无索引、无元数据，README 目录页手工维护必然过时；
- 触发判断"可复用价值"无 checklist，全靠 agent 自由裁量；
- 规则全量常驻每轮对话上下文（~300 token）。
