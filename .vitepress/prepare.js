import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.resolve(repoRoot, "docs");

// 1. 清理并初始化 docs 目录
if (fs.existsSync(docsDir)) {
  fs.rmSync(docsDir, { recursive: true, force: true });
}
fs.mkdirSync(docsDir, { recursive: true });

// 2. 拷贝 .vitepress 配置
function copyDir(src, dest, ignore = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    if (ignore.includes(item)) continue;
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d, ignore);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

copyDir(
  path.join(repoRoot, ".vitepress"),
  path.join(docsDir, ".vitepress"),
  ["cache", "dist", "prepare.js"]
);

// 3. 拷贝核心分类目录
copyDir(path.join(repoRoot, "playbooks"), path.join(docsDir, "playbooks"));
copyDir(path.join(repoRoot, "prompts"), path.join(docsDir, "prompts"));
copyDir(path.join(repoRoot, "learnings"), path.join(docsDir, "learnings"));

// 拷贝基础说明文件
if (fs.existsSync(path.join(repoRoot, "README.md"))) {
  const readmeContent = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  fs.writeFileSync(path.join(docsDir, "README.md"), readmeContent, "utf8");
}
if (fs.existsSync(path.join(repoRoot, "WORKFLOW.md"))) {
  const workflowContent = fs.readFileSync(path.join(repoRoot, "WORKFLOW.md"), "utf8");
  fs.writeFileSync(path.join(docsDir, "WORKFLOW.md"), workflowContent, "utf8");
}

// 4. 解析 INDEX.md 并生成超链接
const indexRaw = fs.readFileSync(path.join(repoRoot, "INDEX.md"), "utf8");

function extractBlock(text, name) {
  const re = new RegExp(`<!-- BEGIN:${name} -->([\\s\\S]*?)<!-- END:${name} -->`);
  const match = text.match(re);
  return match ? match[1].trim() : "";
}

function linkifyTable(tableContent, type) {
  const lines = tableContent.split("\n");
  const processed = lines.map((line) => {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 7) {
      // parts[0] is empty, parts[1]=id, parts[2]=title, parts[3]=status, parts[4]=tags, parts[5]=updated, parts[6]=path
      const id = parts[1];
      const title = parts[2];
      const status = parts[3];
      const tags = parts[4];
      const updated = parts[5];
      const rawPath = parts[6];

      if (id === "id" || id.startsWith("---")) return line;

      const cleanPath = rawPath.replace(/\.md$/, "");
      const link = `/${cleanPath}`;
      return `| ${id} | [${title}](${link}) | \`${status}\` | ${tags} | ${updated} | [查看详情](${link}) |`;
    }
    return line;
  });
  return processed.join("\n");
}

const promptsTableRaw = extractBlock(indexRaw, "prompts");
const playbooksTableRaw = extractBlock(indexRaw, "playbooks");
const learningsTableRaw = extractBlock(indexRaw, "learnings");

const promptsTableLinked = linkifyTable(promptsTableRaw, "prompts");
const playbooksTableLinked = linkifyTable(playbooksTableRaw, "playbooks");

// 5. 生成 docs/index.md (首页)
let homeContent = `---
layout: doc
title: 个人知识库总索引
---

# 个人知识库总索引

> 知识库唯一入口。检索顺序：tags / title 定位 → 读对应文件。
> 流程契约见 [WORKFLOW 契约](/WORKFLOW)。

## 实战手册 (Playbooks)

${playbooksTableLinked}

## 提示词库 (Prompts)

${promptsTableLinked}

## 复盘认知 (Learnings)

| 轨道 | 说明 | 入口 |
|---|---|---|
| **踩坑记录 (Errors)** | 命令失败、集成故障、踩坑排查记录 | [查看 ERRORS](/learnings/ERRORS) |
| **单点认知 (Learnings)** | 纠正、知识缺口、更好做法 | [查看 LEARNINGS](/learnings/LEARNINGS) |
| **功能诉求 (Feature Requests)** | 想要而还没有的能力 | [查看 FEATURE_REQUESTS](/learnings/FEATURE_REQUESTS) |
`;

fs.writeFileSync(path.join(docsDir, "index.md"), homeContent, "utf8");

// 6. 生成 docs/playbooks/index.md (实战手册分类索引页)
const playbooksIndexContent = `---
layout: doc
title: 实战手册
---

# 实战手册 (Playbooks)

> 完整实操手册：包含步骤、命令与踩坑点，均经过真实业务场景验证。
> 当前共收录 ${playbooksTableLinked.split("\n").filter((l) => l.startsWith("| PB-")).length} 篇实战手册。

${playbooksTableLinked}
`;
fs.writeFileSync(path.join(docsDir, "playbooks", "index.md"), playbooksIndexContent, "utf8");

// 7. 生成 docs/prompts/index.md (提示词库分类索引页)
const promptsIndexContent = `---
layout: doc
title: 提示词库
---

# 提示词库 (Prompts)

> 可直接复制使用的提示词与自动化整合模板。
> 当前共收录 ${promptsTableLinked.split("\n").filter((l) => l.startsWith("| PR-")).length} 篇提示词集。

${promptsTableLinked}
`;
fs.writeFileSync(path.join(docsDir, "prompts", "index.md"), promptsIndexContent, "utf8");

// 8. 生成 docs/learnings/index.md (复盘认知分类索引页)
const learningsIndexContent = `---
layout: doc
title: 复盘认知
---

# 复盘认知 (Learnings)

> 踩坑排障、单点认知与功能诉求分轨沉淀。

| 轨道 | 说明 | 入口 |
|---|---|---|
| **踩坑记录 (Errors)** | 命令失败、集成故障、踩坑排查记录 | [查看 ERRORS](/learnings/ERRORS) |
| **单点认知 (Learnings)** | 纠正、知识缺口、更好做法 | [查看 LEARNINGS](/learnings/LEARNINGS) |
| **功能诉求 (Feature Requests)** | 想要而还没有的能力 | [查看 FEATURE_REQUESTS](/learnings/FEATURE_REQUESTS) |
`;
fs.writeFileSync(path.join(docsDir, "learnings", "index.md"), learningsIndexContent, "utf8");

// 9. 扫描所有 Markdown 文件转义裸尖括号，防止 Vue 模板解析与 SFC 块冲突
function sanitizeMarkdown(dir) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      if (item !== ".vitepress" && item !== "node_modules") {
        sanitizeMarkdown(full);
      }
    } else if (full.endsWith(".md")) {
      let content = fs.readFileSync(full, "utf8");

      // 0. 转义 Vue Mustache 插值语法 {{ 与 }}，防止 SSR 阶段把文档里的 {{ ... }} 当作 JS 表达式求值崩溃
      content = content.replace(/\{\{/g, "&#123;&#123;").replace(/\}\}/g, "&#125;&#125;");

      // 1. 转义数学/比较符号：<数字 (如 <120, <0.16, < 2.29, <50MB 等)
      content = content.replace(/<(\s*\d+)/g, "&lt;$1");

      // 2. 转义 <script> 与 <style>，避免 Vue SFC 编译器当作组件块提取
      content = content.replace(/<(\/?script[^>]*)>/gi, "&lt;$1&gt;");
      content = content.replace(/<(\/?style[^>]*)>/gi, "&lt;$1&gt;");

      // 3. 转义省略号与占位符标签：<...> 与常见自定义占位符
      content = content.replace(/<\.\.\.>/g, "&lt;...&gt;");
      content = content.replace(/<([a-zA-Z0-9_\u4e00-\u9fa5\.\-\s\:\/\[\]\?]+)>/g, (m, g) => {
        const tag = g.trim().toLowerCase();
        const allowed = ["br", "hr", "img", "span", "b", "i", "strong", "em", "p", "div", "a"];
        if (allowed.includes(tag)) return m;
        if (g.startsWith("!--") || g.endsWith("--")) return m;
        return "&lt;" + g + "&gt;";
      });

      // 4. 兜底转义：任何未闭合的 < (后面紧跟非字母字符如空格、引号、非闭合括号等)
      content = content.replace(/<(?=[^a-zA-Z\/!])/g, "&lt;");

      fs.writeFileSync(full, content, "utf8");
    }
  }
}
sanitizeMarkdown(docsDir);

console.log("Docs preparation completed successfully!");
