# 需求 007：工具调用（Tool Calling）

## 目标

让 Agent 具备调用外部工具的能力——不再只是"聊天"，而是能在需要时**自己判断要不要调用工具**，执行后把结果用于生成回答。

用的是模型**原生工具调用**能力（Qwen2.5 通过 Ollama 支持），不用 ReAct 那种靠 Prompt 文字约定 + 正则解析的老套路。

本期先写 1 个零依赖的工具（获取当前时间），专注学"调用循环"本身怎么跑通；天气等需要外部 API 的工具、以及后续接入 MCP，都留给之后的需求。

直接在 `chatStream()`（流式）上实现，不额外做"流式/非流式"切换配置——因为终端实际用的就是流式，`chat()` 保持现状不用。

## 背景

现在模型只能基于自己"记忆里"的知识回答，问它"现在几点"，只会瞎编。工具调用要解决的就是：让模型在必要时"伸手"去问外部世界要一个准确结果，再回来生成回答。

非流式场景下循环很简单（`response.tool_calls` 一次性就能拿到）：

```
① 定义工具：tool() + Zod schema 描述参数
② model.bindTools([...]) → 得到一个"知道有哪些工具"的模型
③ 第一次 invoke(messages)
     ├─ 没有 tool_calls → 模型直接给了自然语言答案，结束
     └─ 有 tool_calls → 模型想调用工具，进入 ④
④ 遍历 tool_calls，执行对应的本地函数，拿到返回值
⑤ 把执行结果包装成 ToolMessage（带 tool_call_id），追加进 messages
⑥ 再次 invoke(messages) —— 模型看到工具结果，生成最终自然语言回复
```

但流式场景下，`tool_calls` 是一块一块流过来的（`tool_call_chunks`），不能像非流式那样直接一次读到。解决办法：用 `AIMessageChunk` 自带的 `.concat()` 把每个 chunk 累加起来，流结束后累加出来的完整消息里才有完整的 `tool_calls`。

流式下的完整循环：

```
① model.stream(messages) —— 第一轮流式调用
② 遍历 chunk：
     - chunk.content 有内容就 yield 出去（正常聊天场景，边生成边显示）
     - 同时 full = full ? full.concat(chunk) : chunk 累加整个消息
③ 流结束后检查 full.tool_calls：
     - 没有 → ①②已经是最终回复，结束，存历史
     - 有 → 模型要调用工具（这种情况通常不会同时吐 content）
④ 遍历 tool_calls，执行对应本地函数 → 包装成 ToolMessage → 追加进 messages
⑤ 再发起第二轮 model.stream(messages) —— 这才是真正的最终回答，边生成边 yield
⑥ 存历史：只存最终的用户问题 + 最终自然语言回复，中间的工具调用请求/ToolMessage 不进 history
```

对用户来说：不调用工具就是 1 轮流式，调用工具就是 2 轮流式，但始终"边生成边看到文字"，没有卡住等待的感觉。

## 步骤

### 1. 定义工具 —— 获取当前时间

用 LangChain 的 `tool()` 函数 + Zod 定义一个零参数的工具：

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const getCurrentTimeTool = tool(
  async () => {
    return new Date().toLocaleString("zh-CN");
  },
  {
    name: "get_current_time",
    description: "获取当前的日期和时间",
    schema: z.object({}),   // 无参数
  }
);
```

### 2. 给模型绑定工具

```ts
private modelWithTools = this.model.bindTools([getCurrentTimeTool]);
```

### 3. 改造 `chatStream()` —— 累加 chunk 判断 tool_calls，必要时二次流式调用

```
第一轮 model.stream(messages)
  → 边遍历边 yield chunk.content，同时 concat 累加成 full
流结束后看 full.tool_calls：
  → 空：本轮结束，存历史（fullReply 就是最终回复）
  → 非空：遍历执行工具 → 包装 ToolMessage → 追加进 messages
           → 发起第二轮 model.stream(messages)，边遍历边 yield，累加成新的 fullReply
           → 存历史（这次的 fullReply 才是最终回复）
```

### 4. 运行验证

```bash
npm start
```

- 问"现在几点了？" → AI 通过工具返回真实时间，不是瞎猜，且是流式打出来的
- 问普通问题（不需要工具）→ 走原来的单轮流式逻辑，正常聊天，不受影响

## 验收标准

- [ ] 问时间相关问题，Agent 能通过工具调用返回准确的当前时间，且是流式显示
- [ ] 不需要工具的普通对话，依然是流式输出，行为跟 006 一致
- [ ] 历史记忆（`this.history`）只记录最终的用户问题 + 最终自然语言回复，不把中间的工具调用请求 / `ToolMessage` 存进长期 history
- [ ] `chat()`（非流式方法）维持现状，不需要跟着改
- [ ] 不依赖任何外部网络请求/API Key（时间工具零依赖）

## 备注

- 只写 1 个工具（获取当前时间），保持改动量可控
- 天气等需要外部 API 的工具、多轮工具调用（工具结果又触发新的工具调用，理论上要循环而不是固定两轮）都留给后续需求
- MCP（Model Context Protocol）是这里学的 `tool()` + `bindTools()` 机制的延伸——以后接 MCP，只是把"工具从哪来"换成外部 MCP Server 提供的工具列表，调用循环本身不需要大改

## 已知限制

- 本地 Qwen2.5（7B）在连续对话中，首次询问时间能稳定触发工具调用，但后续轮次倾向不再调用工具、凭历史对话中的时间自行推算，导致时间逐渐偏离真实值。这是本地小模型 tool-calling 判断力本身的局限，不是代码缺陷。
- "获取当前时间"这类信息在大模型产品中通常是直接注入上下文而非走工具调用（Anthropic/OpenAI 官方推荐做法），本期选择它仅因为零依赖、容易验证调用链路——之后会用更适合工具调用场景的计算器工具替换，并将当前时间改为上下文注入方式。
