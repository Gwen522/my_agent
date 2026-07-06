# 需求 009：模型可配置化 + 项目结构重组

## 目标

把「用哪个模型」从 `agent.ts` 源码里抽出来，改成读 `.env` 配置创建。`ChatAgent` 只依赖「一个能对话的模型」，不关心是 Ollama 本地还是以后的云端 API。

同时将项目从扁平结构重组成分层架构，为后续扩展（Web UI、RAG 等）打好基础。

## 背景

改造前模型写死在 `agent.ts` 里：`new ChatOllama({ model: "qwen2.5", ... })`。换模型要改源码，不同电脑无法各用各的配置。

## 最终架构

```
src/
├── types/                ← 纯类型定义（被所有层引用）
│   └── index.ts          ← ModelConfig 接口
├── config/               ← 配置层（读 .env，导出常量）
│   └── index.ts          ← dotenv 加载 + 数据目录 + 模型配置 + modelOptions
├── utils/                ← 工具层（纯函数，无状态）
│   ├── store.ts          ← 画像/对话读写
│   └── modelFactory.ts   ← 根据配置创建模型实例
├── core/                 ← 核心业务层
│   └── agent.ts          ← ChatAgent 类（模型、记忆、prompt、工具）
├── cli/                  ← 终端交互层
│   └── index.ts          ← 入口 + readline + 命令分发
├── tools/                ← Agent 工具
│   ├── calc.ts           ← 计算器工具
│   └── index.ts          ← allTools 注册
└── reset.ts              ← 清空对话记录脚本
```

**调用关系（只许上层调下层）**：

```
cli/        →  core/  →  utils/  →  config/
                                    types/（被所有层引用）
```

## 实现内容

### 009-a：配置 + 工厂 + Agent 解耦

1. **`.env` / `.env.example`**：新建配置文件，`MODEL_PROVIDER`、`OLLAMA_MODEL`、`OLLAMA_BASE_URL`、`MODEL_TEMPERATURE`
2. **`types/index.ts`**：提取 `ModelConfig` 接口（provider、model、temperature、baseUrl）
3. **`config/index.ts`**：加载 `dotenv/config`，导出 `modelConfig` 对象、`getModelLabel()`、`modelOptions`
4. **`utils/modelFactory.ts`**：`createChatModel(config)` 工厂函数，switch provider 创建模型
5. **`core/agent.ts`**：模型类型 `ChatOllama` → `BaseChatModel`，构造函数走工厂创建
6. **`cli/index.ts`**：启动日志打印 `[ollama / qwen2.5:32b]`

### 009-b：运行时切换模型

1. **`core/agent.ts`**：新增 `setModel(config: ModelConfig)`，替换 `this.model` 槽位
2. **`cli/index.ts`**：命令拦截 `/models`、`/model [名称]`、`/help`
3. **`.env`**：新增 `MODEL_OPTIONS` 逗号分隔可选模型列表
4. 切换后 history 保留（不重建 ChatAgent，只换模型实例）

### 009-c：项目结构重组

将 8 个扁平文件重组成 5 层架构：types → config → utils → core → cli。

## 验收标准

### 009-a

- [x] 模型名不再写死在 agent.ts
- [x] `.env` 改 `OLLAMA_MODEL` 后重启即可换模型
- [x] 启动日志显示当前 provider 和 model
- [x] `chat()` / `chatStream()` / 记忆 / 持久化行为不变
- [x] 新增 `.env.example`
- [x] 不新增 npm 依赖（dotenv 已有）

### 009-b

- [x] `agent.setModel()` 可在运行时切换，无需重启
- [x] 终端 `/model`、`/models`、`/help` 命令可用
- [x] 切换后 history 保留

### 009-c

- [x] 项目分层：types / config / utils / core / cli
- [x] `tsc --noEmit` 零错误
- [x] `npm start` 路径指向 `src/cli/index.ts`

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `.env` | 新建 | 真实配置，不进 Git |
| `.env.example` | 新建 | 模板文件，提交 Git |
| `src/types/index.ts` | 新建 | ModelConfig 接口 |
| `src/config/index.ts` | 新建（替代原 config.ts） | dotenv + 配置 + 模型列表 |
| `src/utils/modelFactory.ts` | 新建（替代原 modelFactory.ts） | 工厂函数 |
| `src/utils/store.ts` | 新建（替代原 store.ts） | 画像/历史读写 |
| `src/core/agent.ts` | 新建（替代原 agent.ts） | ChatAgent 核心类 |
| `src/cli/index.ts` | 新建（替代原 index.ts） | 终端入口 |
| `src/tools/index.ts` | 更新 | calc.ts 加 .js 后缀 |
| `src/reset.ts` | 更新 | import 路径 |
| `package.json` | 修改 | scripts 指向 cli/ |

## 备注

- 项目从 8 个扁平文件重组成 5 层架构，调用关系清晰
- 后续加 OpenAI 只需在 `utils/modelFactory.ts` 加一个 case
- 后续加 Web UI 只需新增 `web/` 层，复用 `core/agent.ts`
