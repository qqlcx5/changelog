---
id: PB-20260825-001
type: playbook
title: QCM V2 镜像页字段口径对齐清单（SCM & MDP）
tags: [qcm-v2, protable, field-mapping, jackson]
status: verified
source: conversation:2026-08-25
created: 2026-08-25
updated: 2026-08-31
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
