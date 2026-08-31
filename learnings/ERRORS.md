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

## [ERR-20260831-002] UnoCSS 换 presetWind4 后自定义 theme key 静默失效

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: unocss, preset-wind4, theme, migration

### Summary
`presetWind3` → `presetWind4` 只改了导入名，`vue-tsc` 与 `vite build` 全部通过，但配置里自定义过的
theme key 有一部分被无声丢弃：工具类照样生成，取到的却是预设默认值。

### Details
- 场景：把 tauri-vue3-template 的 `presetWind3` 换成 `presetWind4`（unocss 66.8.1），配置里只自定义了
  `theme.colors`（EP 调色板），未触及任何改名 key，因此本次**没有**实际踩到样式回退；
- 风险来源：presetWind4 调整了一批 theme key 命名——`fontFamily→font`、`borderRadius→radius`、
  `easing→ease`、`boxShadow→shadow`、`breakpoints→breakpoint`、`transitionProperty→property`、
  `container.maxWidth→containers.maxWidth`、`fontSize/lineHeight/letterSpacing` 移入 `text.*`、
  尺寸类统一走 `spacing`；
- 危害：这些 key 既不是类型错误（Theme 类型宽松），也不是构建错误，表现是「样式悄悄变了」，
  排查时不会往配置漂移上想。

### Suggested Action
1. 切换 preset 前先按官方 Wind4 文档的 theme key 对照表，把 `uno.config.ts` 的 `theme` 逐项改名；
2. 改完用产物断言兜底，而不是只看构建是否通过：搜主题变量是否真的进了 CSS
   （如 `--colors-primary`、改名后 key 对应的 `--radius-*`），并确认旧的 `theme()` 指令无残留；
3. 相关 preset 顺带处理：`presetRemToPx` 已内置可删，`presetLegacyCompat` 因 oklch 明确不兼容必须移除。

### Resolution
2026-08-31：本项目仅 `theme.colors` 有自定义，无需改名；按上述断言（`--colors-primary` /
`--spacing:` / `@property --un-text-opacity` / `background-color:revert` 命中，`theme(` 残留 0）
验证切换生效，`pnpm build` 通过。完整迁移清单见 PB-20260828-001 第 1、7 节。

See Also: PB-20260828-001

## [ERR-20260831-001] UnoCSS 提取器会把源码和注释里的图标前缀字面量当成类名

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: unocss, preset-icons, extractor, false-positive

### Summary
构建日志出现 `[unocss] failed to load icon "tabler-"`（集合名后为空图标名）。
排查发现触发源不是模板，而是 JS 表达式 `icon.slice("i-tabler-".length)` 与本人在注释里写的
`"i-tabler-"` 这个**字符串字面量**——提取器把整个文件当纯文本扫描，任何形如 `i-xxx-` 的片段都会被当作候选类名。

### Details
- 场景：图标画廊组件把图标存成完整类名数组 `["i-tabler-rocket", ...]`，模板里为了显示图标名写了
  `{{ icon.slice("i-tabler-".length) }}`；
- 第一次修：改成数组元素为 `{ name, cls }`，模板不再 slice —— **告警依旧存在**；
- 二次定位：真正的残留源是我在 `IconItem` 接口上方新加的注释，注释正文中出现了带引号的 `"i-tabler-"`；
- 根因：UnoCSS 默认提取器（extractorSplit）按分隔符切词，不做语法分析，不区分字符串、标识符还是注释；
  `warn: true` 时每次都会打印一行 `failed to load icon`，但**不影响构建结果、不失败退出**，极易被忽略；
- 危害：告警淹没真实问题——真写错图标名时的告警和这条假告警长得一模一样，等于把 `warn: true` 的保险丝烧了。

### Suggested Action
1. 图标数据一律用 `{ name, cls }` 结构，模板直接取 `name`，不做字符串截取；
2. **注释里也不要写图标前缀字面量**（写成"图标前缀"之类描述，或让前缀不紧跟在引号后）；
3. 排查此类告警：对整个 `src` 搜 `i-<集合名>-[引号/反引号/空格]`，命中即为触发源，不要只盯模板；
4. 每次构建后把 `failed to load icon` 当作**必须清零**的信号，否则 `warn: true` 失去意义。

### Resolution
2026-08-31：把注释里的前缀字面量改写为描述性文字后，构建日志 `failed to load icon` 清零，
产物图标数量 123 且断言全通过。

See Also: ERR-20260828-002, PB-20260828-001

## [ERR-20260831-003] npm 装不上 pnpm 12：安装脚本被拦 + pnpm.ps1 shim 漏拼 $exe

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: pnpm, npm, install-scripts, shim

### Summary
`npm install -g pnpm@12` 装完 `pnpm -v` 输出为空、不报错、exit 0。两个独立故障叠加：
npm 12 默认拦截 `preinstall` 导致原生二进制没落地；npm 生成的 `pnpm.ps1` 又漏拼 `$exe`，
让 PowerShell 去执行无扩展名文件。命令行看起来"装上了但不能用"。

### Details
- 背景：pnpm 12.0（2026-08-26 发布）是 Rust 重写版，**`latest` 标签仍指向 11.x 线**，
  12.x 只发在 `next-12` tag（`npm view pnpm dist-tags` 可见 `next-12: 12.1.0`）。
  从 npm 安装时它是 wrapper，靠 `preinstall: node install.js` 下载并链接 `@pnpm/exe.win32-x64` 原生二进制；
- 故障一：npm 12 引入 allowScripts 安全策略，**默认拦截未被允许的安装脚本**。
  表现为仅一行 warn（`1 package had install scripts blocked ... Run npm install -g --allow-scripts=pnpm`），
  exit code 仍是 0，包"装成功"，但二进制没链接 → `pnpm` 只剩空壳；
- 故障二：`D:\Program Files\npm\pnpm.ps1` 里调用写成 `& "$basedir/node_modules/pnpm/pnpm"`，
  前面算好的 `$exe=".exe"` **没被拼进去**。PowerShell 里执行无扩展名文件静默失败；
  而 `pnpm.cmd` 走 cmd 的 PATHEXT 查找能命中 `pnpm.exe`，所以 `pnpm.cmd -v` 正常、`pnpm -v` 全空——
  这是判断"shim 坏而非二进制坏"的关键分界；
- 排查用具：`where.exe pnpm` 只列出 `pnpm` / `pnpm.cmd`（`.ps1` 不在 PATHEXT 内，不会被列出），
  必须用 `Get-Command pnpm` 才能看到 PowerShell 实际解析到的是 `pnpm.ps1`；
- 危害：两处都不报错。第一处是 warn，第二处是静默退出，合起来极易被误判为"网络问题 / 镜像没同步"。

### Suggested Action
1. 安装时显式放行脚本：`npm install -g pnpm@12 --allow-scripts=pnpm`；
2. 若 `pnpm -v` 为空但 `pnpm.cmd -v` 正常，改 `pnpm.ps1` 两处调用为
   `& "$basedir/node_modules/pnpm/pnpm$exe" $args`（注意 `npm install -g pnpm` 会重新生成坏 shim，需重修）；
3. 想彻底绕开 npm shim，用官方原生安装（不依赖 Node）：
   `$env:PNPM_VERSION="next-12"; Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression`；
4. 已有 pnpm ≥11.10 时最简单：`pnpm self-update next-12`（注意项目若用 `packageManager` 字段钉版本，
   self-update 只改钉子不装全局）；
5. 判断"装没装上"不要只看命令有无报错，用 `pnpm -v` 的实际输出做断言；
   无输出等同于失败，即使 exit code 是 0。

### Resolution
2026-08-31：`npm install -g pnpm@12 --allow-scripts=pnpm` 装上 12.1.0，
再手工修好 `pnpm.ps1` 的 `$exe` 拼接，`pnpm -v` 输出 `12.1.0`。
环境：Windows / Node v22.23.2 / npm 12.0.2 / registry 为 npmmirror 镜像。
