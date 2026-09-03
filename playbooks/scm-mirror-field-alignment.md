---
id: PB-20260825-001
type: playbook
title: QCM V2 镜像页字段口径对齐清单（SCM & MDP）
tags: [qcm-v2, protable, field-mapping, jackson]
status: verified
source: conversation:2026-08-25
created: 2026-08-25
updated: 2026-09-03
---

# QCM V2 镜像页字段口径对齐清单（SCM & MDP / jp-ui + 后端契约）

> 适用：外部系统（SCM/XLS/MDP 等）推送数据落库后，在 jp-ui 做只读镜像展示页（ProTable 列表）。
> 本文为可直接复用的落地核对清单，来源于 SCM采购入退库（scmPurchaseStock）两轮对齐实战（兄弟页面 scmPurchaseOrder 同口径），MDP 商品主数据（productMasterData）实战补充 1.1 变体。

## 1. 三条字段名口径（SCM 实体固定模式）

后端实体（如 `ScmPurchaseStock`）业务字段全部带 `@JsonProperty` 报文全大写注解（`billId→BILLID`、`whQty→WHQTY`），由此产生前端三条铁律：

| 口径 | 规则 | 前端写法 |
|------|------|---------|
| 查询绑定参数 | Spring MVC 绑定用驼峰（`@Query` 字段） | 有搜索的列 `field` 取驼峰，保证搜索提交 key 能被绑定 |
| 响应 JSON key | `@JsonProperty` 指定报文全大写 | 有搜索的列必须加 `formatter: ({ row }) => row.BILLID ?? ""` 从全大写 key 取值；无搜索的列 `field` 直接用全大写 key |
| 非报文字段 | 无 `@JsonProperty`（派生字段、BaseEntity 审计字段 createUserName/createTime 等） | 响应 key 即驼峰，`field` 直接用驼峰，无需 formatter |

### 1.1 MDP 变体：无 @JsonProperty 驼峰实体 + 连续大写开头字段（jAmsea 模式）

MDP 镜像实体（如 `Product`）业务字段**无** `@JsonProperty`，响应 key 与驼峰字段同名，`field` 直接用驼峰即可；唯一例外是**第二字符大写**的字段（如季节 `jAmsea`），绑定 key 与响应 key 分裂成两套：

| 层 | 推导规则 | jAmsea 的 key |
|----|---------|--------------|
| 响应 JSON（Jackson 序列化） | getter `getJAmsea()` 连续大写开头整体小写化 | `jamsea` |
| GET 查询绑定（Spring MVC） | JavaBeans `Introspector.decapitalize`：前两字符均大写保留原样 | `JAmsea` |

前端双 key 分离写法：列 `field: "JAmsea"`（搜索提交 key 能被绑定）+ `formatter: ({ row }) => row.jamsea ?? ""`（从响应 key 取显示值）。注意：QueryWrapperGenerator 已改为按 Field 反射取值，此类字段查询不再抛 500，失败症状是**静默不生效**，更难发现；若前端历史上改过字段名 key，先 `git log` 确认后端是否同步改过。

**mangle 判定细则与 jAmseaD 变体（2026-09-03 增补）**：双 key 分裂不止 jAmsea 一例，判定看 getter 大写形态——「连续大写开头」触发 mangle 整体小写化（getJAmsea→jamsea）；**词尾单大写不触发**（getZsyearD→zsyearD，fallback 按 /[A-Z]/g 自动得 zsyear_d）；实体字段本身全小写则响应 key 与物理列天然一致（subseries 无需处理）。jAmseaD 变体：getJAmseaD() mangle 后为 jamseaD（首段小写化、词尾 D 保留），它到物理列 j_amsea_d 的距离 fallback 补不上——契约模式下 field 全用 snake_case 物理列名时，行数据归一化需显式 `ROW_KEY_ALIAS: { jamsea: "j_amsea", jamseaD: "j_amsea_d" }`，回退查询参数绑定名仍是 JAmsea（Introspector 规则）另用 FALLBACK_PARAM_ALIAS 覆盖。

## 2. 列集合对齐原则：列 = 聚合 SQL 实际返回列

列表接口若是**聚合统计**（自定义 Mapper XML 如 `selectAggregateList` 按 GROUP BY 维度分组），前端列集合必须等于聚合 SQL 的 SELECT 列，**不是实体全字段**：

- 聚合维度字段保留（如按「入退库单号 bill_id」分组，则维度字段保留、明细行级字段全部删除——明细行号/尺码/商品编码等）；
- 数量类取 `SUM`，价格类可 `GROUP_CONCAT(DISTINCT ...)` 去重（多值逗号分隔展示），其余 `MAX` 取组内任一值；
- 聚合 SQL 不返回而实体存在的字段，配了列也恒空白，一律不配。

## 3. 搜索字段对齐原则：筛选项 = 实体 `@Query` 注解字段一一对应

- 实体上有 `@Query` 的字段才可配 `search: { component: "input" }`（默认模糊匹配）；
- 无 `@Query` 的字段（如 itemName、itemId）配了搜索也**恒不生效**（QueryWrapperGenerator 跳过），要么删搜索、要么先给后端补 `@Query`；
- 派生展示字段（如 `itemNameHandled` 去尺码段商品名称）通常非报文字段、无 `@Query`，只展示不筛选。

## 4. 商品名称派生字段模式

落库时由原始商品名称截掉逗号及右侧尺码段生成派生列（`item_name_handled`，如「跑鞋,34-42」→「跑鞋」），列表展示用派生值而非原始值：展示「单商品名称，不拼接尺码段」时取 `itemNameHandled`（响应 key 驼峰）。

## 5. 新建镜像页核对清单

1. 读后端实体：标出 `@Query` 字段（搜索白名单）与 `@JsonProperty`（响应 key 口径）；无 `@JsonProperty` 时按 1.1 节检查连续大写开头字段的双 key 分裂；
2. 读 Mapper XML 聚合 SQL：列集合以 SELECT 实际返回列为准，注意 SUM / GROUP_CONCAT / MAX 口径并在列注释标明；
3. ProTable 列定义按第 1 节三口径写 field / formatter；
4. 菜单挂「主数据管理」一级菜单（menu_code='masterData'），前端路径 `views/md/scmXxx/`、API `api/md/scmXxxService.js`、菜单 href `/md/scmXxx`（不存在「采购管理」一级菜单）；
5. 列标题以用户提供的字段规格表为最终命名依据（如「类型」不写「类型编码」）。

## 6. 常见坑

1. 有搜索的列直接用全大写 field 或不加 formatter → 搜索失效或业务列全空白（绑定 key 与响应 key 是两套口径）。
2. 按实体全字段配列而接口是聚合 SQL → 聚合不返回的列恒空白。
3. 无 `@Query` 的字段配搜索 → 输入无任何过滤效果。
4. 派生字段误当报文字段用全大写 key 取值 → 空白（非报文字段响应 key 是驼峰）。
5. 连续大写开头字段（如 `jAmsea`）前端统一用序列化 key（`jamsea`）作 field → 显示正常但搜索提交 key 绑定不上，筛选静默失效（须按 1.1 节双 key 分离）。

## 7. 契约层：建模列 / 查询白名单 / 物理列三方一致性核对

> 适用：页面走 pageSchema 契约（`sys_model_table` + `sys_model_table_column` +
> `sys_model_table_column_query` + `sys_menu_form_column.visible_columns`）。
> 来源：SCM备案明细（scmSupplierDetail）对抗式审查实战，详见 ERR-20260831-007。

**物理列是权威**，四份清单必须两两对齐：

| 清单 | 位置 | 缺失后果 |
|------|------|---------|
| 物理列（权威） | `CREATE TABLE` / 实体 / Mapper XML | — |
| 建模列元数据 | `sys_model_table_column` | 页面拿不到契约，退回前端列 `search` 回退模式 |
| 查询白名单 | `sys_model_table_column_query` | 该字段不可筛选 |
| 展示列 | `sys_menu_form_column.visible_columns` | 该列不渲染 |

核对动作（差集必须为空）：

1. **契约列集合 − 物理列集合 = ∅**：非空即 500 隐患。`PageSchemaConditionValidator` 只校验
   白名单与 compareType，**不校验 columnCode 是否对应真实物理列**；`QueryWrapperGenerator.applyQueryConditions`
   也是纯拼装（`queryWrapper.like(column, value)`）。缺陷会逃过编译期、启动期与"不筛选直接打开页面"的自测——
   不筛选时只表现为该列空白，只有输入筛选值才抛 MySQL 1054 Unknown column。
2. **物理列集合 − 契约列集合**：剩下的要显式确认是"有意预留"还是"落库但不展示的死列"，不留中间态。
3. 前端 `columns[].field` 与 `visible_columns` 逐项一致，顺序也随契约。

**手写 Mapper XML 是第三处易漏点**：`insertOrUpdateBatch` 的 INSERT 列、VALUES、`ON DUPLICATE KEY UPDATE`
三处都要同步，漏一处则物理列存在但永不落值（MyBatis-Plus 的自动填充救不了手写 XML）。

**回退模式陷阱**：契约未加载时（典型如 `sys_menu_form_column.tenant_id` 与环境租户不匹配被判定"未绑定"），
页面退回前端列 `search` + 实体 `@Query` 绑定，此时**只有带 `@Query` 的字段能筛**。契约里配了筛选、
实体却没 `@Query` 的字段静默失效——不报错、查不出差异，比 500 更难发现。新增契约筛选项时顺手确认实体有 `@Query`。

## 8. 契约白名单静默收敛：页面有列 ≠ 契约有列（2026-09-01 增补）

> 来源：九页 tsv 对抗式审查实战（商品主数据 zsyear / 备案供应商股东 / 样品信息 12 列）。

第 7 节四份清单之外还有第五份：**前端 columns 数组**。契约生效时 `applySchemaColumns` 按 `visible_columns` 白名单收敛列集合——页面写了列但契约（列元数据 + visible_columns）没登记，该列**静默消失**（不报错、不告警），契约恰好未加载时自测会直接漏掉。核对动作：`页面 columns field 集合 − visible_columns = ∅` 且顺序一致；契约新增列时同步三处：`sys_model_table_column`（sort 连续重排）、`visible_columns`（顺序 = 页面列顺序）、前端 columns。

**双向核查**：权威口径表标记「删除」的字段，页面仍展示即违规——缺列要补，多列要删；物理列与契约列元数据可保留（历史数据不丢），仅从 visible_columns 与前端 columns 移除。

**码值列的「文本」筛选口径**：枚举来自物理表注释或源系统时，新建系统字典（`sys_dict_type`/`sys_dict_value`，value=源码值），展示走字典翻译、筛选走码值 IN（契约 compare_type=IN + ref_code 指向字典），与既有字典列口径对齐；实体侧补 `@Query(type = QueryType.IN)` 保回退模式可用。注意：`ref_code` 指向字典的方式**仅适用于系统字典**，MDP 字典（`bd_mdp_dict`）走不通，见第 9 节。

**程序化比对法（2026-09-03 增补）**：列规模上去后（86 列）肉眼核对 field 序列必漏——重排三列后忘插回新位置、前半替换后残留旧列块，两处均肉眼 diff 未见、靠脚本序列比对才暴露。核对动作固化：前端按行序提取 `field: "` 出现序列，契约 visible_columns 提取 JSON 数组同序序列，`Compare-Object` 断言逐位相等（数量相同 + 顺序一致）；重排/扩列类修改完成后必跑，肉眼 diff 只作初审。

## 9. 契约查询区的字典下拉退化与恢复：compare_type=IN + 前端 options 继承（2026-09-03 增补）

> 来源：商品主数据（productMasterData）实战——契约生效后搜索区 MDP 字典多选下拉全部退化为 LIKE 文本输入框，用户须手输编码。

**坑（两因素叠加，列表 formatter 翻译不受影响，只有搜索区退化）**：

1. pageSchema 契约生效后查询区完全由 `sys_model_table_column_query` 驱动，页面列上的 `search` 配置只在契约未生效时回退；
2. 契约 DICT 选项链路（前端 `resolveRefOptions` → `dictUtils.getDictList`）只认**系统字典** `sys_dict_value`，认不了 MDP 字典 `bd_mdp_dict`。若码值列查询项配 LIKE 文本（当时因选项链路走不通而妥协），契约一生效字典下拉就消失。

**修复模式（契约管可查性/位置/比较符，页面列定义仍是选项数据源——单一事实源）**：

1. SQL：码值列查询项 `compare_type` 配 **`IN`**（多值精确匹配，勿用 LIKE），`data_type` 保持 `TEXT`（DICT 链路走不通，不要硬配）；
2. 前端：`queryToField`（`ProTable/utils.ts`）对 `compareType=IN` 的字段自动继承本地列 `search.options` 作为控件与选项来源（select + `mdpDictUtils.getMdpDictList(...)`）；本地未配 `options` 的字段（货号等自由文本 LIKE）不受影响；
3. 后端零改动：`PageSchemaConditionValidator` 按 `compare_type` 白名单严格校验（不匹配抛「不支持的查询条件」），`QueryWrapperGenerator.applyQueryConditions` 原生支持 IN 多值（`QueryCondition.value` 是 `List<String>`，GET 经 qs indices 序列化）。

**注意**：`ModelMetaQueryService` 查询配置有 **5 分钟本地缓存**，改库后需等缓存过期或重启后端才能在 pageSchema 下发中生效。

**诊断提醒**：用户报「字典回显有问题」先澄清具体现象（列表码值显原编码 vs 搜索区下拉变文本框 vs 下拉空选项 vs 切语言丢失）——列表翻译与搜索区选项是两条独立链路，混着排查浪费时间。

**例外分支：Y/N 通用枚举复用现成系统字典 commonYN，前端直接写（2026-09-03 二次增补，同日用户两轮纠错终审定版）**

> 来源：同页「下单状态 isorder」值域 Y/N——用户先明确「取通用字典直接写就行了」，又纠错「yes_no 匹配不上」，最后找到现成字典「commonYN_Y」。

1. **先搜现成字典，再谈新建（两轮返工的核心教训）**：配通用枚举前先 grep 前端 `getDictList\("` 找同值域现成类型——项目里 Y/N 值域的现成字典是 **`commonYN`**（i18nKey 形如 `commonYN_Y/N`，供应商主数据详情页 isIntegratedFactory/isImport/isOdm 等 Y/N 字段在用），isorder 直接复用；**不要只查 db DML 与基础库 dump**——运行库的增量字典不在脚本里（commonYN 在 jeeplus-boot-saas-v3.sql 与 db/ 下都搜不到），自建 `md_yes_no` 后发现 commonYN 已删；
2. **通用字典值域必须核验**：全局 `yes_no` 的 value 是 **1/0**（`sys_dict_value` id=5 是→1、id=6 否→0），**不是 Y/N**——用它配 Y/N 字段，formatter 匹配不上回退显原码，下拉选中提交 `'1'` 去 IN 查 `'Y'` **静默空结果**（比报错更难发现）；
3. **SQL 只改查询配置**：`compare_type='IN'`；列元数据保持 `TEXT`/`ref_code=NULL`——本地 `search.options` 本就必配（回退兜底），契约生效时 IN 继承覆盖契约 options，配 DICT+ref_code 等于白配；
4. **前端直接写**：formatter `dictUtils.getDictLabel("commonYN", value, value)`（第三参回退原值）、options `dictUtils.getDictList("commonYN")`——纯读登录缓存，无需预加载；与 MDP 字典码值列同一条「TEXT + IN + 本地 options 继承」链路，仅选项源不同。
5. **详情页同步适用（2026-09-03 三次增补）**：详情页（detail.vue）码值字段默认原值直出，同页「下单状态」显 Y/N 原码同样被用户要求翻译。通用机制：字段配置加可选 `dictType`（系统字典类型码），渲染统一走 `renderField`——配了 `dictType` 的 `dictUtils.getDictLabel(type, raw, raw)` 翻译（未命中回退原码）、空值统一 `-`，未配的原值直出；`commonYN` 纯读登录缓存无需预加载。以后详情页其他码值字段要翻译只需加配置——但 MDP 字典字段（bd_mdp_dict）勿照抄此机制：getDictLabel 只认系统字典，MDP 码需扩展异步预加载后走 mdpDictUtils。
6. **详情页全量字典翻译（2026-09-03 四次增补）**：列表有的详情也要——详情页 87 字段按**实体注释为权威**全量配码：注释标「字典 XXX」的配 `mdpDictType`（41 个分类走 mdpDictUtils，onMounted `await loadMdpDicts([...])` 后再请求详情，清单为列表页的全量超集，模块缓存跨页面复用不重复请求）、标「Y/N」的配 `dictType: "commonYN"`（13 个，读登录缓存无需预加载）。两个实现细节：renderField 先判空（`raw == null || raw === ""` → "-"）再分流——getMdpDictLabel 对空值返回空串，不先判空会绕过 "-" 占位符；el-descriptions 是响应式渲染（vxe formatter 非响应式的坑在此不适用），但保持「先 await 字典再请求数据」的列表页同构范式，首屏不闪原码。用户原话「列表不是有说明，列表有的详情也要请求」——镜像页详情与列表的字典口径必须一致，否则验收必返工。
7. **字典加载与列表请求并行化（2026-09-03 五次增补，用户定型替换串行范式）**：用户原话「列要计算属性，等接口返回相关字段再回显，而不是等待接口全部请求，以后这样的都得这样改」——旧范式「onMounted 中 await loadMdpDicts([...]) 后再 refresh()」让首屏串行等待全部字典接口，被否决。新范式（列表页 vxe）：onMounted 中 `refresh()` 立即发出列表请求 + `loadMdpDicts([...])` 并行（不 await）；字典就绪后 `.then()` 里 `const vxe = proTableRef.value?.tableRef; const rows = vxe?.getTableData()?.fullData || []; if (rows.length) vxe.reloadData(rows);`——**同数据重载**触发 vxe formatter 缓存重建（getCellLabel 按 rowid+colid 缓存、仅数据重载才重算），不重发请求、不改分页；若列表晚于字典返回，数据到达时 formatter 直接命中缓存（无竞态）。副作用：reloadData 重置勾选状态（低概率交互窗口，可接受）。详情页（el-descriptions 响应式渲染）更简单：字典与详情请求直接并行不 await，renderField 读 reactive 缓存依赖自动追踪，字典后到自动重渲——无需 reloadData（vxe 缓存机制仅适用表格）。defineExpose 暴露的 ref 经模板引用访问自动解包（`proTableRef.value?.tableRef?.` 直调 vxe 方法已有 6 页先例）。已同步修订 harness §8.1.2。

## 10. 契约数据版本滞后：pageSchema 返回旧列集——先指纹定位滞后层再修（2026-09-03 增补�?

> 来源：商品主数据扩列�?86 列后实战——磁盘上的新 DML 未落库，/sys/pageSchema 仍只返回旧版 24 列，误以为接口少数据�?

**机制**：pageSchema 返回�?�?建模登记全量列，而是三层交集�?

`sys_menu_form_column.visible_columns`（Redis Hash `sys:cache:menuForm:{tenantId}::menuForm`，field=menuCode，懒加载，直改库不失效）�?`sys_model_table_column` 实时列（FormColumnParser�? 分钟本地缓存）− 角色黑名单（admin 跳过）；id 不在绑定数组时补位首位�?

**判定特征（先定位滞后层，不要先怀疑代码）**：返回列集与某个历史版本 DML �?visible_columns 数组**逐位一�?* + id 在首位（补位特征）→ 运行库停留在该版本。本例返�?24 �?= 08-27 �?23 列绑�?+ id 补位，缺 zsyear�?9-01 才加）、缺 subseries 等（09-03 才加），版本指纹直接指向 08-27 版数据�?

**修复序（任一层滞后都单独足以致旧�?*�?

1. �?*后端实际连接的库**重跑最新幂�?DML（自�?DELETE 清理）；
2. SQL 指纹核验：`SELECT JSON_LENGTH(visible_columns) FROM sys_menu_form_column WHERE menu_code='xxx' AND del_flag=0;`（应=绑定列数�? `SELECT COUNT(*) FROM sys_model_table_column c JOIN sys_model_table t ON t.id=c.table_id WHERE t.form_code='xxx' AND c.del_flag=0 AND t.del_flag=0;`（应=元数据行数）�?
3. 清绑定缓存：`HDEL sys:cache:menuForm:{tenantId}::menuForm {menuCode}`（或 DEL �?key）；
4. 列元数据 5 分钟本地缓存等过期，或重启后端立即生效；
5. 重新 curl /sys/pageSchema，核对列数与顺序�?

**教训**：磁盘上�?DML 文件 �?库里的数据；直改�?�?缓存失效。契约类接口的返回面是「绑定白名单 × 实时�?× 双层缓存」的交集，任何一层滞后都表现为「少数据」�?

---

