---
id: PB-20260915-003
type: playbook
title: Git 子模块做成「替身」——用目录联接指向本地已有克隆，让 AI 助手读得到代码
tags: [git, submodule, junction, ai-agent]
status: verified
source: conversation:2026-09-15
created: 2026-09-15
updated: 2026-09-15
---

# Git 子模块做成「替身」：目录联接指向本地已有克隆

## 场景

某个「上下文 / 工作区」仓库（下面记作 `<context-repo>`）用 git 子模块（submodule）引入一个体量很大的代码仓库，但：

- 子模块路径下是空目录（`git submodule status` 行首为 `-`，即未初始化）；
- 你本地**早已有一份完整克隆**（记作 `<code-repo>`），且带着未推送的本地改动；
- 你不想 `git submodule update --init`（那会从远端再拉一份**独立检出**，与你本地那份互不相干、改动不互通），也不想整份复制；
- 目标：让 AI 助手 / IDE 在 `<context-repo>` 工作区内就能直接读到 `<code-repo>` 的真实代码。

做法：把子模块路径做成**目录联接（Junction）**指向本地那份克隆。这就是「替身」——路径落在上下文仓库里，内容就是真实工作副本，单一副本、双向一致。

## 步骤

### 0. 前置确认

```powershell
cd <context-repo>
# 子模块是否已注册（看 .gitmodules），索引里是否有 gitlink
git --no-pager ls-files -s <submodule-path>   # 形如: 160000 <sha> 0  <submodule-path>
git --no-pager submodule status               # 行首 "-" = 未初始化
# 子模块路径当前是否为空目录
(Get-ChildItem -Force <submodule-path> | Measure-Object).Count
```

### 1. 删掉空的子模块目录

```powershell
Remove-Item <submodule-path> -Force   # 先确认是空目录（见下方坑点 4）
```

### 2. 建目录联接指向本地克隆

```powershell
New-Item -ItemType Junction -Path <context-repo>\<submodule-path> -Target <code-repo>
# 等价 cmd: mklink /J "<context-repo>\<submodule-path>" "<code-repo>"
Get-Item <context-repo>\<submodule-path> -Force | Select-Object FullName,LinkType,Target
```

要点：**用 Junction，不要用符号链接**。Junction（reparse point，MOUNT_POINT）在 Windows 上创建**不需要管理员权限 / 开发者模式**；`New-Item -ItemType SymbolicLink` 或 `mklink /D` 则需要提升权限或开发者模式。

### 3. 消掉父仓库 git status 噪音

做完第 2 步，父仓库会多出一行：

```
 M <submodule-path>
```

原因是索引里记录的 gitlink sha 与你本地克隆的当前 HEAD 不同，git 报「new commits」。这属正常，但会一直脏着。按「本地托管目录不参与版本跟踪」的意图，在**父仓库本地配置**里忽略它：

```powershell
git config submodule.<submodule-name>.ignore all   # 写入本地 .git/config，不提交、不影响他人
git --no-pager status --short                      # 该行消失
```

`ignore` 取值辨析：`dirty` / `untracked` 只忽略子模块工作树内的改动，**HEAD 不同（new commits）仍会报**；要连 new commits 一起静默，必须用 `all`。

## 验证「AI 能读到代码」

至少覆盖下面四条（缺一条就说明工具链只支持显式路径读取、不支持遍历检索）：

| 能力 | 验证方式 | 期望 |
|---|---|---|
| 读取文件 | 读取联接路径下任一只读文件 | 返回真实内容 |
| 列目录 | 列出联接路径 | 返回真实子目录树 |
| 内容检索 | 在联接路径下全文搜索一个已知符号 | 命中真实文件 |
| 文件搜索 | 按通配符在联接路径下找文件 | 命中真实文件列表 |

若「内容检索 / 文件搜索」漏掉联接目录，多半是检索工具本身不跟随 reparse point（例如 ripgrep 默认不跨 symlink）的问题，而非联接失效——此时显式路径读取仍可用，可改用「把 `<code-repo>` 加为工作区的第二个根目录」。

## 坑点

1. **别用 `git submodule update --init` 覆盖它**：那会把替身换成一份独立检出（从远端拉，HEAD 是索引记录的旧 sha），与你本地那份的改动完全不互通。误执行后需删目录重建联接。
2. **换机器 / 换人无效**：Junction 是本机文件系统对象，`submodule.<name>.ignore` 是本机 `.git/config`，二者都不入库；新环境要各跑一次上述命令。
3. **`.gitignore` 不能替代 `submodule.<name>.ignore`**：即便 `<submodule-path>/` 已写进 `.gitignore`，只要索引里存在 160000 的 gitlink，git 依旧跟踪并报 ` M`。
4. **重建联接前先确认目标类型**：`Remove-Item -Recurse` 作用在联接上时，旧版 PowerShell 可能顺藤删掉**目标仓库**内容。删除前先用 `(Get-Item <path> -Force).LinkType` 确认。
5. **IDE 索引可能需要重开**：部分 IDE 只在启动时枚举工作区目录，建完联接后需重新打开或触发重新索引才能搜到。
6. **改子模块名字要三处同步**：`.gitmodules` 的 `path` / `name`、索引 gitlink、`submodule.<name>.ignore`，名字不一致则 `ignore` 不生效。

## 一句话总结

子模块「替身」＝ **Junction 代替子模块检出** + **`submodule.<name>.ignore all` 消噪**。适合「本地已有工作副本、只想让工作区 / AI 看得到」的场景；**不适合**需要严格锁定子模块版本分发的场景（那种场合就该老实 `git submodule update --init`）。
