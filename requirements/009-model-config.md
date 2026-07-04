# 需求 009：模型可配置化

## 目标

把「用哪个模型」从 `agent.ts` 源码里抽出来，改成读配置创建。`ChatAgent` 只依赖「一个能对话的模型」，不关心是 Ollama 本地还是以后的云端 API。

**终端第一期**：改 `.env` 选默认模型，启动时打印当前模型名。  
**终端第二期（可选）**：对话里用 `/model` 命令运行时切换。  
**UI 以后**：点选模型 = 调用同一个 `setModel()`，机制与 `/model` 相同。

## 背景

现在模型写死在 `agent.ts` 里：

```ts
this.model = new ChatOllama({
    model: "qwen2.5",
    temperature: 0.7,
});
```

问题：

- 换模型（qwen2.5 → qwen3:8b）要改源码
- 公司电脑和家里电脑模型不同，无法各用各的配置
- 以后接云端 API 要在 `agent.ts` 里加 if/else，越改越乱

005 已经用 `USE_PROD_DATA` 环境变量切换数据目录，模型配置沿用同一套习惯：敏感信息放 `.env`，不进 Git。

## 核心设计（先建立直觉）

```
.env / 配置          →  读配置（config.ts）
                              ↓
                        造模型（modelFactory.ts）  →  返回 BaseChatModel 实例
                              ↓
                        ChatAgent 持有 this.model  →  chat / chatStream 照旧
```

**你的理解是对的：**

1. `agent.ts` 不再写死 `ChatOllama` + `"qwen2.5"`，只持有「任意聊天模型」
2. 新增 `createChatModel()` 工厂函数，按配置造出具体模型
3. `.env` 里写清楚要用哪个 provider、哪个 model 名

## 切换模型时，内部到底发生了什么？

这是 UI 和终端共用的机制，分两层理解：

### 第一层：ChatAgent 里只有一个「槽位」

```ts
class ChatAgent {
  private model: BaseChatModel;   // 当前正在用的模型实例

  constructor(...) {
    this.model = createChatModel(modelConfig);  // 启动时填一次
  }

  setModel(config: ModelConfig): void {
    this.model = createChatModel(config);       // 切换时：换掉槽位里的实例
  }

  async *chatStream(userInput: string) {
    const stream = await this.model.stream(messages);  // 永远用「当前槽位」
    // ...
  }
}
```

**切换 = 把 `this.model` 换成一个新造出来的实例。**  
`history`、画像、`systemMessage` 都不动——换的是「后厨厨师」，不是「菜单和账本」。

### 第二层：谁触发 `setModel()`？

| 场景 | 谁触发 | 用户操作 |
|------|--------|----------|
| 启动默认模型 | `index.ts` 启动时 | 读 `.env` → `createChatModel()` → `new ChatAgent(...)` |
| 终端改默认 | 你改 `.env` 后重启 | 下次启动用新默认，**不调用** `setModel` |
| 终端运行时切换 | `index.ts` 识别 `/model xxx` | `agent.setModel(新配置)` |
| UI 点选模型 | 前端事件 → 后端接口 | `agent.setModel(新配置)` ← **和 `/model` 同一条路径** |

用餐厅比喻：

- **换 `.env` 重启** = 明天开店默认换一位厨师
- **`setModel()` / UI 点击** = 营业中临时换厨师，账本（history）继续用

### 切换时序（UI 点选模型的完整链路）

```
用户点击「qwen3:8b」
       ↓
UI 更新选中态（高亮按钮）
       ↓
调用 agent.setModel({ provider: "ollama", model: "qwen3:8b", ... })
       ↓
createChatModel() 内部 new ChatOllama({ model: "qwen3:8b", ... })
       ↓
this.model = 新实例（旧实例可被 GC 回收）
       ↓
用户发下一条消息 → chatStream() → 走的是新 model.stream()
```

**不需要重启进程，不需要重建 ChatAgent，不需要清空 history**（除非产品上要「换模型开新对话」，那是 UI 策略，不是框架限制）。

## 涉及的新 API / 概念（学习点）

| API / 概念 | 说明 |
|------|------|
| `BaseChatModel` | LangChain 所有聊天模型的统一基类，有 `.invoke()` / `.stream()` |
| 工厂模式（Factory） | 根据配置创建对象，`createChatModel()` 就是工厂函数 |
| `dotenv` | 启动时把 `.env` 载入 `process.env` |
| `ModelConfig` | 我们自己定义的配置类型：provider、model、temperature 等 |
| `setModel()` | 运行时替换 `this.model`，为 UI 和 `/model` 预留 |

## 配置文件

### `.env`（每台电脑各自一份，不提交 Git）

```env
# 模型提供商：第一期只支持 ollama
MODEL_PROVIDER=ollama

# Ollama
OLLAMA_MODEL=qwen3:8b
OLLAMA_BASE_URL=http://localhost:11434

# 通用
MODEL_TEMPERATURE=0.7
```

### `.env.example`（提交 Git，当模板）

同上结构，值用占位符，不含真实 API Key。

## 实现步骤（分三期，一次只做一小步）

### 007-a：配置 + 工厂 + Agent 解耦（第一期必做）

#### 1. 扩展 `config.ts`

- 顶部 `import "dotenv/config"` 或等价加载
- 导出 `modelConfig` 对象，从 `process.env` 读取并给默认值
- 导出 `getModelLabel()` 之类的小函数，供启动时打印 `[ollama / qwen3:8b]`

#### 2. 新建 `modelFactory.ts`

```ts
import { ChatOllama } from "@langchain/ollama";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export function createChatModel(config: ModelConfig): BaseChatModel {
  switch (config.provider) {
    case "ollama":
      return new ChatOllama({
        model: config.model,
        temperature: config.temperature,
        baseUrl: config.baseUrl,
      });
    default:
      throw new Error(`不支持的 MODEL_PROVIDER: ${config.provider}`);
  }
}
```

#### 3. 改 `agent.ts`

- `private model: ChatOllama` → `private model: BaseChatModel`
- 构造函数里 `this.model = createChatModel(modelConfig)`
- **`chat()` / `chatStream()` 逻辑不改**

#### 4. 改 `index.ts`

- 启动时打印当前模型：`ChatAgent 已启动 [ollama / qwen3:8b]`

#### 5. 验证

- `.env` 写 `qwen3:8b`，`npm start`，对话正常
- 改 `.env` 为 `qwen2.5:7b`，重启，确认启动日志和实际模型变化
- 记忆、流式、画像、退出保存均正常

---

### 007-b：运行时切换（第二期，可选，为 UI 铺路）

#### 1. `config.ts` 增加「可选模型列表」

```env
# 逗号分隔，供 /models 展示
MODEL_OPTIONS=qwen3:8b,qwen2.5:7b,qwen2.5-coder:7b
```

或后续改为 `models.json`，第一期用 env 即可。

#### 2. `agent.ts` 新增

```ts
setModel(config: ModelConfig): void {
  this.model = createChatModel(config);
}

getModelLabel(): string { ... }  // 返回当前模型名，供 UI / 终端显示
```

#### 3. `index.ts` 识别命令

| 输入 | 行为 |
|------|------|
| `/models` | 列出 `MODEL_OPTIONS` |
| `/model qwen2.5:7b` | 调用 `agent.setModel(...)` |
| 普通文本 | 照常 `chatStream` |

#### 4. 验证

- 启动默认 `qwen3:8b`，对话中 `/model qwen2.5:7b`，下一条走新模型
- 切换后 history 仍在（问「我刚才说了什么」能答上来）

> **这就是 UI 以后要调用的同一套机制**：UI 点选 → 后端 `agent.setModel(config)`，不经过终端命令解析而已。

---

### 007-c：云端 API（第三期，有 Key 再做）

- 安装 `@langchain/openai`
- `modelFactory` 增加 `case "openai"` → `new ChatOpenAI(...)`
- `.env` 增加 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL`（兼容 DeepSeek 等 OpenAI 格式 API）
- `ChatAgent` 仍不改

## 验收标准

### 007-a（必做）

- [ ] 模型名不再写死在 `agent.ts`
- [ ] `.env` 改 `OLLAMA_MODEL` 后重启即可换模型
- [ ] 启动日志显示当前 provider 和 model
- [ ] `chat()` / `chatStream()` / 记忆 / 持久化行为与改前一致
- [ ] 新增 `.env.example`，真实 `.env` 仍在 `.gitignore`
- [ ] 007-a 不新增 npm 依赖（`dotenv` 已在 package.json）

### 007-b（可选）

- [ ] `agent.setModel()` 可在运行时切换，无需重启
- [ ] 终端 `/model`、`/models` 命令可用
- [ ] 切换后 history 保留（共享上下文策略）

### 007-c（后续）

- [ ] `.env` 改 `MODEL_PROVIDER=openai` 可切到云端 API
- [ ] `ChatAgent` 无 provider 相关 if/else

## 文件变更预估

| 文件 | 007-a | 007-b | 007-c |
|------|-------|-------|-------|
| `.env.example` | 新建 | — | 补充 API 字段 |
| `config.ts` | 扩展 ~20 行 | +MODEL_OPTIONS | +openai 字段 |
| `modelFactory.ts` | 新建 ~25 行 | — | +openai case |
| `agent.ts` | 改类型 + 工厂 ~5 行 | +setModel ~10 行 | — |
| `index.ts` | 打印模型名 ~2 行 | +命令解析 ~20 行 | — |

## 备注

- 006 流式输出已完成，007 不改变流式逻辑，只改「model 从哪来」
- 两台电脑：各维护一份 `.env`，代码通过 Git 同步即可
- UI 需求单另开（如 008-web-ui），007 只保证 `setModel()` 接口就绪，UI 直接复用
