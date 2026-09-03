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

---

## [LRN-20260826-002] Jackson 序列化 key 与 Spring MVC 绑定 key 对连续大写开头字段不一致

**Logged**: 2026-08-26T17:24:12 | **Status**: pending | **Tags**: jackson, spring, java-beans, binding
**See Also**: PB-20260825-001

### Summary
Java 字段第二字符大写（如 `jAmsea`）且无 `@JsonProperty` 时，Jackson 序列化的响应 key（`jamsea`）与 Spring MVC GET 参数绑定期望的 key（`JAmsea`）是两个值，前端按响应 key 提交查询会静默绑定失败。

### Details
- Jackson 对 getter `getJAmsea()` 按连续大写开头整体小写化 mangle → 响应 key `jamsea`；
- Spring MVC 数据绑定走 JavaBeans `Introspector.decapitalize`：前两字符均大写时保留原名 → 绑定 key `JAmsea`；
- 两层规则差异在字段无显式 `@JsonProperty` 覆盖时暴露；
- 症状隐蔽：不报错不 500，仅查询条件不生效（QueryWrapperGenerator 反射取到 null 后跳过该条件）；
- 排查手段：对照实体 getter 推导两层 key；`git log` 确认历史上字段改名是否前后端同步。

### Suggested Action
前端双 key 分离：提交 key 用 JavaBeans 属性名（`JAmsea`），显示 key 用序列化 key（`row.jamsea`）；或后端加 `@JsonProperty` 显式统一两层口径（需评估历史报文兼容）。

---

## [LRN-20260831-001] 官方 TIP 的"必须配置"要先用探针实测，再决定采纳

**Logged**: 2026-08-31T17:00:00 | **Status**: resolved | **Tags**: docs, verification, pnpm, dayjs

### Summary
Element Plus 文档要求 pnpm 用户为 `dayjs` 配置依赖提升（`shamefullyHoist` + `nodeLinker: hoisted`），
否则按需引入会出问题。实测（Vite 6 + pnpm 12）该问题**根本不存在**，
盲目照做反而会拍平 `node_modules`、丢掉 pnpm 的隔离优势。

### Details
- 场景：按官方 Quick Start 给模板接 Element Plus 按需引入，读到关于 dayjs 的 TIP；
- 该 TIP 措辞很硬（"you need to configure pnpm to hoist dependencies"），
  照做要改 `pnpm-workspace.yaml`，属于影响整个依赖布局的**重型变更**；
- 实测结果：`dayjs` 不在 package.json、不在顶层 node_modules（只在 `.pnpm/dayjs@1.11.23`），
  但被 Vite 内联进 `node_modules/.vite/deps/element-plus_es.js`（212 处命中）；
  预构建产物 `require(` 计数 0，生产产物 `module.exports` 计数 0，`ElDatePicker` 样式请求正常；
- 结论：Vite 6 的 optimizeDeps 已能处理这个 CJS 传递依赖，TIP 是历史遗留建议；
- 反向代价：若真加 `shamefullyHoist: true` + `nodeLinker: hoisted`，
  `.pnpm` 隔离目录不再使用，此前"靠 `.pnpm/<pkg>@<ver>/node_modules/` 判断依赖是否齐全"
  的排查手法会全部失效（见 ERR-20260831-005）。

### Suggested Action
1. 读到文档里"必须/需要配置 X"的硬性要求，先评估 X 的**破坏半径**：
   全局依赖布局、构建流程、类型系统这类重型变更，一律先实测再采纳；
2. 设计最小探针直接验证问题是否存在（本次：搜产物里的 `dayjs` / `require(` / `module.exports`，
   并 dev 下直接请求 `date-picker` 的样式模块）；
3. 文档给的替代方案里，优先选**局部、可逆**的那个
   （本次是 `pnpm add dayjs`，而非全局 hoist）；
4. 把"实测结论 + 适用版本"写进项目注释，避免后来者重复踩或重复排查。

### Resolution
2026-08-31：未采纳 hoist 建议，也未加 dayjs 依赖（实测无必要）；
改为在 `README.md` / `README.zh-CN.md` 的按需加载章节记录实测数据与判断依据，
并指明"若其他工具链真遇到问题，用 `pnpm add dayjs` 而非 `shamefullyHoist`"。

See Also: PB-20260831-003, ERR-20260831-005

## [LRN-20260903-001] 组件能配置的效果不用 CSS hack：先查安装版 API 再写 :deep 覆盖

**Logged**: 2026-09-03T18:30:00 | **Status**: resolved | **Tags**: element-plus, css, vue
**See Also**: PB-20260831-003

### Summary
Element Plus `el-descriptions` 标签列定宽需求，直接用 `:deep()` CSS 覆盖 label `td`，而安装版（2.14.3）已原生提供 `label-width` prop——border 模式下内部实现就是给 label `td` 写内联 `width`，两者完全等价；CSS 只应兜底组件未暴露的能力（如 `table-layout: fixed` 布局算法）。

### Details
- 场景：详情页 8 组 `el-descriptions` 需要「标签 200px + 内容列均分、组间纵向网格线对齐」；
- 原实现用 `:deep(.el-descriptions__table) td.el-descriptions__label { width: 200px }`；
- 核对安装版类型定义（description.d.ts / description-item.d.ts）：容器级 `labelWidth`（"width of every label column"）与 item 级 `labelWidth`（优先级更高）均已存在；
- 源码核对（descriptions-cell.mjs）：border 模式 `style.width = addUnit(labelWidth)` 直接落在 label `td` 上——与手写 CSS 等价，改配置零行为差异；
- `width: 100%` 也是冗余的：theme-chalk 默认样式 `.el-descriptions__table { width: 100% }` 已含；
- 组件确实未暴露的能力才保留 CSS：`table-layout: fixed`（列宽由首行决定——标签列吃 `label-width` 配置、内容列均分剩余宽度，多个独立 descriptions 表格用同一算法才能组间对齐；auto 布局各表格按内容独立算列宽，组间对不齐）与 `overflow-wrap: break-word`（fixed 格子内长文本断行兜底）。

### Suggested Action
写 `:deep()` 覆盖前先翻**安装版本**的类型定义/源码确认有无对应 prop（配置可维护、被 TS 校验、随组件升级；CSS 覆盖绕过组件抽象，随版本漂移易碎）；覆盖只留组件 API 表达不了的部分，并注释说明「为什么必须用 CSS」。

### Resolution
2026-09-03：商品主数据详情页改为 `:label-width="200"` 配置，CSS 收敛为 `table-layout: fixed` + `overflow-wrap: break-word` 两项并注明配置边界；lint 门禁通过。

---
