# 需求 003：System Prompt / 角色设定

## 目标

让 ChatAgent 支持 System Prompt（角色设定），理解 Chat Model 的消息不是纯字符串而是**带角色的消息数组**。Agent 构造时传入角色描述，每次对话自动拼入 SystemMessage。

## 背景

目前 `agent.ts` 的 `chat()` 是这样调用的：

```ts
this.model.invoke("你好");   // ← 传的是纯字符串
```

LangChain 底层把它当作 HumanMessage。真正的 Chat Model 接收的是**消息数组**，每条消息带角色：

```
[SystemMessage("你是一个日记助手"),   ← 角色设定
 HumanMessage("今天天气不错"),        ← 用户输入
 AIMessage("是啊，真好")]             ← AI 回复
```

003 要做的：把 `chat()` 改成构造消息数组，让模型知道"我是谁"。

## 步骤

### 1. 引入消息类型

从 `@langchain/core` 导入 `SystemMessage`：

```ts
import { SystemMessage } from "@langchain/core";
```

> 注：`HumanMessage` 不需要手动引入——LangChain 的 `.invoke()` 接收字符串时会自动包装成 HumanMessage

### 2. 修改 ChatAgent 构造函数

```ts
export class ChatAgent {
  private model: ChatOllama;
  private systemPrompt: string;      // ← 新增：存储角色设定

  constructor(systemPrompt = "你是一个有帮助的助手。") {
    this.model = new ChatOllama({ model: "qwen2.5", temperature: 0.7 });
    this.systemPrompt = systemPrompt; // ← 默认角色，可覆盖
  }
```

### 3. 修改 chat() 方法 —— 构造消息数组

```ts
async chat(userInput: string): Promise<string> {
  const messages = [
    new SystemMessage(this.systemPrompt),
    userInput,                       // 字符串自动当 HumanMessage
  ];
  const response = await this.model.invoke(messages);
  return response.content as string;
}
```

### 4. 修改 index.ts —— 传入角色

```ts
const agent = new ChatAgent("你是一个温柔贴心的日记助手。");
```

### 5. 运行验证
```bash
npm start
```
用户说"我今天被导师表扬了"，模型不再冷冰冰回复，而是用"日记助手"的口吻回应 → 角色生效。

## 涉及技术解释（教学用）

| 技术 | 是什么 | 在这个需求里的作用 |
|------|--------|-------------------|
| **SystemMessage** | LangChain 消息类型，角色=system，代表给模型的指令/规则 | 告诉模型它的身份和行为方式 |
| **HumanMessage** | LangChain 消息类型，角色=human，代表用户说的话 | `.invoke()` 收到纯字符串会自动包装 |
| **AIMessage** | LangChain 消息类型，角色=ai，代表模型的回复 | 002 不需要手动构造，003 只是了解概念即可 |
| **消息数组** | `[SystemMessage, string, ...]` 传给 `.invoke()` | 模型基于全部消息理解上下文再回复 |
| **默认参数** | `constructor(prompt = "默认值")` | 不传角色时也有兜底，保证兼容性 |

## 验收标准

- [ ] `npm start` 运行正常
- [ ] 传入不同 System Prompt（日记助手/编程伙伴/倾听者），模型回复风格明显不同
- [ ] 不传角色时使用默认值，不报错
- [ ] `index.ts` 仅改变 1 行（`new ChatAgent(...)` 的参数），其余不动

## 备注

- 代码量预估：agent.ts 约 5 行改动，index.ts 1 行改动
- 不涉及角色配置文件，用写死的字符串验证能力
- 角色数据管理（多角色切换、配置文件）放到后续需求 005
- 这一步做完后，需求 004 的"会话记忆"就水到渠成了——因为消息数组已经有了，只需往里追加历史
