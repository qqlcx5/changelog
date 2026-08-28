---
id: PB-20260828-001
type: playbook
title: Vite + Vue3 + Element Plus 项目的 UnoCSS 生产级配置
tags: [vite, vue3, unocss, element-plus, sass]
status: verified
source: conversation:2026-08-28
created: 2026-08-28
updated: 2026-08-28
---

# Vite + Vue3 + Element Plus 项目的 UnoCSS 生产级配置

> 来源：2026-08-28。基于 UnoCSS 官方文档（v66.7.x）逐项核对 + 在本项目（Vite 6 / Vue 3.5 / TS / pnpm 11 / unocss 66.8.1）
> 实跑验证：`vue-tsc --noEmit` 通过，`vite build` 9s 通过，产物断言全部命中。

## 0. 只用 `unocss` 一个包就够

`unocss` 包的 exports 已包含全部预设与转换器，**不需要**再装
`@unocss/preset-wind3` / `@unocss/preset-icons` / `@unocss/transformer-directives` 等分包：

```
unocss 导出：presetMini presetWind3 presetWind4 presetUno(废弃) presetWind(废弃)
             presetAttributify presetIcons presetTypography presetWebFonts presetTagify
             transformerDirectives transformerVariantGroup transformerCompileClass extractorSplit
```

唯一需要额外装的是重置样式 `@unocss/reset`（本文用 `preflights` 内联替代，见第 5 节）。

## 1. presetUno / presetWind 已废弃 → 用 presetWind3

官方 INFO：`@unocss/preset-wind` 和 `@unocss/preset-uno` 已被废弃并重命名为 `@unocss/preset-wind3`。
新项目直接 `presetWind3()`；`presetWind4` 是 Tailwind v4 对齐版（oklch / cascade layers），老语法迁移成本更高，按需选。

## 2. presetIcons：必须显式写 collections

```ts
presetIcons({
  scale: 1.2,
  warn: true,                          // 图标名写错只输出一行 warn，页面直接空白
  extraProperties: { display: "inline-block", "vertical-align": "middle" },
  collections: {
    tabler: () => import("@iconify-json/tabler/icons.json").then(m => m.default),
  },
})
```

- 文档说 node 环境"自动搜索已安装的 iconify 数据集"——**pnpm 大依赖树下实测会卡住构建**
  （transforming 阶段挂死 >90s）。显式 `collections` 后同样工程 9s 完成。见 ERR-20260828-002。
- 图标名必须查表，写错是静默空白：
  `node -e "const i=require('./node_modules/@iconify-json/tabler/icons.json');console.log(Object.keys(i.icons).includes('rocket'))"`

## 3. 两个必开转换器

```ts
transformers: [transformerDirectives(), transformerVariantGroup()]
```

- `transformerDirectives`：`@apply` / `--uno:` / `theme()` / `icon()`，让 `<style lang="scss">` 里能复用原子类。
  实测产物：`.greet-msg{@apply rounded-lg px-4 py-2;color:theme("colors.primary")}`
  → `.greet-msg{...border-radius:.5rem;padding:.5rem 1rem;color:#409eff}`。
- `transformerVariantGroup`：`hover:(bg-red text-white)` 变体分组。

## 4. 与 Element Plus 共存的四条规则

1. **加载顺序**：`element-plus/dist/index.css` → `element-plus/theme-chalk/dark/css-vars.css` → `virtual:uno.css`。
   原子类放最后才能覆盖组件默认样式。
2. **不要用 `important: '#app'`**：UnoCSS 的 `important` 支持传选择器前缀（提升特异性而不加 `!important`），
   传 `#app` 后所有工具类都变成 `#app xxx`，而 EP 的 `append-to-body` / `teleported` 组件（Dialog、Select、Tooltip 下拉）
   渲染在 body 下，会整体失去 uno 样式。靠加载顺序解决优先级即可。
3. **暗黑模式对齐**：EP 用 `<html class="dark">` 切换，uno 默认 `dark: 'class'` 也是 `.dark`——天然一致，
   一次 `document.documentElement.classList.toggle('dark')` 同时驱动两边。
4. **调色板对齐**：把 EP 默认色写进 `theme.colors`（primary #409eff / success #67c23a / warning #e6a23c /
   danger #f56c6c / info #909399），就能写 `text-danger`、`bg-primary`。

## 5. preflight 冲突：button 背景被刷成 transparent

`presetWind3` 默认带 preflight，其中 `button,[type=button]{background-color:transparent}` 会和 UI 框架冲突。
官方为此提供 `@unocss/reset/tailwind-compat.css`（去掉该条重写）。不想多装依赖就内联等价补丁：

```ts
preflights: [{
  getCSS: () => `
button, [type='button'], [type='reset'], [type='submit'] {
  background-color: revert;
  background-image: none;
}`
}]
```

## 6. 提取范围与动态类名

```ts
content: { pipeline: { include: [/* 默认正则 */, "src/**/*.{js,ts}"] } },
safelist: [],   // 运行时拼接的类名（如 `text-${state}`）必须列在这里，否则构建后被摇掉
```

默认只扫 `vue / svelte / jsx / tsx / html / md / astro` 等，**`.js` `.ts` 不在内**——
类名常量表写在 ts 里时务必加进去，或用 `// @unocss-include` 逐文件标记。

## 7. 验收（三步）

```bash
pnpm exec vue-tsc --noEmit
pnpm exec vite build                 # 注意日志里的 [unocss] failed to load icon
# 产物断言
$c = [IO.File]::ReadAllText((Get-ChildItem dist/assets/*.css | Select-Object -First 1).FullName)
$c.Contains("i-tabler-rocket"); $c.Contains("revert"); $c.Contains("409eff")
```

## 坑位清单

1. presetIcons 不写 collections → pnpm 下构建挂死（ERR-20260828-002）。
2. 图标名不校验 → 静默空白，构建不失败。
3. `important: '#app'` + EP teleported 组件 → 弹层样式全丢。
4. js/ts 里的类名常量默认不被扫描。
5. 全量引入 EP：产物约 +370 KB CSS / +1 MB JS，要瘦身再上 `unplugin-vue-components` 按需引入。
6. 装了 `virtual:uno.css` 但没在 `vite-env.d.ts` 里 `declare module "virtual:uno.css"` → TS2307。
