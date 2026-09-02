---
id: PB-20260902-001
type: playbook
title: 钉钉多端 H5 视口适配（vw + 最大宽度限制）
tags: [dingtalk, viewport, vw, postcss, mobile]
status: draft
source: conversation:2026-09-02
created: 2026-09-02
updated: 2026-09-02
---

# 钉钉多端 H5 视口适配（vw + 最大宽度限制）

See Also: [PB-20260824-001 uniapp 接入钉钉 H5 微应用（JSAPI + 免登）](../playbooks/dingtalk-h5-microapp.md)

## 问题：纯 vw 适配在钉钉 PC/Mac 客户端会崩

钉钉四端视口宽度差异极大：

| 端 | 视口宽度 | 纯 vw（设计稿 375）后果 |
|---|---|---|
| iOS / Android | 375–430 | 正常 |
| Mac 客户端 | 800–1200+ | 等比放大 2–3 倍，UI 全崩 |
| Windows 客户端 | 900–1600+ | 同上，且更宽 |

两个根因：

1. `vw` 是视口单位，屏幕越宽元素越大，**没有上限**，移动端页面在宽屏被拉伸成巨型界面。
2. 钉钉 PC 客户端是 CEF 内核，用户会本能按 `Ctrl +/-` 缩放，而 **vw 模式下浏览器缩放完全无效**（页面纹丝不动），可访问性为零。

## 解法：postcss-mobile-forever

<https://github.com/wswmsword/postcss-mobile-forever>

原理是编译阶段把 `10vw` 转成 `min(10vw, 70px)`，即「小于上限时等比伸缩，到上限后停止放大」；同时矫正 `fixed` 定位元素在宽屏下飘到居中视图之外的问题（把 `right` 重写为 `calc(50% - min(315px, 45%))` 之类）。

相比 `postcss-px-to-viewport`：多了宽屏包容；相比 `postcss-px2rem`：无需运行时 JS，禁用 JS 也能正常显示。

### 三种模式

| 模式 | 行为 | 适配建议 |
|---|---|---|
| `vw-mode` | 朴素转 vw，不限制最大宽度 | 仅纯移动端，钉钉多端**不可用** |
| `max-vw-mode` | 转 vw + `min(vw, px)` 限制最大宽度 | 可用，社区最常用 |
| `mq-mode` | 媒体查询实现，兼容性更好，桌面端**可用浏览器缩放按钮** | 钉钉 PC/Mac **推荐** |

### 配置（Vite）

```js
// vite.config.mjs
import mobileForever from 'postcss-mobile-forever'

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        mobileForever({
          viewportWidth: 375,      // 设计稿宽度，与 Vant 4 默认一致
          appSelector: '#app',     // 根节点，用于居中 + 限宽
          maxDisplayWidth: 560,    // 超过此宽度停止放大
          mode: 'mq',              // 媒体查询模式
        }),
      ],
    },
  },
})
```

`index.html` 的 viewport 必须带 `viewport-fit=cover`：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

> **待核实**：`viewportWidth` / `appSelector` / `maxDisplayWidth` 三项参数名已确认；`mode: 'mq'` 的参数名需以上游 README 为准，落地前先核对。本条目标 `draft` 即因尚未实测验证。

## 钉钉专属适配要点

1. **平台判断**——UA 兜底，`dd.env.platform`（`ios` / `android` / `pc`）更可靠但需等 JSAPI 加载完成：
   ```ts
   const ua = navigator.userAgent
   const isDingTalk = /DingTalk/i.test(ua)
   const isPc = isDingTalk && /(Windows|Macintosh)/.test(ua)
   const isIos = isDingTalk && /iPhone|iPad|iPod/.test(ua)
   const isAndroid = isDingTalk && /Android/.test(ua)
   ```
2. **JSAPI 降级**——`dd.biz.*` 在 PC 端支持度低于移动端，每个调用都需 try/catch + 降级路径；`dd.ready` 在非钉钉容器不触发，浏览器打开时应降级到普通登录页而非白屏。
3. **UnoCSS 与 px→vw 冲突（关键坑）**——若项目用 UnoCSS，其生成的原子类走独立管道，**不经过本 PostCSS 插件**，产出的尺寸不会被转 vw。需约定：尺寸类写在 `<style>` 里手写 px 交给 PostCSS，UnoCSS 只管颜色与语义类。动手前必须实测验证。
4. **安全区**——钉钉自带导航栏与底部 tabbar，`env(safe-area-inset-bottom)` 实际值与 Safari 不同，底部固定按钮要真机实测。
5. **PC 端调试**——vConsole 在 PC 端基本不可用，改用钉钉开放平台「H5 微应用四端调试工具」。

## 关联选型

若需完整移动端基座（非仅适配插件），`vue-zone/vue3-vant-mobile` 默认已集成 `postcss-mobile-forever`，且带 `unplugin-vue-i18n`、`vite-plugin-vconsole`、`pinia-plugin-persistedstate`。建议**抄其 PostCSS / UnoCSS 配置而非 clone 整仓**，避免引入第二套工程约定。

## 验证清单

- [ ] 设计稿宽度与 `viewportWidth` 一致（Vant 4 为 375）
- [ ] 移动端 375 / 414 / 430 三档实测
- [ ] 钉钉 iOS / Android 真机实测
- [ ] 钉钉 Mac / Windows 客户端实测：视图居中、两侧留白、不再巨型化
- [ ] PC 端 `Ctrl +/-` 缩放生效（仅 mq-mode）
- [ ] `fixed` 定位元素（返回顶部、底部按钮）在宽屏下未飘出居中视图
- [ ] UnoCSS 原子类尺寸与手写 CSS 尺寸表现一致
