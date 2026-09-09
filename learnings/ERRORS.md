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

## [ERR-20260831-004] PowerShell 把命令的 stderr 输出判为 NativeCommandError，$LASTEXITCODE 变成假 1

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: powershell, exit-code, stderr, false-negative

### Summary
`pnpm build` 明明成功（日志 `✓ built in 9.53s`），`$LASTEXITCODE` 却是 1。
原因：Vite 的 chunk-size 警告写 stderr，PowerShell 把**任何** stderr 输出包成
`NativeCommandError` 记录，并把 `$LASTEXITCODE` 置为非 0。凭退出码判定构建成败会得出反向结论。

### Details
- 场景：给 tauri-template 接入 Vue Router + Pinia 后做构建验证；
- 现象一：``pnpm build 2>&1 | Select-Object -Last 30; echo "EXIT=$LASTEXITCODE"``
  输出 `EXIT=1`，但同一次日志末尾是 `✓ built in 9.53s`；
- 现象二：单独再跑一次同样命令，`$LASTEXITCODE` 变成 0 —— 同一个命令给出两个结论；
- 根因：PowerShell 对原生命令的 stderr 输出生成 `ErrorRecord`（报文中可见
  `CategoryInfo : NotSpecified`、`NativeCommandError`），这是宿主行为而非子进程失败；
  Vite 的 `(!) Some chunks are larger than 500 kB` 属警告，走 stderr 但退出码为 0；
- 危害：CI 或脚本里用 `$LASTEXITCODE` 判定成败会**把成功判成失败**；
  反过来若只看退出码不看日志，也会把"带警告的成功"当成全绿而漏掉体积回退。

### Suggested Action
1. 判定构建成败，用**输出内容**做断言而不是退出码：
   匹配 `built in` / `error TS` 等特征串（如 `pnpm build 2>&1 | Select-String "built in|error"`）；
2. 需要严格退出码时，用 `cmd /c "<cmd> && exit 0"` 包裹，或在脚本里
   临时 `$ErrorActionPreference = 'Continue'` 并检查 `$LASTEXITCODE` 之外再核日志；
3. 看到 `NativeCommandError` 先读日志尾部确认真实结果，不要直接下"失败"结论；
4. 同理适用于任何"把警告写 stderr"的工具链（eslint、tsc --noEmit 的部分输出等）。

### Resolution
2026-08-31：改为对输出内容做断言后确认构建通过（`✓ built in 7.98s` / `9.53s`），
产物 chunk 分布符合预期（vue / element-plus / lodash / vendor + 三个路由懒加载 chunk）。

2026-09-02（第 2 次复现）：tauri-template 中 `cargo check` 输出 `Finished dev profile in 8.87s`（成功）但管线报 ExitCode 1，`npm run lint` 同样被误报；以输出特征串（`Finished` / `EXIT: 0`）判定后确认两者真实通过。原处置方案依然有效。

## [ERR-20260831-005] pnpm 隔离布局下，顶层 node_modules 查找会把"依赖齐全"误判为缺失

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: pnpm, node-modules, peer-deps, false-negative

### Summary
`Test-Path node_modules/@vue` 返回 False，据此怀疑 pinia 的必需 peer 依赖
`@vue/devtools-api` 缺失会导致构建失败；实际它已正确安装在
`node_modules/.pnpm/pinia@4.0.3/node_modules/@vue` 下，构建毫无问题。

### Details
- 场景：确认 `pinia@4.0.3` 的 peer `@vue/devtools-api`（`peerDependenciesMeta` 中
  `optional: false`）是否已安装，因为它被 `pinia/dist/pinia.js` 第 8 行**静态顶层导入**；
- 误判路径：`Test-Path node_modules\@vue` → `False`；
  `node -e "require('@vue/devtools-api/package.json')"` → 抛 MISSING；
  据此一度判定"静态导入必然解析失败、vite build 会挂"；
- 真相：pnpm 的隔离布局把传递/peer 依赖放进
  `node_modules/.pnpm/<pkg>@<ver>/node_modules/` 内，**不提升到顶层**。
  从 pinia 自己的视角，`@vue/devtools-api` 就在同级目录，解析完全正常；
- 辨别方法：列出 `node_modules/.pnpm/pinia@*/node_modules/` 下的目录，
  其中确有 `@vue`、`vue`、`typescript` 等，即证明链接完整；
- 危害：这类误判会让人去装一个根本不缺的包，甚至为了"修好"而破坏正确的依赖布局。

### Suggested Action
1. 在 pnpm 项目里判断依赖是否存在，**不要**只看顶层 `node_modules/<pkg>`；
   查 `node_modules/.pnpm/<pkg>@*/node_modules/` 才是准的；
2. 更可靠：直接用构建结果断言（`pnpm build` 是否报 `Failed to resolve import`），
   而不是静态查文件；
3. 顶层查不到但构建通过 ⇒ 属于 pnpm 正常的隔离布局，不是缺失；
4. `node -e require(...)` 只覆盖 Node 的顶层解析路径，不能代表 Vite/bundler 的解析结果。

### Resolution
2026-08-31：列出 `.pnpm/pinia@4.0.3/node_modules/` 确认 `@vue` 存在后放弃"补装"，
直接 `pnpm build` 验证通过（`✓ built in 8.68s`），未做任何多余改动。

See Also: ERR-20260828-001

## [ERR-20260831-006] 在 Vue 模板里调用 auto-import 的全局 const 报 TS2339

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: vue, unplugin-auto-import, global-const, ts2339

### Summary
Element Plus 改为按需引入后，`vue-tsc` 报
`Property 'ElMessage' does not exist on type 'CreateComponentPublicInstanceWithMixins<...>'`。
报错不在 `<script setup>`，而在**模板**里 `@click="ElMessage.info(...)"` 那一行。

### Details
- 场景：接入 `unplugin-auto-import` 后删掉手写的 `import { ElMessage }`，
  模板里原本就存在的 `@click="ElMessage.info('ElMessage 提示')"` 与
  `@confirm="ElMessage.success('已确认')"` 开始报错；
- 误导点一：报错类型提到 `CreateComponentPublicInstanceWithMixins`，看着像"组件实例上没这个属性"，
  容易往 props / expose / 组件类型上查；
- 误导点二：`src/auto-imports.d.ts` 确实生成了，内容也确实声明了全局 const
  `ElMessage`，且 `vue-tsc --noEmit --listFiles` 能列出它——文件在、被加载、依然报错；
- 根因：`unplugin-auto-import` 提供的是 **`declare global` 的 const**，
  只在模块作用域（`<script setup>` 编译产物）里可解析；
  **模板表达式是在组件实例的 render 作用域求值的，不走全局作用域**，所以解析不到；
- 危害：这类代码在全量引入时代是能跑的（那时 `ElMessage` 是显式 import 进 setup 的），
  改按需引入后才暴露，容易误判成"按需引入配错了"。

### Suggested Action
1. 模板只做事件绑定，具体调用一律收进 `<script setup>` 的函数里：
   `@click="showMessage"` + `function showMessage() { ElMessage.info(...) }`；
2. 排查口诀：**报 TS2339 且行号落在 `.vue` 的模板区域** → 先怀疑"模板作用域 vs 全局作用域"，
   而不是组件类型定义；
3. 确认 dts 是否真的参与编译，用 `vue-tsc --noEmit --listFiles | grep auto-imports`，
   不要只看文件存在与否；
4. 这条同样适用于 `unplugin-auto-import` 引入的 Vue API（`ref` / `computed` 等），
   它们在模板里也**不能**直接使用。

### Resolution
2026-08-31：在 `DemoElement.vue` 中新增 `onConfirm()` / `showMessage()` 两个函数收口调用，
模板改为绑定函数名；`pnpm build`（含 `vue-tsc --noEmit`）通过，产物样式注入正常。

See Also: PB-20260831-003

## [ERR-20260831-007] pageSchema 查询白名单登记了不存在的物理列，只有命中该筛选项才 500

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: qcm-v2, pageschema, schema-drift, mysql

### Summary
查询白名单（`sys_model_table_column_query`）里登记了物理表根本不存在的列，编译、启动、
"不筛选直接打开页面"三轮全部绿灯，只有用户输入该筛选项时才抛 MySQL 1054 Unknown column，接口 500。

### Details
- 场景：QCM V2「SCM备案明细」列表页 `/md/scmSupplierDetail`（表 `bd_scm_supplier_detail`）。
  按用户提供的 29 字段规格表逐条核对，发现「备案供应商简称 `vendor_short_name`」在四处登记齐全——
  建模列元数据 `sys_model_table_column`（sort=4）、查询配置 `sys_model_table_column_query`（LIKE, query_sort=2）、
  菜单列契约 `sys_menu_form_column.visible_columns`、前端 ProTable `columns`（带 `search`）——
  唯独 `CREATE TABLE`、实体、Mapper XML 三处都没有这一列；
- 根因：`PageSchemaConditionValidator.validateAndApply` 只做「白名单 + compareType」校验
  （从 `queryConfigMap` 取 compareType 比对，不等抛 ValidException），**不校验 columnCode 是否对应真实物理列**；
  `QueryWrapperGenerator.applyQueryConditions` 同样是纯拼装，直接 `queryWrapper.like(column, value)`。
  于是缺陷逃过编译期、启动期和日常自测——不筛选时页面正常打开，只是该列空白；
- 放大点一：契约是数据驱动的（DB 配置 + 本地缓存 5 分钟），物理列是 DDL／实体／XML 三方维护，
  两者之间没有任何机械门禁；
- 放大点二：契约登记往往与建表不同批次、不同人完成（本例建表 08-19、建契约 08-27），跨批次最容易漏；
- 一般化形态：投影（契约／元数据）与权威（物理表）分处两地，校验器只验投影自洽、不验投影↔权威一致性。
- 顺带查出同源缺陷：`vendor_code` 的"按 vendor_id 关联主表回填"写在 DDL 注释、Service 类注释、
  Controller 注释、Mapper XML 注释**四处**，但 `doSync` 里从未实现，直接用报文值落库——
  注释与实现长期背离，比缺列更难被察觉。

### Suggested Action
1. 新增镜像页／契约页时用「物理列集合 ⊇ 契约列集合」做机械核对：从 `CREATE TABLE` 提取列名，
   与 `sys_model_table_column` / `sys_model_table_column_query` / `visible_columns` / 前端 `columns.field`
   四处求差集，差集必须为空；
2. 手写 Mapper XML 的 `insertOrUpdateBatch` 是第三处易漏点：新增物理列后必须同步改
   INSERT 列、VALUES、`ON DUPLICATE KEY UPDATE` 三处，否则列存在但永远落不进值；
3. 反向核对同样要做：物理表有、契约里没有的列（本例 `vendor_code_h` / `two_mdm_code_h`）
   属于落库但不展示的死列，显式决策"建契约"还是"删列"，不留半成品；
4. 校验器侧可加固：`validateAndApply` 增加 columnCode 与实体／物理列的合法性校验，
   把运行期 1054 前移为启动期或配置期失败；
5. 注释声称的能力要有对应实现，评审时把"注释与代码是否一致"当作独立检查项。

### Resolution
2026-08-31：补建 `vendor_short_name`——新增增量 DDL
`jp-console/db/202608/DDL/scm备案明细_备案供应商简称增列.sql` 及其回滚脚本，
含存量数据 `UPDATE ... JOIN bd_scm_supplier` 回填；实体加字段并补 `@Query`；
Mapper XML 三处（INSERT 列 / VALUES / ON DUPLICATE）同步；
并补上四处注释声称存在但从未实现的 `fillFromMaster()`——
按 `vendor_id` 关联主表批量回填 `vendor_code` 与 `vendor_short_name`。
架构检查通过（ERROR 0）。核对清单沉淀为 PB-20260825-001 第 7 节。

See Also: PB-20260825-001

---

## [ERR-20260831-008] 列表跳详情零请求：后端进程落后源码 + NON_NULL 隐藏 null 主键

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: jackson, non-null, version-skew, debugging

### Summary

列表页有数据，但点击跳详情后 URL 不带主键参数、一个接口请求都不发、页面全「-」。前端链路逐环排查无缺陷，根因是本地后端进程落后于工作区源码：列表接口响应行缺主键 `id`，而全局 Jackson `NON_NULL` 把值为 null 的字段整个隐藏，症状变成了「字段不存在」，极具迷惑性。

### Details

- 现象链（QCM V2 供应商主数据）：列表接口响应 `records[0]` 无 `"id"` 键 → 前端 `goDetail` 里 `row.id` 为 undefined → `router.push` 的 query 被 vue-router 忽略 → 详情页 `loadDetail()` 的 `if (!id) return` 静默返回 → 零请求 + 详情全「-」。
- 排查中逐环验证全部通过：列表 SQL `SELECT s.id, ...`（且 git 全历史版本都带主键）、`BaseEntity` 有 lombok getter 序列化正常、src 与 target/classes 的 Mapper XML MD5 一致、前端 snake_case 行转换不影响全小写 `id`、ProTable 行数据原样透传、隐藏详情页路由注册（`menu_type=1` + `is_show=0` 会被后端例外下发）、后端详情 VO 结构与前端取值完全对齐。矛盾的唯一解释：**运行中的后端（vite proxy target `localhost:8082`）早于当天 pageSchema 契约批次提交启动，进程未随源码更新重启**。
- 关键认知 ①：全局 Jackson `NON_NULL`（`JsonUtils.applyGlobalConvention`）下「响应缺字段」＝「运行时该值为 null」，不能把「字段不存在」直接推断为「SQL 没查/没映射」。
- 关键认知 ②：前端 vite dev server 有 HMR 实时生效，后端 JVM 却不会自己更新 classes——验收当天刚提交的后端改动，必须重启后端才可见。
- 关键认知 ③：同模块对照法——商品主数据列表走 MyBatis-Plus 标准 `page()` 查询（实体全列、必含主键），供应商列表走自定义 XML SQL（多语言 COALESCE 联表），自定义 SQL 是列缺失/版本漂移的高发位；用一个正常兄弟接口做对照能快速圈定问题面。

### Suggested Action

「列表有数据但详情页零请求」三步定位法：

1. 看跳转后地址栏 URL 是否带业务主键参数（`?id=...`）——不带则上游行数据缺主键；
2. F12 看列表接口响应 `records[0]` 是否含主键字段——缺字段先想起 NON_NULL（值为 null），再顺藤摸瓜查运行后端版本；
3. 对比运行后端与工作区源码：`git log --format="%h %ad %s" --date=format:"%m-%d %H:%M"` 的提交时间 vs 后端进程启动时间，重新编译并重启后端。

前端防御：跳转入口对 `row.id` 判空做响亮失败提示（`ElMessage.warning`），把静默失败变显式（本次已在 `supplierMasterData/index.vue` 的 `goDetail` 落地）。

### Resolution

2026-08-31：确认根因为本地后端进程落后源码（当天 13:35 刚提交 pageSchema 契约批次），指导重启后端即可恢复；前端 `goDetail` 增加主键判空响亮失败提示，ESLint 0 问题。项目侧经验已同步 agent memory（common_pitfalls_experience）。

See Also: PB-20260825-001

---

## [ERR-20260831-009] pageSchema 濂戠害"涓嶇敓鏁?锛氱粦瀹氳〃 tenant_id 鍐欓敊绉熸埛锛屾煡璇㈡案涓嶅懡涓?

**Logged**: 2026-08-31 | **Status**: resolved | **Tags**: qcm-v2, pageschema, multi-tenant, dml

### Summary

琛ㄥ崟寤烘ā DML 鍏ㄩ儴鎵ц鎴愬姛锛岄〉闈㈠嵈濮嬬粓璧板洖閫€閫昏緫锛堝绾︽湭鐢熸晥锛夈€傛牴鍥狅細`sys_menu_form_column.tenant_id` 鍐欐垚浜?`'10002'`锛岃€岃繍琛屾湡 `getMenuFormCache` 鎸?`menu_code + 褰撳墠鐧诲綍鐢ㄦ埛绉熸埛` 绮剧‘鏌ヨ锛宎dmin 绉熸埛鏄?`'10000'`锛岀粦瀹氭案杩滄煡涓嶅埌 鈫?`restricted=false` 鈫?鍓嶇璧板師閫昏緫銆?

### Details

- 鍦烘櫙锛歈CM V2 md 妯″潡 7 椤垫帴鍏?pageSchema 濂戠害锛坄usePageSchema` + `/sys/pageSchema`锛夛紝閰嶅 9 浠借〃鍗曟ā鍨?DML锛坰ys_model_table / sys_model_table_column / sys_model_table_column_query / sys_menu_form_column锛夊叏閮ㄦ墽琛岋紝椤甸潰鏃犱换浣曞彉鍖栵紱
- 鍒ゅ畾閾撅細鍓嶇 `usePageSchema` 鈫?`GET /sys/pageSchema?menuCode=xxx` 鈫?`PageSchemaAssembler.assemble` 鈫?`FormColumnPermissionCalculator.calculate` 鈫?`SysMenuFormColumnService.getMenuFormCache`锛氬厛鏌?Redis Hash `sys:cache:menuForm:{tenantId}::menuForm`锛坒ield=menuCode锛夛紝miss 鍐嶆煡 `sys_menu_form_column WHERE menu_code=? AND tenant_id=CacheTenantUtils.getTenantId()`锛涙煡涓嶅埌鍗宠繑鍥炵┖ 鈫?`restricted=false`锛?
- 鏍瑰洜锛歵enant_id 鍐欏叆 `'10002'`锛堝綋鏃惰鍒ら粯璁ょ鎴凤紝瀹為檯鏄剼鎵嬫灦 SQL 閲屾棤閿″垎鍏徃鏃х鎴风殑娈嬬暀鍊硷級锛涜€?admin 鐢ㄦ埛锛坰ys_user.id='1'锛塼enant_id='10000'锛宍DEFAULT_TENANT_ID="10000"`锛宻ys_tenant 鍏ㄩ儴璁板綍 tenant_id 鍒椾篃鏄?'10000'锛?
- 闅愯棌鎬ф潵婧愶細鈶?澶氱鎴锋彃浠?IGNORE_TABLES 宸插拷鐣?`sys_menu_form_column`锛屼笉浼氳鑷姩鎷肩鎴锋潯浠讹紝绉熸埛鍖归厤瀹屽叏闈犳墜鍐?`.eq(tenantId)`锛岄厤缃敊鍊兼棤浠讳綍鎶ラ敊锛涒憽 DML 鎵ц鎴愬姛銆佽彍鍗曞瓨鍦ㄣ€佸缓妯″垪榻愬叏锛屾墍鏈夐潤鎬佹鏌ラ兘缁跨伅锛涒憿 "鏈粦瀹?鏄璁′笂鐨勬甯稿洖閫€锛堝墠绔?console.error 涓€琛岀孩瀛楋級锛屼笉鎶ラ敊锛?
- 浜ゅ弶楠岃瘉鏂规硶锛欶12 鎺у埗鍙扮湅 `[ProTable][pageSchema] 鎺ュ彛鍘熷杩斿洖` 鐨?`restricted` 涓?`formsCount`鈥斺€攆alse/0 鍗崇粦瀹氭湭鍛戒腑锛?
- 闄勫甫鍙戠幇锛氱洿鎺ユ墽琛?SQL 涓嶈蛋鍚庣 saveBinds锛屼笉浼氳Е鍙?`evictByMenuCode` 娓呯紦瀛橈紱鑻ヤ箣鍓嶆浘鍛戒腑杩囩粦瀹氾紝Redis 閲屾湁鏃у€硷紝鏀瑰簱鍚庡繀椤绘竻缂撳瓨鎵嶇敓鏁堛€?

### Suggested Action

1. 鍐欎换浣曞惈 tenant_id 鐨?DML 鍓嶅厛鏌ュ綋鍓嶇櫥褰曡处鍙风鎴凤細`SELECT login_name, tenant_id FROM sys_user WHERE login_name='<鐧诲綍鍚?'`锛屼笉瑕佸嚟"榛樿绉熸埛"鍗拌薄鍐欐锛?
2. 濂戠害鏈敓鏁堟爣鍑嗘帓鏌ュ簭锛欶12 鐪?restricted 鈫?鏌?`sys_menu_form_column`锛坢enu_code/tenant_id/del_flag锛夆啋 鏌ョ櫥褰曠敤鎴风鎴?鈫?娓?Redis `sys:cache:menuForm:*`锛?
3. 缁曡繃 SQL 鐩存敼搴撴椂璁板緱鍚屾娓呯紦瀛橈紙redis-cli DEL 鎴栭噸鍚悗绔級锛屽惁鍒欐棫缂撳瓨缁х画鍛戒腑锛?
4. 寤烘ā涓夎〃锛坰ys_model_table/column/query锛夊湪澶氱鎴锋彃浠跺拷鐣ュ悕鍗曢噷锛屽彧鏈?sys_menu_form_column 鏈夋墜鍐欑鎴疯繃婊も€斺€旇繖鏄敮涓€鐨勭鎴锋晱鎰熺偣銆?

### Resolution

2026-08-31锛? 浠借〃鍗曟ā鍨?DML 鐨?tenant_id 缁熶竴淇涓?'10000'锛? 涓?md 椤?+ plm/bi/scm鍟嗗搧璁㈠崟瑙勫垝鍚屾壒娆★級锛屽瓨閲忓簱 UPDATE + 娓?Redis 缂撳瓨鍚庡绾︾敓鏁堛€傞」鐩晶缁忛獙宸插悓姝?agent memory銆?

See Also: ERR-20260831-008, PB-20260825-001

---

## [ERR-20260901-001] prettier.enable=false 静默废掉全部 defaultFormatter，格式化"配了但不生效"

**Logged**: 2026-09-01 | **Status**: resolved | **Tags**: vscode, prettier, settings, silent-failure

### Summary

`settings.json` 里同时存在 `prettier.enable: false` 和十余处
`"editor.defaultFormatter": "esbenp.prettier-vscode"`，后者全部静默失效——
设置 UI 不报错、文件不飘黄，只有按 `Format Document` 时提示"没有安装格式化程序"。

### Details

- 场景：审查一份 622 行的 `settings.json`（antfu 模板 + Cursor 方案混抄）。
  antfu 方案主张"用 ESLint 统一格式化"，带上了 `prettier.enable: false`；
  Cursor 方案依赖 Prettier 当 `defaultFormatter`，于是 `[javascript]` / `[typescript]` /
  `[css]` / `[scss]` / `[jsonc]` / `[markdown]` / `[yaml]` / `[toml]` / `[shellscript]` 等
  13 处指向 `esbenp.prettier-vscode`。两套方案叠加后互相抵消；
- 插件官方说明：`prettier.enable` 默认 `true`，**改动后必须重启 VS Code**。
  这解释了为什么"改过一次没生效就被忽略"——重启前看不到差异；
- 误导点：设置项本身合法、`[lang]` 块也合法，校验不出任何 JSON / schema 错误；
  失效点在**跨段落的引用关系**里，只能靠"两个开关是否指向同一套方案"的人脑核对发现；
- 一般化形态：**任何 `xxx.enable: false` 都是全局否决**，
  它不挑语言、不挑作用域，所有指向该 provider 的配置一起失效。

### Suggested Action

1. 改完含 `enable` 的开关后一律 `F1` → `Developer: Reload Window` 再验证；
2. 验证不看配置看行为：打开代表性文件 → `Format Document` →
   状态栏是否提示"没有安装格式化程序"；
3. 审查 `settings.json` 第一步就全局搜 `enable": false`，
   逐条反查它的引用点（见 PB-20260901-001 第 1 节）；
4. 决定方案时二选一，不要两个都留：要么删 `prettier.enable` 让 Prettier 接管格式化，
   要么把所有 `defaultFormatter` 改为 ESLint 并让 ESLint 承担 fix。

See Also: PB-20260901-001

### Resolution

2026-09-01：拿到 antfu 原版配置原文（`cdn.jsdelivr.net/gh/antfu/vscode-settings@main/.vscode/settings.json`）
坐实了根因——antfu 的 `prettier.enable: false` 上一行就是他自己的注释
`// I only use Prettier for manually formatting`，且他**没有给任何语言设
`editor.defaultFormatter: esbenp.prettier-vscode`**，格式化由 ESLint 承担。
被审查的文件把"antfu 的开关"和"Cursor 方案的 formatter"拼在一起，两套方案互相抵消。
处置：注释掉 `prettier.enable`，13 处 formatter 恢复；同时修掉
`[vue]` 指向 `vscode.typescript-language-features`（不能格式化 Vue SFC，同类死配置）。
核对要点沉淀为 PB-20260901-001 第 1.1 节。


## [ERR-20260901-002] harness-creator 的 validate-harness.mjs 把「嵌套目录 + 中文」harness 误判成 20/100

**Logged**: 2026-09-01T12:04:44 | **Status**: pending | **Tags**: harness, agent, false-negative, scoring, i18n

### Summary
结构评分器只在仓库根查 7 个固定文件名，且只匹配英文关键词；产物放在 `harness/` 子目录、标题写中文的项目会拿到 20/100 的假阴性，bottleneck 还会被误导到「instructions」。

### Details
- `loadHarnessFiles()` 对 `AGENTS.md` / `feature_list.json` / `progress.md` / `session-handoff.md` / `init.sh` 逐个做 `path.join(root, name)`，**不递归子目录**。QCM V2 把全部产物放在 `harness/`，仓库根只留一个 44 行纯路由的 `AGENTS.md`（无任何条文，符合渐进披露设计）→ 只有「Agent instruction file exists」一条通过，总分 20/100。
- `structuredHas()` 先抽取标题 / 列表 / 表格 / 粗体行，再匹配英文短语：`Startup Workflow`、`Definition of Done`、`One feature at a time`、`Last Updated`、`Recommended Next Step` 等。中文标题 `## 核心工作流（Core Workflow）`、`## 当前状态`、`## 下一步` 一处都不命中。
- `jsonFeatureList()` 要求每条 feature 有字符串 `name` + `description`；项目用 `title` + `rationale`（语义等价且更丰富，另含 `definition_of_done` / `scope_boundary` / `context_to_read`）→ 判为「tracker is invalid」。
- 实测对照：同一套产物，`--target d:\Desktop\qcmV2` = 20/100；`--target d:\Desktop\qcmV2\harness` = 44/100（instructions 1/5、scope 1/5、state 3/5、verification 3/5、lifecycle 3/5）。
- 误判的代价方向是错的：报告会指向「instructions 是瓶颈，重写指令层」，而这个 harness 的指令层恰恰是它最强的一环（<120 行导航图 + 任务导航表 + 分层门禁）。真正缺口——指令文件没有路由到状态产物、没写 WIP 上限与 scope 边界、没写会话收尾流程——被淹没在 12 条失败里看不出来。

### Suggested Action
1. 跑分前先确认产物真正所在的目录，把那个目录传给 `--target`，不要默认传仓库根；
2. 中文 harness 用中英并列标题（`## 核心工作流 / Startup Workflow`），一次消掉 4~5 条关键词失败，对人类读者无副作用；
3. 把失败项按「关键词误判」与「结构真缺口」分成两堆，只对后者动手；
4. 判定真缺口的可操作标准：假设一个全新会话的智能体只读 `AGENTS.md`——它能否自己找到 `progress.md` / `feature-list.json` / `session-handoff.md`？能否知道 WIP 上限、scope 边界在哪、会话结束要做什么？任一项答不上来就是真缺口，与评分无关；
5. `feature-list.json` 若必须过 `jsonFeatureList()`，补 `name` / `description` 字段即可（或保留 `title` / `rationale` 并接受该项失败，不要为此削弱现有 schema）。

See Also: PB-20260827-001

---

## [ERR-20260901-003] agent 维护的状态文件产物计数虚报——声称 47 实测 43，旧数字同样虚且沿袭放大

**Logged**: 2026-09-01T14:07:38 | **Status**: pending | **Tags**: harness, agent, metadata, drift, audit

### Summary
AI 会话生成的 harness 状态文件（progress.md / session-handoff.md）里「产物数量」声称 47 个（26 md + 15 脚本 + 3 JSON + 2 init + 1 冻结清单），`git ls-files harness/` 实测 43（24 + 14 + 3 + 2）；分项还把 legacy-freeze.json 既算进「3 个 JSON」又单列为「1 份冻结清单」双重计数；追溯旧口径声称 49 实为 46——数字漂移跨会话沿袭并放大。

### Details
- 根因：agent 按上一轮数字做增量推算（49 − 3 md − 2 py + 1 py + 1 json ≈ 47）而非实测，三个环节叠加失真——基线本身已虚 + 推算引入新误差 + 分项口径重复计数；
- 危害：这类数字会被后续会话当作事实引用（「产物 47 个」进入 session-handoff 状态行与交接记录），错误随状态文件繁殖；
- 发现方式：对抗式审查执行「声称的事实必须实测」——`git ls-files harness/` 按扩展名分组统计，与文档声称逐项对账。

### Suggested Action
1. agent 状态文件里任何计数类断言（产物数 / 文件数 / 规则数 / 命中数）禁止从上轮数字推算，必须命令实测（`git ls-files` 分组统计、脚本输出）；
2. 分项口径唯一化：每个文件只归入一个分项（JSON 与「冻结清单」互斥），总数 = 分项之和可自检；
3. 对抗式审查清单固定加一条：声称的数字逐个用命令复核，报「命中数==冻结数」这类成对数字时两侧都要验。

See Also: PB-20260901-002

### Resolution

2026-09-01：对抗式审查发现后当场订正 progress.md / session-handoff.md（47→43，分项 24/14/3/2），并在数字旁标注「经 git ls-files 实测」来源，防止下一会话再次沿袭虚数。

---

## [ERR-20260902-001] cargo test 二进制启动即崩 STATUS_ENTRYPOINT_NOT_FOUND——用独立 bin 绕过导出 tauri-specta 绑定

**Logged**: 2026-09-02 | **Status**: resolved | **Tags**: cargo, test-harness, tauri, specta, windows

### Summary
Windows 上 `cargo test export_bindings` 的测试二进制启动即崩（STATUS_ENTRYPOINT_NOT_FOUND 0xc0000139），与代码逻辑无关；同一 crate 用 `cargo run --bin` 编出的普通二进制运行正常。绕过：把绑定导出逻辑放进 `src/bin/export-bindings.rs`，用 `cargo run --bin export-bindings` 替代 `cargo test -- --ignored`。

### Details
- 场景：tauri-template 用 tauri-specta 导出 TS 绑定，官方惯例是 ignored test（`#[cfg(test)] #[test] #[ignore] fn export_bindings()`）；
- 现象：`cargo test export_bindings -- --ignored` 编译通过，运行瞬间崩，Windows 事件码 0xc0000139（入口点未找到）；
- 排除法：`PATH` 清成最小集无效；用 rustc 直接编最小 exe 正常运行 → 环境能加载新编译 PE，问题锁定在 test harness 二进制的运行时依赖（harness 链接的某个 DLL 缺导出/版本不匹配）；
- 相邻坑：换 bin 通道后导出又报 `BigIntForbidden(i64)`——specta 默认拒绝 64 位整数字段（createdAt/lastActiveAt 等 i64），需显式 `specta_typescript::Typescript::default().bigint(BigIntExportBehavior::Number)`（API 以本地 registry 源码为准，0.0.9 版本确认存在）。

### Suggested Action
1. 遇 test 二进制启动即崩（0xc0000139），先用最小 rustc exe 验证环境，再切 `src/bin/` 独立 bin 绕过 harness，不要死磕 test 环境；
2. tauri-specta 导出含 i64 的类型时，直接配上 `.bigint(BigIntExportBehavior::Number)`，不要等报错；
3. 该 bin 依赖 `lib.rs` 中目标模块 `pub` 可见（如 `pub mod bindings`），这是与 test 方案的第二个差异点。

See Also: ERR-20260831-004

### Resolution
2026-09-02：`cargo run --bin export-bindings` 导出 `src/lib/bindings.ts` 成功（21 个新命令 + 13 个类型），配 `.bigint(...)` 后无 BigIntForbidden；随后 `cargo check`（8.87s）、`npm run lint`（0 错）、`npx tsc --noEmit`（0 错）三重门禁全绿。

---

## [ERR-20260903-001] Grep 类搜索工具单次输出截断 15 条，大批量清单提取静默不完整

**Logged**: 2026-09-03 | **Status**: resolved | **Tags**: grep, search, truncation, evidence

### Summary
Grep 类封装工具单次调用输出截断到 15 条匹配：86 列清单提取到一半、17 条 ID 只返回 15 条，两次据「搜完了」的表象下结论险些漏项；返回里既无 truncated 标记也无匹配总数，截断不可感知。

### Details
- 场景一：从 762 行 vue 提取全部列 field 顺序核对 86 列清单，只返回前 15 个 field，中间缺段导致残留重复列块未被发现；
- 场景二：确认 ERRORS.md 当日序号时 `^## \[ERR-` 恰好 15 条，与 INDEX 统计 17 条矛盾，改精确 pattern 二次查询才发现尾部还有 2 条；
- 机制：工具层对返回结果做 head 截断（非 rg 本身），「结果看起来完整」不可信；预期命中少时看不出异常，命中一多就静默丢尾部。

### Suggested Action
1. 预期匹配可能超过十几个时不拿 Grep 枚举全量清单：改 Read 全文人工提取，或 PowerShell `Select-String | ForEach-Object { $_.Line.Trim() }` 拿全量；
2. 用「总数旁证」交叉验证：索引统计、`Measure-Object -Line` 等与 grep 命中数对不上即说明截断；
3. 确定性结论（序号、列清单、差集比对）一律以全量提取为准，单次 grep 结果只当线索。

See Also: ERR-20260827-001

### Resolution
2026-09-03：商品主数据 86 列改用 Read 全文 + PowerShell Select-String 提取核对，最终契约 visible_columns 与前端列序 Compare-Object 比对 MATCH（86=86）；ERRORS.md 序号确认改用精确 pattern `ERR-2026090[0-9]-\d+` 二次查询补齐尾部 2 条。

---

## [ERR-20260903-002] mvn 不在 PATH：Maven 只存在于 .m2\wrapper\dists 发行版缓存

**Logged**: 2026-09-03 | **Status**: resolved | **Tags**: maven, path, windows, wrapper

### Summary
Windows 开发机未单独装 Maven，`mvn` 不在 PATH（CommandNotFoundException），但 Maven 发行版其实已被 wrapper 下载缓存到用户目录，用完整路径调用即可编译，无需安装。

### Details
- 现象：`mvn -s settings.xml -f pom.xml compile` 报「无法将"mvn"项识别为 cmdlet…」；
- 机制：Maven Wrapper 把发行版解压到 `%USERPROFILE%\.m2\wrapper\dists\apache-maven-<ver>\<hash>\bin\mvn.cmd`（hash 目录名不可猜，须探测）；
- 探测：对候选根数组（.m2\wrapper\dists、JetBrains 安装目录等）循环 `Get-ChildItem $p -Recurse -Filter mvn.cmd -Depth 5`，命中后 PowerShell 用调用操作符 `& "完整路径" ...` 执行（带空格路径不能直接裸写）。

### Suggested Action
1. PATH 无 mvn 时先探测 `%USERPROFILE%\.m2\wrapper\dists`（凡 wrapper 项目构建过一次必有）与 IDEA 捆绑 Maven（`<IDEA>\plugins\maven\lib\maven3\bin\mvn.cmd`），再谈安装；
2. 探测限定候选根 + `-Filter mvn.cmd -Depth 5`，避免全盘扫描；
3. `-q` 静默模式下编译成功无输出，以 `$LASTEXITCODE` 判定成败；多模块 compile 可能耗时数分钟，放后台终端轮询。

### Resolution
2026-09-03：定位 wrapper 缓存 mvn.cmd（3.9.9），`& <path> -s settings.xml -f jp-console/pom.xml -DskipTests compile -q` 编译通过（EXIT=0）。

---

## [ERR-20260903-003] dingtalk-jsapi union getAuthCode 声明返回 { authCode }，实际透传底层 { code }，解构得 undefined 导致免登空 code

**Logged**: 2026-09-03 | **Status**: resolved | **Tags**: dingtalk, jsapi, types, axios

### Summary
dingtalk-jsapi 3.2.9 的 union 层 `dd.getAuthCode` 的 .d.ts 声明返回 `{ authCode }`，但 union 层源码只是 `ddSdk.invokeAPI('runtime.permission.requestAuthCode', params)` 纯透传，底层 platform 类型明确返回 `{ code }`；按声明解构得 undefined，免登请求丢失 code 参数，后端报「authCode 不能为空」。

### Details
- 现象：钉钉容器内免登 toast「免登失败：authCode 不能为空」，请求实际发出但无 code 参数；
- 定位：union/getAuthCode.js 仅 `invokeAPI(actualCallApiName, d)` 无响应改名；union/getAuthCode.d.ts 声明 `IUnionGetAuthCodeResult { authCode }` 与 runtime/permission/requestAuthCode.d.ts 的 `IRuntimePermissionRequestAuthCodeResult { code }` 矛盾，后者才是真实返回；
- 放大机制：axios params 中值为 undefined 的键会被静默丢弃（不报错），后端报「参数为空」时要先查前端是否传了 undefined；
- 误导源：playbook PB-20260902-003 第 3.1 节表格当时按 .d.ts 记为「返回 { authCode }」，本次已更正。

### Suggested Action
1. 用 dingtalk-jsapi union API 前与 platform 层 .d.ts 交叉验证响应结构，union 类型声明可能失真；
2. 对 SDK 返回做兼容提取 `res?.authCode ?? res?.code ?? ''`，空值显式 throw 并携带 corpId 与原始返回，别让空值流到请求层；
3. 呼应 ERR-20260827-001：类型/文档声明与运行时证据冲突时，以源码（js 实现链）为准。

### Resolution
2026-09-03：ding-h5 utils/dingtalk.ts getAuthCode 改为兼容提取两键 + 空值显式报错；另查明 dev 侧 vite-plugin-mock-dev-server 曾抢答 /api/auth/dingtalk/login（假 token 干扰真机联调），已移除该插件与 mock 目录，dev 经 vite proxy 直连真实后端；pnpm lint 通过。

---

## [ERR-20260903-004] crate 新增辅助 bin 后 tauri dev 报 could not determine which binary to run

**Logged**: 2026-09-03 | **Status**: resolved | **Tags**: cargo, tauri, default-run, multi-bin, windows

### Summary
为绕过 test harness 崩溃（ERR-20260902-001）在 src/bin/ 加了 export-bindings.rs 后，`tauri dev` 启动即报 `error: cargo run could not determine which binary to run`；Vite 正常 ready，卡在 Rust DevCommand。修复：Cargo.toml `[package]` 加 `default-run = "tauri-app"`。

### Details
- tauri dev 执行 `cargo run --no-default-features`，crate 有 ≥2 个 binary 且未声明 default-run 时 cargo 拒绝自动选择（报文列出 available binaries: export-bindings, tauri-app）；
- 前半段（beforeDevCommand/vite）完全正常，容易误判为前端或包管理器问题——用户最初报「pnpm tauri dev 运行不起来」，实际与 pnpm/npm 无关；
- tauri CLI 对该错误非阻塞：打印 error 后仍打 `Info Watching ... for changes` 随后进程退出，关键报错淹没在长输出里易漏看。

### Suggested Action
1. crate 内加任何 src/bin/*.rs 辅助二进制后，若主程序也是 bin（tauri 模板必然是），同步在 Cargo.toml `[package]` 加 `default-run = "<主 bin 名>"`；
2. tauri dev 报障先看 `Running DevCommand (cargo run ...)` 之后的输出，别被 vite ready 误导；
3. 辅助 bin 的调用始终用 `cargo run --bin <name>`，不依赖 default-run。

See Also: ERR-20260902-001

### Resolution
2026-09-03：src-tauri/Cargo.toml 加 `default-run = "tauri-app"`（附注释说明原因）后 `npm run tauri dev` 成功：编译 1m24s，`Running target\debug\tauri-app.exe`，应用日志正常（Application starting up / quick pane 注册）。

---

## [ERR-20260903-005] 并行依赖升级触发 eslint 规则回归——「新 error + 失效 disable」双信号指纹

**Logged**: 2026-09-03 | **Status**: resolved | **Tags**: eslint, react-hooks, dependency-upgrade, lint

### Summary
lint 门禁全绿后突然变红，报错文件却无任何未提交改动——根因是并行会话的依赖升级提交（chore(deps)）让新版 eslint-plugin-react-hooks 的 `react-hooks/set-state-in-effect` 规则生效。

### Details
- 双信号互相矛盾：①既有代码新增 error（use-mobile.ts 在 effect 内同步 `setIsMobile(...)` 初始化 matchMedia 快照）；②上次按旧版规则加的 `eslint-disable-next-line react-hooks/set-state-in-effect`（ThemeProvider.tsx）反而报 "Unused eslint-disable directive"；
- 「同一规则一处新报错、一处 disable 失效」是规则行为变化的指纹：说明规则实现变了，而不是代码被改动；
- 定位链：git status（报错文件不在改动列表）→ git log 最新提交即依赖升级 → 版本升级导致规则重算。

### Suggested Action
1. lint 全绿后变红：先 `git status` 排除本地改动，再 `git log` 找依赖升级提交，避免误改无辜文件；
2. 订阅外部系统（matchMedia/事件源等）场景的 setState-in-effect，标准替代是 `useSyncExternalStore(subscribe, getSnapshot)`——语义等价、首帧即有正确值、无需 useState+useEffect 中转；
3. "Unused eslint-disable directive" 的 disable 注释直接删除（规则已不再匹配该行）。

### Resolution
2026-09-03：use-mobile.ts 重写为 useSyncExternalStore、ThemeProvider.tsx 删除失效注释，`npm run lint --max-warnings 0` 恢复 EXIT 0，`tsc --noEmit` EXIT 0。

---

## [ERR-20260904-001] CI 老镜像 glibc < 2.29 导致 rollup 原生二进制 dlopen 失败——pnpm overrides 换 WASM 版

**Logged**: 2026-09-04 | **Status**: resolved | **Tags**: ci, glibc, rollup, pnpm-overrides, wasm
**See Also**: PB-20260904-002, ERR-20260904-002(LRN), LRN-20260904-001

### Summary
Vite 项目 CI 构建末尾（vite-plugin-pwa → workbox-build → rollup）报 `ERR_DLOPEN_FAILED`，cause 是 `/lib64/libm.so.6: version 'GLIBC_2.29' not found`——CI 基础镜像是老 glibc（CentOS 7 系，2.17），而 rollup 4.62.3 的 `rollup.linux-x64-gnu.node` 要求 GLIBC_2.29。用 pnpm overrides 把 rollup 换成官方 WASM 版 `@rollup/wasm-node`，一次解决且与 glibc 版本解耦。

### Details
- 报错定位链：错误主体是 `parseAst.js`（rollup 的 require 链）→ `[cause]` 里才是真因 `GLIBC_2.29 not found`；`ERR_DLOPEN_FAILED` 本身只说明「.node 在但加载不了」，具体缺哪个符号要看 cause；
- 为什么只有 workbox 挂：vite 8 已走 rolldown（其原生 binding 兼容老 glibc），rollup 只剩 workbox-build（PWA 插件）一条链在用——所以 vite build 成功、generateSW 阶段才崩；
- 排除项：不是 musl（`/lib64/libm.so.6` 存在即 glibc）；不是 node_modules 平台残留（clean install 后仍复现）；`supportedArchitectures` 声明 `libc` 解决不了「二进制要求更新的 glibc 符号」；
- 方案对比：换基础镜像（升级 glibc）最彻底但动公司镜像；`@rollup/wasm-node` 是 rollup 官方 drop-in 替换，同版本号、API 一致，只影响 workbox 这条低频路径，代价是 SW 生成慢一点；
- 坑：`supportedArchitectures` 写多平台（os/cpu/libc 多值）会让 pnpm 把所有平台原生二进制都拉下来（rolldown binding 每个十几 MB），安装体积和时间成倍涨——非必要不加。

### Suggested Action
1. `pnpm-workspace.yaml` 加 `overrides: { rollup: npm:@rollup/wasm-node@^4.62.3 }`（与 rollup 同版本线）；
2. CI 脚本 install 后加快速失败校验 `node -e "require('rollup')"`，把 dlopen 失败从构建末尾提前到安装后；
3. 基础镜像升级到 glibc ≥ 2.29 后移除 override。

### Resolution
2026-09-04：ding-h5 加 override 后本地 `pnpm build:dev` 全链路通过（vue-tsc + vite build 18.95s + PWA generateSW 生成 sw.js），CI 重跑通过；lockfile 已记录 override，`--frozen-lockfile` 不受影响。

---

## [ERR-20260904-002] 本地 tauri build 正式包三道坎：插件版本预检 / updater 签名私钥 / 并发构建锁

**Logged**: 2026-09-04 | **Status**: resolved | **Tags**: tauri, build, version-mismatch, windows

### Summary
本地 `tauri build` 打正式包连续遇到三道独立关卡：npm 插件升级后 Rust crate 未联动（版本预检硬失败）、`createUpdaterArtifacts: true` 且无签名私钥（bundle 收尾必失败）、两份 build 并发（target 目录锁互等假死）。

### Details
1. **版本预检**：tauri-cli 构建前校验 npm 插件包与 Rust 插件 crate 的 major/minor 一致，不一致直接 Error 退出（编译都不开始）。npm 侧 `npm install` 在 caret 范围内自动升 minor 而 Cargo.lock 未动即触发。报错形态：`Found version mismatched Tauri packages`，逐对列出两侧版本。
2. **updater 签名**：`bundle.createUpdaterArtifacts: true` 时构建收尾要对更新产物做 minisign 签名，需要 `TAURI_SIGNING_PRIVATE_KEY`；本地没有（CI 走 GitHub Secrets），release 编译十几分钟会在最后签名步失败。
3. **并发锁**：两份 `tauri build` 同时跑互相等锁，日志只有一行 `Blocking waiting for file lock on build directory`，无其他线索；tasklist 可见两个 cargo.exe（各自完整进程树 npm → tauri-cli → cargo → rustc）。

### Suggested Action
1. 版本预检失败：Cargo.toml 插件声明是宽松 `"2"` 时无需改 manifest，用 `cargo update -p tauri-plugin-log -p tauri-plugin-updater -p tauri-plugin-dialog -p tauri-plugin-fs -p tauri-plugin-notification` 把 Rust 侧精准升到与报错中 npm 侧相同的 minor 即可，不动其他依赖；
2. 本地无签名私钥：把 `createUpdaterArtifacts` 改 false（exe/msi 照常产出）或提供 TAURI_SIGNING_PRIVATE_KEY；打包前预检 `Get-ChildItem Env:TAURI*`；
3. 锁互等：用 `Get-CimInstance Win32_Process` 按命令行识别进程（node 只杀含 tauri.js / npm-cli run tauri 的，切勿按映像名全杀 node——IDE 本身也是 node），`taskkill /PID <树根> /T /F` 连进程树整组清掉，确认无残留后单实例重跑。

### Resolution
2026-09-04：createUpdaterArtifacts 置 false 并保留；cargo update 五插件对齐（dialog 2.7.3 / fs 2.5.2 / log 2.9.1 / notification 2.4.0 / updater 2.11.0，与 npm 完全一致）；两棵构建树 11 个进程清杀干净，交还用户单实例手动打包。

See Also: ERR-20260903-004

---

## [ERR-20260904-003] PowerShell 5.1 处理 git 中文文件名八进制转义：内联解码失败、blob 导出有损、控制台读取乱码

**Logged**: 2026-09-04 | **Status**: pending | **Tags**: git, powershell, encoding, filename

### Summary
git 默认对非 ASCII 路径输出八进制转义（`"\345\270\202..."`），在 PowerShell 5.1 下用内联 `-replace` 解码会产出双重乱码；`git cat-file -p <blob>` 管道/重定向导出含中文的报告会编码有损；GBK 控制台读中文路径文件一律乱码。正确姿势：放弃解码用原始输出人工比对、跨分支取证用 blob 导出后立即回读验证、内容读写全部走工具链不经过控制台。

### Details
场景：对抗式审查需恢复只存在于另一分支的历史报告（文件不在当前工作区）。连环踩坑：
1. `git status --short` / `git ls-tree` 输出中文路径为八进制转义串，内联脚本 `-replace '\\([0-7]{3})', {...}` 解码失败——PowerShell 按 GBK 处理管道字节流，解码后得到双重编码损失的乱码。
2. `git cat-file -p <hash> | Out-File` 导出 UTF-8 中文报告，经管道解码 + Out-File 默认编码双重转换后内容部分有损。
3. `Get-Content` 直读中文路径文件在 GBK 控制台下显示乱码（后续查看同仓库文件时同样复现），无法据此判断内容正确性。

### Suggested Action
1. **不要在 PowerShell 内联解码 git 转义文件名**：需要文件名清单时直接用 `git ls-tree` / `git status` 原始输出，把已知八进制串与输出人工比对；或临时 `git -c core.quotepath=false` 让本次命令输出 UTF-8 原文（用 `-c` 进程级参数，勿改全局配置）。
2. **跨分支取证用 blob 导出**：`git ls-tree <branch> -- <path>` 拿 blob hash → `git cat-file -p <hash>` 落盘；导出后**必须**用文件读取工具（Read/Grep，非控制台）回读验证，内容可辨即可继续用；不可辨改用 `git show <branch>:<path>` 配合输出重定向字节数校验。
3. **中文路径/内容读写一律走工具链**：Read / Grep / Glob 按 UTF-8 处理；PowerShell 控制台仅用于启动命令与看退出码，不用其判断内容正确性。

---
## [ERR-20260907-001] 前端「菜单打不开」根因是共享库停留在旧版脚本——版本错位三层核对 + 无客户端时用 .m2 JDBC 驱动直查实库

**Logged**: 2026-09-07 | **Status**: resolved | **Tags**: jeeplus, dynamic-menu, database, diagnostic

### Summary
动态菜单系统里「菜单打不开」要先查数据库实态再怀疑代码：本例共享库被执行过旧版基线脚本（menu_code=marketQualityHome 体系），而代码分支已重构命名（marketQuality/replenishApply 体系）——旧菜单 href 指向前端已删除的路由，新版菜单、业务表、pageSchema 表单模型又从未入库，三层错位同时存在。

### Details
症状：市场补配菜单点击后无内容。三层排查定位：
1. **前端路由机制**：动态菜单存 localStorage（登录时写入），`filterAsyncRouter` 把 href 作为组件路径，`loadComponent` 在 `import.meta.glob(views/**/*.vue)` 里匹配，匹配不到落 empty 空组件——组件缺失不报错只渲染空白；
2. **菜单 DML 脚本静态审查**：发现两个脚本缺陷——重建共享父节点（marketReplenish）的配置脚本 DELETE 清单不含挂其下的主单据菜单（重跑即孤儿化，树上消失）；主单据脚本 parent_ids 拼接 CONCAT 缺逗号（'1,rootIdfolderId,'）；
3. **数据库实态（决定性证据）**：sys_menu 里只有旧版菜单树（menu_code/href 与当前代码全不匹配）+ 一个新版空壳一级节点；biz_replenish_* 业务表、sys_model_table 表单模型、sys_menu_form_column 列契约全部缺失；旧节点的 create_time 证明执行的是基线提交版本的脚本，当前分支的 DDL/DML 从未执行。
诊断技巧：本机无 mysql 客户端时，用 `~/.m2` 仓库里现成的 mysql-connector-j jar + Java 11+ 单文件源码模式（`java -cp driver.jar DbCheck.java`）做只读直查，比装客户端轻量；PowerShell 控制台中文乱码不影响 id/menu_code/href 等 ASCII 字段判读。

### Suggested Action
1. 动态菜单类故障的诊断顺序：代码路由映射机制 → 菜单 DML 脚本审查 → 实库 SELECT（sys_menu 全量含 del_flag、information_schema.tables、表单模型三表）——实库是唯一能终结猜测的证据层；
2. 修复 = 清理旧版残留（按旧版 menu_code/form_code/dict type 写 DELETE，入库为正式清理脚本）→ 按依赖顺序重跑当前分支 DDL→DML → 刷新后端缓存（reloadSysCache 或重启）→ 前端退出重新登录（localStorage 菜单缓存必须重新登录才更新）；
3. 写多页面菜单 SQL 的两条军规：重建共享父节点的脚本，DELETE 清单必须覆盖挂在该父节点下的全部子孙 menu_code，否则重跑产生孤儿菜单（树上消失且无报错）；parent_ids 拼接 CONCAT 时每段 id 后都要补逗号。

4. 多分支平行交付同一功能 + 共享开发库 = 系统性错位风险：任一方向在库上执行过菜单 DML 后，checkout 到另一分支必现「菜单打不开」（本条第 2 次发生即此形态：库上午被 prd 分支脚本刷成 marketQuality 体系，10 分钟后切回 qoder 分支）。切分支前先确认库内菜单体系归属，切后用一条 SELECT 比对 href 与前端 views 目录；
5. 排查两个坑：① git reflog 的 checkout 时间戳 + sys_menu.create_time 交叉，可还原「谁在何时刷了库/切了分支」时间线，一条证据链终结猜测；② LEFT JOIN 判「是否绑定」必须 COUNT(右表列)——COUNT(*) 按左表行计数，无匹配也返回 1，本次险些据此误判；菜单无任何角色绑定却可见 → 当前账号是超管（绕过角色过滤），重建菜单后无需授权即可见。

### Resolution

2026-09-07（第 1 次）：清理旧版 marketQualityHome 体系残留 → 按依赖顺序重跑 marketQuality 体系 DDL/DML → reloadSysCache → 前端重新登录，菜单恢复。
2026-09-07（第 2 次，同日反向复现）：共享库 10:07 被 prd 分支《补配配置菜单权限.sql》刷成 marketQuality 体系（但未建 biz_replenish_* 物理表，pageSchema 指向空表），10:18 用户 checkout 切回 qoder 分支 → href=/market/replenish* 与 views/marketReplenish/* 错位，菜单点开空白。修复面比第 1 次扩大：除 sys_menu（含 sys_role_menu 绑定残留）外还需清 pageSchema 三表（sys_model_table/column/column_query）、sys_menu_form_column、sys_language key；与目标体系不冲突的字典（replenish_* 主单据字典 9 个）保留不动。清理脚本已入库为《市场补配菜单修复-清理prd残留.sql》，幂等可重跑。

2026-09-07（第 3 次，同日新变体——进程错位而非库错位）：接口报「错误:脚本执行异常」通用脱敏文案，实库两张业务表已建齐、列结构与实体完全一致仍复现。根因：后端 JVM 10:05 自 prd 分支编译启动（target/classes 只有 prd 的 ReplenishReasonController），10:18 切回 qoder 分支后未重启——prd 与 qoder 两分支的 Controller 路径（/market/replenishReason）与权限码（market:replenishReason:list）完全同名，请求可正常路由鉴权，但 prd 实体查的表是 biz_replenish_reason（不存在）→ 1146 → ExceptionTranslator 统一脱敏文案。用户按 qoder DDL 建 biz_market_replenish_reason 自然无效——建表动作与运行进程查询的表名根本对不上。判定证据链：Get-CimInstance Win32_Process 进程启动时间 vs git reflog checkout 时间戳交叉 + target/classes 中孤儿类与缺失类存在性比对（prd 的 .class 在、qoder 的不在 = 运行的是 prd 代码）。修复：停止进程 → Rebuild Project → 重启 → reloadSysCache → 前端重新登录。两条军规：①错位有三个独立层（库 DML、源码分支、运行中 JVM 进程），任一层落后都产生症状且症状不同——库错位→菜单空白/契约失效，进程错位→接口 SQL 异常但库表齐全；三方核对顺序：实库 SELECT → git reflog → 进程启动时间 vs .class 时间戳。②切分支后重启后端必须 Rebuild（清空输出目录）而非增量编译——IDEA 增量编译不清孤儿类，prd/qoder 双 Controller 同路径共存会触发 Spring ambiguous mapping 直接启动失败。

---

## [ERR-20260907-002] JeePlus 字典 DML 漏隐藏必填列 parentcode：INSERT 报 1364，字典静默缺失

**Logged**: 2026-09-07 | **Status**: resolved | **Tags**: jeeplus, mysql, dml, dict, schema-drift

### Summary

按仓库基线 DDL 的列清单写 `sys_dict_value` INSERT，在共享库执行必报 1364 Field 'parentcode' doesn't have a default value——目标库表结构比脚手架基线多了 NOT NULL 无默认值的业务列，且脚本先 DELETE 后 INSERT，字典从此「从未插入成功」而静默缺失（页面品类列显示原始码值而非翻译，无任何报错）。

### Details

- 现象：字典 DML 执行报 1364；若用逐条自动提交的执行器重跑，DELETE 已生效、INSERT 失败——字典处于被删空状态（幂等脚本重跑可恢复，但要意识到中间态页面已无字典可用）；
- 根因：共享库 `sys_dict_value` 有 `parentcode varchar(64) NOT NULL` 无默认值（既有字典 commonYN/scrap_category 的 parentcode 均为空串），仓库基线 DDL 无此列，按基线写的 INSERT 列清单必缺它；
- 一般化：目标共享库的表结构 ≠ 仓库基线 DDL（多团队/多分支各自加列），跨环境执行 INSERT 前必须用 information_schema 核对 `is_nullable='NO' AND column_default IS NULL` 的隐藏必填列；
- 连带发现：`sys_language` 唯一必填列是 id（脚本已供 UUID）无此问题——每张表独立核对，不能类推；
- 补列时的错位陷阱：列清单把 parentcode 放在 status 与 create_by_id 之间，VALUES 的空串必须插在对应位置——只往行尾追加会造成「列数一致但语义错位」（parentcode 拿到 create_by_id 的值，datetime 列拿到 'admin'，执行期报 1292）。

### Suggested Action

1. 跨环境执行 INSERT 前先查目标库隐藏必填列：`SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name=? AND is_nullable='NO' AND column_default IS NULL`——差集列全部显式补值，口径对齐既有行（空串/0）；
2. 幂等 DELETE+INSERT 脚本失败后，先确认当前是「事务回滚后的原状」还是「逐条提交后的删空态」，两者都可用重跑恢复；
3. 批量补列用模式化替换（如 `, '1', '1', NOW()` → `, '1', '', '1', NOW()`）而非逐行尾追加，替换后逐列对齐复核一遍。

### Resolution

2026-09-07：《市场补配字典.sql》两处 sys_dict_value INSERT 列清单补 parentcode、37 行 VALUES 在 status 与 create_by_id 之间补空串（与既有行口径一致）；重跑后品类 3 项 + 省份 34 项入库，页面品类列翻译恢复。

See Also: ERR-20260907-001

---

## [ERR-20260907-003] MCP 工具「可用性检查」误判：业务错误响应≠工具故障——aop_markdown 三级试错定位参数

**Logged**: 2026-09-07 | **Status**: resolved | **Tags**: mcp, api-platform, diagnostic, permission

### Summary

检查外部集成 MCP 工具可用性时，平台业务错误响应是「链路已通、参数有误」的信号而非工具故障：aop_markdown（下载接口 markdown 文档，参数 appCode=调用方应用编码 / targetAppName=目标应用名 / apiName=平台侧 API 名）经三次试调用，错误从「应用不存在」收敛到「未订阅该接口，无权查看」，证明进程、网络、鉴权、应用识别全部打通，只剩接口级订阅权限待到平台控制台确认。

### Details

- 背景：三参数均未在项目代码/配置中登记，无历史调用记录可查；
- 试错路径：① 用报文里出现的 APPCODE + 猜测的目标应用名调用 → 返回 `{"code":600,"message":"应用不存在"}`（业务码，非 MCP 异常）——工具可调用、请求已达平台业务层，但该组合未登记；② 从系统库接口平台登记表找权威值——接口发布 URI 模式为 `/interfaces/invoke/aop/<调用方编码>/<目标路径首段>/…`，调用方编码即 URI 中 aop/ 后首段，目标应用名即其后目标路径首段，apiName 取平台侧登记的 API 标识；重试 → 错误变为「未订阅该接口」，说明 appCode/targetAppName 组合已被平台识别，错误粒度收敛到接口级权限/参数形态；③ 换项目内部接口编码仍同错——残余原因是订阅范围或 apiName 形态与平台登记不一致，参数试错已到边界；
- 关键认知：该 MCP 错误处理层把平台业务响应当正常结果返回（不抛异常）——「MCP 调用成功返回」完全不代表业务成功，必须读业务 JSON 的 code/message；
- 方法论收益：每次试调用都应产生确定性的收敛信息（哪个参数被证实正确），而非盲目换参数。

### Suggested Action

1. MCP/外部服务可用性检查流程：读工具 schema → 选最无害工具试调 → 把业务错误响应当「链路已通」的证据继续按错误粒度定位参数；只有传输层错误（连接拒绝/超时/进程未启动）才算「MCP 不可用」；
2. 集成工具参数未知时，先在系统库登记表（应用登记 / 接口登记）找权威数据源，从发布 URI 的 URL 模式反推真实 appCode/targetAppName/apiName，再用错误消息粒度定位残余错参数；
3. 「未订阅该接口」类错误需到集成平台管理控制台核实应用编码的订阅清单与接口文档权限，参数盲试无法解决。

### Resolution

2026-09-07：诊断完成——MCP 工具链确认可用（可达平台业务层且错误逐级收敛），端到端文档拉取待在集成平台控制台确认订阅清单后补验。

---


## [ERR-20260907-004] 一次性清理 DML 脚本绕过门禁：修复类 SQL 同样是新增代码，别名命中 S-W2

**Logged**: 2026-09-07 | **Status**: resolved | **Tags**: sql, architecture-gate, legacy-freeze, review

### Summary

一次性「清理/修复」类 SQL 脚本被当作临时产物直接提交，未经 arch-check-sql 门禁，`DELETE rm FROM sys_role_menu rm JOIN sys_menu m ...` 的表别名新增 4 处 S-W2 违规，使此前记录的「门禁全绿」交接状态失真；对抗式审查复跑门禁才暴露。

### Details

- 背景：分支切换事故（另一分支菜单脚本污染共享库）后赶写的菜单清理脚本及其 rollback，用 `DELETE rm FROM sys_role_menu rm JOIN sys_menu m ON rm.menu_id = m.id WHERE m.menu_code IN (...)` 形式删角色绑定；
- 为什么错：多表 DELETE 的 `rm`/`m` 属于缩写别名，违反「列名一律全表名限定（别名必须等于表名）」规范；门禁以冻结清单判定「新增命中」，别名是 commit 后第一次复跑 arch-check-all 才被发现（SQL 端 exit 1，新增 4）；
- 深层教训：验证证据有时效——最后一次绿色门禁之后任何 commit 都会使其失效，仍引用旧记录的交接/进度文件会误导下个会话；
- 正确改写（MySQL 合法、语义等价）：子查询表不是删除目标表时，可用 `DELETE FROM sys_role_menu WHERE sys_role_menu.menu_id IN (SELECT sys_menu.id FROM sys_menu WHERE sys_menu.menu_code IN (...))`——零别名、全表名限定，幂等可重跑。

### Suggested Action

1. 任何新建/编辑的 SQL 文件（含清理、修复、迁移、rollback）一律先跑 arch-check-sql 再提交，不存在「一次性脚本免检」；
2. 多表 DELETE 需要按另一表过滤时优先改写为 `DELETE FROM target WHERE target.col IN (SELECT other.col ...)`；若必须 JOIN 形式，列限定用全表名；
3. 会话收尾若在最后一次门禁之后又产生 commit，必须复跑门禁并同步更新交接/进度文件中的绿色声明。

### Resolution

2026-09-07：两个脚本 4 处别名全部改写为全表名子查询形式，复跑 arch-check-sql exit 0（S-W2 命中 230 = 冻结 230 / 新增 0），交接与进度文件同步订正。

See Also: ERR-20260907-001

---

## [ERR-20260907-005] 脚本重组把交付脚本改烂尾：能力段丢失、头注释与内容自相矛盾

**Logged**: 2026-09-07 | **Status**: resolved | **Tags**: sql, refactor, script-reorganization, review

### Summary

把独立「清理 prd 残留」脚本并入主菜单脚本「市场补配菜单.sql」的重组操作中，只替换进了清理段、未接回原脚本的建菜单 INSERT 段，导致主脚本"只清不建"（qoder 18 条菜单重建能力丢失）、头部执行顺序自引用（"本脚本 → … → DML/市场补配菜单.sql"）；回滚脚本头注释宣称删除"修复链路建出的 qoder 体系数据"，与主脚本实际能力（不再建）矛盾——注释与内容的矛盾是发现烂尾的最廉价信号。

### Details

- 背景：2026-09-07 字典 parentcode 修复入库（7bdf7a69d）后，用户将清理逻辑并入主菜单脚本并删除独立清理脚本（暂存 4 改 2 删），意图形成一体化幂等脚本，但主脚本重组初稿烂尾；
- 为什么错：脚本重组/改名时没有先盘点原脚本全部能力段（清理、幂等自删、重建、说明注释），逐段核对头注释声明与文件实际内容；
- 发现路径：rollback 头注释"删掉本次修复链路建出的 qoder 体系数据"前提是主脚本会建——前提失效即矛盾暴露；主脚本头部"执行顺序"引用自身进一步佐证；
- 修复：补回建菜单段（幂等删 qoder 旧菜单含 sys_role_menu 子查询 + 重建两级目录/2 页面/14 按钮），修正头部标题/变更内容/执行顺序，rollback 头部去除 prd 分支指引（对齐 qoder-only 决策）；arch-check-sql 复跑全绿（S-W2 230=冻结 230/新增 0）。

### Suggested Action

1. 重组/改名/合并脚本时，先列出原脚本全部能力段清单，重组后逐段核对"头注释声明的能力 ↔ 文件实际内容"一一对应，重点检查执行顺序块的自引用与失效引用；
2. 回滚脚本的头注释是其主脚本能力的规格声明——两者必须互证一致，回滚宣称可删除的数据必须存在对应的建设来源；
3. 重组后的脚本交付前必须复跑对应端门禁（SQL 脚本 → arch-check-sql），确认新增违规为 0。

### See Also

- ERR-20260907-004（同批菜单脚本链路的门禁时效教训）


---

## [ERR-20260907-006] AI 生成测试用例引用虚构角色名：引用数据不实查，虚构值随产物固化

**Logged**: 2026-09-07 | **Status**: pending | **Tags**: ai-testing, reference-data, harness, mcp

### Summary

AI 生成的测试用例 / 自动化脚本引用了系统里不存在的自造角色名（「报废鉴定管理员」「仅列表权限」），而开发实际配置的角色是「报废鉴定-建单 / -审批 / -查看」。引用数据（角色 / 账号 / 字典值 / 菜单编码）是 AI 生成的虚构高发区：必须实查真实数据源并与开发口径逐字对齐，规则要同时落在事实源文档与生成器指令两层。

### Details

- 现象：`test/cases/**/test_suite.json` 与测试生成 skill 的示例里写满「报废鉴定管理员」「仅列表权限」「建单角色」；实查 `sys_role` 后发现全部不存在，开发实际配的是「报废鉴定-建单 / -审批 / -查看」（各自带唯一 role_code）。按真实环境执行时角色匹配不上：权限用例的前提直接失效。
- 根因①（生成侧）：生成器需要「引用数据」的具体值时，凭 Spec 语义 / 通用模板臆造（「管理员 / 建单 / 审批 / 仅查看」这类泛称被直接当成真实角色名），没有「先实查数据源」的动作。
- 根因②（固化侧）：虚构值不止留在产物里，还被写进了生成器 skill 的示例，后续每次生成都会再复制一遍；没人核对，错值静默扩散。
- 伴随发现（同源教训）：落规则时按文档抄「sys_role 有 is_admin 列」，实查 information_schema 发现 is_admin 在 sys_user——**写关于数据的规则，权威是实库不是文档**，文档本身会漂移。
- 环境坑：共享 MySQL 可能一址多实例数据不同步（本例靠 @@hostname / DATABASE() 回验才确认读对库）。

### Suggested Action

1. harness 事实源文档（权限 / 数据模型类）落硬约束：引用数据只能实查获得（DB MCP / 数据源 API），禁止凭记忆模板编造，禁止为跑通用例自行 INSERT 新增，匹配不到 → 停下与开发对齐，不降级为自造值。
2. 同一条规则必须同步写进生成器 skill（生成契约的核心规则表），只写事实源文档不够——生成时智能体未必去读它。
3. 实查后回验 @@hostname / DATABASE()（或等价的实例标识），防多实例错库。
4. 发现存量虚构引用 → 登记 pending 项交用户决策（对齐改写 / 作废重生成），不静默沿用也不静默修数据。

---

## [ERR-20260907-007] 文件工具回执三连失真：SearchReplace 假失败、DeleteFile 假成功、PowerShell 行数缩水

**Logged**: 2026-09-07 | **Status**: pending | **Tags**: qoder, tooling, verification, powershell

### Summary

同一轮 harness gc 清理连遇三种「回执与磁盘实际状态不符」：① SearchReplace 报 save failed 但两处替换实际已落盘（重试反而 match failed）；② DeleteFile 报 success 但 pyc 文件仍在盘上（Test-Path 复核为 True）；③ PowerShell（经 sandbox / Node fallback 代理执行）`(Get-Content f).Count` 对 116 行文件只报 94。结论：写 / 删 / 计数类操作的回执都不可单独采信，关键状态断言前必须用独立通道（Test-Path / python 二进制读取）复核。

### Details

- ① SearchReplace 误报：第一次调用报「save file failed, reason: unknown」，重读文件发现两处替换均已生效；再重试报「match failed」（原文已不在）。误报会诱导「无害重试」，若实际是部分落盘，盲目重试可能破坏已生效内容；
- ② DeleteFile 误报：删除源已不存在的 `__pycache__` 残留 pyc，工具返回 success；后续 `Get-ChildItem` 仍列出该文件、`Test-Path` 返回 True，最终 PowerShell `Remove-Item -Force` 才真正删除；
- ③ 行数统计失真：对 116 行的 AGENTS.md，`Measure-Object -Line` 报 83、`(Get-Content f).Count` 报 94（命令经 Node fallback 代理执行，疑似多字节行传输截断）；python `io.open(f, encoding='utf-8').read().count('\n')` 得真实值 116——该文件有 <120 行硬约束，靠 PowerShell 数字验收会得出「远低于上限」的错误结论；
- 共同根因：工具 API 回执与磁盘副作用之间无事务保证，中间叠加 sandbox / Node fallback 代理层后不确定性进一步放大。

### Suggested Action

1. SearchReplace 报 save failed：先重读目标文件核实哪些替换已生效，再决定是否重试；禁止直接重试；
2. DeleteFile 后：用 Test-Path / Get-ChildItem 复核；仍在则改用 `Remove-Item -Force`；
3. 行数 / 计数类验收断言：用 python 二进制读取统计，不依赖 PowerShell 管道（尤其输出标注「Node fallback executed」时）；
4. 会话交接中的「已删除 / 已修改」声明，一律以独立读取通道的观测为准，不以工具回执为准。

---

## [ERR-20260907-008] 在 agent 命令行里直接跑长命令（mvn compile）被「空闲超时」取消，且 `mvn` 不在 PATH

**Logged**: 2026-09-07 | **Status**: resolved | **Tags**: maven, windows, powershell, tooling, timeout

### Summary
`mvn -q -o -pl <module> -am compile` 在 agent 的 shell 里跑了几十秒后被判「Idle timeout - no output for too long」取消；且 `-q` 静默模式下过程无输出，加上 `mvn` 本身不在 PATH，一连串失败让人误以为编译有问题。

### Details
- 现象：① `mvn : 无法将“mvn”项识别为 cmdlet…`（不在 PATH）；② 用绝对路径后加了 `-q`，编译 40+ 秒无任何输出，工具按空闲超时杀掉进程，返回 Execution Cancelled；③ 实际上编译本身没问题（后台跑完 BUILD SUCCESS）。
- 根因：agent 命令行按「无输出」判空闲，静默模式 + 编译耗时 = 必超时；这是工具行为不是构建问题。
- 环境事实（本机）：Maven 在 `D:\apache-maven-3.6.3\bin\mvn.cmd`，`JAVA_HOME=D:\JDK`；项目 `fast-gate.ps1` 里已有同样的探测逻辑（PATH → 该 fallback）。

### Suggested Action
1. 长命令一律改**后台进程 + 日志轮询**：`Start-Process -FilePath <mvn.cmd> -ArgumentList '-o','-llr','-pl','<module>','-am','compile','-DskipTests' -WorkingDirectory <dir> -RedirectStandardOutput <log> -RedirectStandardError <err> -NoNewWindow`，不阻塞；随后另起一条命令 `Get-Content <log> -Tail n` 轮询结果。
2. 编译命令**不要加 `-q`**（或同时重定向到文件），保证有输出或至少可事后取证。
3. 先 `Start-Process` 前设 `$env:JAVA_HOME`，子进程会继承；mvn 路径优先从项目脚本（如 `fast-gate.ps1` 的 `Get-MvnCmd`）里抄，不要猜。

### Resolution
2026-09-07：按后台进程 + 日志方式复跑，`qcm-admin -am compile` 两次均 BUILD SUCCESS（48s / 33s），结论确认为工具空闲超时而非构建失败。

---

## [ERR-20260909-001] Chromium/多开浏览器报 Unable to move the cache (0x5) 与 Gpu Cache Creation failed: -2——profile 目录被残留内核进程锁死

**Logged**: 2026-09-09 | **Status**: resolved | **Tags**: chromium, electron, cache, file-lock, windows

### Summary

多开/指纹浏览器环境（Playwright launchPersistentContext 每环境独立 userDataDir）启动时 Chromium 报三连 `Unable to move the cache: 拒绝访问 (0x5)` + `Unable to create cache` / `Gpu Cache Creation failed: -2`：上一次崩溃/强杀后仍存活的内核进程锁住了该环境 profile 目录下的缓存子目录，Chromium 迁移/重建缓存目录时被 Windows 拒绝访问。修复 = 每次启动前按 profile 路径精确强杀残留进程，并 best-effort 删除 GPU 着色器缓存目录。

### Details

- 报错定位：`net\disk_cache\cache_util_win.cc`（0x5 = ERROR_ACCESS_DENIED，移动缓存目录失败）→ `net\disk_cache\disk_cache.cc:236`（创建失败 -2）→ `gpu\ipc\host\gpu_disk_cache.cc:724`（GPU 磁盘缓存创建失败）；这些是**非致命**错误，浏览器仍能启动，但着色器缓存不工作且日志刷屏；
- 根因：孤儿内核进程（主进程崩溃/被强杀后 Chromium 子进程仍挂着 `envs/{id}/profile`）持有缓存目录内文件句柄；原架构只在**应用启动时**做一次孤儿清理（按命令行匹配 userData/envs 路径强杀），单个环境在应用运行期间崩溃后再次启动，不会触发清理；
- 修复落点（fingerprint-browser `src/main/launcher/launch.ts`）：launchPersistentContext 之前插入两步——① 复用已有 `killByProfileDir(id)`（按单环境 profile 目录精确匹配命令行强杀，不误杀其他 Chromium）+ 150ms 等待句柄释放；② `repairGpuCacheDirs`：`fs.rm(join(profile, 'ShaderCache'|'GrShaderCache'|'GraphiteDawnCache'|'DawnCache'|'GPUCache'), { recursive: true, force: true })` 逐目录 best-effort 删除（失败静默吞掉）；
- 安全边界：只删可再生成的缓存目录（体积小、无用户数据），不触碰 Cookies / Local State / Cache(HTTP) 等，避免每次启动丢网络缓存；`force: true` 保证目录不存在时不报错；
- 通用化：任何「同一 userDataDir 多进程」的 Chromium 场景（Electron 自定义 userData、CDP、浏览器自动化）出现 0x5 缓存移动失败，排查方向都是「谁还拿着这个目录」——残留进程 / 杀毒软件实时扫描 / OneDrive 同步锁定。

### Suggested Action

1. 每环境启动前先按 profile 路径精确匹配命令行强杀残留进程（Windows 用 `Get-CimInstance Win32_Process` 枚举 + `taskkill /PID x /T /F`），杀完等 150ms 再动目录；
2. 启动前 best-effort 删除 GPU 着色器缓存子目录（ShaderCache / GrShaderCache / GraphiteDawnCache / DawnCache / GPUCache），Chromium 会自动重建，无数据损失；
3. 若清理后仍复现 0x5：查杀毒软件实时扫描与 OneDrive/网盘同步是否锁目录，考虑把 profile 目录移出同步盘。

### Resolution

2026-09-09：fingerprint-browser launchEnv 在 launchPersistentContext 前加入 killByProfileDir + repairGpuCacheDirs（步骤 4），`pnpm typecheck` 通过。

---


## [ERR-20260909-002] 国内免费 IP 检测接口实测：多个"知名"接口不可用，选型必须先 curl 实测

**Logged**: 2026-09-09 | **Status**: resolved | **Tags**: ip-geolocation, api, china, proxy, selection

### Summary
给 fingerprint-browser 的出口测试双源（原 ipinfo.io + ipwho.is）换国内源时，逐个实测发现多个常被推荐的国内 IP 检测接口不可用，文档/博客推荐不可信，必须先 curl 验证再接入。

### Details
- `https://ip.useragentinfo.com/json`：返回空 body（带/不带 UA 均空），疑似对本机网络或客户端有过滤；
- `https://api.vore.top/api/IPdata`：服务端 PHP Fatal error（Redis MISCONF，服务方自身故障），返回 HTML 而非 JSON；
- `https://qifu-api.baidubce.com/ip/local/geo/v1/district`（百度千帆，博客大量推荐）：返回 `ResourceNotFound`，接口已下线或路径变更；
- `https://2024.ipchaxun.com/`：空响应；
- ✅ `https://api.mir6.com/api/ip_json`：可用，JSON 含 `data.ip` + `data.countryCode`（ISO 3166-1 alpha-2，可直接消费）；
- ✅ `https://myip.ipip.net/json`：可用，JSON 含 `data.ip` + `data.location`（数组，[0] 为中文国名如"中国/美国"），需自建中文国名→ISO 映射；
- 通用教训：国内免费接口无 SLA，接口会静默下线/返回 HTML 错误页，接入前实测 + 双源并行 + 严格 JSON 解析（非 JSON 即视为该源失败）是必要的。

### Suggested Action
1. 选国内 IP 检测源时先 `curl -s <url>` 确认返回 JSON 且字段与文档一致，再看连通性稳定性；
2. 解析层对嵌套字段（`data.ip`、`data.countryCode`、`location` 数组）做空值防御，字段缺失返回空由上层兜底，不让单源失败拖垮整体；
3. 中文国名接口需维护国名→ISO 映射表（覆盖常见代理出口国家/地区即可），未命中置空。

### Resolution
2026-09-09：fingerprint-browser `src/main/proxy/testEgress.ts` 默认双源改为 `api.mir6.com/api/ip_json`（首选，直接给 ISO 码）+ `myip.ipip.net/json`（备选，中文国名映射 ISO），lint 通过，doc/tasks/04-proxy.md 同步更新。
---

