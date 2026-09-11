import{bV as a,aL as n,u as p,G as e}from"./chunks/framework.DvBUyM1S.js";const g=JSON.parse('{"title":"Changelog 生成提示词集","description":"","frontmatter":{"id":"PR-20260821-001","type":"prompt","title":"Changelog 生成提示词集","tags":["changelog","git","release-notes"],"status":"draft","source":"web-collected:2026-08-21","created":"2026-08-21T00:00:00.000Z","updated":"2026-08-21T00:00:00.000Z"},"headers":[],"relativePath":"prompts/changelog.md","filePath":"prompts/changelog.md"}'),l={name:"prompts/changelog.md"};function i(t,s,c,o,h,r){return n(),p("div",null,[...s[0]||(s[0]=[e(`<h1 id="changelog-生成提示词" tabindex="-1">Changelog 生成提示词 <a class="header-anchor" href="#changelog-生成提示词" aria-label="Permalink to &quot;Changelog 生成提示词&quot;">​</a></h1><p>从 git 历史、提交记录或手动粘贴的要点，自动产出用户友好的变更说明。</p><hr><h2 id="_1-每日工作总结-我今天干了什么" tabindex="-1">1. 每日工作总结（&quot;我今天干了什么&quot;） <a class="header-anchor" href="#_1-每日工作总结-我今天干了什么" aria-label="Permalink to &quot;1. 每日工作总结（&quot;我今天干了什么&quot;）&quot;">​</a></h2><p>把今天的 <code>git log</code> 或工作要点贴入即可：</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>以下是今日的变更信息，请完成今日的 changelog 摘要（用简体中文）：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>&lt;!-- 在此粘贴 git log 或你的工作要点 --&gt;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>1. 分析变更内容</span></span>
<span class="line"><span>   - 今日变更的核心主题是什么？</span></span>
<span class="line"><span>   - 主要做了哪些功能开发、错误修正或重构？</span></span>
<span class="line"><span>   - 涉及的关键文件有哪些（列几个代表性路径）？</span></span>
<span class="line"><span>   - 今日共几笔提交/几件事？</span></span>
<span class="line"><span></span></span>
<span class="line"><span>2. 输出 Markdown 摘要，示例格式：</span></span>
<span class="line"><span>## YYYY-MM-DD 变更摘要</span></span>
<span class="line"><span></span></span>
<span class="line"><span>今日主要进行了 XXX 的开发与优化，包含：</span></span>
<span class="line"><span>- 新增/修复/重构 XXX（文件路径）</span></span>
<span class="line"><span>- ...</span></span>
<span class="line"><span></span></span>
<span class="line"><span>今日共 N 笔提交，核心主题为 XXX。</span></span></code></pre></div><p><strong>前置命令（获取今日提交）：</strong></p><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">git</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> log</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --since=</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;2026-08-21 00:00:00&quot;</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --pretty=format:</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;%h %s&quot;</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --no-merges</span></span></code></pre></div><hr><h2 id="_2-基于-git-历史的自动-changelog-技能版" tabindex="-1">2. 基于 Git 历史的自动 changelog（技能版） <a class="header-anchor" href="#_2-基于-git-历史的自动-changelog-技能版" aria-label="Permalink to &quot;2. 基于 Git 历史的自动 changelog（技能版）&quot;">​</a></h2><p>适合版本发布说明、周报月报：</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>你是一个 changelog 生成器。请分析指定时间范围或版本之间的 git commit，</span></span>
<span class="line"><span>将技术化提交转换为用户友好的发布说明。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>步骤：</span></span>
<span class="line"><span>1. 扫描 Git 历史（时间段/版本区间）</span></span>
<span class="line"><span>2. 按类别归类：✨新功能 / 🔧优化 / 🐛修复 / ⚠️破坏性变更 / 🔒安全</span></span>
<span class="line"><span>3. 技术语言 → 用户语言</span></span>
<span class="line"><span>4. 过滤噪声（重构、测试等纯内部提交）</span></span>
<span class="line"><span>5. 输出结构化 Markdown</span></span>
<span class="line"><span></span></span>
<span class="line"><span>示例输出：</span></span>
<span class="line"><span>## ✨ New Features</span></span>
<span class="line"><span>- **团队工作区**：可创建独立工作区，邀请成员协作。</span></span>
<span class="line"><span>## 🐛 Fixes</span></span>
<span class="line"><span>- 修复大图无法上传的问题。</span></span></code></pre></div><hr><h2 id="_3-自动化工作流指令-cursor-windsurf-等可跑终端的-ai" tabindex="-1">3. 自动化工作流指令（Cursor / Windsurf 等可跑终端的 AI） <a class="header-anchor" href="#_3-自动化工作流指令-cursor-windsurf-等可跑终端的-ai" aria-label="Permalink to &quot;3. 自动化工作流指令（Cursor / Windsurf 等可跑终端的 AI）&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span># 自动产出日志摘要（每次粘贴都重新执行，不解释过程）</span></span>
<span class="line"><span>## 1. 运行 \`git log --since=&quot;00:00:00&quot; --oneline\` 收集今日提交</span></span>
<span class="line"><span>## 2. 分析：核心主题 / 功能·修复·重构 / 关键文件 / 提交数</span></span>
<span class="line"><span>## 3. 输出 Markdown 到 logs/summary/YYYY-MM-DD.md</span></span>
<span class="line"><span>## 4. 仅回复「生成成功」</span></span></code></pre></div><hr><h2 id="_4-月报总结提示词-结果导向-给领导看" tabindex="-1">4. 月报总结提示词（结果导向，给领导看） <a class="header-anchor" href="#_4-月报总结提示词-结果导向-给领导看" aria-label="Permalink to &quot;4. 月报总结提示词（结果导向，给领导看）&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>角色设定：你是一名向公司管理层汇报工作的技术/项目负责人，</span></span>
<span class="line"><span>擅长将日常工作提炼成领导关心的成果与价值。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>任务：读取 &amp;lt;日志路径&amp;gt;/&amp;lt;月份&amp;gt;.md，整理成《YYYY年MM月工作月报》。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>汇报原则：</span></span>
<span class="line"><span>- 结果导向：少写&quot;做了什么&quot;，多写&quot;做成了什么&quot;&quot;带来了什么价值&quot;</span></span>
<span class="line"><span>- 合并同类：按主题合并，不逐条列流水账</span></span>
<span class="line"><span>- 突出亮点：客户价值、业务支撑、风险消除、效率提升</span></span>
<span class="line"><span>- 语言精炼：条理清晰、用词正式</span></span>
<span class="line"><span></span></span>
<span class="line"><span>月报结构：</span></span>
<span class="line"><span># YYYY 年 MM 月工作月报</span></span>
<span class="line"><span>## 一、本月重点工作概述（3~5条）</span></span>
<span class="line"><span>## 二、重点成果与进展（需求交付/功能建设/性能优化/问题风险）</span></span>
<span class="line"><span>## 三、会议与协同</span></span>
<span class="line"><span>## 四、统计信息</span></span>
<span class="line"><span>## 五、个人完成与改进</span></span>
<span class="line"><span>## 六、下月计划</span></span>
<span class="line"><span></span></span>
<span class="line"><span>约束：所有内容必须来自提供日志，不得虚构数据或成果。</span></span></code></pre></div>`,18)])])}const u=a(l,[["render",i]]);export{g as __pageData,u as default};
