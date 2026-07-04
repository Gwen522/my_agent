# 需求 008：Prompt Template + 时间注入 + 计算器工具

## 目标

两件事合并：

1. **用 LangChain 的 `ChatPromptTemplate` 重构消息构建**，替换目前手拼 `new SystemMessage(...)` + `...this.history` + `new HumanMessage(...)` 的写法
2. 顺带完成工具职责分离：**时间走注入**（拼进 SystemMessage）→ 不再是工具；**计算器走工具调用**——这才是真正需要参数的 Tool Calling 场景

改完后：

- 问"现在几点了？" → 模型直接回答，不走工具调用（SystemMessage 里已经写了时间）
- 问"帮我算 12345 × 67890" → 模型触发 `calc` 工具计算，走完整的工具调用循环

## 背景

007 里用 `get_current_time` 当第一个工具只是因为它零依赖、方便验证调用链路。但"获取当前时间"这种信息，业界标准做法是**注入上下文**（拼到 System Prompt 里），而不是走工具调用——原因有三：

1. 时间**每次必变**，保留 ToolMessage 历史反而误导模型
2. 它**零参数**，体现不出 Tool Calling 的"参数传递 schema"这个核心能力
3. 注入后省一次工具调用往返，**快且可靠**（本地小模型多轮容易不再调用工具，时间会逐渐偏离——这是 007 已知限制）

真正的 Tool Calling 应该留给**有参数、结果需要计算/查询**的场景，比如计算器。

`ChatPromptTemplate` 是引入时间注入最自然的方式——模板里放 `{current_time}` 占位符，每次调用时填入真实时间，不用再手动拼字符串。

## 步骤

### 1. 引入 ChatPromptTemplate，重构消息构建

把现在 `agent.ts` 里的手拼方式：

```ts
const messages = [
    new SystemMessage(this.systemMessage),
    ...this.history,
    new HumanMessage(userInput),
];
```

换成：

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";

const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", "{system_message}\n\n当前时间：{current_time}"],
    ...this.history, // 历史消息不是模板部分是动态的，格式化为消息后合并
    ["human", "{user_input}"],
]);
```

调用时：

```ts
const messages = await promptTemplate.formatMessages({
    system_message: this.systemMessage,
    current_time: new Date().toLocaleString("zh-CN"),
    user_input: userInput,
});
```

### 2. 移除 `getCurrentTimeTool`，从 `allTools` 里去掉

- 删除 `src/tools/getCurrentTime.ts`（或保留但注释说明已废弃）
- `src/tools/index.ts` 里 `allTools` 不再包含它
- 时间信息改为通过模板占位符 `{current_time}` 注入

### 3. 新增 `calcTool` —— 表达式计算器

新文件 `src/tools/calc.ts`：

```ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const calcTool = tool(
    async ({ expression }) => {
        // 用 Function 做安全的表达式求值（只允许数学运算符和数字）
        const sanitized = expression.replace(/[^0-9+\-*/%.() ]/g, "");
        const result = Function(`"use strict"; return (${sanitized})`)();
        return String(result);
    },
    {
        name: "calculator",
        description: "执行数学表达式计算。支持加减乘除、括号、小数点。传入一个合法的数学表达式字符串，返回计算结果。",
        schema: z.object({
            expression: z.string().describe("要计算的数学表达式，例如 '123 + 456' 或 '3.14 * 2'"),
        }),
    }
);
```

`src/tools/index.ts` 更新为：

```ts
import { calcTool } from "./calc.js";
export const allTools = [calcTool];
```

### 4. `agent.ts` 适配 PromptTemplate

- 构造函数里初始化 `ChatPromptTemplate`
- `chat()` 和 `chatStream()` 里用 `formatMessages()` 替换手拼
- 其他逻辑（工具调用循环、历史管理）不动

### 5. `chat()` 也顺带支持 `modelWithTools`

007 里 `chat()` 保持用 `this.model`（不带工具），现在时间工具已移除，只剩一个计算器工具，`chat()` 也应该用 `modelWithTools` 调用——不然非流式路径遇到计算题不会触发工具。改动很小：把 `this.model.invoke` 改成 `this.modelWithTools.invoke`，再加上跟 `chatStream()` 一样的工具调用判断逻辑（非流式更简单，直接看 `response.tool_calls`）。

### 6. 运行验证

```bash
npm start
```

- 问"现在几点了？" → 模型直接回答准确时间，不走工具调用，流式显示
- 问"帮我算 12345 × 67890" → 模型调用 calculator 工具，走两轮流式循环，最终给出计算结果
- 问普通聊天问题 → 正常流式对话，行为不变

## 验收标准

- [ ] 问时间问题，Agent 不触发任何工具调用，直接回答准确时间
- [ ] 问计算题，Agent 触发 `calculator` 工具，走完整的两次流式调用后给出正确结果
- [ ] 普通聊天行为跟 007 一致
- [ ] `chat()`（非流式）也能处理计算题的工具调用
- [ ] `getCurrentTimeTool` 已从 `allTools` 移除
- [ ] `ChatPromptTemplate` 替换了原有的手拼消息方式

## 备注

- `ChatPromptTemplate` 是 LangChain 里最核心的抽象之一，后续做 RAG（检索增强生成）、Few-shot 示例、多角色对话，都建立在模板机制之上。本期只是最简用法，后续需求会逐步展开更复杂的模板能力。
- 计算器的 `Function()` 求值是有意选择的最简实现，生产环境应用更安全的表达式解析库（如 `mathjs`），这里聚焦教学。
- `chat()` 的工具调用改造：非流式没有 chunk 累加问题，直接 `response.tool_calls` 判空 → 执行工具 → 二次 `invoke` 即可，不涉及流式那个 `concat` 逻辑。
