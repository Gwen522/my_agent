# 需求 010：RAG 入门 —— 文档问答

## 目标

实现一个**基础的 RAG（检索增强生成）管线**：把 `requirements/` 目录下的需求文档作为知识库，让 Agent 能"读懂"这些文档并基于内容回答问题。

RAG 全称 Retrieval-Augmented Generation，核心思路是：**回答问题前，先去外部知识库里检索相关内容，拼进 Prompt，再让模型基于检索结果生成回答**——而不是只靠模型训练时记住的知识瞎猜。

本需求聚焦 RAG 基础管线本身，**不改造 ChatAgent 的记忆系统**（那是 011/012 的事）。先做一个独立的 RAG 验证脚本，跑通整条链路。

## 背景

现在的 Agent 只能基于模型自身的训练知识 + 短期对话记忆回答问题。问它"我们项目怎么实现流式输出的？"，它只能瞎编。

有了 RAG 之后，Agent 会先从 `requirements/006-streaming-output.md` 里检索相关内容，再基于真实文档回答——效果从"瞎编"变成"有据可查"。

### RAG 管线的五个环节

```
① 文档加载（Document Loader）
   ↓  从文件系统读取原始文本
② 文本分割（Text Splitter）
   ↓  把长文档切成小块（chunk），每块几百字
③ 向量嵌入（Embeddings）
   ↓  每个 chunk → 一串数字（向量），语义相近的文本向量也相近
④ 向量存储（Vector Store）
   ↓  把所有向量存起来，支持按"语义相似度"快速检索
⑤ 检索 + 生成（Retrieve + Generate）
   ↓  用户提问 → 向量化 → 从 VectorStore 搜最相关的 N 个 chunk → 拼进 Prompt → 模型回答
```

### 为什么需要文本分割？

`requirements/` 目录下一个需求文档可能几百上千字，但模型的上下文窗口有限，而且**塞太多不相关内容会稀释 Prompt，反而降低回答质量**。切成小块后，每次只检索最相关的几块，信息密度更高。

### 为什么用 MemoryVectorStore？

VectorStore 有很多选型：Chroma、Pinecone、Weaviate、PGVector……但它们都需要额外安装部署。`MemoryVectorStore` 是 LangChain 内置的纯内存实现，数据存在内存里、进程结束就消失——**零部署成本**，最适合入门学习。后续要持久化再换 Chroma/PGVector 即可，接口完全一致。

### 为什么用 Ollama 做 Embeddings？

我们已经在用 Ollama 跑 Qwen 模型，Ollama 也提供 Embedding 模型（如 `nomic-embed-text`），可以直接复用同一个 `OLLAMA_BASE_URL`，不需要额外申请 API Key。

## 步骤

### 1. 安装依赖

新增两个包：

- `@langchain/textsplitters`：提供 `RecursiveCharacterTextSplitter`（递归字符分割器）
- `faiss` 或直接使用 `@langchain/core` 内置的 `MemoryVectorStore`

```bash
npm install @langchain/textsplitters
```

`@langchain/ollama` 已有 `OllamaEmbeddings`，不需要新装。

### 2. 拉取 Ollama Embedding 模型

```bash
ollama pull nomic-embed-text
```

这是一个轻量的文本嵌入模型（约 274MB），专门把文本转成向量。

### 3. 新建 `src/rag/index.ts` —— RAG 验证脚本

独立于 ChatAgent，一个纯演示脚本，包含完整 RAG 管线：

```ts
// src/rag/index.ts
import { TextLoader } from "@langchain/core/document_loaders/fs/text";  // 或手写加载器
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MemoryVectorStore } from "@langchain/core/vectorstores";
```

**3a. 文档加载**：遍历 `requirements/` 目录，读取所有 `.md` 文件，每份文档保留 `文件名` 作为 metadata（检索到后能知道来源）。

**3b. 文本分割**：用 `RecursiveCharacterTextSplitter`，chunkSize ≈ 500、chunkOverlap ≈ 50（块之间有 50 字重叠，避免关键信息正好卡在边界被切断）。

**3c. 向量嵌入 + 存储**：创建 `OllamaEmbeddings` → 把所有 chunk 丢进 `MemoryVectorStore.fromDocuments()`，自动完成嵌入和存储。

**3d. 检索**：`vectorStore.asRetriever(k: 3)` — 每次返回最相关的 3 个 chunk。

**3e. 问答**：用检索到的 chunk 拼 Prompt，调用 `ChatOllama` 生成回答。

### 4. 运行验证

```bash
npx tsx src/rag/index.ts
```

脚本内预设几个测试问题，例如：

```ts
const questions = [
    "我们这个项目的流式输出是怎么实现的？",
    "项目用的是什么模型？",
    "工具调用（Tool Calling）支持哪些工具？",
];
```

对每个问题：检索 → 拼 Prompt → 模型回答 → 打印检索到的来源文档和回答。

### 5. package.json 加启动脚本

```json
"rag": "tsx src/rag/index.ts"
```

## 验收标准

- [ ] `nomic-embed-text` 模型已成功拉取并在 Ollama 可用
- [ ] `requirements/` 下所有 `.md` 文件被成功加载
- [ ] 文本被正确分割成 chunk（chunkSize 500、overlap 50）
- [ ] `MemoryVectorStore` 成功创建，检索返回与提问语义相关的 chunk
- [ ] 对 3 个测试问题，模型能基于检索到的文档内容给出准确回答（不是瞎编）
- [ ] 每次回答显示来源文档的文件名
- [ ] `npm run rag` 可直接运行

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/rag/index.ts` | 新建 | RAG 演示脚本 |
| `package.json` | 修改 | 加 `rag` 脚本、新增依赖 |

## 备注

- 本期不碰 `ChatAgent`，纯粹跑通 RAG 管线。011 才把检索能力注入 Agent 的对话流程（升级记忆系统）。
- `MemoryVectorStore` 数据不持久化，每次运行都重新加载文档 → 嵌入 → 存储。后续持久化可以换 Chroma 或存本地文件。
- `RecursiveCharacterTextSplitter` 的 chunkSize/chunkOverlap 是经验值，500/50 适合中文文档，后续可根据实际效果微调。
- 这是 RAG 最简形态（Naive RAG），生产级 RAG 还会涉及：重排序（Reranker）、查询重写（Query Rewriting）、混合检索（Hybrid Search）等，留给后续进阶需求。
