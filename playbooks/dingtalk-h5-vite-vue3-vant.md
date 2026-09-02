---
id: PB-20260902-003
type: playbook
title: Vite + Vue3 + Vant 接入钉钉 H5 微应用（hybrid 模型：签名 v1.0 + 免登 topapi/v2 + mock 层服务端签名）
tags: [dingtalk, vite, vue3, jsapi, mock]
status: verified
source: conversation:2026-09-02
created: 2026-09-02
updated: 2026-09-02
---

# Vite + Vue3 + Vant 接入钉钉 H5 微应用（hybrid 模型）

> 适用：纯 H5 脚手架（Vite + Vue3 + TS + Vant）做钉钉工作台内的 H5 微应用，需要 JSAPI 鉴权 + 免登。
> 与 [PB-20260824-001](dingtalk-h5-microapp.md)（uniapp + 老模型）互补：本文签名服务直接落在 `vite-plugin-mock-dev-server` 的 mock 层，前端无需另起 Node 后端进程即可联调。
> **关键修正（2026-09-02）**：本文采用 **hybrid 模型**——签名走统一 OpenAPI（`api.dingtalk.com/v1.0`，应用维度 ticket 无需 corpId），免登走老模型（`oapi.dingtalk.com/topapi/v2/user/getuserinfo` + `topapi/v2/user/get`）。这是企业内部应用（有 agentId）在钉钉里能真实跑通免登的链路，已对照 reference/ding-uniapp 验证。
> 实战已验证：`accessToken → jsapiTickets → SHA1 签名` 链路返回真实签名（`mocked:false`）；免登接口到达钉钉并返回「不合法的临时授权码」（说明链路通，仅 code 是假的，浏览器里无法拿到真 authCode）。

## 1. 依赖

```bash
pnpm add dingtalk-jsapi      # 当前 3.2.9
```

`dingtalk-jsapi` 是 `export =` 的 CJS 包，TS 下取整体类型的写法：

```ts
export type DingTalkSDK = typeof import('dingtalk-jsapi')
// 动态 import 时 CJS 会被包一层 default
const mod = await import('dingtalk-jsapi')
const dd = (mod as unknown as { default?: DingTalkSDK }).default ?? mod
```

用动态 import 而非顶层 import：SDK 只在钉钉场景下需要，避免进主包；同时浏览器调试时不会因 SDK 初始化失败炸页面。

## 2. 凭证切分（安全红线）

| 变量 | 位置 | 说明 |
|---|---|---|
| `VITE_DING_CORP_ID` | `.env` / `.env.development` / `.env.production` | 会进前端产物，只放非敏感项 |
| `VITE_DING_AGENT_ID` | 同上 | 同上 |
| `VITE_DING_CLIENT_ID` | 同上 | 即 AppKey，非敏感 |
| `DINGTALK_CLIENT_SECRET` | **`.env.local`（无 VITE_ 前缀）** | 服务端密钥，**永不进前端** |

`.env.local` 必须被 gitignore 排除（多数脚手架的 `*.local` 已覆盖，用 `git check-ignore -v .env.local` 确认）。同时提交一份 `.env.local.example`（空值）给后续接手的人。

mock 层（Node 端）读取服务端变量的写法：

```ts
import process from 'node:process'
import { loadEnv } from 'vite'

// loadEnv 第三参传空串 = 读取所有变量，不再只过滤 VITE_ 前缀
const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
export const DINGTALK_CLIENT_SECRET = process.env.DINGTALK_CLIENT_SECRET || env.DINGTALK_CLIENT_SECRET || ''
```

`import process from 'node:process'` 是必须的——antfu eslint 的 `node/prefer-global/process` 规则会报「Unexpected use of the global variable 'process'」。

## 3. hybrid 链路（签名 v1.0 + 免登 topapi/v2，已实测）

```
1) POST https://api.dingtalk.com/v1.0/oauth2/accessToken
   body: { appKey: clientId, appSecret: clientSecret }
   → { accessToken, expireIn: 7200 }                 ← 应用级 token，缓存

2) POST https://api.dingtalk.com/v1.0/oauth2/jsapiTickets
   header: x-acs-dingtalk-access-token: <accessToken>
   → { jsapiTicket, expireIn: 7200 }                 ← 缓存，应用维度无需 corpId

3) 本地签名（前端给 url，后端 sha1）
   raw = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timeStamp}&url=${url}`
   signature = sha1(raw)

4) 免登（老模型 topapi/v2，企业内部应用 + agentId 标准链路）：
   POST https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=<应用级accessToken>
   body: { code: authCode }                           ← V1 的临时授权码
   → { errcode:0, result: { userid } }
   POST https://oapi.dingtalk.com/topapi/v2/user/get?access_token=<应用级accessToken>
   body: { userid }
   → { errcode:0, result: { name, mobile, avatar, dept_id_list } }
```

要点：
- **签名与免登用两套域名**：签名用统一 OpenAPI（`api.dingtalk.com/v1.0`，应用维度 ticket 不需要钉钉注入 corpId）；免登用老 `oapi.dingtalk.com/topapi/v2`，拿的是「应用级 accessToken（第1步那个）」，不是用户 token。
- 老 `topapi/v2/user/getuserinfo` 把 V1 临时授权码换成 `userid`，再用 `topapi/v2/user/get` 换详情。这两个接口都用**同一个应用级 accessToken**（免登免用户 token）。
- token / ticket 都缓存 7200s，本地缓存提前 60s 过期，避免临界失效。

### 3.1 免登授权码：两个版本，别用错（最容易踩的坑）

`dingtalk-jsapi` 里有三个长得几乎一样的免登 API，**映射到的 JSAPI 版本不同，配的后端接口也不同**：

| union 调用 | 实际 JSAPI | 参数 | 返回 | 配哪个后端接口 | 客户端要求 |
|---|---|---|---|---|---|
| `dd.getAuthCode` | `runtime.permission.requestAuthCode`（V1） | `{ corpId }` | `{ authCode }` | **老模型 `topapi/v2/user/getuserinfo`** | 6.0.0+ |
| `dd.getAuthCodeV2` | `runtime.permission.requestAuthCodeV2` | `{ corpId, clientId }` | `{ code }` | 新模型 `v1.0/oauth2/userAccessToken` | 7.0.45+ |
| `dd.requestAuthCode` | `runtime.permission.requestAuthCodeV2` | `{ corpId, clientId }` | `{ code }` | 同上（与 getAuthCodeV2 完全等价） | 同上 |

证据（`node_modules/dingtalk-jsapi/api/union/*.js`，一行代码）：

```
apiName="getAuthCode"     ,actualCallApiName="runtime.permission.requestAuthCode"
apiName="getAuthCodeV2"   ,actualCallApiName="runtime.permission.requestAuthCodeV2"
apiName="requestAuthCode" ,actualCallApiName="runtime.permission.requestAuthCodeV2"
```

判定方法：**企业内部应用（有 agentId）走 V1 免登**——`dd.getAuthCode({ corpId })` 拿 `{ authCode }`，后端调 `topapi/v2/user/getuserinfo`。把 V1 的 authCode 喂给 `v1.0/oauth2/userAccessToken` 会报「不合法的临时授权码」，极易误判成后端或签名问题。新模型（clientId/clientSecret + 无 agentId 的第三方应用）才用 V2 + `userAccessToken`。

免登授权码**免鉴权**，`api/runtime/permission/requestAuthCode.d.ts` 里写着「调用此api不需要进行鉴权（即不需要进行dd.config）」。放进 `jsApiList` 不报错也无副作用，主要是让 `dd.checkJsApi` 能查到可用状态。

### 3.2 corpId 从 URL 注入取（避免 errorCode 9）

钉钉打开 H5 微应用时会在 URL 注入 `?corpid=<真实企业corpId>`。免登和 `dd.config` 的 corpId **优先用这个注入值**，不要只用静态 env 里配的 corpId，否则在移动端会报 `errorCode 9`（签名企业不匹配）。

```ts
export function getCorpIdFromUrl(): string {
  const m = location.search.match(/[?&]corpid=([^&]+)/i)
  return m ? decodeURIComponent(m[1]) : ''
}
export function resolveCorpId(): string {
  return getCorpIdFromUrl() || DINGTALK_CORP_ID
}
```

## 4. 目录结构（可直接照搬）

```
mock/dingtalk-env.ts              # Node 端读服务端密钥
mock/modules/dingtalk.mock.ts     # /api/dingtalk/jsapi-signature、/api/dingtalk/login
src/config/dingtalk.ts            # corpId / agentId / clientId + jsApiList 常量
src/api/dingtalk.ts               # 两个请求函数 + 类型
src/utils/dingtalk.ts             # SDK 加载 / 环境检测 / 鉴权 / 免登
src/pages/dingtalk/index.vue      # 调试 Demo 页
```

`vite-plugin-mock-dev-server` 默认扫描 `mock/**/*.mock.{ts,js,...}`，所以 `dingtalk-env.ts` 不会被当成 mock 文件注册，命名安全。

## 5. 前端封装要点

```ts
// 鉴权：单例 + 失败可重试
export function authDingTalk(): Promise<{ authed: boolean, signature: JsapiSignature | null }> {
  if (!isInDingTalk()) return Promise.resolve({ authed: false, signature: null })
  if (authPromise) return authPromise
  authPromise = (async () => {
    const dd = await loadDingTalkSDK()
    const url = location.href.split('#')[0]      // 签名 url 必须去 hash
    const signature = (await fetchJsapiSignature(url)).data
    dd.config({
      agentId: signature.agentId || DINGTALK_AGENT_ID,   // 用 truthy 兜底，防后端返回空串覆盖
      corpId: signature.corpId || resolveCorpId(),      // 优先 URL 注入的真实 corpId，避免 errorCode 9
      timeStamp: signature.timeStamp,
      nonceStr: signature.nonceStr,
      signature: signature.signature,
      type: 0,
      jsApiList: DINGTALK_JS_API_LIST,
    })
    await new Promise<void>((resolve, reject) => {
      dd.ready(() => resolve())
      dd.error((err: unknown) => reject(new Error(formatDingTalkError(err))))
    })
    return { authed: true, signature }
  })().catch((e) => { authPromise = null; throw e })   // 失败清空，允许下次重试
  return authPromise
}
```

- `isInDingTalk()` 用同步 UA 判断（`/DingTalk/i.test(navigator.userAgent)`），SDK 未加载时也可用。
- `jsApiList` 里填**完整 API 名**（如 `device.geolocation.get`），而非调用链上的缩写。
- 免登 `dd.getAuthCode({ corpId })` 不需要先 dd.config，但 scan / contact / geolocation 等必须先鉴权。

## 6. 调试 Demo 页：浏览器降级

关键设计：不在钉钉容器内时，每个 JSAPI 演示按钮**返回预置模拟数据**而不是抛错。这样普通浏览器就能把交互、日志面板、参数拼装全部跑通，只有真机才切真实能力。

```ts
function invoke(action: DemoAction) {
  if (!inDingTalk) return Promise.resolve(action.mock)
  return action.run()
}
```

页面同时展示：`dd.env`（platform / platformSub / version / appType）、corpId/agentId/clientId、签名参数（带「真实签名 / 模拟签名」tag）、用户信息（带「模拟数据」tag）、调用日志（成功/失败 + 耗时 + JSON）。

## 7. 联调与验证

```bash
npx vue-tsc --noEmit                                  # 类型检查
npx eslint src mock                                    # lint
npx vite --port 5193                                   # 起服务
curl "http://localhost:5193/api/dingtalk/jsapi-signature?url=http%3A%2F%2Flocalhost%3A5193%2Fdingtalk"
# → {"code":0,...,"data":{...,"mocked":false}}         mocked:false 说明拿到的是真实钉钉签名
```

- 真机调试需要先让页面公网可达（内网穿透 / ngrok），钉钉容器内访问不到开发机 `localhost`。
- 免登在浏览器里必然失败（拿不到真实 authCode），靠 `DINGTALK_MOCK_FALLBACK=true` 降级返回模拟用户，保证链路可测。

## 8. 坑点

1. **密钥泄漏**：`VITE_` 前缀的变量会被打进产物。clientSecret 只能放 `.env.local` 且不带前缀，由 mock 层 / 真实后端读取。
2. **`process` 全局**：mock 层里写 `process.env.X` 会触发 eslint `node/prefer-global/process`，改 `import process from 'node:process'`。
3. **签名 url 不一致**：必须 `location.href.split('#')[0]`，前后端取同一个值；套件还要求含端口号一致。
4. **`dd.config` 一次性**：同一页面生命周期内第二次调用被静默忽略，改完配置必须刷新页面重试。
5. **后端空串覆盖**：`signature.agentId || DINGTALK_AGENT_ID` 用 truthy 兜底，否则后端漏配时传给钉钉的是空字符串。
6. **Vant `van-tag` 没有 `size="mini"`**：Tag 只有 `large | medium`，写 `mini` 会类型报错；`van-button` 才有 mini。
7. **后台 JSAPI 权限**：通讯录（contact.choose）、定位（geolocation.get）需单独申请权限，免登默认开通。报 errorCode 9 是签名问题，不是权限问题。
8. **免登「不合法的临时授权码」先查版本**：企业内部应用（有 agentId）必须 `dd.getAuthCode({ corpId })`（V1）拿 `{ authCode }`，后端走 `topapi/v2/user/getuserinfo`；一旦误用 `dd.getAuthCodeV2`（V2）拿 `{ code }` 去喂老模型接口就报这个错。看起来像后端问题，实则是 V1/V2 错配。对照第 3.1 节的表。

See Also: PB-20260824-001
