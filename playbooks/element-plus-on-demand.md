---
id: PB-20260831-003
type: playbook
title: Element Plus 按需引入（Vite + pnpm）——官方方案落地与实测验证
tags: [element-plus, on-demand, vite, pnpm]
status: verified
source: conversation:2026-08-31
created: 2026-08-31
updated: 2026-08-31
---

# Element Plus 按需引入（Vite + pnpm）——官方方案落地与实测验证

> 来源：2026-08-31。在 `qqlcx5/tauri-template`（Vite 6.4.3 + pnpm 12.1.0 + element-plus 2.14.5
> + Vue 3.5）落地，逐条对照官方 Quick Start 文档核对，并用 **dev 模式模块请求** 与
> **生产产物探针** 双重实测验证（非仅"构建通过"）。

## 0. 官方方案原文（已核对）

<https://element-plus.org/en-US/guide/quickstart.html#on-demand-import> 的 "Auto Import（推荐）"：

```ts
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  plugins: [
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
});
```

配套结论（文档分散在各节，这里汇总）：

- 按需引入时**不再** `app.use(ElementPlus)`，也不再 `import "element-plus/dist/index.css"`；
- 全局默认配置（size / zIndex）改用 `<el-config-provider>` 包裹根组件；
- `"types": ["element-plus/global"]` 是 **Full Import** 的配套项（文档放在 Full Import 小节下），
  按需引入时**不应保留**；
- pnpm 用户注意 `dayjs`（详见第 6 节）。

## 1. 安装

```bash
pnpm add -D unplugin-vue-components unplugin-auto-import
```

## 2. 完整配置（含本项目踩过的坑）

```ts
Components({
  resolvers: [ElementPlusResolver({ importStyle: "css" })],
  dts: "src/components.d.ts",      // 放 src/ 下，确保被 tsconfig include 覆盖
}),
AutoImport({
  resolvers: [ElementPlusResolver({ importStyle: "css" })],
  dts: "src/auto-imports.d.ts",
}),
```

### 2.1 两个插件缺一不可

| 插件 | 负责范围 | 漏掉的后果 |
| --- | --- | --- |
| `Components` | 模板里的 `<el-xxx>` 标签 | 组件不渲染 |
| `AutoImport` | `<script setup>` 里的 `ElMessage` / `ElNotification` | **弹窗变成无样式裸 div** |

`ElMessage` 这类函数式 API 不出现在模板中，`Components` 扫不到，
只有 `AutoImport` 会注入 `element-plus/es/components/message/style/css`。

### 2.2 `importStyle` 的真实取值（源码核实）

`unplugin-vue-components/dist/resolvers.mjs` 的 `getSideEffects`：

```js
const { importStyle = true, importLess = false } = options;
if (!importStyle) return;
if (importStyle === "less" || importStyle === "css-in-js" || importLess) return `.../style`;
```

而 ElementPlusResolver 内部是 `const importStyle = options.importStyle ?? "css"`。

结论：**`"css"` 就是默认值**，显式写出无害且能防默认值变更。
**没有 `"sass"` 这个取值**——想覆盖 EP 主题走官方 Theming（SCSS 变量），与本选项无关。

## 3. 必须同步改的四处

1. **删掉** `import "element-plus/dist/index.css"` 与 `app.use(ElementPlus)`；
2. **删掉** `tsconfig.json` 里的 `"types": ["element-plus/global"]`
   （保留它 = 全部组件在类型上永远可用，按需引入失效也查不出来）；
3. **删掉** 源码里手写的 `import { ElMessage } from "element-plus"`；
4. **保序**：组件样式注入在组件模块所在的依赖图位置，因此 `App.vue` / `router` 的 import
   必须排在 `virtual:uno.css` **之前**，否则 EP 的 CSS 落到原子类之后会反过来盖住它
   （实测：`<el-tag class="hidden">` 会重新显示）。

## 4. 坑：模板里不能调用 auto-import 的全局 const

`AutoImport` 把 `ElMessage` 暴露为**全局 const**，只在 `<script setup>` 里可解析，
**模板表达式不走全局作用域**：

```vue
<!-- ✗ vue-tsc: TS2339 Property 'ElMessage' does not exist -->
<el-button @click="ElMessage.info('hi')">Message</el-button>
```

```ts
// ✓ 模板只绑事件，调用收进 script
function showMessage() { ElMessage.info("hi"); }
```

排查提示：报错行号落在 `.vue` 的**模板区域**时，`auto-imports.d.ts` 存在且被加载
（用 `vue-tsc --noEmit --listFiles | grep auto-imports` 确认），但依然报 TS2339
——基本就是这条。

## 5. 验证清单（别只看"构建通过"）

### 5.1 dev 模式：请求组件模块看注入结果

```bash
curl "http://localhost:<port>/src/components/Xxx.vue"
```

应看到形如：

```
/* unplugin-vue-components disabled */
import { ElButton as __unplugin_components_1 } from "/node_modules/.vite/deps/element-plus_es.js?...";
import "/node_modules/.vite/deps/element-plus_es_components_button_style_css.js?...";
```

逐个组件 + 各自样式，且函数式 API 单独有一行 `import { ElMessage } from "..."`。

### 5.2 生产产物：用未使用组件名做探针

在 chunk 里搜**从未使用过**的组件名（`ElColorPicker` / `ElUpload` / `ElTree` /
`ElCarousel` / `ElCascader` / `ElTransfer` / `ElTimeline` / `ElCalendar` / `ElBacktop` /
`ElDrawer`），全部应为 **0 命中**。命中即 tree-shaking 失效。

### 5.3 产物 CSS 顺序断言

按字节偏移确认 `reset` < `element-plus` < `[data-v-]`。

## 6. pnpm + dayjs：官方提示需实测后再采纳

官方文档 TIP 原文大意：`dayjs` 不是 ESM，pnpm 下需依赖提升
（pnpm ≥10.6 在 `pnpm-workspace.yaml` 写 `shamefullyHoist: true` + `nodeLinker: hoisted`），
或 `pnpm add dayjs`。

**本项目实测无需任何处理**（Vite 6 + pnpm 12）：

- `dayjs` 不在 `package.json`、不在顶层 `node_modules`（只存在于 `.pnpm/dayjs@1.11.23`）；
- 但它被内联进 `node_modules/.vite/deps/element-plus_es.js`（212 处命中）；
- 预构建产物中 `require(` 出现 **0** 次，生产产物中 `module.exports` 出现 **0** 次；
- `ElDatePicker` 的样式与功能均正常。

**结论**：优先用探针实测，不要盲从文档加 `shamefullyHoist` —— 它会把 `node_modules` 拍平，
彻底丢掉 pnpm 的隔离优势（连带让"靠 `.pnpm/<pkg>@<ver>/node_modules/` 判断依赖是否存在"
这类排查手法失效，见 ERR-20260831-005）。
真的需要时用 `pnpm add dayjs` 这个轻量替代方案。

## 7. 收益要诚实测量

本项目实测（demo 使用了 22 个组件中的 18 个，含 `ElTable` / `ElDatePicker` / `ElSelect`）：

| 产物 | 改动前 | 改动后 |
| --- | --- | --- |
| `style.css` | 401.03 kB | **208.06 kB**（−48%） |
| `element-plus.js` | 769.51 kB | 767.69 kB（几乎不变） |

**JS 收益在 demo 上被"用得多"掩盖了**：组件用得越多，tree-shaking 能砍的就越少。
真实项目只用少量组件时 JS 收益才会显著。报告收益时必须带上"用了多少组件"这个前提，
否则会给出误导性结论。
