---
id: PB-20260831-001
type: playbook
title: 开源仓库可发现性优化清单（README 双语 + 元数据 + topics）
tags: [github, readme, discoverability, docs]
status: verified
source: conversation:2026-08-31
created: 2026-08-31
updated: 2026-08-31
---

# 开源仓库可发现性优化清单（README 双语 + 元数据 + topics）

> 来源：2026-08-31。在 `qqlcx5/tauri-template`（Tauri 2 + Vue 3 + UnoCSS + Element Plus）实战执行：
> 重写双语 README、补 LICENSE / CONTRIBUTING、补齐 `package.json` 与 `Cargo.toml` 元信息，并整理 topics 配置清单。

## 0. 杠杆点：GitHub 靠什么找到你

按权重排序，前四项是搜索与推荐页真正吃的部分：

1. **仓库名 + description**（≤160 字符，必须含核心关键词，写给陌生人看）
2. **topics**（每个都是一条可检索路径，上限约 20 个）
3. **README 首屏**（前 3 行决定停留；标题与首段要覆盖别人会搜的词）
4. **LICENSE 文件**（缺失会显示 "No license"，被部分搜索与聚合站降权）
5. `package.json` / `Cargo.toml` 等生态元信息（生态站点与镜像站会抓取 keywords）
6. Star / fork / 最近更新时间（只能靠内容换，不能刷）

## 1. 双语 README：英文主文档 + 中文副文档

- `README.md` 用**英文**：GitHub 搜索、聚合站、LLM 抓取以英文为主
- `README.zh-CN.md` 用**中文**：母语用户转化率更高
- 两份**首屏各放一行互链**，不要用 `README-CN.md` / `readme_chinese.md` 这类非约定命名（部分工具识别不到）
- 内容不需要 100% 对照翻译，但**章节编号与锚点尽量一致**，方便维护

## 2. README 骨架（照抄结构，换内容）

```
# <项目名 —— 含核心关键词>
[徽章行：技术栈版本 / License / PRs Welcome]
一句话定位：<是什么> + <用什么技术> + <解决什么问题>
[关键词行：`tauri template` · `vue 3 desktop app` · ...]   ← 纯文本，非 frontmatter，供搜索命中
[互链：English / 中文]
---
## Why this template        ← 表格：痛点 → 本项目做法（差异化最强的部分）
## Screenshots              ← 有图就放，没有就留 HTML 注释占位
## Tech stack               ← 表格：层 / 选型 / 版本
## Quick start              ← 编号步骤，每步可复制的整块命令
## Commands                 ← 表格：命令 → 作用
## Project structure        ← 目录树 + 每处一句话
## Configuration notes      ← 别人会踩的坑，写在这里最容易被搜到
## Roadmap                  ← 复选框，暗示项目活着
## Contributing / License
```

关键细节：

- **"Why" 表比 "Features" 列表有效**：功能列表千篇一律，"痛点 → 解法" 才让人停下
- **Quick start 的每步要能整块复制**，不要 `cd xxx && npm i` 混一句解释
- **版本号写进表格**（Vue 3.5 / Vite 6），搜索 "<库> 6 template" 时能命中
- 结尾放一句 "觉得有用请 Star"，一句话，不要长段

## 3. 徽章（shields.io，静态，无 token）

```markdown
[![Vue](https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
```

- logo 名必须存在于 [simple-icons](https://simpleicons.org)，写错会渲染成灰色空块
- 徽章链接指向**本地文件**时用 `./LICENSE` 相对路径，别用 GitHub blob 绝对 URL（fork 后会失效）

## 4. 生态元信息（会被镜像站与生态目录抓取）

`package.json`：

```json
"description": "一句话，含核心关键词",
"keywords": ["tauri", "tauri-template", "vue3", "desktop-app", "electron-alternative", "..."],
"homepage": "https://github.com/<user>/<repo>#readme",
"repository": { "type": "git", "url": "git+https://github.com/<user>/<repo>.git" },
"bugs": { "url": "https://github.com/<user>/<repo>/issues" },
"license": "MIT"
```

`Cargo.toml`（Rust 项目同理）：

```toml
description = "..."
license = "MIT"
repository = "https://github.com/<user>/<repo>"
homepage = "https://github.com/<user>/<repo>"
keywords = ["tauri", "vue", "desktop", "template"]
```

关键词与 README 关键词行**保持一致**，两处互相印证。

## 5. topics（GitHub 网页端 About ⚙ 手动设置，上限约 20 个）

选词原则：**技术栈词**（有人按技术找）+ **用途词**（有人按需求找）+ **替代词**（有人按迁移找）。

Tauri + Vue 模板的参考组合：

```
tauri  tauri-v2  tauri-template  vue  vue3  typescript  vite  unocss  element-plus
desktop-app  electron-alternative  rust  starter-template  boilerplate  cross-platform
```

## 6. 仓库 description（About 区，≤160 字符）

公式：`<技术栈关键词> + <一句话定位> + <差异化>`。示例：

> Desktop app template: Tauri 2 (Rust) + Vue 3 + TypeScript + Vite 6 + UnoCSS + Element Plus, with dark mode and code splitting preconfigured.

## 7. 坑点

- **破图**：README 里不要引用尚不存在的 `docs/screenshot.png`，GitHub 会显示裂图，比没图更糟。用 HTML 注释占位：
  `<!-- Drop a PNG at docs/screenshot.png and uncomment: -->`
- **关键词堆砌**：description / keywords 里塞无关热门词会被判 spam，得不偿失
- **改 README 前先确认旧内容有价值**：本仓库旧 README 是 Windows 环境安装指南，重写时把内容保留到 `initialize.md` 并双向链接，而不是直接删
- **截图与徽章链接用相对路径**，避免 fork / 改名后全部失效
- 改名类文档（如模板改项目名）值得单独一节：列出所有需要改的位置（`package.json` / `Cargo.toml` 含 `[lib].name` / `tauri.conf.json` 的 `productName` + `identifier`）——这是模板类仓库最高频的 issue 来源

## 8. 交付前 checklist

- [ ] `README.md`（英文）+ `README.zh-CN.md`（中文）首屏互链
- [ ] 首段覆盖 3–5 个别人会搜的关键词
- [ ] `LICENSE` 存在且类型明确
- [ ] `CONTRIBUTING.md` 存在，README 有链
- [ ] `package.json` / `Cargo.toml` 六项元信息齐全
- [ ] 无破图、无失效链接
- [ ] GitHub About：description ≤160 字符、topics 已填、Website 指向 README 锚点
