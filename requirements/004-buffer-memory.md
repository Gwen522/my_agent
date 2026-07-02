# 需求 004：会话记忆（Buffer Memory）

## 目标

给 ChatAgent 加上短期记忆——Agent 记住本轮对话的历史，后续回复基于前文。

手写实现一个 `Message[]` 数组做记忆，理解"记忆 = 消息拼接"，不引入 LangChain Memory。

## 背景

目前每次 `chat()` 发给模型的消息是：

```
[SystemMessage(角色), 用户输入]
                     ↑
                  模型不知道上一句说过什么
```

003 已经会构造消息数组了。004 在数组中间插入历史：

```
[SystemMessage(角色),
 HumanMessage(第1轮用户),
 AIMessage(第1轮AI),       ← 历史消息
 HumanMessage(第2轮用户),   ← 历史消息
 AIMessage(第2轮AI),       ← 历史消息
 HumanMessage(当前输入)]    ← 当前提问，排最后
```

## 步骤

### 1. 引入消息类型

从 `@langchain/core/messages` 导入 `HumanMessage` 和 `AIMessage`：

```ts
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
```

> 之前 `userInput` 直接传字符串让 LangChain 自动包装，现在需要手动构造 `HumanMessage`，因为我们要把它存进 history 数组。

### 2. 加 history 数组

```ts
private history: (HumanMessage | AIMessage)[] = [];
```

> 类型 `(HumanMessage | AIMessage)[]` 表示"数组里要么是用户消息，要么是 AI 消息"。SystemMessage 只在最前面固定一条，不存历史。

### 3. 修改 chat() —— 拼接历史 + 存新消息

```ts
async chat(userInput: string): Promise<string> {
  const messages = [
    new SystemMessage(this.systemMessage),
    ...this.history,                         // 展开历史
    new HumanMessage(userInput),             // 当前提问
  ];
  const response = await this.model.invoke(messages);
  const reply = response.content as string;

  this.history.push(new HumanMessage(userInput));  // 存档：用户说的话
  this.history.push(new AIMessage(reply));          // 存档：AI 的回复
  return reply;
}
```

### 4. index.ts 不改

展现层零改动。

### 5. 运行验证
```bash
npm start
```

验证效果——连续多轮：

```
你: 我叫小明
AI: 你好小明！（记住名字）
你: 我叫什么？
AI: 你叫小明呀～（确实记住了）
```

## 验收标准

- [ ] `npm start` 多轮对话正常运行
- [ ] Agent 能记住本轮对话中之前说过的人名、事件等
- [ ] `quit` 退出 + 重新 `npm start` 后记忆清空（这是"短期记忆"——不持久化）
- [ ] `index.ts` 零改动
- [ ] 不安装任何新依赖包

## 备注

- 代码量：agent.ts 约 8 行改动
- 不持久化到文件/数据库——这是需求范围外
- 历史太长导致 token 溢出 → 004 不管，005 引入 `BufferWindowMemory`（只保留最近 N 轮）
- 手动构造 `HumanMessage` 后，`chat()` 的类型签名不变：`(string) => Promise<string>`
