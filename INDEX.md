# INDEX — 总索引

> 知识库唯一入口。写入 / 更新条目后必须同步本文件对应表格；
> `tools/sync-index.ps1` 校验一致性，`tools/sync-index.ps1 -Sync` 以 frontmatter 为源再生成表格。
> 检索顺序：tags / title 定位 → 读对应文件。完整流程契约见 [WORKFLOW.md](WORKFLOW.md)。

## prompts（可复制使用的提示词）

<!-- BEGIN:prompts -->
| id | title | status | tags | updated | path |
|---|---|---|---|---|---|
| PR-20260821-001 | Changelog 生成提示词集 | draft | changelog,git,release-notes | 2026-08-21 | prompts/changelog.md |
| PR-20260821-002 | 个人活动日志提示词集 | draft | activity-log,journal,retro | 2026-08-21 | prompts/activity-log.md |
| PR-20260821-003 | 自动整合提示词（v1 元提示词，已被 WORKFLOW.md 取代） | verified | meta,automation,history | 2026-08-21 | prompts/auto-changelog.md |
<!-- END:prompts -->

## playbooks（实战手册）

<!-- BEGIN:playbooks -->
| id | title | status | tags | updated | path |
|---|---|---|---|---|---|
| PB-20260824-001 | uniapp 接入钉钉 H5 微应用（JSAPI + 免登） | verified | uniapp,dingtalk,jsapi,auth | 2026-09-02 | playbooks/dingtalk-h5-microapp.md |
| PB-20260825-001 | QCM V2 镜像页字段口径对齐清单（SCM & MDP） | verified | qcm-v2,protable,field-mapping,jackson | 2026-09-01 | playbooks/scm-mirror-field-alignment.md |
| PB-20260825-002 | Windows PATH 被 setx 覆盖后的恢复 | verified | windows,setx,registry,vss | 2026-08-25 | playbooks/windows-path-recovery.md |
| PB-20260827-001 | DeepSeek Harness 设计哲学 · 思维框架 | draft | deepseek-harness,architecture,design-philosophy,cordis | 2026-08-27 | playbooks/harness-design-philosophy.md |
| PB-20260827-002 | 通用架构哲学 · 思维框架（可移植版） | draft | architecture,design-philosophy,capability-seam,dependency-inversion | 2026-08-27 | playbooks/generic-architecture-philosophy.md |
| PB-20260827-003 | 权威↔投影一致性机械校验——给「文档必须等于代码」装上门禁 | verified | architecture,ssot,baseline,guard | 2026-08-27 | playbooks/authority-projection-consistency-check.md |
| PB-20260828-001 | Vite + Vue3 + Element Plus 项目的 UnoCSS 生产级配置 | verified | vite,vue3,unocss,element-plus,sass | 2026-08-31 | playbooks/vite-vue-unocss-elementplus.md |
| PB-20260831-001 | 开源仓库可发现性优化清单（README 双语 + 元数据 + topics） | verified | github,readme,discoverability,docs | 2026-08-31 | playbooks/github-repo-discoverability.md |
| PB-20260831-002 | Tauri 2 模板配置加固与排障（CSP / 路由 / 改名 / 打包元数据） | verified | tauri,csp,config,security | 2026-08-31 | playbooks/tauri2-config-hardening.md |
| PB-20260831-003 | Element Plus 按需引入（Vite + pnpm）——官方方案落地与实测验证 | verified | element-plus,on-demand,vite,pnpm | 2026-08-31 | playbooks/element-plus-on-demand.md |
| PB-20260901-001 | VS Code settings.json 审查与优化清单（冲突检测 + 死配置清理 + 新设置项补齐） | verified | vscode,settings,dx,audit | 2026-09-01 | playbooks/vscode-settings-audit.md |
| PB-20260901-002 | 架构质量门的存量冻结模式——用冻结快照替代基线棘轮，豁免历史包袱但拦截新增 | verified | quality-gate,legacy-freeze,static-analysis,entropy | 2026-09-01 | playbooks/legacy-freeze-gate.md |
| PB-20260902-001 | 钉钉多端 H5 视口适配（vw + 最大宽度限制） | draft | dingtalk,viewport,vw,postcss,mobile | 2026-09-02 | playbooks/dingtalk-multi-platform-viewport.md |
| PB-20260902-002 | 钉钉多端 H5 表格组件选型（Vant 无 Table 的替代路径） | draft | dingtalk,table,vue3,mobile | 2026-09-02 | playbooks/dingtalk-h5-table-component.md |
| PB-20260902-003 | Vite + Vue3 + Vant 接入钉钉 H5 微应用（hybrid 模型：签名 v1.0 + 免登 topapi/v2 + mock 层服务端签名） | verified | dingtalk,vite,vue3,jsapi,mock | 2026-09-02 | playbooks/dingtalk-h5-vite-vue3-vant.md |
| PB-20260903-001 | 免费大模型 API 平台选型清单（2026-09） | draft | free-api,llm,platform-selection,quota | 2026-09-03 | playbooks/free-llm-api-platforms.md |
<!-- END:playbooks -->

## learnings（分轨统计，条目追加在各轨道文件内）

<!-- BEGIN:learnings -->
| track | file | entries | updated |
|---|---|---|---|
| errors | learnings/ERRORS.md | 17 | 2026-09-03 |
| feature-requests | learnings/FEATURE_REQUESTS.md | 0 | 2026-08-25 |
| learnings | learnings/LEARNINGS.md | 3 | 2026-08-31 |
<!-- END:learnings -->
