---
id: PB-20260910-001
type: playbook
title: Windows 上 git pull/push 因文件名含非法字符（`<` `>`）失败的绕过与恢复
tags: [git, windows, filename, recovery]
status: verified
source: conversation:2026-09-10
created: 2026-09-10
updated: 2026-09-10
---

# Windows 上 git pull/push 因文件名含非法字符失败的绕过与恢复

## 症状

`git pull` 或 `git push` 被拒，报：

```
error: invalid path '500 Sources/得到听书新/《<山海经>的世界》裴鹏程解读.md'
error: invalid path '.../《<资本论>的读法》杨照解读.md'
...
```

`git push` 还会先报：

```
! [rejected]  master -> master (fetch first)
```

根因有两层：
1. **远程领先**：本地落后远程，需先 `pull` 才能 `push`（普通 fast-forward 拒绝）。
2. **Windows 非法文件名**：远程提交里的若干文件含 `<` 或 `>`（书名号里嵌套尖括号），Windows 不允许文件名带这两个字符，`git checkout` 写盘时报 `invalid path`，导致 pull 卡死。

## 修复 A（治本）：在远程改名

仓库 owner 去 Gitee/GitHub 网页把那几个文件重命名，删掉 `<` `>` 即可，例如：

- `《<山海经>的世界》裴鹏程解读.md` → `《山海经的世界》裴鹏程解读.md`
- `《<资本论>的读法》杨照解读.md` → `《资本论》的读法-杨照解读.md`

改完 `git pull` + `git push` 正常。

## 修复 B（绕过，不改远程）：sparse-checkout 排除问题目录

适合"现在就要 pull/push，远程文件暂时不想动"的情况。

```powershell
# 让索引接受非法路径（否则 protectNTFS 直接拒绝）
git config core.protectNTFS false
git config core.sparseCheckout true
```

把下面内容写进 `.git/info/sparse-checkout`（含非法符的目录排除，其余全要）：

```
/*
!/500 Sources/得到听书新/
```

然后拉取推送：

```powershell
git pull --tags origin master
git push
```

要点：非法文件不会写进本地磁盘，但仍在远程历史里，不影响你推送自己的改动。状态里 `sparse checkout ... 95% of tracked files present` 是正常现象。

## 恢复：被快进合并冲掉的未提交改动

`git pull` 若走 fast-forward 合并，会直接把 HEAD 移到远程提交并刷新工作树。**已 `git add` 但没 `git commit` 的本地改动会被丢弃**（不是进回收站，是变成 dangling 对象）。别慌，对象还在：

```powershell
# 找出游离对象（含未提交内容的 blob 和被丢弃的 commit）
git fsck --lost-found

# 先看 dangling commit 是否正是你丢失的那次提交
git show --stat <dangling-commit-sha>
# 例：606c2c819 vault backup: ...  6 files changed, 33948 insertions(+)
```

确认后把该 commit cherry-pick 到最新 `origin/master` 之上：

```powershell
git cherry-pick <dangling-commit-sha>
# 若冲突（常见于 .obsidian/community-plugins.json），手动编辑解决后：
git add <冲突文件>
# PowerShell 里用下面写法避免弹出编辑器卡死：
git -c core.editor=echo cherry-pick --continue
git push
```

冲突解析经验：`community-plugins.json` 冲突时，HEAD 侧为空代表远程当前版本没有那些插件 id（你后来移除了），只把要恢复的那个插件 id（如 `flomo-importer-sync`）加回去，别顺手恢复已被你移除的插件。

## 防复发

- 跨平台仓库（Mac/Linux 协作者推 Windows 用户拉）的提交，文件名避开 `<` `>` `:` `*` `?` `"` `\` `|` 及尾部的 `.` `/` 等 Windows 保留字符。
- 要推改动前先 `git commit` 再 `pull`；或养成 `git pull --rebase` 习惯，别让未提交改动悬空。
