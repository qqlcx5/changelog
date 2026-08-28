# Errors — 命令失败与集成故障记录

> 追加式分轨日志（id 前缀 `ERR`）。条目格式见 [WORKFLOW.md](../WORKFLOW.md) 第 4.2 节。
> 同一 Pattern 复现 ≥3 次（See Also 链接计数）应提炼为 playbook（WORKFLOW.md 第 6 节）。

---

## [ERR-20260826-001] 钉钉 dd.config 报 errorCode 9「无效的随机字符串参数」

- **Logged**: 2026-08-26 | **Status**: resolved | **Tags**: dingtalk, jsapi, config, signature
- **Summary**: 调用需鉴权 JSAPI（chooseImage/chooseMedia/previewMedia 等）前 `dd.config` 失败，errorCode=9、errorMessage=无效的随机字符串参数。
- **Details**:
  - 根因：`dd.config` 的 `nonceStr`（连同 `timeStamp`/`signature`）为空占位符，未从后端用 `jsapi_ticket` 计算下发。钉钉要求三参数有效且后端签名，前端无法本地生成。
  - 为何"浏览器能选、钉钉报错"：浏览器/H5 调试走 `uni.chooseImage` 回退，不经 `dd.config`；钉钉容器内 `union.*` 媒体 API 必须 `dd.config`，空 `nonceStr` 直接报 9。
- **Suggested Action**: `ensureConfig()` 应先请求后端签名接口（`/api/ding/jsapi-sign?url=当前页URL 去 #hash`），回填 `timeStamp/nonceStr/signature` 后再 `dd.config`。签名服务见 PB-20260824-001 第 4 章（AppSecret 仅服务端）。
- **Resolution**: 主 demo `ensureConfig` 改为 async，从 `VITE_DING_JSAPI_SIGN_API` 拉签名后填充 `dingConfig` 再 `dd.config`；env 需配置该地址并运行签名后端。
---

## [ERR-20260827-001] ripgrep 默认尊重 .gitignore 导致关键证据静默漏检

**Logged**: 2026-08-27 | **Status**: resolved | **Tags**: ripgrep, gitignore, evidence, search

### Summary
全仓搜索返回 0 匹配 ≠ 文件里没有：ripgrep/grep 类工具默认遵守 .gitignore，被忽略的未跟踪文件（状态 JSON、生成物、私有配置）完全不在扫描范围内，而它们恰恰最常承载漂移证据。

### Details
- 场景：架构评审中需确认某个已删除配置文件的遗留引用是否清理干净，ripgrep 全仓搜其文件名关键词得 0 处，据此初步判断「无残留」；
- 随后直接 Read 一个被 .gitignore 忽略的 session 状态 JSON 时，其中明确包含该关键词——工具从未扫过它，「0 匹配」是被扫描范围人为制造的假阴性；
- 反向陷阱同样出现过：项目目录树快照显示存在的某 json 文件实际已被删除，Read/Glob 为空后又用 shell 枚举交叉证实才敢下「已删」结论；
- 危害放大点：ignore 名单通常覆盖生成物与私有状态文件，恰好是架构漂移最爱藏身的地方，因此这种漏检是系统性盲区而非随机误差。

### Suggested Action
关键否定性结论（「不存在 / 无引用 / 已清理」）不得只凭一次全仓 grep：① 对重点嫌疑文件（被 gitignore 的状态/生成文件）直接 Read/Glob 取证；② 补一轮 `rg --no-ignore --hidden` 对照两次结果；③ 把「0 匹配」当作待证实信号而非终局证据；④ 对快照中「看似存在」的文件用 Test-Path/枚举交叉证实后再定论。

### Resolution
2026-08-27 同一会话内即改为「rg 广撒网 + Read/Glob 精确取证」双轨流程，并重新核对了此前给出的关键判断（含幻影文件是否存在、旧路径残留清单），结论均未反转；此后评审类任务默认对该类怀疑对象做直读复核。

## [ERR-20260828-001] node_modules 里有包 ≠ package.json 声明了它：手工编辑会被 pnpm 静默覆盖

**Logged**: 2026-08-28 | **Status**: resolved | **Tags**: pnpm, package-json, lockfile, drift

### Summary
`pnpm ls` 能看到依赖不等于项目声明了它：包在 `node_modules` / lockfile 里、却不在 `package.json`，
新克隆会直接构建失败；且手工编辑 `package.json` 后再跑 `pnpm add/install`，pnpm 会以 lockfile importers
为准重写文件，把人的编辑成果悄悄抹掉（依赖被重新塞进 devDependencies、分组错乱）。

### Details
- 场景：给 tauri-vue3-template 集成 unocss/element-plus/lodash-es/sass-embedded。
  `pnpm ls --depth 0` 显示 unocss 等已装，但 `package.json` 里一个都没有——典型的「装过但没写进声明」残留。
- 第一次跑 `pnpm add -D @types/lodash-es` 后，pnpm 把 lockfile 里那批包全部写进了 `devDependencies`
  （element-plus、lodash-es 这类运行时库也被归为 dev）；
- 我用编辑工具按正确分组改完 `package.json`，随后一次 `pnpm install` 又把文件改回旧形态，
  表现为「编辑工具报 string not found」——不是文件被别人改，是包管理器在写。

### Suggested Action
1. 集成类任务开工前先跑 `pnpm ls --depth 0` 与 `package.json` 对照，不一致就先把缺失依赖补进声明再动配置；
2. 依赖分组这类「最终态」编辑放在**最后一次 pnpm 命令之后**，改完立刻回读 `package.json` 复核；
3. 改完声明必须补一次 `pnpm install` 同步 lockfile，但要用 diff/回读确认分组没被 pnpm 翻回去。

### Resolution
2026-08-28：最终改为「先装齐 → 再用整文件覆写定稿 `package.json`（element-plus/lodash-es 归 dependencies）→
再 `pnpm install` 同步 → 回读复核」，构建与类型检查均通过，分组保持正确。

See Also: PB-20260828-001

## [ERR-20260828-002] UnoCSS presetIcons 不写 collections 会在 pnpm 下把构建挂死

**Logged**: 2026-08-28 | **Status**: resolved | **Tags**: unocss, preset-icons, pnpm, build-hang

### Summary
`presetIcons` 配置里省略 `collections`（依赖官方所说的"node 环境自动搜索已安装的 iconify 数据集"），
`vite build` 会停在 `transforming...` 阶段不再推进（>90s 无输出也无退出）；补上显式 `collections` 后同样工程 9s 构建完成。

### Details
- 场景：按官方文档把 `presetIcons({ scale, warn, extraProperties })` 精简配置落到一个
  Vite 6 + pnpm 11 + unocss 66.8.1 的 Vue3 项目（依赖树 300+ 包）；
- 现象：`vite build` 卡在 `transforming...`，node 进程 CPU 持续占用，日志零新增行，也不超时退出；
- 定位方式：逐个回退本次新增项（presetWind3 / presetAttributify / transformerDirectives / content.pipeline），
  最后定位到 presetIcons 的集合解析；
- 根因推断：node 端的集合自动发现会去 node_modules 里搜 `@iconify-json/*`，pnpm 的
  符号链接 + 隔离目录结构（`node_modules/.pnpm/...`）让这次扫描退化成极慢甚至不终止的遍历；
- 危害：这类"卡住"不报错、不失败，只会让人以为机器慢；在 CI 里表现为任务超时，排查成本远高于报错。

### Suggested Action
1. `presetIcons` 一律显式写 `collections`，用动态导入按需加载：
   `tabler: () => import('@iconify-json/tabler/icons.json').then(m => m.default)`；
2. 看到构建卡在 `transforming...` 超过 30s，优先怀疑图标集合解析，而不是机器性能；
3. 给构建命令加超时告警（CI 里 `timeout` 包一层），把"挂死"变成"报错"。

### Resolution
2026-08-28 同会话内补回显式 `collections` 后构建恢复正常（9.02s），产物图标 CSS 断言全部命中。
