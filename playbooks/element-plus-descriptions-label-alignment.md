---
id: PB-20260903-002
type: playbook
title: Element Plus el-descriptions 标签列统一对齐三件套
tags: [element-plus, vue3, css, layout]
status: verified
source: conversation:2026-09-03
created: 2026-09-03
updated: 2026-09-03
---

# Element Plus el-descriptions 标签列统一对齐三件套

## 1. 问题场景

同一页面用多块 `el-descriptions`（v-for 分组渲染或同页多块）展示详情时，各表纵向网格线对不齐：

- 标签列是 auto 布局按内容自适应——有的标签长、有的短，每块表、每列宽度都不一样；
- 内容列也按各自内容分配，块与块之间竖线错位，观感「有的长有的短」。

Element Plus 的 bordered descriptions 底层是 `<table>`，默认 `table-layout: auto`，
组件 API 层没有「跨多块表对齐」的现成手段，需要三件套组合。

## 2. 方案（三件套）

### 2.1 标签列宽走组件配置：`:label-width`

```vue
<el-descriptions :column="3" :label-width="200" border>
```

- EP 会把该值作为标签单元格的**内联 width** 落地（源码 `descriptions-cell.mjs`：
  `width: addUnit(item.labelWidth ?? descriptions.labelWidth ?? item.width)`）；
- 配置能表达的优先用配置，不要手写 `:deep(.el-descriptions__label) { width: 200px }`。

### 2.2 固定表格布局：`table-layout: fixed`

```scss
:deep(.el-descriptions__table) {
	table-layout: fixed;
}
```

- fixed 布局下**列宽仅由首行单元格（及 col 元素）决定**：标签列全部取 200px，
  内容列均分剩余宽度 → 多块表的网格线纵向完全贯通；
- auto 布局下 width 只是「建议值」，长内容仍会撑开该列，对不齐。

### 2.3 长值兜底：内容列按词断行

```scss
td.el-descriptions__content {
	overflow-wrap: break-word;
}
```

- fixed 格子宽度固定，超长值（长 ID、URL）必须换行，否则溢出撑破表格。

## 3. 坑点清单

1. **`:span` 大项不要出现在首行**——fixed 列宽由首行决定，首行一旦跨列会扭曲整表列宽；
   `:span="column"` 的全宽项放最后一行。
2. **局部 CSS 覆盖组件配置会造成双口径**——如全局约定 200px、某页局部样式写 250px，
   同特异性下后加载的组件样式胜出，宽度悄悄漂移；统一宽度标准时全局与局部只能留一个来源。
3. **定宽要容纳最长标签**——200px（14px 字号）约容纳 12 个中文字符含内边距；
   更长的标签在 fixed 布局下折为两行（不再撑宽，但单行更工整）。
4. **`:label-width` 需要较新的 EP 版本**（本方案在 EP 2.14.3 验证）；
   旧版本退化方案是 `:deep(.el-descriptions__label) { width: 200px }` +
   `table-layout: fixed`（fixed 布局下首行同样会采纳 CSS 定宽）。

## 4. 完整最小示例

```vue
<template>
	<el-descriptions
		v-for="g in groups"
		:key="g.title"
		:title="g.title"
		:column="3"
		:label-width="200"
		border
		style="margin-bottom: 16px"
	>
		<el-descriptions-item v-for="it in g.items" :key="it.key" :label="it.label">
			{{ it.value }}
		</el-descriptions-item>
	</el-descriptions>
</template>

<style lang="scss" scoped>
:deep(.el-descriptions__table) {
	table-layout: fixed;

	td.el-descriptions__content {
		overflow-wrap: break-word;
	}
}
</style>
```

## 5. 实战落地记录

- QCM V2（jp-ui）6 个详情页统一为该方案：md/productMasterData（8 组）、
  md/supplierMasterData、scm/productOrder（5 组）、plm/productSample（5 组）、
  bi/saleInfo（5 组）、sys/office/OfficeDetail（原局部 250px 收敛回 200px）。
- 静态门禁：6 个目标文件 eslint 全部通过；视觉核对按人工验收清单执行。
