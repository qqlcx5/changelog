---
id: PB-20260904-001
type: playbook
title: 钉钉 H5 微应用官方工具链导航（ding CLI / dingtalk-jsapi / dingtalk-mcp）
tags: [dingtalk, cli, mcp, jsapi]
status: draft
source: web-collected:2026-09-04
created: 2026-09-04
updated: 2026-09-04
---

# 钉钉 H5 微应用官方工具链导航

## 结论先行

钉钉官方**不提供** AI coding skill（SKILL.md / Cursor Rules / Claude Skills 那种）。
官方交付的是三个独立工具，定位互不重叠：

| 工具 | 形态 | 覆盖范围 | 是否需要 |
|---|---|---|---|
| `dingtalk-design-cli` | 全局 CLI，命令 `ding` | 工程的 init / 开发调试 / 本地校验 / 构建预览 / 上传 | 建议装（真机调试 + 发布） |
| `dingtalk-jsapi` | npm 包 | 前端 JSAPI：鉴权、免登、扫码、定位等 | 必装 |
| `dingtalk-mcp` | MCP Server | **仅服务端 OpenAPI**：通讯录、日程、待办、机器人消息、日志 | 仅做服务端能力时配 |

> 常见误解：以为官方 MCP 能覆盖 H5 前端开发。不能。MCP 只封装 `api.dingtalk.com` 的服务端接口，
> 不含 `dd.*` 前端 JSAPI。前端仍走 `dingtalk-jsapi` + 后端签名。

## 1. DingTalk Design CLI

面向钉钉小程序、H5 微应用、工作台组件的官方研发命令行工具。

```bash
npm install dingtalk-design-cli -g     # 或 yarn global add dingtalk-design-cli
ding -v                                 # 验证安装
ding -h                                 # 查看全部子命令（子命令以 -h 输出为准，勿凭记忆）
npm update -g dingtalk-design-cli       # 升级
```

初始化（交互式：选应用类型 → 模板 → 语言）：

```bash
ding init -o mpTest
cd mpTest
ding dev
```

- Node 版本要求 ≥ 12.15.x。
- 已有自建脚手架（如纯 Vite 项目）时，**不需要** `ding init` 重建工程；
  装 CLI 主要是为了 `ding dev` 的真机联调与上传发布能力。
- 仓库：`github.com/open-dingtalk/dingtalk-design-cli`（MIT）。

## 2. dingtalk-jsapi（前端必装）

```bash
npm i dingtalk-jsapi
```

- 官方文档入口：JSAPI 鉴权 `developers.dingtalk.com/document/app/jsapi-authentication`
- 硬约束：`dd.config` 所有参数必须由服务端下发，**禁止前端硬编码**；SPA 每页只调一次 `dd.config`，重复调用复用首次参数。
- 免登模型分叉（易踩坑）：
  - 企业内部应用（有 agentId）→ `dd.getAuthCode` (V1) + `topapi/v2/user/getuserinfo`
  - 新模型应用 → `dd.getAuthCodeV2` + `v1.0/oauth2/userAccessToken`
  - 两者**不通用**，选错直接鉴权失败。
- corpId 应优先取钉钉注入到 URL 的 `?corpid=`，回退 env 配置，否则 `dd.config` / 免登报 errorCode 9。

## 3. 钉钉官方 MCP（服务端）

仓库 `github.com/open-dingtalk/dingtalk-mcp`。配置示例：

```json
{
  "mcpServers": {
    "dingtalk-mcp": {
      "command": "npx",
      "args": ["-y", "dingtalk-mcp@latest"],
      "env": {
        "DINGTALK_Client_ID": "<应用凭证与基础信息里的 Client ID>",
        "DINGTALK_Client_Secret": "<Client Secret>",
        "ACTIVE_PROFILES": "dingtalk-contacts,dingtalk-calendar"
      }
    }
  }
}
```

- 环境变量：`DINGTALK_Client_ID` / `DINGTALK_Client_Secret` / `ACTIVE_PROFILES`（逗号分隔，`ALL` 激活全部）/
  `ROBOT_CODE`（机器人消息）/ `ROBOT_ACCESS_TOKEN`（群自定义机器人）/ `DINGTALK_AGENT_ID`（工作通知）。
- Profiles：`dingtalk-contacts`(默认)、`dingtalk-robot-send-message`(默认)、`dingtalk-department`、
  `dingtalk-honor`、`dingtalk-tasks`、`dingtalk-calendar`、`dingtalk-checkin`、`dingtalk-notice`、
  `dingtalk-app-manage`、`dingtalk-service-window`、`dingtalk-teambition`、`dingtalk-report`。
- 每个 profile 对应独立权限点，需在开放平台「添加权限」里逐个开通，否则调用报无权限。
- 文档：`open.dingtalk.com/document/ai-dev/dingtalk-server-api-mcp-overview`

## 4. 官方文档站取文技巧

`open.dingtalk.com` 是 SPA（React + render-engine），`web_fetch` / curl 只能拿到空壳 HTML，
正文需浏览器打开或走 SSR 镜像。可用替代源：

- API 镜像站：`dingtalk.apifox.cn`（文档正文可抓取）
- 老域名：`developers.dingtalk.com/document/...`（与 open.dingtalk.com 同构，部分页面可索引）
- 官方仓库 README：GitHub raw 抓取最稳

## 5. 端到端最小链路（企业内部 H5 微应用）

1. 开放平台创建企业内部应用，拿 Client ID / Secret / AgentId，配置首页地址与安全域名
2. 前端装 `dingtalk-jsapi`，封装环境判断 → 加载 SDK → `dd.config`（签名来自后端）→ `dd.ready`
3. 免登：`getAuthCode` → 后端换 userid → 后端签发自有 token → 前端落库
4. 装 `ding`，`ding dev` 真机联调
5. 需要通讯录/日程/待办等服务端能力时，才加 MCP

## See Also

- PB-20260824-001 uniapp 接入钉钉 H5 微应用（JSAPI + 免登）
- PB-20260902-003 Vite + Vue3 + Vant 接入钉钉 H5 微应用（hybrid 模型）
- PB-20260902-001 钉钉多端 H5 视口适配
- PB-20260902-002 钉钉多端 H5 表格组件选型
