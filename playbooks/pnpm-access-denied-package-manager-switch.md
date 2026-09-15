---
id: PB-20260914-001
type: playbook
title: pnpm 在项目目录报「拒绝访问」——packageManager 版本切换失败的定位与修复
tags: [pnpm, windows, access-denied, package-manager]
status: verified
source: conversation:2026-09-14
created: 2026-09-14
updated: 2026-09-14
---

# pnpm 在项目目录报「拒绝访问」——packageManager 版本切换失败的定位与修复

## 症状

在**某个特定项目目录**执行任意 pnpm 命令都立即失败：

```
❯ pnpm dev
拒绝访问。          # 英文环境: Access is denied.
```

- 退出码 1，没有任何 pnpm 自身日志；
- 同一条命令（同一个 pnpm 可执行文件）在别的目录完全正常；
- `--loglevel=debug`、`--config.xxx` 等 CLI 参数全部无效——失败发生在参数解析之前。

## 根因

`package.json` 的 `packageManager` 字段声明的 pnpm 版本，与当前 PATH 上 pnpm 的主版本不一致时，
pnpm 会（在其原生 bootstrap 阶段、JS 运行时启动之前）尝试切换到 pin 的那个版本。

一旦全局版本目录状态不一致——例如版本管理器 lock 仍指向 A 版本，而目录内实际是 B 版本，
并遗留悬空符号链接——切换动作在 Windows 上返回 `ERROR_ACCESS_DENIED`，pnpm 直接退出。

检查方法（本机实例：`packageManager: pnpm@11.18.0`，PATH 上是 12.3.4）：

```powershell
# 1. 全局版本目录里实际装了什么
Get-ChildItem "$env:PNPM_HOME\global" -Recurse -Depth 3 -Filter package.json |
  Where-Object { $_.FullName -match 'node_modules\\(pnpm|@pnpm\\exe)\\package.json' } |
  ForEach-Object { "$($_.FullName) -> " + (Get-Content $_ -Raw | ConvertFrom-Json).version }

# 2. 版本管理器 lock 里 pin 的版本（与上面不一致即为根因）
Get-Content "$env:PNPM_HOME\global\v11\pnpm-lock.yaml" | Select-String -Pattern 'packageManagerDependencies' -Context 0,8
```

## 三分钟确认根因（二分法）

在任意可写位置建空目录，只放一个 `package.json`，对比两次结果：

```powershell
mkdir D:\tmp\pnpm-probe
# 写 {"name":"x","packageManager":"pnpm@<项目里 pin 的版本>"}
cd D:\tmp\pnpm-probe; pnpm -v     # 复现失败
# 改成 {"name":"x"} 或 packageManager 与全局一致
cd D:\tmp\pnpm-probe; pnpm -v     # 恢复正常
```

失败随 `packageManager` 字段一起迁移 = 根因确认。

## 修复（任选其一）

### 方案 A：把 pin 对齐到本机已装的版本（推荐，改一行）

```jsonc
// package.json
"packageManager": "pnpm@12.3.4"
```

适合没有强 CI 版本约束的仓库。改完 `pnpm -v` 立即恢复正常。

### 方案 B：不动物业文件，禁掉版本自动切换（临时/本机）

```powershell
$env:npm_config_manage_package_manager_versions = 'false'
pnpm dev
```

持久化用系统环境变量（新开终端生效）：

```powershell
setx npm_config_manage_package_manager_versions false
```

注意：写在项目 `pnpm-workspace.yaml` 里的 `managePackageManagerVersions: false` **无效**——
切换发生在项目配置被读取之前。

### 方案 C：把 pin 的版本真正装上

需要写 `$PNPM_HOME\global`（通常在 `Program Files` 下，需管理员），
并清理悬空符号链接目录与滞后的 lock，再重跑 install。成本最高，仅在必须锁定旧版本时采用。

## 验证

```powershell
cd <项目目录>
pnpm -v          # 不再报拒绝访问，返回具体版本号
pnpm dev         # dev server 正常起监听
```

## 坑点

- **报错信息误导**：「拒绝访问」看起来像权限/杀软问题，实际是版本切换失败；先查 `packageManager` 字段，别急着改 ACL 或加杀软白名单。
- **CLI 参数救不了**：失败早于参数解析，`--loglevel=debug` 只会一起失败，无法提供线索。
- **多版本共存是前提条件**：机器上同时存在 pnpm 11/12（或升级过主版本、遗留 `global\v11` 旧目录）时才容易触发。
- **改 pin 会波及他人**：`packageManager` 是仓库共享配置，改前确认 CI/团队没有硬绑旧版本，否则本地通畅、CI 翻车。
- **lockfile 可能被重写**：换成更高主版本 pnpm 后首次运行会改写 `pnpm-lock.yaml`，提交前看 diff。
