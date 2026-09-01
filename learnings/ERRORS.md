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

**Logged**: 2026-09-01 | **Status**: pending | **Tags**: vscode, prettier, settings, silent-failure

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

