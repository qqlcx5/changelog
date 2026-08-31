---
id: PB-20260831-002
type: playbook
title: Tauri 2 模板配置加固与排障（CSP / 路由 / 改名 / 打包元数据）
tags: [tauri, csp, config, security]
status: verified
source: conversation:2026-08-31
created: 2026-08-31
updated: 2026-08-31
---

# Tauri 2 模板配置加固与排障（CSP / 路由 / 改名 / 打包元数据）

> 来源：2026-08-31。在 `qqlcx5/tauri-template`（Tauri 2.10.1 + Vue 3.5 + Vite 6 + pnpm 12）逐项落地并验证：
> 所有字段均对照本地 crate 源码核对（`tauri-2.10.1`、`tauri-utils-2.8.2`），
> 配置改动以 `cargo check`（编译期反序列化）与 `pnpm build`（vue-tsc + vite）双重验证通过。

## 0. 核心思路：让编译器帮你验配置

`tauri::generate_context!()` 宏在**编译期**反序列化 `tauri.conf.json`，且
`SecurityConfig` 等结构体带 `#[serde(deny_unknown_fields)]`。

结论：**改完配置跑一次 `cargo check`**，字段名写错、类型不符、多余字段全部当场报错。
这比查文档、比对 JSON Schema 可靠得多，且能挡住版本间字段变更。

```bash
cd src-tauri && cargo check   # 配置错误在此暴露，不必等到打包
```

## 1. CSP：必须同时写 `csp` 与 `devCsp`

### 1.1 dev 会回退使用 csp（源码实证）

`tauri-2.10.1/src/manager/mod.rs`：

```rust
fn csp(&self) -> Option<Csp> {
    if !crate::is_dev() {
        self.config.app.security.csp.clone()
    } else {
        self.config.app.security.dev_csp.clone()
            .or_else(|| self.config.app.security.csp.clone())   // ← 回退
    }
}
```

**未设置 `devCsp` 时，开发模式直接使用 `csp`。** 若 `csp` 严格（默认不允许
`ws://`、`'unsafe-inline'`），Vite 的 HMR WebSocket 与内联样式会被 CSP 拦掉，
表现为**开发环境页面异常 / 热更新失效**，而打包后一切正常 —— 极难联想到 CSP。

### 1.2 推荐配置

```json
"security": {
  "csp": {
    "default-src": "'self'",
    "connect-src": "ipc: http://ipc.localhost",
    "img-src": "'self' asset: http://asset.localhost blob: data:",
    "style-src": "'unsafe-inline' 'self'",
    "font-src": "'self' data:"
  },
  "devCsp": {
    "default-src": "'self'",
    "script-src": "'self' 'unsafe-inline'",
    "style-src": "'unsafe-inline' 'self'",
    "connect-src": "'self' ipc: http://ipc.localhost ws://localhost:1421 http://localhost:1420",
    "img-src": "'self' asset: http://asset.localhost blob: data:",
    "font-src": "'self' data:"
  }
}
```

要点：

- **对象形式**（`Map<String, CspDirectiveSources>`）是 Tauri 2 支持的，比字符串拼接易维护；
- 生产 `csp` **不需要** `script-src: 'unsafe-inline'`：Tauri 在编译期扫描前端产物，
  自动把 nonce 与 hash 注入 `script-src` / `style-src`（见
  `tauri-2.10.1/src/manager/mod.rs` 的 `set_csp` / `replace_csp_nonce`）；
- `connect-src` 至少保留 `ipc: http://ipc.localhost`，否则 `invoke()` 失效；
- 应用要请求外部 API 时，**必须把该 origin 加进 `connect-src`**，否则打包后 `fetch` 失败
  而 `pnpm dev` 正常（dev 走 `devUrl`，由 Vite 提供，不经 asset 协议，CSP 不覆盖）。

### 1.3 `dragDropEnabled` 别乱改

`tauri-utils-2.8.2/src/config.rs` 注释原文：
"Disabling it is required to use HTML5 drag and drop on the frontend on Windows."

即 `true`（默认）= Tauri 拦截本地文件拖入，页面拿不到路径（更安全）；
改成 `false` 反而**放开**了这条限制。语义与直觉相反，不要为"想让拖拽生效"而关闭它。

## 2. 路由：打包后必须用 hash 模式

```ts
history: createWebHashHistory(),   // 不是 createWebHistory()
```

原因：打包后前端由 Tauri 自定义协议（`tauri://localhost` / `http://tauri.localhost`）提供，
背后**没有服务端**把 `/settings` 重写回 `index.html`。WebHistory 下跳转或刷新直接白屏。
hash 模式把路径放在 `#` 后，请求始终指向 `index.html`。

配套：

- 路由组件用 `() => import(...)` 懒加载，每页单独成 chunk；
- 末尾加兜底 `{ path: "/:pathMatch(.*)*", ... }`；
- 注册顺序：`createApp(App).use(createPinia()).use(ElementPlus).use(router).mount("#app")`
  —— Pinia 先于 router（路由守卫可能用 store），router 先于 mount（否则首屏匹配不到路由）。

## 3. 改名清单（模板类仓库最高频的 issue 来源）

以 `tauri-vue3-template` 为例，共 **7 处**：

| # | 位置 | 说明 |
|---|---|---|
| 1 | `package.json` → `name` | |
| 2 | `src-tauri/Cargo.toml` → `name` | 连字符合法 |
| 3 | `src-tauri/Cargo.toml` → `[lib].name` | **只能下划线**（`tauri_vue3_template_lib`），crate 名不允许连字符 |
| 4 | `src-tauri/src/main.rs` → `tauri_vue3_template_lib::run()` | **必须与 `[lib].name` 完全一致**，编译器不推断；漏改 = 编译失败 |
| 5 | `src-tauri/tauri.conf.json` → `productName` / `identifier` / window `title` | `identifier` 必须全局唯一 |
| 6 | `index.html` → `<title>` | 只在开发/浏览器窗口可见，最易忘 |
| 7 | `src-tauri/tauri.conf.json` → `bundle.publisher` / `bundle.copyright` | MSI / RPM / AppImage 需要 |

不需要改：`Cargo.lock`（下次 cargo 自动更新）、`src-tauri/gen/schemas/*`
（自动生成的权限 JSON Schema，不含应用名）。

## 4. 隐私：identifier 别带真实工号

`npm create tauri-app` 会用系统用户名生成 identifier，例如
`"identifier": "com.t-liaochunxin.tauri-vue3-template"`。

**开源模板务必改成中性值**（`com.example.tauri-vue3-template`），
否则等于把公司工号发布到公网，且每个 fork 的人都带着别人的标识。

## 5. bundle 元数据（源码核实的可用字段）

`tauri-utils-2.8.2/src/config.rs` 中 `BundleConfig` 实际支持的字段：

```json
"bundle": {
  "publisher": "Your Name",                       // → Windows Installer Manufacturer / deb Maintainer
  "copyright": "Copyright © 2026 ...",            // 版权字符串
  "category": "DeveloperTool",                    // 取值固定，见源码注释枚举（Business/Utility/...）
  "shortDescription": "...",                      // serde alias: short-description
  "longDescription": "..."                        // serde alias: long-description
}
```

注意：`category` 必须是源码注释列出的枚举值之一，写自由文本会被拒。

## 6. crates.io keywords 上限 5 个

`Cargo.toml` 的 `keywords` 最多 **5 个**、每个 ≤20 字符、只允许 ASCII 字母数字与 `_`/`-`，
且不能以 `_` 开头。写 6 个会在 `cargo publish` 时报错 —— 本地 `cargo check` **不报**，
容易漏到发布阶段。

## 7. 配置类改动的验证顺序

1. `cargo check`（在 `src-tauri/`）—— 验 `tauri.conf.json` 字段；
2. `pnpm build`（`vue-tsc --noEmit` + `vite build`）—— 验前端；
3. 产物断言：搜 CSS/JS 里关键标记是否真的存在，而不是只看"构建成功"。

## 8. 坑点速查

- **dev 正常、打包后异常** → 先怀疑 CSP（`connect-src` 漏了 API origin）与路由模式（WebHistory）；
- **打包后正常、dev 异常** → 先怀疑 CSP 回退（漏了 `devCsp`）；
- **改完配置想确认字段合法** → 直接 `cargo check`，别只查文档；
- `cargo` 走国内镜像时，`src-tauri/.cargo/config.toml` 配 `sparse+https://rsproxy.cn/index/`
  可用（`cargo add --dry-run` 实测能解析），但 `CARGO_HOME` 可能不在 `~/.cargo`，
  源码定位要先查 `$env:CARGO_HOME`。
