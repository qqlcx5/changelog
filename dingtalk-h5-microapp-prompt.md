# uniapp 接入钉钉 H5 微应用（企业内部应用 / 老模型）

> 适用：uniapp / unibest 脚手架，做钉钉工作台内的 H5 微应用，需要 JSAPI 鉴权（扫一扫、选图片、选人、定位）+ 免登。
> 本文为可直接复用的落地指南，凭证信息用占位/示例，真实密钥只在服务端。

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
