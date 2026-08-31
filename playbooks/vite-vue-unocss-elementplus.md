---
id: PB-20260828-001
type: playbook
title: Vite + Vue3 + Element Plus 项目的 UnoCSS 生产级配置
tags: [vite, vue3, unocss, element-plus, sass]
status: verified
source: conversation:2026-08-28
created: 2026-08-28
updated: 2026-08-31
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

**不需要**额外装 `@unocss/reset` / `normalize.css`：`presetWind4` 内置了 Tailwind4 版 reset（见第 1、5 节）。

## 1. presetUno / presetWind 已废弃 → 直接用 presetWind4

官方 INFO：`@unocss/preset-wind` 和 `@unocss/preset-uno` 已被废弃并重命名为 `@unocss/preset-wind3`，
当前推荐是 `@unocss/preset-wind4`（Tailwind4 对齐：内置 reset + 主题 CSS 变量 + `@property`）。
它对 presetWind3 兼容，工具类写法不用改，换导入名即可：

```ts
presetWind4({
  dark: "class",                 // 默认值就是 'class'，与 Element Plus 的 <html class="dark"> 天然一致
  preflights: {
    reset: true,                 // 默认 true：内置 reset，无需 @unocss/reset
    theme: "on-demand",          // 默认 'on-demand'：只生成被用到的 --colors-* / --spacing 等主题变量
  },
})
```

### 1.1 presetWind3 → presetWind4 的 theme key 改名

只影响在 `uno.config.ts` 里自定义过的 key，工具类写法不变：

| presetWind3 | presetWind4 |
|---|---|
| `fontFamily` | `font` |
| `fontSize` / `lineHeight` / `letterSpacing` | 移入 `text.fontSize` / `text.lineHeight` / `text.letterSpacing`（或继续用 `leading-*` / `tracking-*`） |
| `borderRadius` | `radius` |
| `easing` | `ease` |
| `breakpoints` / `verticalBreakpoints` | `breakpoint` / `verticalBreakpoint` |
| `boxShadow` | `shadow` |
| `width` / `height` / `maxWidth` / `minHeight` … | 统一走 `spacing` |
| `transitionProperty` | `property` |
| `container.maxWidth` | `containers.maxWidth` |

只配了 `theme.colors`（本文第 4 节的做法）则**完全不受影响**。

### 1.2 不再需要的包

- `presetRemToPx`：能力已内置于 presetWind4（用 `preflights.theme.process` + `postprocess: [createRemToPxProcessor()]`，
  从 `@unocss/preset-wind4/utils` 导入）。
- `presetLegacyCompat`：presetWind4 用 oklch 色彩模型，**明确不兼容**，不要一起用。

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

`presetWind4` 内置 reset 同样带 `button,input,select,optgroup,textarea,::file-selector-button{background-color:transparent}`，
会和 UI 框架冲突。官方为此提供 `@unocss/reset/tailwind-compat.css`（去掉该条重写）。不想多装依赖就内联等价补丁：

```ts
preflights: [{
  getCSS: () => `
button, [type='button'], [type='reset'], [type='submit'] {
  background-color: revert;
  background-image: none;
}`
}]
```

**层序保证覆盖**：presetWind4 新增三个层，order 为负——`properties(-200) < theme(-150) < base(-100)`。
自定义 `preflights` 不带 layer 时落在 order 0，排在 `base` 之后，因此上面这段补丁能盖掉内置 reset，无需 `!important`。

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

# presetWind4 专属断言（缺一个就说明没真正切过去；最后一项应为 0）
node -e "const fs=require('fs');const p=fs.readdirSync('dist/assets').find(f=>f.startsWith('index-')&&f.endsWith('.css'));const t=fs.readFileSync('dist/assets/'+p,'utf8');const keys=['@property --un-text-opacity','--colors-primary','--spacing:','background-color:revert','theme('];for(const k of keys)console.log(k,t.split(k).length-1)"
# → 依次应输出 1, >0, 1, 1, 0
```

## 坑位清单

1. presetIcons 不写 collections → pnpm 下构建挂死（ERR-20260828-002）。
2. 图标名不校验 → 静默空白，构建不失败。
3. `important: '#app'` + EP teleported 组件 → 弹层样式全丢。
4. js/ts 里的类名常量默认不被扫描。
5. 全量引入 EP：产物约 +370 KB CSS / +1 MB JS，要瘦身再上 `unplugin-vue-components` 按需引入。
6. 装了 `virtual:uno.css` 但没在 `vite-env.d.ts` 里 `declare module "virtual:uno.css"` → TS2307。
7. 提取器不区分代码与注释，源码/注释里出现图标前缀字面量也会触发
   `failed to load icon`（见 ERR-20260831-001）。
8. `@apply` 在**外部 .scss** 和 SFC `<style lang="scss">` 里都能用（实测 dev 与 build 均已展开）；
   VS Code 的 SCSS 语言服务会报 `unknownAtRules` 误警，加 `.vscode/settings.json`
   配 `scss.lint.unknownAtRules: "ignore"` 消除。
9. presetAttributify 与 Element Plus 的布尔属性（`text` / `circle` / `plain` / `round`）实测不冲突，
   不会生成 `[text=""]` 之类的属性选择器。
7. 切到 presetWind4 后自定义 theme key 用了旧名（`fontFamily` / `borderRadius` / `boxShadow` …）→ 不报错、静默失效，
   按 1.1 表格逐个改名（ERR-20260831-002）。
