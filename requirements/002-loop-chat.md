# 需求 002：终端循环对话 + ChatAgent 封装

## 目标

让程序能持续多轮对话（输 `/exit` 退出），并把对话逻辑封装进独立的 `ChatAgent` 类，实现**业务层与展现层分离**，为后续 Web UI 打好基础。

## 背景

需求 001 的 `src/index.ts` 写死了"发一条消息 → 退出"，对话逻辑和终端代码混在一起。002 要做的改造：

```
改造前:  index.ts = 模型调用 + 终端交互（混在一起）

改造后:
  src/
  ├── agent.ts    ← ChatAgent 类（纯业务逻辑，不知道是终端还是网页）
  └── index.ts    ← 终端壳（负责 readline 循环，调用 agent）
```

## 步骤

### 1. 新建 `src/agent.ts` —— ChatAgent 类

```ts
export class ChatAgent {
  private model: ChatOllama;

  constructor() {
    this.model = new ChatOllama({ model: "qwen2.5", temperature: 0.7 });
  }

  async chat(userInput: string): Promise<string> {
    const response = await this.model.invoke(userInput);
    return response.content as string;
  }
}
```

**设计要点**：
- `chat()` 方法签名是 `(string) => Promise<string>`：收一句话、返一句话，与输入来源无关
- 没有 `console.log`、没有 `readline`——不碰 IO，纯业务

### 2. 改造 `src/index.ts` —— 终端循环

使用 Node.js 内置的 `readline` 模块实现循环输入：

```
用户输入 → agent.chat() → 打印回复 → 等下一次输入 → ...
输入 /exit → 退出
```

### 3. 运行验证
```bash
npx tsx src/index.ts
```
多轮对话正常，`/exit` 退出 → 完成。

## 涉及技术解释（教学用）

| 技术 | 是什么 | 在这个需求里的作用 |
|------|--------|-------------------|
| **类封装** | OOP 基本概念，把数据和方法打包成一个整体 | 把模型实例和对话方法封进 `ChatAgent`，对外只暴露 `.chat()` |
| **readline 模块** | Node.js 内置模块，从终端逐行读取用户输入 | 实现"等待用户输入 → 处理 → 再等待"的循环 |
| **readline.createInterface** | readline 的工厂方法，创建一个问答接口 | 绑定 `process.stdin`（输入流）和 `process.stdout`（输出流） |
| **async/await + 循环** | JS 异步控制流，`.question()` 返回 Promise，用 await 暂停等输入 | 避免回调地狱，让循环代码读起来像同步代码 |
| **agent.ts vs index.ts** | 业务层 vs 展现层分离 | 后续写 Web UI 时 `agent.ts` 零改动直接复用 |

## 验收标准

- [ ] `npx tsx src/index.ts` 启动后能持续对话
- [ ] 输入 `/exit` 能正常退出
- [ ] `agent.ts` 不包含任何 `console.log` 或 `readline`，纯业务逻辑
- [ ] 代码拆分清晰：`agent.ts` 管对话，`index.ts` 管终端

## 备注

- 这一步不涉及 Memory，每次对话仍是独立的（不记住上文）
- 需求 003 会在此基础上加入 System Prompt 和历史消息
- 代码量预估：agent.ts ~12 行，index.ts ~20 行，总计约 30 行
