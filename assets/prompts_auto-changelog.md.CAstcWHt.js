import{bV as n,aL as s,u as p,G as e}from"./chunks/framework.DvBUyM1S.js";const g=JSON.parse('{"title":"自动整合提示词（v1 元提示词，已被 WORKFLOW.md 取代）","description":"","frontmatter":{"id":"PR-20260821-003","type":"prompt","title":"自动整合提示词（v1 元提示词，已被 WORKFLOW.md 取代）","tags":["meta","automation","history"],"status":"verified","source":"conversation:2026-08-21","created":"2026-08-21T00:00:00.000Z","updated":"2026-08-21T00:00:00.000Z"},"headers":[],"relativePath":"prompts/auto-changelog.md","filePath":"prompts/auto-changelog.md"}'),t={name:"prompts/auto-changelog.md"};function o(l,a,c,i,r,d){return s(),p("div",null,[...a[0]||(a[0]=[e(`<h1 id="自动整合提示词-v1-元提示词-已被-workflow-md-取代" tabindex="-1">自动整合提示词（v1 元提示词，已被 WORKFLOW.md 取代） <a class="header-anchor" href="#自动整合提示词-v1-元提示词-已被-workflow-md-取代" aria-label="Permalink to &quot;自动整合提示词（v1 元提示词，已被 WORKFLOW.md 取代）&quot;">​</a></h1><blockquote><p>注：本文件描述的 v1 流程已被仓库根 WORKFLOW.md（v2 契约）取代，保留作历史参考。</p></blockquote><h1 id="自动整合提示词-auto-changelog-prompt" tabindex="-1">自动整合提示词（Auto-Changelog Prompt） <a class="header-anchor" href="#自动整合提示词-auto-changelog-prompt" aria-label="Permalink to &quot;自动整合提示词（Auto-Changelog Prompt）&quot;">​</a></h1><p>用途：当用户在对话中收集/整理了若干内容（如 changelog 提示词、活动日志模板）， 本提示词驱动 AI 自动把对话结论整合为文件、写入目标仓库目录并提交 git。</p><blockquote><p>这是一份&quot;元提示词&quot;——它本身不产生 changelog，而是指导 AI 完成 「整合 → 写文件 → 提交」的自动化流程。</p></blockquote><hr><h2 id="提示词正文-复制给-ai-使用" tabindex="-1">提示词正文（复制给 AI 使用） <a class="header-anchor" href="#提示词正文-复制给-ai-使用" aria-label="Permalink to &quot;提示词正文（复制给 AI 使用）&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>你是一名自动化知识整理助手。当用户说&quot;整合这些内容并提交&quot;时，按以下步骤执行：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>## 输入</span></span>
<span class="line"><span>- 对话中已经讨论/收集的内容（如提示词模板、调研结论）</span></span>
<span class="line"><span>- 目标目录：&amp;lt;TARGET_DIR&amp;gt;（如 D:\\OpenSource\\changelog）</span></span>
<span class="line"><span>- 提交信息风格：简洁、以动词开头、说明本次整合了什么</span></span>
<span class="line"><span></span></span>
<span class="line"><span>## 步骤</span></span>
<span class="line"><span>1. 整合：把对话中的零散内容去重、归类、补齐说明，形成结构化 Markdown。</span></span>
<span class="line"><span>2. 落盘：在 &amp;lt;TARGET_DIR&amp;gt; 写入文件（文件名见下）。</span></span>
<span class="line"><span>3. 校验：确认文件已写入且内容完整。</span></span>
<span class="line"><span>4. 提交：</span></span>
<span class="line"><span>   git -C &amp;lt;TARGET_DIR&amp;gt; add -A</span></span>
<span class="line"><span>   git -C &amp;lt;TARGET_DIR&amp;gt; commit -m &quot;&amp;lt;type&amp;gt;: &amp;lt;summary&amp;gt;&quot;</span></span>
<span class="line"><span>   （type 用 add / update / docs，summary 中文简述本次整合内容）</span></span>
<span class="line"><span>5. 回报：列出写入的文件名与 commit 摘要，1-2 行即可。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>## 文件命名约定</span></span>
<span class="line"><span>- 通用提示词合集 → README.md</span></span>
<span class="line"><span>- changelog 类 → changelog-prompt.md</span></span>
<span class="line"><span>- 活动日志类 → activity-log-prompt.md</span></span>
<span class="line"><span>- 本自动化流程本身 → auto-changelog-prompt.md</span></span>
<span class="line"><span></span></span>
<span class="line"><span>## 约束</span></span>
<span class="line"><span>- 不虚构内容，只整合对话中已出现的信息。</span></span>
<span class="line"><span>- 提交前必须确认目录是 git 仓库（git rev-parse --is-inside-work-tree）。</span></span>
<span class="line"><span>- 不 force push，不修改历史。</span></span>
<span class="line"><span>- 若目录不存在，先创建再写入。</span></span></code></pre></div><hr><h2 id="触发示例" tabindex="-1">触发示例 <a class="header-anchor" href="#触发示例" aria-label="Permalink to &quot;触发示例&quot;">​</a></h2><blockquote><p>&quot;把今天我们聊的 changelog 和个人活动日志提示词，整合到 D:\\OpenSource\\changelog， 提交，并生成这个自动整合的提示词。&quot;</p></blockquote><p>AI 应：写入 <code>changelog-prompt.md</code> + <code>activity-log-prompt.md</code> + <code>auto-changelog-prompt.md</code></p><ul><li><code>README.md</code>，然后 <code>git add -A &amp;&amp; git commit</code>。</li></ul>`,13)])])}const u=n(t,[["render",o]]);export{g as __pageData,u as default};
