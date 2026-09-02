---
id: PB-20260824-001
type: playbook
title: uniapp 接入钉钉 H5 微应用（JSAPI + 免登）
tags: [uniapp, dingtalk, jsapi, auth]
status: verified
source: conversation:2026-08-24
created: 2026-08-24
updated: 2026-09-02
---

# uniapp 接入钉钉 H5 微应用（企业内部应用 / 老模型）

> 适用：uniapp / unibest 脚手架，做钉钉工作台内的 H5 微应用，需要 JSAPI 鉴权（扫一扫、选图片、选人、定位）+ 免登。
> 本文为可直接复用的落地指南，凭证信息用占位/示例，真实密钥只在服务端。

## 0. 技术选型：uniapp 还是纯 H5 脚手架

> 结论先行：**只做钉钉 H5 微应用 → 纯 H5（Vue3 + Vite + Vant）；还要发小程序 / App → uniapp。**

| 维度 | 纯 H5 脚手架 | uniapp（编译到 H5） |
|---|---|---|
| 钉钉官方适配 | 官方 CLI `ding init`（DingTalk Design CLI）直接支持 H5 微应用，本地模拟 + 真机远程调试开箱可用 | 官方适配的是**钉钉小程序**（mp-dingtalk）；H5 微应用无专项适配，只是当普通 SPA 编译 |
| JSAPI / dd.config | 自己引 `dingtalk-jsapi`、自己签 | **同样**自己引、自己签，uniapp 不代劳 |
| 额外坑 | 少 | `dd is not defined`（引入时机）、hash 路由 + `publicPath/router.base` 白屏、H5 产物体积偏大、条件编译分散逻辑 |
| 跨端收益 | 无 | 需同时发微信/支付宝小程序或 App 才兑现 |
| 移动端 + PC 双端 | 同，但多一层平台抽象 | 同，但多一层平台抽象（PC 后台重度能力缺失，见 §0.1） |

判定规则（二选一，别纠结）：
- 只进钉钉工作台（移动 + PC）→ 纯 H5。`Vite + Vue3 + Vant`，移动端与 PC 用响应式布局，不开两个仓库。
- 同一套代码还要发微信小程序 / 支付宝 / App / 其他小程序 → uniapp，跨端收益 > 抽象税。
- 已有成熟 uniapp 资产要复用 → uniapp（复用 > 理论最优）。

纯 H5 起步（跑通鉴权约 1 天）：
1. `npm create vite@latest ding-h5 -- --template vue-ts` + `npm i vant dingtalk-jsapi`
2. `npm i -g dingtalk-design-cli && ding init`（本地 dev + `open-dev.dingtalk.com` 的 H5 远程调试）
3. 鉴权 / 免登按本文第 2、3 节流程走（签名必须服务端算，签名 url 取 `location.href.split('#')[0]`）

### 0.1 场景升级：PC 管理后台 + 钉钉 H5 移动端（同一套业务）

> 结论：**两个前端工程（或一个工程双入口）+ 一个共享层，后端一套。不要一套代码响应式，不要 uniapp。**

前提变化：移动端不再是"独立的轻量 H5"，而是"一个完整管理后台的移动端入口"。此时 PC 与移动端是两种形态——后台是虚拟滚动表格 / 复杂表单 / 多标签 / 权限路由 / Excel 导入导出；移动端是卡片流 / 待办 / 审批 / 扫码。响应式只能做到"手机上能点"，做不到"好用"。

三条硬事实：
1. **uniapp 做不了管理后台**：生态无 vxe-table 级数据表格、无成熟复杂表单与流程设计器；其 PC 宽屏适配（`rpxCalcMaxDeviceWidth` 等）本质是"让小程序在 PC 上不变形"，不是为后台设计。主流开源组合（RuoYi Office、Mars-Admin）一律是 `Spring Boot 3 + Vue3 Web 端 + UniApp 移动端`——**PC 端从不走 uniapp**。
2. **钉钉 H5 微应用后台天然给两个首页地址**（移动端首页 + PC 端首页），官方设计即允许两套页面。
3. 全网适配方案汇总把"双端组件拆分（`MobileLayout` / `PCLayout` 条件加载）"列为**差异极大项目的终极方案**——管理后台 + 移动端正属此类。

| 方案 | 结构 | 判定 |
|---|---|---|
| **A. 独立工程 + 共享包** | pnpm workspace：`apps/admin`（Element Plus + vxe-table）/ `apps/mobile`（Vant）/ `packages/shared`（api、TS 类型、字典枚举、权限码） | 移动端页面多、要独立发版、未来上小程序 → 选它（约 2–3 天搭骨架） |
| **B. 单工程双入口** | 现有工程内加 `mobile.html` + `src-mobile/`，Vite `rollupOptions.input` 多入口，两套 layout | 移动端只是待办 / 审批 / 扫码 / 少量填报 → 选它（约 1 天搭骨架） |
| C. 单工程响应式 | 一套页面 `@media` 适配 | **仅**移动端纯只读查看时可用；管理后台绝大多数功能不适用 |
| D. uniapp 一套 | | 否 |

落地要点（B 方案，Vue3 + Vite + Element Plus 现有工程）：
1. `build.rollupOptions.input = { main: 'index.html', mobile: 'mobile.html' }`，移动端入口指向 `src-mobile/main.ts`。
2. **共享**：`src/api/*`、TS 接口类型、字典枚举、权限码常量、`utils`。**不共享**：组件、路由、UI 库。
3. 移动端装 `vant` + `dingtalk-jsapi`；`postcss-px-to-viewport` 用 `include` 限定 `src-mobile/`，避免把 PC 的 px 一起转。
4. 钉钉后台：移动端首页地址 `https://<host>/mobile.html#/`，PC 端首页地址 `https://<host>/`。
5. 鉴权代码只放 `src-mobile/utils/dingtalk/`（见 §11 抽离模式），不污染 PC 构建图。

四个必踩的坑：
1. **UnoCSS / Tailwind reset 会打爆 Vant**：`@unocss/reset`（尤其 tailwind 预检）重置 button/input 默认样式，Element Plus 上已有同样已知冲突。移动端入口要么不引 reset，要么引完做 Vant 补正。
2. **Element Plus 与 Vant 不可进同一 bundle**：必须分入口，否则 tree-shaking 失效、体积翻倍。
3. **钉钉 PC 客户端内核偏老**：PC 入口 `build.target` 降到 `es2015`，browserslist 补 `chrome >= 80`，否则 PC 钉钉白屏。
4. **菜单 / 权限必须同源**：权限码常量放共享层，双端各写一份必然漂移。

工时参考：B 骨架约 1 天（半天 Vite 多入口 + 半天鉴权/免登），A 约 2–3 天；之后每个移动端页面约为同功能 PC 页的 1/3 工时（API 与类型已共享）。

## 1. 需要的凭证

| 凭证 | 说明 | 前端/后端 |
|------|------|-----------|
| corpId（企业ID） | 开放平台首页企业信息 | 前端 dd.config / requestAuthCode |
| agentId（原企业内部应用AgentId） | 应用详情 | 前端 dd.config |
| AppKey（Client ID） | 凭证与基础信息 | 后端 gettoken |
| AppSecret（Client Secret） | 凭证与基础信息（只在后端） | 后端签名 / 换 token |

注意：钉钉后台同时给了一个 UUID 形式的 `App ID` 和 `Client ID/Secret`，那是**新应用模型**标识，新模型走 `api.dingtalk.com/v1.0/oauth2/accessToken`。本文走**老企业内部应用模型**（有 agentId + AppKey/AppSecret），与 `dingtalk-jsapi` 官方示例一致，忽略 UUID。

## 2. 老模型核心流程

```
前端 requestAuthCode({corpId})  ──code──▶  后端
                                        │
                          gettoken(appkey,appsecret) → access_token
                          get_jsapi_ticket(access_token) → ticket
                          SHA1(jsapi_ticket,noncestr,timestamp,url) → signature
                                        │
              前端 dd.config({agentId,corpId,timeStamp,nonceStr,signature,jsApiList})
                                        │
              前端调用 scan / chooseImage / contact / geolocation 等 JSAPI
              前端 requestAuthCode 拿 code → 后端 topapi/v2/user/getuserinfo 换 userid
```

关键事实：
- `requestAuthCode`（免登）**不需要** dd.config；但 scan/chooseImage/contact/geolocation 等**必须**先 dd.config。
- dd.config 的 `signature` 必须用 `jsapi_ticket` 在服务端用 AppSecret 算，**前端算不了**。
- 签名用的 `url` 是当前页面完整 URL（去掉 `#hash`），前端传给后端，前后端必须一致，否则报"签名错误"。
- `timeStamp` 是秒级时间戳（10 位），dd.config 与签名用同一个。

## 3. 前端集成（unibest 实操）

### 3.1 env 变量（VITE_ 前缀）
```
VITE_DING_CORP_ID = 'dingxxxx'
VITE_DING_AGENT_ID = '4892215388'
VITE_DING_JSAPI_SIGN_API = '/api/ding/jsapi-sign'   # 生产相对路径
VITE_DING_LOGIN_API = '/api/ding/login'
```
开发期若用独立示例后端，可把两个 API 写成绝对地址 `http://localhost:3001/api/ding/...`（示例后端已开 CORS）。

### 3.2 ding.ts 关键函数
- `isDingTalk()`：是否在钉钉容器（getENV 判断）。
- `getAuthCode()`：调 `dd.runtime.permission.requestAuthCode({corpId})` 拿免登 code。
- `fetchDingSign()`：把 `location.href.split('#')[0]` 发给后端签名接口，返回 `{timeStamp,nonceStr,signature}`。
- `setupDingConfig(agentId, sign)`：调 `dd.config(...)` + `dd.ready/dd.error`，jsApiList 含 scan/chooseImage/contact/geolocation 等。
- `bootstrapDing()`：isDingTalk 时 fetchDingSign → setupDingConfig，失败不阻塞。

### 3.3 App.vue onLaunch 引导鉴权
```ts
onLaunch(async (options) => {
  // #ifdef H5
  if (isDingTalk()) {
    try { await bootstrapDing() } catch (e) { console.error('钉钉鉴权失败:', e) }
  }
  // #endif
})
```
注意：`dd.config` 必须在任何需鉴权 JSAPI 调用前完成；`ensureDing()`（等 `dd.ready`）已封装在 scan/选图等函数内，含 3s 超时兜底。

### 3.4 免登接入登录态（tokenStore）
- `src/api/login.ts` 增加 `dingLogin({code})` → `POST /auth/dingLogin`。
- `src/store/token.ts` 增加 `dingLogin()`：先 `getAuthCode()` 拿 code → `_dingLogin({code})` → `_postLogin(res)`。
- 登录页/工作台进入时（isDingTalk 且未登录）调用 `tokenStore.dingLogin()` 即可自动免登。
- 实战：在 `src/pages/auth/login.vue` 的 `onLoad` 里判断 `isDingTalk() && !tokenStore.hasLogin` 自动 `doDingLogin()`；模板另加「钉钉免登」按钮（`v-if="isDingTalk()"`）供手动触发。注意 `onLoad` 执行前 App.vue 的 `bootstrapDing()` 应已完成 `dd.config`，`dingLogin` 内部 `getAuthCode` 会经 `ensureDing()` 等 `dd.ready`。

## 4. 后端示例（Node 零依赖，server/ding-server-example.mjs）

两个端点：
- `GET /api/ding/jsapi-sign?url=`：gettoken → get_jsapi_ticket（带缓存）→ SHA1 拼接签名返回。
- `POST /api/ding/login`：body `{code}` → gettoken → `topapi/v2/user/getuserinfo` 换 `userid`；真实项目在此用 userid 查/建自家用户并签发登录态。

运行（Node >= 20.6，用 `--env-file` 读密钥）：
```
node --env-file=server/ding-server.env server/ding-server-example.mjs
```
密钥放 `server/ding-server.env`（`DING_CORP_ID/DING_AGENT_ID/DING_APP_KEY/DING_APP_SECRET`），该文件被 `server/.gitignore` 排除（`*.env`），**真实 AppSecret 不会进 git**。实战已验证：用真实 AppSecret 起服务后，`GET /api/ding/jsapi-sign?url=...` 正常返回 `timeStamp/nonceStr/signature`，说明 gettoken→get_jsapi_ticket→SHA1 链路通。

签名算法（服务端）：
```js
const raw = `jsapi_ticket=${ticket}&noncestr=${noncestr}&timestamp=${timestamp}&url=${pageUrl}`
const signature = crypto.createHash('sha1').update(raw).digest('hex')
```

## 5. 开发调试 & 部署

- 本地调试：`npx ding dev web`（依赖 `ding.config.json`），钉钉模拟器(10003/10005)加载 dev server；vite 已 `cors: {origin:'*'}` 放行。
- 开发期 `/api` 会被 vite 代理剥离前缀，且代理会抢占主后端流量；钉钉接口建议直接指向示例后端绝对地址（CORS 已开），主后端走各自配置。
- 部署：`pnpm build:h5` → 把产物 URL 填到钉钉「应用首页地址」；生产 `VITE_DING_*` 用相对路径，由真实后端提供 `/api/ding/*`。

## 6. 常见坑

1. 报"没有权限/未鉴权" → 调 scan/选图/选人前没做 dd.config。
2. 报"签名错误/invalid signature" → 前后端 url 不一致（是否含 #hash、是否编码）、ticket 过期、timestamp 单位不对。
3. AppSecret 只在后台「凭证与基础信息」查看时显示一次，务必保存完整值（不是 `****` 打码版）。落盘时放 `server/ding-server.env` 并用 `server/.gitignore` 排除 `*.env`，避免提交泄露。
4. 新模型（UUID App ID + Client ID/Secret）接口与老模型不通用，别混用。
5. 启动多实例会 `EADDRINUSE: :::3001`（端口被占用）——先 `Stop-Process -Name node` 清理残留再起。
6. union API（chooseImage/chooseMedia/previewMedia）**需要** dd.config（不像 requestAuthCode 免登），且 `jsApiList` 里必须填去前缀名（`chooseImage` 而非 `union.chooseImage`），否则鉴权不过。
7. `IUnion*` 系列类型从 `dingtalk-jsapi/api/union/<name>` 子路径导入，包入口（`export = dd`）不导出。

## 7. 媒体选择与预览（union API：chooseImage / chooseMedia / previewMedia）

> 场景：钉钉 H5 里选图片 / 选视频（相册或录制），再预览播放。用 union 系列（挂在 `dd` 根上，返回 Promise），不要用老 `biz.util.*` 回调版。

### 7.1 调用签名（dingtalk-jsapi v1.x）

| API | 入参要点 | 返回 |
|---|---|---|
| `dd.chooseImage({ count, sourceType })` | count≤9；`sourceType: ['album','camera']` | `{ files: [{ path, size, fileType }] }` |
| `dd.chooseMedia({ count, camera, sizeType, mediaType, sourceType, maxDuration })` | 选视频 `mediaType:'video'`；`sizeType:'compressed'`（string，不是数组） | `{ tempFiles: [{ tempFilePath, size, width, height, duration, fileType }] }` |
| `dd.previewMedia({ current, sources:[{url,type,poster?}], showmenu })` | `sources.type` 取 `'image'\|'video'`，可混合 | `{}`（钉钉原生图片预览/视频播放器） |

- chooseImage / chooseMedia 返回本地临时路径，可直接喂给 `<image>` / `<video>` 组件。
- previewMedia 的 `sources` 可混合图片与视频，`current` 指定起始项，实现"多图多视频画廊播放"。

### 7.2 与 dd.config 的配合
- union API 的 `jsApiList` 项必须**去掉 `union.` 前缀**（对照包内 `constant/apiMapping.d.ts`）。
- 实操：`apis` 列表每项加 `jsName` 字段，`jsApiList: apis.map(i => i.jsName ?? i.name)`。

### 7.3 浏览器回退（H5 调试）
钉钉容器判定 `dd.env.platform !== 'notInDingTalk'`；非钉钉时回退 uni API，普通浏览器即可调试同一页面：
- chooseImage → `uni.chooseImage({ count })`（返回 `tempFilePaths`）
- chooseMedia → `uni.chooseVideo({ sourceType, maxDuration })`（返回 `tempFilePath`）
- 图片预览 → `uni.previewImage`；视频用页面内 `<video controls>` 播本地路径（无需全屏 API）

### 7.4 类型导入坑
包入口 `export = dd`，**不导出** `IUnion*Result` 等类型，需子路径导入：
```ts
import type { IUnionChooseImageResult } from 'dingtalk-jsapi/api/union/chooseImage'
import type { IUnionChooseMediaResult } from 'dingtalk-jsapi/api/union/chooseMedia'
```

## 8. 后台接口权限申请（两层鉴权）

> 调用 JSAPI 报"没有权限/未鉴权"要分两层排查，不要只盯 dd.config。

1. **应用层（开发者后台开通）**：应用需在「开发者后台 → 应用 → 权限管理 → 接口权限(JSAPI)」勾选/申请对应接口。常见要求：
   - 基础能力（toast/alert/confirm/openLink/setTitle/chooseDateTime/chooseImage/chooseMedia/previewMedia 等媒体与 UI）：企业内部应用大多默认可用，仍建议后台确认已勾选。
   - 通讯录类（complexPicker / biz.contact.choose）：需"通讯录读权限"，必须申请。
   - 定位（getGeolocation）：需"获取地理位置"权限，需申请。
   - 免登（requestAuthCode）：企业内部应用默认开通，无需单独申请。
2. **调用层（dd.config 的 jsApiList 声明）**：见第 2、7 节——未声明会报"没有权限"；union 系列填去前缀名。

排查顺序：后台权限已开通 → jsApiList 已声明正确名称 → 后端签名（timeStamp/nonceStr/signature）正确（见 ERR-20260826-001）。注意 errorCode 9「无效的随机字符串参数」是**签名**问题不是权限问题，别误判成权限未开。

## 9. 本地联调注意（最易踩的运行期坑）
- **签名服务必须常驻**：前端 `ensureConfig` 每次调用需鉴权 JSAPI 前都要 `fetch(/api/ding/jsapi-sign)`，服务没起就报网络错/errorCode 9。启动命令 `node --env-file=server/ding-server.env server/ding-server-example.mjs`（监听 :3001）。别把它和 `pnpm dev`（前端）混淆——两者是两个独立进程。
- **容器内 localhost ≠ 开发机**：`VITE_DING_JSAPI_SIGN_API=http://localhost:3001/...` 仅在「开发者电脑 + 钉钉 PC 客户端打开本地 H5 微应用」成立。手机/钉钉真机容器内 `localhost` 指向设备自身，访问不到开发机服务 → 改成开发机局域网 IP（如 `http://192.168.x.x:3001`）或内网穿透（ngrok/frpc）。
- **签名 url 一致性**：`dd.config` 签名用的 url 必须等于当前页面地址（去 `#`hash）。前端用 `location.href.split('#')[0]` 传给服务即可，勿硬编码固定 url。
```

## 10. 移动端 vs PC 端：dd.config 鉴权链路差异（真机报「agentId 不能为空」排查）

> 场景：PC 钉钉 dd.config 正常，手机钉钉（从工作台微应用入口打开、URL 带 corpid）报「agentId 不能为空」，且前端参数里 agentId 有值、签名接口实测返回正常。说明错误来自原生/服务端侧校验，不是前端参数真为空。

### 10.1 机制差异（dingtalk-jsapi 3.2.9 源码结论）

| | PC 端 | 移动端（Android/iOS） |
|---|---|---|
| authMethod | `config` | `runtime.permission.requestJsApis` |
| 桥 | top window 消息（h5Pc） | nuva（Android）/ WebViewJavascriptBridge（iOS） |
| url 字段 | SDK 自动附加 `url=location.href.split('#')[0]` 传给容器校验 | 不传 url，原生侧用容器当前 URL 参与校验 |
| 新版容器 | — | 可能注入 `window.__useNativeSDK=true` + `window.__ddSDK`，此时 `dd.config` 走的是原生实现而非 npm 包逻辑 |

推论：PC 端鉴权完全由「传入参数」驱动（url 也是显式传入，所以宽松）；移动端鉴权由「原生容器上下文 + 容器侧 URL」参与，对签名 URL 一致性和容器上下文更敏感——同一份代码 PC 成功不代表移动端链路一致。

### 10.2 三个确定性代码坑（逐个排查）

1. **后端返回空串覆盖前端默认值**：`if (data.agentId != null) dingConfig.agentId = data.agentId` —— 后端漏配时返回 `agentId: ''`，空串照样覆盖本地默认值 → 传给钉钉的真的是空。corpId/agentId 都要用 truthy 判断（`if (data.agentId)`）。
2. **dd.config 一次性（hadConfig 保护）**：同一页面生命周期内第二次 `dd.config` 被静默忽略，**复用第一次的参数与结果**。失败后无论重试多少次、重新拉多少次签名，收到的永远是第一次的旧错误；改完任何配置必须刷新页面。前端应维护 attempted 标记，重复触发时直接提示「请刷新页面后重试」。
3. **签名 URL 与移动端容器 URL 严格一致（含端口号，官方原话）**：hash 路由下 `location.href.split('#')[0]` 跨页面稳定；若仍失败，用页内诊断面板打出签名 URL 与手机容器实际 URL 逐一比对（含 query 参数顺序与编码）。

### 10.3 现场诊断清单（真机）

页内内置诊断面板，输出：UA、URL 中 corpid、dd.env、dd.version、`window.__useNativeSDK` / `window.__ddSDK` 注入状态、签名接口地址、签名 URL（去 hash）、timeStamp/nonceStr/signature 是否已填。配合钉钉官方 H5 远程调试工具（open-dev.dingtalk.com → api-tools → debug/h5，npm 包 dingtalk-h5-remote-debug）在真机实时看 Console 与 Network。dd.error 回调的完整 JSON（errorCode/errorMessage）是定位移动端鉴权失败的第一手证据，别只看弹窗文案。

## 11. 钉钉逻辑从 .vue 页面抽离到独立 .ts 模块（重构模式）

> 场景：demo 页面里钉钉鉴权/环境检测逻辑越堆越大（470+ 行），要抽成可复用模块（如 `src/utils/dingtalk/`：env.ts 环境检测 + config.ts 鉴权 + index.ts 出口），供正式业务页引用。

### 11.1 硬约束：条件编译引用链

- dingtalk-jsapi 及 window/navigator/location 等浏览器 API **只能在 H5 构建图内**；
- 抽出的 .ts 模块内部**无需**再写 `// #ifdef H5`（跟随引用方进入构建图），但**页面里的 import 必须包在 `// #ifdef H5` 块内**——非 H5 构建时 import 被条件编译删除，模块不会进产物；
- 模块文件头注释显式声明「仅限 H5 平台引用」，防止后续有人在非 H5 代码里误引；
- 先例：uniapp 项目 .ts 文件里 `// #ifdef` 条件编译是官方支持的（interceptor.ts / useEcharts.ts 等均有使用）。

### 11.2 抽离职责划分

| 模块 | 职责 | 关键导出 |
|---|---|---|
| env.ts | 纯环境检测（不持状态） | isInDingTalk / isPcPlatform / getCorpIdFromUrl / buildDingEnvDiagnostic(input) |
| config.ts | 鉴权状态机（模块级单例） | dingConfig / SIGN_API / loadSignature / ensureConfig(jsApiList) / isConfigured |
| 页面 | demo 交互与展示 | apis 注册表 + apiCallers 映射 + 响应式状态镜像 |

要点：
- **configured 状态单一事实源放 config.ts（模块级变量 + isConfigured() getter）**，页面 ref 只做展示镜像（doConfig 的 finally 里 `configured.value = isConfigured()`），避免两份状态漂移；
- 诊断函数设计成**纯函数** `buildDingEnvDiagnostic(input)`，input 接收页面状态快照（configured/corpId/agentId/signApi/signFilled），检测逻辑与响应式状态解耦；
- corpId/agentId 移入 `env/.env`（VITE_DING_CORP_ID / VITE_DING_AGENT_ID）+ env.d.ts 类型声明，页面不再硬编码；**前端 env 永不放 clientSecret**（原页面遗留的 oauth 死代码对象含 secret，直接删除）。

### 11.3 验证门禁（重构后必跑）

```bash
# 1. 严格模式 lint（antfu config 在编辑器环境会禁用部分规则，须 CI=true）
CI=true pnpm exec eslint src/utils/dingtalk/*.ts src/pages/dingtalk/dingtalk.vue
# 2. 类型检查（对比基线错误数，不新增即可）
pnpm type-check
# 3. H5 构建验证条件编译链（若项目有预存在构建失败，确认报错不在本次改动文件即可）
pnpm build:h5
```

坑：IDE 的 TS 语言服务对新建模块会误报「xxx 不是模块」（缓存未刷新），以命令行 `pnpm type-check` 结果为准。

