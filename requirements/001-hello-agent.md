# 需求 001：项目初始化 + Hello Agent

## 目标

搭建 TypeScript 项目骨架，安装 LangChain.js，用本地 Ollama Qwen 模型跑通第一次 Agent 对话，验证链路通畅。

## 前置条件

| 项 | 状态 | 说明 |
|----|------|------|
| Node.js | v25.9.0 ✅ | 已切换完成 |
| npm | 随 Node 25 | |
| Ollama | 已安装，待启动 + 拉模型 | 需 `ollama serve` + `ollama pull qwen2.5` |

## 步骤

### 1. 切换 Node 版本
```bash
nvm use 25                     # 已完成 ✅
```

### 2. 启动 Ollama 并拉取模型
```bash
ollama serve                    # 启动服务（可能已自动启动）
ollama pull qwen2.5:latest      # 拉取 Qwen 模型（约 4-8 GB）
```

### 3. 初始化项目
```bash
npm init -y                     # 生成 package.json
```

### 4. 安装依赖
```
typescript tsx @types/node      # TypeScript 运行时
@langchain/core                 # LangChain 核心（基础抽象）
@langchain/ollama               # Ollama 模型连接器
dotenv                          # 环境变量管理（可选，当前用不到但先装）
```

### 5. 写代码

创建 `src/index.ts`，内容：

- 导入 `ChatOllama` 创建一个模型实例，指向本地 `qwen2.5`
- 调用 `.invoke("你好，请介绍一下你自己")`
- 把回复内容打印到终端

### 6. 运行验证
```bash
npx tsx src/index.ts
```
终端看到模型的回复 → 需求完成。

## 涉及技术解释（教学用）

| 技术 | 是什么 | 在这个需求里的作用 |
|------|--------|-------------------|
| **LangChain.js** | AI 应用开发框架，提供统一的模型接口、工具调用、记忆等能力 | 整个项目的 Agent 骨架 |
| **@langchain/core** | LangChain 的核心包，定义了 ChatModel、Message 等基础类型 | 所有其他包依赖的基础层 |
| **@langchain/ollama** | LangChain 对接本地 Ollama 服务的连接器 | 让 LangChain 能调用你本地的 Qwen 模型 |
| **ChatOllama** | LangChain 里的一个 Chat Model 实现，封装了对 Ollama API 的调用 | 创建模型实例，发送消息、接收回复 |
| **.invoke()** | ChatModel 上的核心方法，发送消息并等待完整回复 | 最简单的调用方式（同步等待） |
| **tsx** | TypeScript 直接执行工具（基于 esbuild），免编译 | 直接运行 `.ts` 文件，不需要先 `tsc` 编译 |
| **dotenv** | 读取 `.env` 文件到环境变量 | 管理 API Key 等敏感配置（当前需求用不到，先装好备用） |

## 验收标准

- [ ] `npx tsx src/index.ts` 运行不报错
- [ ] 终端打印出 Qwen 模型的自我介绍回复
- [ ] 不依赖任何外部 API，纯本地运行

## 备注

- 第一个需求不涉及 API Key、不涉及多模型切换，只验证本地链路
- 代码量预估不超过 20 行，保持极简
