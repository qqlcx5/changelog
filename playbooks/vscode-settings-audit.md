---
id: PB-20260901-001
type: playbook
title: VS Code settings.json 审查与优化清单（冲突检测 + 死配置清理 + 新设置项补齐）
tags: [vscode, settings, dx, audit]
status: verified
source: conversation:2026-09-01
created: 2026-09-01
updated: 2026-09-01
---

# VS Code settings.json 审查与优化清单

> 用途：给一份几百行的 `settings.json`（通常是 antfu / 网络模板的复制品）做体检，
> 找出**互相打架的配置**、**对当前 OS 无效的死配置**、**被注释掉的收益项**，
> 并按段落补齐新版 VS Code 的设置项。
> 约束：只改值 / 在段落内插入，不重排已有条目（避免 diff 爆炸、便于回滚）。

## 1. 先查配置冲突（唯一会"静默失效"的一类，优先级最高）

排查口诀：**凡是 `xxx.enable: false` 的开关，都要全局搜它对应的引用点。**

| 开关 | 冲突表现 | 修法 |
|---|---|---|
| `prettier.enable: false` | 插件整体停用，所有 `editor.defaultFormatter: esbenp.prettier-vscode` 变死配置（官方要求改后重启 VS Code） | 二选一：删掉该行；或把所有 `[lang].editor.defaultFormatter` 换成 ESLint / 内置 formatter |
| `eslint.format.enable: false` | 若某语言 `defaultFormatter` 指向 ESLint，该语言格式化失效 | 同上，保持两者指向一致 |
| `editor.formatOnSave: false` + 各语言 `codeActionsOnSave` | 不冲突，但要确认 `source.fixAll.*` 的值是 `"always"` / `"explicit"` / `"never"` 而不是 `true` / `false` | 布尔值已被废弃语义，统一改三态字符串 |
| `files.eol` vs 项目 lint / prettier `endOfLine` | 与团队规范不一致时，整个仓库 diff 全红 | 以项目配置为准，不要照抄模板 |

验证方法：打开一个该语言文件 → `F1` → `Format Document` → 看状态栏右下角是否弹出"没有安装格式化程序"。
**没有格式化程序 = 冲突已发生，不要靠"我配了 formatter"来判断。**

## 2. 清死配置（对当前 OS / 环境不生效，纯噪音）

- macOS only：`window.nativeTabs`、`terminal.integrated.*` 的部分 mac 专属项。
- Linux only：`terminal.external.linuxExec`（已被 `terminal.integrated.profiles.*` 取代）。
- 主题类：`workbench.preferredLightColorTheme` 若填了深色主题，浅色模式等于不可用。
- 已被取代的旧键：优先看 `F1` → `Preferences: Open Settings (UI)` 里是否标注 Deprecated。
- 注释错位的行（注释描述的是另一项，复制模板时串行导致）：不修功能，但会误导后续维护，顺手改注释。

## 3. 安全红线（模板里最常见的三类）

1. **明文密钥**：翻译插件 / 图床插件的 `secret` / `accessKey` 常以明文写死。
   处理：轮换密钥 → 改用环境变量或插件自带的密钥存储 → 从文件中删除。
   （这类内容禁止进入任何共享知识库。）
2. `security.workspace.trust.untrustedFiles: "open"` → 改 `"prompt"`。
3. `update.mode: "none"` + `update.enableWindowsBackgroundUpdates: false` → 永不打补丁。
   至少改 `"manual"`，保留手动确认但不再永久落后。

## 4. 性能项（大仓 / 单仓 500+ 文件的直接收益）

```jsonc
// 建议新增，插在现有 files / search 段落内
"typescript.tsserver.maxTsServerMemory": 4096,   // 默认 3072，大仓加到 4096~8192
"search.followSymlinks": false,
"files.watcherExclude": {
  "**/node_modules/**": true,   // 已覆盖 pnpm 的 .pnpm 子目录
  "**/dist/**": true,
  "**/.git/objects/**": true
}
```

反向检查：`search.exclude` 里从模板抄来的 `**/assets` / `**/public` / `**/*.svg`
**在很多项目里是源码目录**，会把真实源码从全局搜索里藏掉，按项目实际删掉。

## 5. 被注释掉的"纯收益项"（模板里默认关，逐个确认后打开）

- `typescript.updateImportsOnFileMove.enabled: "always"`（同 `javascript.*`）—— 移动文件自动改引用路径。
- `typescript.preferences.preferTypeOnlyAutoImports: true` —— 自动导入类型时用 `import type`。
- `files.autoSave: "afterDelay"` —— 配合 AI agent 编辑，减少"改了没存"的落差。
- `editor.foldingStrategy: "auto"` —— 模板常写 `"indentation"`，对 TS / Vue 应改回 `auto`（语言感知）。

## 6. 新版设置项从哪里查（不要凭记忆）

唯一权威来源：`https://code.visualstudio.com/updates/v1_XXX` 的 **Deprecated features and settings** 与各章节的 `Setting: xxx` 标注。

截至 2026-09（1.130 ~ 1.134）仍值得主动打开的新项：

| 设置 | 版本 | 作用 |
|---|---|---|
| `chat.agentHost.enabled` | 1.130+ | agent 跑在独立进程，同一会话可从多窗口连接 |
| `chat.assistedPermissions.enabled` | 1.130 | 模型评估工具调用风险，减少反复点确认 |
| `chat.tools.autoApprove` | 1.130 | 低风险工具自动放行 |
| `sessions.chatTimeline.display` | 1.134 | 会话右侧出现 prompt 时间轴，跳转历史提问 |
| `sessions.layout.singlePaneDetailPanel` | 1.134 | 单栏布局，会话详情与编辑器共用标签栏 |
| `dictation.enabled` | 1.131 | 内置离线语音输入（需下载模型，音频不出本机） |
| `terminal.integrated.resizeDimensionsOverlay.enabled` | 1.131 | 关掉调整终端大小时的行列数浮层 |
| `workbench.editorAssociations` | 1.134 | 把 HTML 默认用内置浏览器打开 |

编辑器侧常配的 AI 项：`editor.inlineSuggest.edits.enabled`（Next Edit Suggestions）、
`editor.inlineSuggest.edits.allowCodeShifting`、`editor.inlineSuggest.showToolbar: "always"`。

## 7. 全局用户设置 vs 工作区设置

**不要**把用户 `settings.json` 整份复制进项目的 `.vscode/settings.json`：

- 工作区设置覆盖用户设置，两份会长期漂移；
- 项目文件该进 git，个人偏好（字体、主题、密钥、终端）不该进；
- 正确分工：项目侧只放 `defaultFormatter` / `codeActionsOnSave` / `search.exclude` / `tsdk` 这类**团队共识**，
  其余留在用户设置。

判定：`diff` 两份文件，重复率 > 80% 就是复制粘贴，把非项目相关的段落删掉。

## 8. 执行顺序（15~25 分钟）

1. 全局搜 `enable": false`，逐条确认其引用点没被打死（第 1 节）；
2. 打开一个代表性文件跑一次 `Format Document` 验证；
3. 搜 `secret` / `key` / `token` / `password`，处理明文凭证；
4. 删死配置、改注释错位；
5. 按第 4/5/6 节在**原段落内**插入新项，不重排；
6. `F1` → `Developer: Reload Window`，逐项确认生效。
