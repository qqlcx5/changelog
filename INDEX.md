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
| PB-20260824-001 | uniapp 接入钉钉 H5 微应用（JSAPI + 免登） | verified | uniapp,dingtalk,jsapi,auth | 2026-08-26 | playbooks/dingtalk-h5-microapp.md |
| PB-20260825-001 | SCM 镜像页前端字段口径对齐清单 | verified | qcm-v2,protable,field-mapping | 2026-08-25 | playbooks/scm-mirror-field-alignment.md |
| PB-20260825-002 | Windows PATH 被 setx 覆盖后的恢复 | verified | windows,setx,registry,vss | 2026-08-25 | playbooks/windows-path-recovery.md |
<!-- END:playbooks -->

## learnings（分轨统计，条目追加在各轨道文件内）

<!-- BEGIN:learnings -->
| track | file | entries | updated |
|---|---|---|---|
| errors | learnings/ERRORS.md | 1 | 2026-08-26 |
| learnings | learnings/LEARNINGS.md | 0 | 2026-08-25 |
| feature-requests | learnings/FEATURE_REQUESTS.md | 0 | 2026-08-25 |
<!-- END:learnings -->
