---
id: PB-20260903-001
type: playbook
title: 免费大模型 API 平台选型清单（2026-09）
tags: [free-api, llm, platform-selection, quota]
status: draft
source: web-collected:2026-09-03
created: 2026-09-03
updated: 2026-09-03
---

# 免费大模型 API 平台选型清单（2026-09）

> 来源：2026-08 ~ 2026-09 全网检索（官方文档核实版博客园文、CSDN 限额实测、Agnes 官方站与智源社区报道、国内云厂商额度汇总）。
> 免费政策变动极快，**动手前先花一分钟核对官方「价格 / 额度」页**。

## 1. 先分清三种「免费」

| 类型 | 特征 | 典型 | 适合 |
|---|---|---|---|
| 永久免费模型 | 指定模型无期限免费调用，通常限速 | 智谱 Flash 系列、Agnes 全模态 | 长期原型、Agent 日常 |
| 新用户赠送额度 | 一次性 token 包，有有效期 | 阿里百炼、腾讯混元、百度千帆 | 短期验证、压测 |
| 海外免费层 | 限速不限量，随时可调 | Google AI Studio、Groq、Cerebras | 学习实验（需代理） |

判断标准：官方定价页是否**明确标注 Free**，而非「赠送 XX 万 token」。查不到的数字一律以控制台实际显示为准。

## 2. 国内直连（无需代理）

| 平台 | 免费内容 | 门槛 / 有效期 | 备注 |
|---|---|---|---|
| 智谱开放平台 | 8 款 Flash 模型明确标「免费」：GLM-4.7-Flash(200K)、GLM-4-Flash-250414(128K)、GLM-4.5-Flash(128K，即将下线)、GLM-4.6V-Flash、GLM-4.1V-Thinking-Flash、GLM-4V-Flash、CogView-3-Flash、CogVideoX-Flash(4K/60fps,10s) | 手机号，免信用卡，长期 | 兼容 OpenAI 格式，**国内起步首选**；仍有速率/额度限制 |
| 硅基流动 SiliconFlow | 指定开源模型免费（如 Qwen2.5-7B） | 手机号 | 一个 Key 切多家开源模型，适合对比测试 |
| Agnes AI（国内站） | 全模态三剑客无限期免费：文本 `agnes-2.0-flash` / `agnes-2.5-flash`、图像 `agnes-image-2.1-flash`(4K)、视频 `agnes-video-v2.0`；文本 1M 上下文 | 邮箱注册，不绑卡 | 2026-07-29 入口迁至 .cn，旧 Key 有效，改 base_url 即可 |
| 阿里云百炼 | 新用户每模型约 100 万 token，覆盖 70+ 模型，累计约 7000 万 | 需华北 2（北京）地域，90 天有效 | 只能抵扣实时调用，批量/调优不适用 |
| 腾讯混元 | 通用包 100 万 token 多模型共享 + 100 万 Embedding；Hunyuan-lite 永久免费(256K) | 有效期 1 年 | 微信生态/小程序接入最顺 |
| 百度千帆 | 每模型独立送 100 万 token，ERNIE-4.5 系列适用 | 多数 3 个月 | 并发限制较宽松，适合压测 |
| 字节火山方舟 | 新用户赠送额度（各模型独立） | 有效期短 | 见控制台 |
| DeepSeek | 无永久免费模型，但有赠送余额机制；v4-flash 输入 1 元/百万 token、输出 2 元 | 峰谷定价，空闲约五折 | 中文/代码/推理首选，充 5 元能用很久 |
| 小米 MiMo | MiMo Orbit 100T 计划，申请制，通过后可达亿级 token | 30 天有效，发完即止 | 需写使用场景申请，配合 cc-switch 接入 |
| 七牛云 AI | 新用户赠 300 万 token | 见官网 | 聚合多模型，按 token 计费 |

## 3. 海外（需代理）

| 平台 | 免费额度规则 | 代表模型 |
|---|---|---|
| Google AI Studio | 因模型而异：Gemini Flash 约 20 请求/天，Gemma 3 系列可达 14400 请求/天 | Gemini 2.5/3、Gemma 3 |
| Groq | 因模型而异，Llama 3.1 8B 最高 14400 请求/天 | Llama、Whisper、Qwen3 |
| Cerebras | 30 请求/分钟，100 万 token/天 | gpt-oss-120b、Llama 3.1 8B |
| OpenRouter | 未充值：20 RPM / 50 RPD；充值满 $10：20 RPM / 1000 RPD（`:free` 后缀模型） | Llama 3.3 70B、gpt-oss-120b、Qwen3 Coder |
| Cloudflare Workers AI | 每天 10000 neurons | Llama、Gemma、Qwen、GLM、Kimi |
| HuggingFace Inference | 每月 $0.10 额度，限 10GB 以下模型 | 各类开源小模型 |
| NVIDIA NIM | 40 请求/分钟，需手机号验证 | 多款开源模型 |

## 4. Agnes 接入要点（踩坑已验证）

- 国内站：`https://agnes-ai.cn/`，Key 在 `https://platform.agnes-ai.cn/settings/apiKeys`，文档 `https://agnes-ai.cn/zh-Hans/docs/overview`。
- 兼容 OpenAI 格式，接 Claude Code / Codex / OpenClaw / Trae 只需自定义 provider + base_url + 模型名。
- 模型名坑：`agnes-image-2.0-flash` 实测稳定 503，`/v1/models` 里只有 `agnes-image-2.1-flash`。
- 生图请求**不要带 `response_format`**，带顶层该参数直接 400；最简请求 = `model + prompt + size`，默认返回 url。
- 内容审核严格：武器类词（剑/武侠）+ hyper-realistic 会触发 `content_policy_violation`，改写为艺术化描述后通过。
- 视频结果 URL 在**顶层 `url` 字段**（不是 metadata.url）；尺寸会被归一化到标准档；`num_frames` 最多 441（约 18 秒）。
- 文档里部分地址仍是国际版 `.com`，调用时注意 base_url 的 .com / .cn 区分。

## 5. 选型速查

| 需求 | 首选 | 备选 |
|---|---|---|
| 中文对话/工具调用/零成本跑通 | 智谱 GLM-4.7-Flash | 硅基流动免费模型 |
| 代码 / 数学 / 推理 | DeepSeek v4-flash（便宜） | Agnes 2.5-flash（免费 + 1M 上下文） |
| 全模态（图 + 视频）零成本 | Agnes | 智谱 CogView / CogVideo Flash |
| 多模型对比 | 硅基流动 / OpenRouter `:free` | — |
| 极速响应 | Groq | 智谱 Flash |
| 长文档 | Gemini Flash（代理）/ Agnes 1M | Kimi（直连） |

## 6. 通用踩坑

1. **多账号刷额度无效**：OpenRouter 等平台的限流是全局的，多 Key 不叠加。
2. **429 不一定是限流**：可能是上游容量不足，实现指数退避并读 `Retry-After`。
3. **数据协议**：Mistral 免费层要求同意数据用于训练，敏感项目避开。
4. **免费模型随时下线**：GLM-4.5-Flash 官方已标注「即将下线」，长期项目别只押一条。
5. **别拿免费层扛生产流量**：20~30 RPM 撑不住真实并发。
6. **警惕影子 API**：第三方「免费 GPT-5/o3/Grok」中转实测正确率可从 83% 掉到 37%，只走官方免费层。

## 7. 起步路径（15 分钟）

1. 手机号注册智谱 → 建 API Key → 调 `GLM-4.7-Flash`（OpenAI 格式，国内直连）。
2. 邮箱注册 Agnes 国内站 → 建 Key → 补上全模态（图/视频/1M 文本）。
3. 需要更强代码推理时，DeepSeek 充 5~10 元用 v4-flash。
