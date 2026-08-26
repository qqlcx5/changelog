# Learnings — 纠正 / 知识缺口 / 更好做法

> 追加式分轨日志（id 前缀 `LRN`）。条目格式见 [WORKFLOW.md](../WORKFLOW.md) 第 4.2 节。
> 同一 Pattern 复现 ≥3 次（See Also 链接计数）应提炼为 playbook（WORKFLOW.md 第 6 节）。

---

## [LRN-20260826-001] 配置驱动组件的回落开关应绑定「功能是否启用」而非「配置是否有值」

**Logged**: 2026-08-26T14:29:27 | **Status**: resolved | **Tags**: vue, config-driven, fallback

### Summary
`if (schema?.items?.length)` 式判断把「功能已启用但配置为空」误判成「功能未启用」，空配置被静默回落到代码里写死的默认行为；但空数组往往是接口契约里的合法业务语义，应作为最终态生效，而不是触发回落。

### Details
- 场景：通用表格组件接入运行期页面契约（接口返回 restricted + forms[].queries），契约生效但 queries 为空数组时，组件用 `schemaContract?.queries?.length` 决定是否走契约分支——空数组 falsy → 落回默认 search 注解，表现为「接口明确说没有查询项，页面却显示全部默认筛选字段」，且请求参数形态随之回落（结构化 conditions → 扁平参数）。
- 根因：一个布尔开关承载了两种语义——「契约未生效」与「契约生效但无查询项」是两个状态，`?.length` 把后者折叠进了前者。
- 接口文档已约定「queries 空数组 = 不展示查询区」，是实现违背了契约；排查这类“接口返回空但 UI 不变”问题，先查接口文档的空值语义，再查前端判断条件。

### Suggested Action
回落开关只绑定功能启用标志（`if (schemaContract.value)`），配置载荷另做空值兜底（`(queries || []).map`）；渲染与请求参数两处必须用同一开关，避免半回落状态；下游要有空字段列表的天然 no-op 路径（搜索区 v-if 不渲染、参数构造返回空对象）。

### Resolution
2026-08-26 在 qcmV2 的 ProTable.vue 中将 allFields 与 getQueryParams 的判断从 `schemaContract.value?.queries?.length` 收敛为 `schemaContract.value`：queries 为空时不渲染搜索区、请求不带 conditions；组件 README 生效规则表同步补注。
