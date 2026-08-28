---
id: PB-20260828-001
type: playbook
title: Vite + Vue3 项目一次性集成 UnoCSS / Element Plus / lodash-es / sass-embedded
tags: [vite, vue3, unocss, element-plus, sass]
status: verified
source: conversation:2026-08-28
created: 2026-08-28
updated: 2026-08-28
---

# Vite + Vue3 项目一次性集成 UnoCSS / Element Plus / lodash-es / sass-embedded

> 来源：2026-08-28 在 tauri-vue3-template（Vite 6 + Vue 3.5 + TS + pnpm 11）上实战跑通，
> `vue-tsc --noEmit` 与 `vite build` 均通过，产物已验证含 uno 图标 / element-plus 样式 / scss 编译结果。

## 1. 安装（先分组再装，别让 pnpm 乱放）

```bash
pnpm add element-plus lodash-es                       # 运行时依赖
pnpm add -D unocss @iconify-json/tabler sass-embedded @types/lodash-es
```

- `element-plus` / `lodash-es` 必须进 `dependencies`；`pnpm add` 默认进 dependencies，
  但**旧 lockfile 里已存在的包会被 pnpm 按 lockfile 归位**，装完一定回读 `package.json` 复核分组。
- `lodash-es` 自身不带类型，`@types/lodash-es` 必装，否则 `import { debounce } from 'lodash-es'` 报 TS7016。

## 2. UnoCSS

`vite.config.ts`：

```ts
import UnoCSS from "unocss/vite";
// plugins: [vue(), UnoCSS()]
```

`src/main.ts` 里 `import "virtual:uno.css";`，**顺序放在 `element-plus/dist/index.css` 之后**，
让原子类能覆盖组件库默认样式。

`src/vite-env.d.ts` 补声明，否则 TS2307 找不到模块：

```ts
declare module "virtual:uno.css";
```

## 3. presetIcons + @iconify-json/tabler

```ts
presetIcons({
  scale: 1.2,
  warn: true,
  collections: {
    tabler: () => import("@iconify-json/tabler/icons.json").then((m) => m.default),
  },
})
```

显式写 `collections` 比依赖 node 自动探测稳（Windows / 打包环境都能解析）。
**图标名必须查表再写**，写错只在构建日志里出现一行 `[unocss] failed to load icon "xxx"`（warn 级别，不失败），
极易漏掉导致页面上空白：

```bash
node -e "const i=require('./node_modules/@iconify-json/tabler/icons.json'); \
console.log(Object.keys(i.icons).filter(n=>n.includes('brand-v')).join(','))"
```

## 4. Element Plus（全量引入，零额外插件）

```ts
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "virtual:uno.css";
createApp(App).use(ElementPlus).mount("#app");
```

`tsconfig.json` 补全局组件类型，否则模板里 `<el-button>` 类型不认：

```jsonc
"types": ["element-plus/global"]   // 会限制自动引入的 @types，需 @types/node 的场景另加进数组
```

全量引入产物约 +366 KB CSS / +1 MB JS（含 lodash 与 EP）；要瘦身再上
`unplugin-vue-components` + `unplugin-auto-import` 按需引入（本次未引入，保持依赖最小）。

## 5. sass-embedded

装了就够，Vite 6 会**自动优先**使用它（比 `sass` 快数倍），无需 `css.preprocessorOptions` 也能跑；
显式声明更明确：

```ts
css: { preprocessorOptions: { scss: { api: "modern-compiler" } } }
```

pnpm 装完可能报 `Failed to create bin ... sass. ENOENT`，那是 Vite 内置 `sass` 的软链创建失败，
**可忽略**，不影响 sass-embedded 生效。

## 6. 验收（三步，别只看 dev server）

```bash
pnpm exec vue-tsc --noEmit          # 类型
pnpm exec vite build                # 构建，注意日志里的 failed to load icon
# 产物断言：图标类 + 组件库样式 + scss 编译结果都在
$css = Get-ChildItem dist/assets/*.css | Select-Object -First 1
$c = Get-Content $css.FullName -Raw
$c.Contains(".i-tabler-rocket"), $c.Contains(".el-button"), $c.Contains(".greet-msg")
```

## 坑位清单

1. `node_modules` 里有包 ≠ `package.json` 声明了它：新克隆会直接构建失败，改完配置顺手 `pnpm install` 同步 lockfile。
2. UnoCSS 图标名不校验 = 静默空白，见第 3 节查表命令。
3. `types` 字段一写就限制了自动引入的 `@types/*`，后续需要别的全局类型要手动加进数组。
4. `virtual:uno.css` 无类型声明会 TS2307，全量 `element-plus` 无 `element-plus/global` 会丢组件类型。
