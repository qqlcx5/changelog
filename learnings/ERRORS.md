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
