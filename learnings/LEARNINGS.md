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
- 接口文档已约定「queries 空数组 = 不展示查询区」，是实现违背了契约；排查这类"接口返回空但 UI 不变"问题，先查接口文档的空值语义，再查前端判断条件。

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


## [LRN-20260903-002] 全局 `.page` 是列表页专用固定高度容器，详情页误用导致内容被裁切

**Logged**: 2026-09-03T19:30:00 | **Status**: resolved | **Tags**: css, layout, element-plus, vue
**See Also**: LRN-20260903-001

### Summary
jp-ui 全局 `.page` class（app.scss）自带固定视口高度 `height: calc(100% - 16px)`（含 `!important` 变体），是列表页专用容器（内部靠 jp-table 自滚）；详情页把它当普通内容容器复用后，内容超长即被固定高度裁切，表现为「页面显示不全」。

### Details
- 场景：5 个详情页（MDP 商品/供应商、SCM 订单、BI 销售、PLM 样品）模板根节点都写了 `class="page p-4"`，内容最长的商品主数据详情（8 组 el-descriptions + 3 个子表 tabs）最先暴露内容被截断；
- 根因：`.page` 的设计契约是「固定视口高度 + 内部表格区滚动」，详情页内容高度远超视口，容器自身又无滚动，溢出即被裁切；
- 滚动归属：布局层 `adminui-main` 是 `overflow: auto`，详情页容器只要高度自适应内容，整页滚动天然可用；
- 隐蔽性：列表页用 `.page` 一切正常，坑只在「内容超高页面」复用该 class 时暴露；全局样式里的 `!important` 高度变体更难排查。

### Suggested Action
区分容器语义后再复用全局 class：固定视口高度容器（列表页 `.page`）只服务内部自滚的列表布局；详情页/长内容页用高度自适应容器，仅保留卡片外观（白底、圆角、margin、padding），滚动交给布局层；新增页面先判断「滚动归属在容器内还是布局层」再选容器 class，并在 scoped 样式里注释容器选型原因。

### Resolution
2026-09-03：5 个详情页容器改为 `.detail-page p-4`（高度自适应 + 列表页同款白底卡片外观），容器样式随后按用户要求收敛至 app.scss 全局定义（各页 scoped 不再重复），页面注释指向全局；定向 eslint 门禁通过。

---

## [LRN-20260904-001] 判断「某包离了 install script 就跑不了」要先看它怎么定位原生二进制，别凭经验断言

**Logged**: 2026-09-04T20:10:00 | **Status**: resolved | **Tags**: pnpm, esbuild, install-scripts, verification
**See Also**: PB-20260904-002, ERR-20260831-003

### Summary
我断言「`pnpm install --ignore-scripts` 会打断 esbuild → vite build 必挂」，实测是错的：esbuild 0.25 的 JS API 不走自己 `bin/esbuild`，而走 optionalDependencies 里的平台包 `@esbuild/<platform>/bin/esbuild`，跳过 postinstall 照样能构建。

### Details
- 触发：给 ding-h5 设计 CI 脚本，凭「esbuild 靠 postinstall 落地二进制」这条老经验判了死刑；
- 实测：`node_modules/esbuild/lib/main.js` 的 `generateBinPath()` 里是 `require.resolve(\`${pkg}/${subpath}\`)`（pkg = `@esbuild/win32-x64`，subpath = `bin/esbuild`，见 main.js:1691），与 esbuild 自身 `bin/` 无关；把本地 `node_modules/esbuild/bin/esbuild` 改名后 `transformSync` 仍成功；
- 老经验的来源：esbuild <0.16 时代没有平台可选包，二进制靠 install.js 现下载，那时 `--ignore-scripts` 确实致命；0.16 之后已改为平台包分发；
- 全仓扫描确认（`node_modules/.pnpm/*/node_modules/*/package.json`）只有 3 个包带 install script：esbuild（CLI shim，非必需）、core-js（funder 提示）、simple-git-hooks（装 git hook，CI 里本就该跳过）——正好等于 `pnpm-workspace.yaml` 的 `allowBuilds` 白名单，所以 `--ignore-scripts` 在这类工程里是安全的。

### Suggested Action
判定「必须跑 install script」时按三步走，不要直接下结论：① 读目标包的解析代码（找 `require.resolve` / `binPath`）；② 做一次可逆的破坏性验证（把产物改名再跑 API）；③ 必要时全仓扫一遍哪些包真有 install script，再看白名单是否覆盖。结论落到文档前必须有其一。

### Resolution
2026-09-04：已实测推翻原判断，并把 PB-20260904-002 第 3 节从「`--ignore-scripts` 会打断 esbuild」改写为「用 allowBuilds 白名单替代全局禁脚本 / 何时可保留 `--ignore-scripts`」。

---

## [LRN-20260904-002] 对抗式审查必须含「声明层」核对：任务清单勾了 `[x]` ≠ 功能已实现，后端接口就绪会制造已完成假象

**Logged**: 2026-09-04T21:30:00 | **Status**: resolved | **Tags**: adversarial-review, task-checklist, verification, openspec

### Summary
PRD→代码一致性审查中，最隐蔽的缺口不是「规格没写」也不是「代码没写」，而是**任务清单标记完成但功能没实现**：后端把接口做好了（能力就绪），前端没接线（消费端缺失），tasks.md 还打了勾——三层里任何单层核查都可能误判，必须交叉。

### Details
- 场景：补配业务族 PRD 对抗式审查（diff 基准 07e62c3 → HEAD，124 文件 +9130/-2752）。PRD 6 处明确要求「返修工具按分销商省份自动带出工厂」，spec L48 有 SHALL，tasks.md 4.3 标 `[x]`，后端 `factoryOptions(provinceCode)` 省份过滤已实现——但前端 `onAccessoryTypeChange()` 无联动、`loadFactoryOptions()` 固定传空参，且 roleContext 无省份数据源（想接也没数）。
- 三层假象链：只看任务清单→「做完了」；只看后端→「接口就绪随时能用」；只有从前端消费端反向验证（谁调了这个接口？参数从哪来？）才暴露缺口。
- 定级依据：因为 tasks 标记与实现不符，这不是普通漏做，而是违反「规格/代码/测试/验证记录一致」准绳的声明失真，直接定 P1。
- 归属分责手法：对每个问题文件跑 `git log <base>..HEAD -- <file>`，一次即可把全部问题精确归到具体 commit（本次全部指向 4ebd42f02 feat-011，而 feat-010 全清白）——比逐 commit diff 快且证据确凿。

### Suggested Action
对抗式审查的固定流程里加一层「声明层核对」：① 逐条扫任务清单的 `[x]` 项，每项在前端消费端找调用证据（事件处理器/取数代码），找不到即降级为「声明与实现不符」；② 后端接口存在≠功能完成，以「谁调用它、参数从哪来」为判据；③ 发现此类缺口定级上浮一档（声明失真比单纯漏做危害大，会误导后续排期与交接）；④ 报告阶段用 `git log <base>..HEAD -- <file>` 把每个差距归属到 commit，让「哪一批交付有问题」一目了然。

### Resolution
2026-09-04：QCM V2 补配审查按此法产出最终报告（P1×1/P2×2/P3×1/P4×4，其余 95% 一致），报告存档于项目 `文档/对抗式审查-补配业务族PRD实现一致性核对-20260904.md`，P1 修复待用户确认省份数据源后执行。
