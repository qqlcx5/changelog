---
id: PB-20260904-002
type: playbook
title: Vite + pnpm 项目上 CI 流水线的构建脚本排障清单
tags: [ci, pnpm, vite, build-pipeline]
status: draft
source: conversation:2026-09-04
created: 2026-09-04
updated: 2026-09-04
---

# Vite + pnpm 项目上 CI 流水线的构建脚本排障清单

适用：Vue3 + Vite + pnpm 的前端工程，要把本地 `pnpm build` 搬进 CI（Jenkins / 蓝盾 / GitLab CI / 云效等 bash 步骤）。
下面每一条都对应一个「本地能过、CI 挂掉」的真实差异点。

## 1. 基线脚本（可直接抄）

```bash
#!/usr/bin/env bash
set -ex

cd ding-h5

# 0) 断言运行时：package.json engines 要求什么就校验什么
node -v                      # 例：>=22.23.0
corepack enable              # 尊重 packageManager 字段
corepack prepare pnpm@11.18.0 --activate
pnpm -v                      # 用「实际输出」断言装上了，别只看 exit code

# 1) 安装：CI 必须 frozen；不要给 pnpm install 加 --ignore-scripts
pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

# 2) 构建（mode 决定产物接哪个后端，见第 6 条）
pnpm build:dev               # 或 pnpm build:pro

# 3) 产物交接：先清再拷，否则会拷成 deploy/dist
rm -rf ./deploy
cp -R ./dist ./deploy
```

配套：把镜像源写进项目 `.npmrc` 并提交，别散落在流水线命令里。

```
registry=https://registry.npmmirror.com/
```

## 2. pnpm 怎么来：`npm install pnpm` 是错的

- `npm install pnpm` 把 pnpm 装进 `./node_modules/.bin/`，**不在 PATH 里**，下一行 `pnpm install` 直接 `command not found`；
- 同时它会把 pnpm 写进 `package.json` 的 dependencies，污染声明；
- 正确做法（按优先级）：
  1. `corepack enable && corepack prepare pnpm@<packageManager 里的版本> --activate`（推荐，版本与仓库声明一致）；
  2. `npm i -g pnpm@<版本>`（全局装，注意 npm 新版本默认拦截 install scripts，见 ERR-20260831-003）。

## 3. `--ignore-scripts` 与 esbuild：先验证再下结论

**常见误判**：「`--ignore-scripts` 会跳过 esbuild 的 postinstall → vite build 必挂」。这条在 esbuild <0.16 成立（当年二进制靠 install.js 现下载），0.16 之后已不成立。

- 真相：`esbuild/lib/main.js` 的 `generateBinPath()` 是 `require.resolve(\`${pkg}/${subpath}\`)`，
  pkg = `@esbuild/<platform>-<arch>`、subpath = `bin/esbuild`（见 main.js:1691）——走的是 **optionalDependencies 里的平台包**，
  与 esbuild 自己的 `bin/esbuild`（postinstall 生成）无关；
- 验证方法：把 `node_modules/esbuild/bin/esbuild` 改名，再跑一次 `transformSync`，成功即证明 JS API 不依赖 postinstall；
- 结论：**这类工程保留 `--ignore-scripts` 是安全的**，反而更干净（CI 里连 `simple-git-hooks` 装 git hook 都一并跳过）。

真正该做的是用 pnpm 的构建白名单替代「全局禁脚本」的裸奔，而不是二选一。`pnpm-workspace.yaml`：

```yaml
allowBuilds:
  core-js: true
  esbuild: true
  simple-git-hooks: true
```

排查套路（扫全仓哪些包真有 install script）：

```bash
node -e "..."   # 遍历 node_modules/.pnpm/*/node_modules/*/package.json，收集 preinstall/install/postinstall
```

## 4. CI 一定要 `--frozen-lockfile`

- 不带它，CI 可能静默改写 lockfile / 拉取超出锁定的版本，产物不可复现；
- 本地 pnpm 大版本与 CI 不一致（如本地 12.x、声明 11.x）时，frozen 会把不兼容直接暴露成报错，而不是悄悄升级。

## 5. registry：taobao 老域名别再用

- `registry.npm.taobao.org` 已停止服务 / 证书不可用 → 换 `https://registry.npmmirror.com`；
- 写在 `.npmrc` 里随仓库走，避免每个流水线步骤各写一遍。

## 6. build mode 决定产物连哪个后端

Vite 的 `--mode` 决定加载 `.env.<mode>`，接口前缀、调试开关都跟着变。例：

| mode | 典型差异 |
|---|---|
| development | API 走相对 `/api`（需 nginx 反代到真实上下文）、预览开关开、devtools/vconsole 可能开 |
| production | API 直连同域真实上下文、`PREVIEW=false`、调试插件关 |

上线前先确认部署形态：同源直连就用 `build:pro`，有网关反代才用 `build:dev`。
`.env.local` 通常被 `.gitignore` 的 `*.local` 排除，CI 上不会存在——构建期依赖的变量必须落在已提交的 `.env` / `.env.<mode>` 里。

## 7. `vue-tsc --noEmit` 前置的代价

`build:dev` / `build:pro` 若写成 `vue-tsc --noEmit && vite build`：

- 任何类型错误在 CI 上直接红灯（本地 IDE 缓存可能掩盖）；
- 插件生成的 d.ts（`auto-imports.d.ts` / `components.d.ts` / `route-map.d.ts`）**必须随仓库提交**，否则 `vue-tsc` 先跑、d.ts 后生成，CI 首轮必挂；
- 想提速或临时绕开：`pnpm vite build --mode <mode>`，把类型检查拆成独立可选步骤。

## 8. 产物拷贝的语义坑

```bash
cp -R ./dist ./deploy     # deploy 已存在 → 生成 deploy/dist；不存在 → 生成 deploy
```

工作区复用时第二次就出错。固定写法：

```bash
rm -rf ./deploy && cp -R ./dist ./deploy
```

## 9. 其它快查

| 现象 / 写法 | 结论 |
|---|---|
| `npm cache clear --force` | 无收益且耗时，删掉 |
| `set -ex` + `cd dir` … `cd ../` | 成对 OK；但流水线若已把工作目录设为子目录，`cd dir` 会失败，优先用绝对路径 / `$WORKSPACE` |
| Node 版本 | 对齐 `engines.node`（例 `>=22.23.0`），CI 镜像常停在旧 LTS |
| 老镜像 glibc < 2.29，`ERR_DLOPEN_FAILED` cause 是 `GLIBC_2.29 not found` | `pnpm-workspace.yaml` 加 `overrides: { rollup: npm:@rollup/wasm-node@^4.62.3 }`（仅影响 workbox/PWA 链，vite 8 已走 rolldown）；见 ERR-20260904-001 |
| pnpm `trustPolicy: no-downgrade` 报签名/trust 错 | 加 `--config.trustPolicy=off`（或按需要排除包） |
| 构建「卡住」不报错 | 给命令包 `timeout`，把挂死变成报错（参见 ERR-20260828-002） |
| PowerShell 里用 `$LASTEXITCODE` 判成败 | 会把成功判成失败，见 ERR-20260831-004 |

## See Also

- ERR-20260831-003（npm 装不上 pnpm：install scripts 被拦 + shim 漏拼）
- ERR-20260831-004（PowerShell 下 pnpm 退出码误判）
- ERR-20260828-002（pnpm 下构建挂死：给命令加 timeout）
- ERR-20260828-001（pnpm 以 lockfile 为真相源，会覆盖人工编辑）
