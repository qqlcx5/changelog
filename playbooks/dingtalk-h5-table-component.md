---
id: PB-20260902-002
type: playbook
title: 钉钉多端 H5 表格组件选型（Vant 无 Table 的替代路径）
tags: [dingtalk, table, vue3, mobile]
status: draft
source: conversation:2026-09-02
created: 2026-09-02
updated: 2026-09-02
---

# 钉钉多端 H5 表格组件选型（Vant 无 Table 的替代路径）

See Also: [PB-20260902-001 钉钉多端 H5 视口适配](../playbooks/dingtalk-multi-platform-viewport.md)、[PB-20260824-001 uniapp 接入钉钉 H5 微应用](../playbooks/dingtalk-h5-microapp.md)

## 结论先行

- **Vant 2/3/4 官方都没有 Table 组件**，也没有列入路线图。官方定位是「原子化高频组件」，复杂表格交社区。社区 `vant-table` 已停更，别用。
- 主流移动端 UI 库里 **只有 TDesign Mobile Vue 原生自带 Table**；Vant / NutUI / antd-mobile / Varlet 均无。
- 钉钉四端（iOS / Android / Mac 客户端 / Windows 客户端）共用一套表格的**最低成本路径**：TDesign Mobile Vue 的 `t-table` 按需引入，与 Vant 混用。

## 选型矩阵

| 方案 | 包 | 体积 | 适用场景 | 风险 |
|---|---|---|---|---|
| TDesign Mobile Vue Table | `tdesign-mobile-vue` | 按需引入，小 | 移动端为主、PC 钉钉也要能看；列数 ≤ 15 | 与 Vant 混用需统一主题色 |
| Vant + 手写 table | 无新依赖 | ~0 | 列少（≤6）、只读、卡片式 | 自己实现 sticky 首列 + 横向滚动 |
| vxe-table（纯表格模式） | `vxe-table` + `vxe-pc-ui` | 大（数百 KB） | 列多、虚拟滚动、行编辑、合并单元格 | 桌面优先；移动端需手动压行高、关 hover |
| AG Grid Community | `ag-grid-vue3` | 大 | 在线编辑、Excel 级交互 | 中文文档弱、企业版才有的功能易踩坑 |

决策树：

1. 列 ≤ 6 且只读 → **手写 table + Vant**（`van-list` 上拉加载 + `van-skeleton` 占位）
2. 列 7–15、需要固定首列/表头、跨四端 → **TDesign Mobile Vue `t-table`**
3. 列 > 15、或需要虚拟滚动 / 行内编辑 / 列拖拽 → **vxe-table**（若 PC 主项目已在用，直接复用同一套列定义最省）

## 钉钉四端适配要点（表格专属）

1. **PC 端视口是宽的**——`t-table` 与手写 table 都要设 `max-width` 居中，否则在 Windows 客户端 1600px 宽下拉成一条线。视口方案见 PB-20260902-001。
2. **iOS 横向滚动惯性**——滚动容器必须加：
   ```css
   .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
   ```
   缺 `-webkit-overflow-scrolling` 时 iOS 上滑动会「粘手」，用户以为页面卡死。
3. **固定首列用 `position: sticky; left: 0`**——不要引入 `position: fixed` 方案，会与钉钉容器的滚动层级打架。sticky 的祖先链上任何节点有 `overflow: hidden` 都会失效，检查到 `#app` 为止。
4. **表头吸顶**——`position: sticky; top: 0` 会顶到钉钉自带导航栏下面；`top` 值需按 `dd.env.platform === 'ios' ? 44 : 0` 之类动态给，或直接用钉钉 JSAPI 关掉自带导航自行实现。
5. **点击延迟**——`t-table` 的行点击事件在 iOS 上有 300ms 问题，配 `viewport` 的 `width=device-width` 已能规避大部分，剩余用 `touch-action: manipulation`。
6. **PC 端无下拉刷新手势**——分页/加载更多要做成显式按钮，不要只靠 `van-list` 的上拉触底（PC 端永远触不了底）。

## 验证清单

- [ ] 钉钉 iOS / Android 真机：横向滑动跟手、首列不跟着滚
- [ ] 钉钉 Mac / Windows 客户端：表格不巨型化、有最大宽度、居中
- [ ] PC 端可翻页（无触底事件）
- [ ] 空态 / 骨架屏 / 加载失败三态齐全
- [ ] 与 Vant 混用时主题变量未互相覆盖（检查 CSS 变量作用域）

> **待核实**：TDesign Mobile Vue 的 `t-table` 具体 API（固定列属性名、是否支持横向滚动配置）以上游文档为准，本条目落 `draft` 因尚未在钉钉四端实测。
