# 需求 006：流式输出（Streaming）

## 目标

把 AI 回复从「等全部生成完再一次性显示」改成「边生成边显示」（打字机效果），提升终端对话体验。

不改变现有的记忆逻辑——流式只是"怎么把内容显示出来"的方式变了，历史记录该存的还是要存。

## 背景

现在 `chat()` 里是这样调用模型的：

```ts
const response = await model.invoke(messages);   // 阻塞等待，模型全部生成完才返回
```

如果回复比较长，用户会盯着空白终端等好几秒，体验很差。LangChain 的聊天模型还提供了另一种调用方式 `.stream()`：模型生成一个词/一小块内容，就立刻吐给你一块，而不是等全部生成完。

## 涉及的新 API（学习点）

| API / 概念 | 说明 |
|------|------|
| `model.stream(messages)` | 返回 `AsyncIterable<AIMessageChunk>`，不是 `Promise<AIMessage>` |
| `for await (const chunk of stream)` | 消费异步流的语法，每轮循环拿到一小块内容 |
| `AIMessageChunk.content` | 每个 chunk 携带的文字片段（要自己累加才能拼出完整回复） |
| `process.stdout.write(text)` | 不像 `console.log` 会自动换行，适合连续吐字 |

## 步骤

### 1. 改造 `agent.ts` —— 新增流式方法

保留原来的 `chat()` 不动（以防以后需要非流式场景），新增一个流式版本：

```ts
async *chatStream(userInput: string): AsyncGenerator<string> {
  const messages = [
    new SystemMessage(this.systemMessage),
    ...this.history,
    new HumanMessage(userInput),
  ];

  const stream = await this.model.stream(messages);
  let fullReply = "";

  for await (const chunk of stream) {
    const piece = chunk.content as string;
    fullReply += piece;
    yield piece;              // 一小块一小块地"产出"给调用者
  }

  // 流结束后，把完整回复存进历史——这一步不能丢，否则记忆功能失效
  this.history.push(new HumanMessage(userInput));
  this.history.push(new AIMessage(fullReply));
}
```

> `async function*` 是"异步生成器"——每次 `yield` 就把一小块内容交出去，调用方用 `for await` 消费。跟普通 `async function` 的区别：普通函数只能 `return` 一次性结果，生成器可以"吐"多次。

### 2. 改造 `index.ts` —— 消费流并打印

```ts
process.stdout.write("AI: ");
for await (const piece of agent.chatStream(input)) {
  process.stdout.write(piece);   // 不换行，一块接一块打出来
}
console.log("\n");               // 一轮结束后手动换行
```

### 3. 运行验证

```bash
npm start
```

问一个需要长回复的问题，观察文字是不是"边蹦出来边显示"，而不是等好几秒突然全部出现。

同时验证记忆没坏：连续问两轮，第二轮 AI 依然记得第一轮说的内容。

## 验收标准

- [ ] 终端里 AI 回复是逐块打出来的，能看到明显的"打字机"效果
- [ ] 流式输出结束后，历史记忆正常写入（下一轮对话能验证）
- [ ] 原有 `chat()` 方法保留，不删除
- [ ] `saveRecent` / 画像注入等已有逻辑不受影响
- [ ] 不安装新依赖（`.stream()` 是 `@langchain/ollama` 自带能力）

## 备注

- 代码量：`agent.ts` 新增 `chatStream()` 约 15 行；`index.ts` 改动约 5 行
- 暂不处理中途取消流式输出（如按 Ctrl+C 打断生成），这是更高级的 `AbortController` 用法，留后续
- 流式场景下如果想在过程中就实时保存历史（比如异常退出时不丢失），也留后续；本次只保证流结束后正常存档
