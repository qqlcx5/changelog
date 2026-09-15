---
id: PB-20260915-002
type: playbook
title: Pinia 巨型 Store 提取 Headless Engine 架构深化实操
tags: [vue3, pinia, architecture, refactor]
status: verified
source: conversation:2026-09-15
created: 2026-09-15
updated: 2026-09-15
---

# Pinia 巨型 Store 提取 Headless Engine 架构深化实操

> 面向 Vue 3 + Pinia 项目中不断膨胀的巨型 Store，将其重构为「无状态/独立 Headless Engine + 响应式薄适配器」的完整实战手册。已在生产级浏览器扩展（AuraMind / ReadChat Clipper）完成落地验证。

---

## 1. 痛点场景与浅模块诊断

随着业务迭代，核心 Pinia Store（例如 `chat.store.ts`）通常会迅速演化成 1000+ 行的巨型模块：

- **浅模块（Shallow Module）**：对外导出 30~40 个 ref、computed 和 action，接口表面积与内部实现一样宽，未能有效封装复杂度。
- **跨 Store 隐式耦合破坏 Locality**：在底层流式消费（如 `streamToProvider`）或异步循环深处直接调用 `useDocumentStore()`、`useModelStore()`，数据流在层级之间乱窜，产生隐式状态污染。
- **测试成本高**：为了测试纯数据调度（如并发控制、队列排空、消息分支、中断恢复），必须引入 `@vue/test-utils`、`setActivePinia`、`fake-indexeddb`，单测速度变慢且脆弱。

---

## 2. 核心模式：Headless Engine + Thin Adapter

```
┌────────────────────────────────────────────────────────┐
│  Vue 视图组件 (WorkspaceView / TopBar / ChatInput)      │
└───────────────────────────┬────────────────────────────┘
                            │ 调用原有 38 个导出符号 (API 零变动)
┌───────────────────────────▼────────────────────────────┐
│  stores/chat.store.ts (薄适配器, ~300 lines)           │
│  - 持有 Vue 响应式 ref (messages, isStreaming 等)      │
│  - 在调用边界解析依赖 (从 documentStore 转为纯 Context)   │
│  - 注入 EngineCallbacks 接收业务事件并更新 ref          │
└───────────────────────────┬────────────────────────────┘
                            │ 委托纯数据调用
┌───────────────────────────▼────────────────────────────┐
│  services/conversation/engine.ts (Headless Engine)     │
│  - 纯 TS 类/模块，无任何 Vue / Pinia 依赖              │
│  - 负责流式调用、并发模型任务、持久化、排空队列        │
│  - 随时可在 Node / CLI / Web Worker 中独立运行与单测   │
└────────────────────────────────────────────────────────┘
```

---

## 3. 标准落地 4 步法

### Step 1: 定义边界数据上下文与回调接口

在 `services/conversation/engine.ts` 中定义纯数据上下文，杜绝在 Engine 内部 import 任何 Store：

```ts
// 纯数据上下文，调用前由 Store 从其他 Store 解析后传入
export interface DocumentContext {
  title: string
  url: string
  markdown: string
  wordCount: number
  tokenCount: number
  siteName?: string
  capturedAt?: string
  highlights?: Highlight[]
}

// Engine 到 Store 的反向桥接回调
export interface EngineCallbacks {
  onStreamChange(cid: string, active: boolean): void
  onSendComplete(cid: string, hasFailed: boolean): Promise<void>
  onConversationSaved(conv: ConversationEntity): void
}
```

### Step 2: 实现 Headless Engine

Engine 封装所有状态流转与并发控制器，内部不访问任何外部 Store：

```ts
export class ConversationEngine {
  private streamStates = new Map<string, StreamState>()

  constructor(private callbacks: EngineCallbacks) {}

  isStreaming(cid: string): boolean {
    return this.streamStates.has(cid)
  }

  // 关键：切换对话时，提供活跃流的内存引用（比 DB 更鲜活）
  getLiveMessages(cid: string): ChatMessage[] | null {
    return this.streamStates.get(cid)?.messages ?? null
  }

  async sendSingleModel(
    content: string,
    userMsgId: string,
    model: ModelConfig,
    settings: AppSettings,
    cid: string,
    capturedMessages: ChatMessage[],
    docCtx: DocumentContext | undefined,
  ): Promise<void> {
    // 纯逻辑编排：流式处理 -> 消费 -> 异常捕获 -> 状态回写
  }
}
```

### Step 3: 合并消除冗余实现

在拆分过程中同时做“删除测试（Deletion Test）”：
- 将此前散落的 `persistConversation()` 与 `persistConversationForId()` 合并为私有统一方法 `persist(cid, msgs)`，消除多处重复代码。

### Step 4: 将 Store 改造为薄适配层

Store 保留所有的原有 ref 和对外暴露方法，保持 100% 向后兼容：

```ts
export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)

  // 实例化 Engine，注入状态桥接
  const engine = new ConversationEngine({
    onStreamChange(cid, active) {
      if (cid === currentConversationId.value) {
        isStreaming.value = active
      }
    },
    async onSendComplete(cid, hasFailed) {
      // 队列调度
    },
    onConversationSaved(conv) {
      // 同步列表缓存
    },
  })

  // 解析上下文纯数据后转发
  async function sendMessage(content: string, modelIds?: string[]) {
    const docCtx = resolveDocumentContext()
    await engine.sendSingleModel(..., docCtx)
  }

  return {
    messages,
    isStreaming,
    sendMessage,
    // 原有 30+ 个 API 全部保持原名导出
  }
})
```

---

## 4. 实战坑点与验证守则（Gotchas）

1. **流式并发与切换上下文漂移**：
   - 在流式开始时捕获当前 `messages` 数组的引用保存在 `StreamState` 中；用户在流式进行中切换到其他对话时，后台流只往捕获的数组写入，切回时通过 `engine.getLiveMessages(cid)` 恢复最新引用，避免写入被全局重置覆盖。
2. **Vue 响应式代理克隆失败（DataCloneError）**：
   - 将响应式数据存入 IndexedDB 时，直接 `structuredClone(messages.value)` 会因 Proxy 报错。务必使用 `toRaw(msgs)` 解构，并在 catch 中兜底使用 `JSON.parse(JSON.stringify(raw))`。
3. **零破坏渐进升级**：
   - 先写 Engine 单测与功能实现；
   - 切换 Store 的内部实现；
   - 运行项目现有全部单测（如 `pnpm vitest run stores/chat.store.test.ts`），确保原测全部绿灯后即证明重构成功。
