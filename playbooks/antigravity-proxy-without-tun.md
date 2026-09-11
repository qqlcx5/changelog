---
id: PB-20260908-002
type: playbook
title: Antigravity 免 TUN 模式代理（Windows DLL 注入 + macOS 扩展）
tags: [antigravity, proxy, no-tun, windows]
status: draft
source: web-collected:2026-09-08
created: 2026-09-08
updated: 2026-09-08
---

# Antigravity 免 TUN 模式代理

## 背景：为什么 `http.proxy` 不够用

Antigravity 是 VS Code 分支，但它的网络栈分三类，普通 VS Code 代理配置只能覆盖第一类：

| 请求类型 | 走的接口 | VS Code `http.proxy` 能否覆盖 |
|---|---|---|
| 大部分连接 | Winsock（`connect` / `ConnectEx`） | ❌ 不读 `http.proxy` |
| language server（Go 写，用 Go 原生 DNS） | 直连，绕过系统代理 | ❌ 完全绕过 |
| 部分认证 / OAuth / 系统请求 | WinINet（Windows 系统代理） | ✅ 由系统代理接管 |

结论：settings.json 里配 `http.proxy` 只能解决一部分，表现是「models 列表加载不出来、登录跳转失败、自动更新失败」。要么开 TUN（全局接管、需管理员），要么做**进程级强制代理**。

## 方案一（Windows，推荐）：antigravity-proxy DLL 注入

仓库：<https://github.com/yuaotian/antigravity-proxy>（BSD-2，4k star）。原理：`version.dll` 劫持 + MinHook 拦截 `connect` / `getaddrinfo` / `WSAConnect` / `ConnectEx` / `CreateProcessW`，把指定进程的 TCP 连接重定向到 SOCKS5/HTTP 代理，并自动注入子进程。不接管全局流量，不需要管理员权限。

### 步骤

1. 确认本地代理端口（关键，配错会静默失败）

   ```powershell
   Test-NetConnection -ComputerName 127.0.0.1 -Port 7890   # Clash 混合端口
   Test-NetConnection -ComputerName 127.0.0.1 -Port 10808  # v2rayN SOCKS5
   ```

   端口速查：Clash / Clash Verge / Mihomo → 混合 7890、SOCKS5 7891、HTTP 7890；v2rayN → SOCKS5 10808、HTTP 10809。

2. 下载 Release 里 `antigravity-proxy-vX-ide-win-x64.zip`（桌面端用 `ide/`，CLI 用 `cli/`，**不要混拷**；桌面端不需要 `dbghelp.dll`），解压出 `version.dll` 和 `config.json`。

3. 改 `config.json`，只动这几项：

   ```json
   {
     "proxy": { "host": "127.0.0.1", "port": 7890, "type": "socks5" },
     "child_injection": true,
     "child_injection_mode": "filtered",
     "target_processes": [
       "agy.exe", "language_server.exe", "language_server_windows",
       "Antigravity.exe", "Antigravity IDE.exe", "node.exe"
     ],
     "proxy_rules": {
       "allowed_ports": [80, 443],
       "dns_mode": "proxy",
       "ipv6_mode": "proxy",
       "udp_mode": "auto"
     }
   }
   ```

   - `proxy.type=socks5` 优先；v2rayN 用 10808（10808 是 SOCKS5 入站，写成 `http` 会静默失败）。
   - `dns_mode` 只支持 `direct` / `proxy`，**不支持** `fake_ip`（填了会回退并打日志）。
   - Antigravity 2.0 改过进程名，旧版 config 迁移时必须保留上面的 `target_processes` 且 `child_injection=true`。

4. 复制到 Antigravity 主程序目录（与 `Antigravity.exe` 同级）：

   ```powershell
   cd "$env:LOCALAPPDATA\Programs\Antigravity"
   # 一般是 C:\Users\<用户名>\AppData\Local\Programs\Antigravity
   # 找不到就：右键图标 → 打开文件所在的位置
   ```

5. 代理客户端侧补一刀（**必做**，WinINet 流量 Hook 不到）：
   - 系统代理选「自动配置系统代理（普通模式）」，**不要用 PAC 模式**（PAC 不含 Google AI 域名）。
   - 路由规则加代理域名：`googleapis.com` / `googleusercontent.com` / `goog` / `google.com`；路由模式选「绕过大陆」而不是「全局」。

6. 启动 Antigravity，验证是否注入成功：

   ```powershell
   cd "$env:LOCALAPPDATA\Programs\Antigravity\logs"   # 或 $env:TEMP\antigravity-proxy-logs
   # 看到「已注入目标进程」「SOCKS5: 隧道建立成功」即生效；没有日志文件 = 注入失败
   ```

### 排错速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 启动报 `0xC0000142` / `0xC0000135` | 缺 VC++ 2015-2022 运行库或架构不匹配 | 装运行库；x86/x64 与主程序对齐；或 `.\build.ps1 -StaticRuntime` |
| 无 logs 文件 | DLL 未加载 / 放错目录 | 确认与 `Antigravity.exe` 同级，且 dll 与 config 同次构建 |
| 日志 `10061` / `10060` | 代理端口没监听 / 超时 | 核对 `proxy.port`，调大 `timeout.connect/send/recv` |
| 隧道成功但 AI 一直 loading | 路由模式不对或用了 PAC | 见步骤 5 |
| 日志大量「已阻止 UDP 连接」 | QUIC/HTTP3 被 `udp_mode=block` | 正常，会自动回退 TCP |
| `location is not supported for the API use` | **不是 DLL 问题，是出口 IP 问题** | 换住宅/普通 ISP 出口；同国家不同 ASN 结果不同 |
| 360 / 火绒环境下失效 | LSP 注入干扰 Hook | 加白名单；`netsh winsock show catalog` 查第三方 Provider |
| 更新后又不走代理 | 安装目录被更新清理 | 重新复制两个文件 |

### 通用化

同一套 `version.dll` 可以强制代理任何不走系统代理的 Windows 程序，改 `target_processes` 即可：Chrome 放 `C:\Program Files\Google\Chrome\Application\`，VS Code 放 `...\Microsoft VS Code\`。

## 方案二（macOS）：VS Code 扩展 / ProxyBridge

- VS Code 扩展：<https://github.com/raybz/Antigravity-Proxy> —— `Cmd+Shift+P` → `Extensions: Install from VSIX...`，命令面板「⚙️ 打开配置页面」填代理（默认 `127.0.0.1:10808`，Clash 改 7890）→「🚀 启动代理」。内部做 `/etc/hosts` 写入 + SNI 中继 + `DYLD_INSERT_LIBRARIES` 注入 + 重签名。settings：`antigravity-proxy.proxyHost/proxyPort/proxyType/antigravityAppPath/autoStart`。
  - 坑：Antigravity 更新会覆盖签名 → 执行「🔑 强制重签名」。
- 通用进程代理：<https://github.com/InterceptSuite/ProxyBridge>（按进程名走代理）。

## 方案三（WSL）

`version.dll` 对 WSL 无效（WSL2 是真 Linux 内核，不走 Winsock）。二选一：
1. `antissh`（推荐）：WSL 内 `curl -O https://raw.githubusercontent.com/ccpopy/antissh/main/antissh.sh && bash ./antissh.sh`，用 graftcp 包装 `language_server_linux_x64`。
2. Mirrored 网络：`~/.wslconfig` 写 `[wsl2] networkingMode=mirrored`，`wsl --shutdown`，再 export `ALL_PROXY/HTTP_PROXY/HTTPS_PROXY`（需 Win11 22H2+、WSL ≥ 2.0.0）。

## 方案四（不注入、纯配置，仅作补充）

只能覆盖部分流量，配合上面方案一起用，不能单独解决 models 加载问题：

```jsonc
// settings.json
{
  "http.proxy": "http://127.0.0.1:7890",
  "http.proxySupport": "on",
  "http.proxyStrictSSL": false
}
```

启动参数：`Antigravity.exe --proxy-server="http://127.0.0.1:7890"`。
环境变量：启动前 `set HTTPS_PROXY=http://127.0.0.1:7890`。

## 参考资料

- <https://github.com/yuaotian/antigravity-proxy>
- <https://github.com/raybz/Antigravity-Proxy>
- <https://ksh7.com/posts/antigravity-proxy/index.html>
- <http://xiebinnto.top/2026/04/22/2026_antigravity_proxy_guide>
