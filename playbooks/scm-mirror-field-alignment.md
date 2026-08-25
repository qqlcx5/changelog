---
id: PB-20260825-001
type: playbook
title: SCM 镜像页前端字段口径对齐清单
tags: [qcm-v2, protable, field-mapping]
status: verified
source: conversation:2026-08-25
created: 2026-08-25
updated: 2026-08-25
---

# SCM 镜像页面前端字段口径对齐清单（QCM V2 / jp-ui）

> 适用：外部系统（SCM/XLS 等）推送数据落库后，在 jp-ui 做只读镜像展示页（ProTable 列表）。
> 本文为可直接复用的落地核对清单，来源于 SCM采购入退库（scmPurchaseStock）两轮对齐实战，兄弟页面 scmPurchaseOrder 同口径。

## 1. 三条字段名口径（SCM 实体固定模式）

后端实体（如 `ScmPurchaseStock`）业务字段全部带 `@JsonProperty` 报文全大写注解（`billId→BILLID`、`whQty→WHQTY`），由此产生前端三条铁律：

| 口径 | 规则 | 前端写法 |
|------|------|---------|
| 查询绑定参数 | Spring MVC 绑定用驼峰（`@Query` 字段） | 有搜索的列 `field` 取驼峰，保证搜索提交 key 能被绑定 |
| 响应 JSON key | `@JsonProperty` 指定报文全大写 | 有搜索的列必须加 `formatter: ({ row }) => row.BILLID ?? ""` 从全大写 key 取值；无搜索的列 `field` 直接用全大写 key |
| 非报文字段 | 无 `@JsonProperty`（派生字段、BaseEntity 审计字段 createUserName/createTime 等） | 响应 key 即驼峰，`field` 直接用驼峰，无需 formatter |

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

1. 读后端实体：标出 `@Query` 字段（搜索白名单）与 `@JsonProperty`（响应 key 口径）；
2. 读 Mapper XML 聚合 SQL：列集合以 SELECT 实际返回列为准，注意 SUM / GROUP_CONCAT / MAX 口径并在列注释标明；
3. ProTable 列定义按第 1 节三口径写 field / formatter；
4. 菜单挂「主数据管理」一级菜单（menu_code='masterData'），前端路径 `views/md/scmXxx/`、API `api/md/scmXxxService.js`、菜单 href `/md/scmXxx`（不存在「采购管理」一级菜单）；
5. 列标题以用户提供的字段规格表为最终命名依据（如「类型」不写「类型编码」）。

## 6. 常见坑

1. 有搜索的列直接用全大写 field 或不加 formatter → 搜索失效或业务列全空白（绑定 key 与响应 key 是两套口径）。
2. 按实体全字段配列而接口是聚合 SQL → 聚合不返回的列恒空白。
3. 无 `@Query` 的字段配搜索 → 输入无任何过滤效果。
4. 派生字段误当报文字段用全大写 key 取值 → 空白（非报文字段响应 key 是驼峰）。
