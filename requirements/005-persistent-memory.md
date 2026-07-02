# 需求 005：持久化记忆（第一期：短期记忆层）

## 整体记忆架构（三层）

Agent 的记忆系统分三层，逐步演进：

| 层级 | 职责 | 数据形式 | 状态 |
|------|------|---------|------|
| **短期缓存** | 最近 N 条消息，直接拼进上下文 | `{DATA_DIR}/recent.json` | ✅ 本次实现 |
| **中期摘要** | 把较久远的对话压缩成摘要保留 | 文本摘要 | 后续实现 |
| **长期检索** | 重要的历史信息用向量数据库存储、按语义捞 | 向量库 | 后续实现 |

> 为什么分三层而不是一个"大文件"？—— 单文件会越滚越大，token 爆炸；分三层可以「最近的全记住、稍远的压摘要、久远的按需检索」，既保证记忆连贯，又不撑爆上下文。

---

## 005 目标（本期范围）

实现**第一层短期记忆**：用户画像 + 最近 N 条消息持久化到磁盘，每次启动自动恢复，实现跨进程的长期连续对话。

数据目录（两个目录可同时存在）：

```
data_test/               # 测试环境：npm start           ← 默认
data/                    # 正式环境：npm run start:real  ← 通过环境变量切换
  ├── user_profile.json  # 用户画像 {"name":"小明", "preferences":"简洁回复"}
  ├── ai_profile.json    # AI 角色画像 {"role":"温柔的助手", "name":"小助手"}
  └── recent.json        # 最近 N 条消息缓存（不按日期分，始终覆盖写入）
```

> 切换方式：`config.ts` 通过 `USE_PROD_DATA` 环境变量决定用哪个目录，不需要改代码。

## 背景

004 实现了"一轮对话内的记忆"，但关闭程序就没了。005 做三件事：
1. **用户画像** → 存磁盘，每次启动加载，拼进 SystemPrompt
2. **AI 角色画像** → 与用户画像对称，同样存磁盘、启动加载，拼进 SystemPrompt，让 AI 有稳定的人设
3. **最近消息缓存** → 退出时存最近 N 条消息到 `recent.json`，启动时自动恢复，实现连续对话

> 与旧方案的区别：不做「按日期分会话文件」，对话是长期连续的，只有一个 `recent.json`。历史消息的长期存储留给后续的中期摘要和向量数据库层。

## 步骤

### 1. 新建 `src/config.ts` —— 路径和常量集中管理

```ts
// 通过环境变量 USE_PROD_DATA 切换目录
// npm start           → data_test/
// npm run start:real  → data/
const USE_PROD = process.env.USE_PROD_DATA === "true";

export const DATA_DIR = USE_PROD ? "data" : "data_test";
export const USER_PROFILE_PATH = `${DATA_DIR}/user_profile.json`;
export const AI_PROFILE_PATH = `${DATA_DIR}/ai_profile.json`;
export const RECENT_PATH = `${DATA_DIR}/recent.json`;

// 短期缓存：最多保留多少条消息（1 条用户 + 1 条 AI = 1 轮）
// 20 条 ≈ 最近 10 轮对话，平衡记忆效果和上下文大小
export const MAX_RECENT_MESSAGES = 20;
```

> **为什么用环境变量而不是直接改字符串？**—— 两个目录可以同时存在、互不影响。`npm start` 走测试，`npm run start:real` 走正式，不用改代码切来切去。

所有路径和可调参数在一处定义，后面改只改这一个文件。

### 2. 新建 `src/store.ts` —— 文件读写工具

封装 Node.js 内置 `fs` 模块，提供三组对称的函数：

| 函数 | 做什么 |
|------|--------|
| `loadProfile()` | 读 `user_profile.json`，返回对象（不存在返回 `{}`） |
| `saveProfile(data)` | 把对象写入 `user_profile.json` |
| `loadAiProfile()` | 读 `ai_profile.json`，返回对象（不存在返回 `{}`） |
| `saveAiProfile(data)` | 把对象写入 `ai_profile.json` |
| `loadRecent()` | 读 `recent.json`，返回消息数组（不存在返回 `[]`） |
| `saveRecent(messages)` | 截取最近 `MAX_RECENT_MESSAGES` 条消息写入 `recent.json` |

### 3. 修改 `agent.ts` —— 支持画像注入 + 历史导出/恢复

```ts
constructor(systemMessage, profile?: object, aiprofile?: object) {
  // 把用户画像、AI 画像分别拼进 SystemPrompt：
  // "你是温柔助手。AI角色设定：叫小助手，性格温柔。用户信息：叫小明，喜欢简洁回复。"
}
```

新增方法：

```ts
getHistory(): Message[]           // 暴露当前历史，供退出时保存
loadHistory(messages): void       // 从磁盘恢复历史
```

### 4. 修改 `index.ts` —— 启动/退出流程

```
启动 → loadProfile() + loadAiProfile() + loadRecent()
     → 构造 ChatAgent（注入两个画像，加载历史）
     → 开始对话
     → 用户 quit → saveRecent(agent.getHistory()) → 退出
```

### 5. 修改 `package.json` —— 增加脚本

```json
"scripts": {
  "start": "tsx src/index.ts",
  "start:real": "USE_PROD_DATA=true tsx src/index.ts",
  "reset": "tsx src/reset.ts",
  "reset:real": "USE_PROD_DATA=true tsx src/reset.ts"
}
```

| 命令 | 数据目录 | 说明 |
|------|---------|------|
| `npm start` | `data_test/` | 默认测试模式 |
| `npm run start:real` | `data/` | 正式模式 |
| `npm run reset` | `data_test/` | 只清空对话记录 `recent.json`，保留画像 |
| `npm run reset:real` | `data/` | 只清空对话记录 `recent.json`，保留画像 |

> **为什么 reset 不删画像？**——画像（用户是谁、AI 是什么人设）是相对稳定的设定，不应该因为「清空聊天记录」被误删；只有对话历史 `recent.json` 是需要频繁清空重来的测试数据。

### 6. 运行验证
```bash
npm start                       # 首次：data_test/ 自动创建
# 聊几句，让模型记住一些信息
quit                            # data_test/ 下出现 user_profile.json + ai_profile.json + recent.json
npm start                       # 再次启动：模型还记得上轮聊的内容

# 测试正式模式（独立目录，不影响测试数据）
npm run start:real              # 首次：data/ 自动创建，独立存储
quit
npm run reset                   # 只清空 data_test/recent.json，画像保留
```

## 涉及技术解释（教学用）

| 技术 | 是什么 | 在这个需求里的作用 |
|------|--------|-------------------|
| **Node.js `fs` 模块** | 操作文件系统（读/写/删/建目录） | 存用户画像、AI 画像和 recent 到磁盘 |
| **JSON.stringify / parse** | JS 对象 ↔ JSON 字符串互转 | 把 Message 对象序列化存文件，再反序列化读取 |
| **`fs.existsSync`** | 检查文件/目录是否存在 | 首次运行时 data_test/ 不存在，需要自动创建 |
| **`fs.mkdirSync`** | 创建目录，`{ recursive: true }` 自动创建父目录 | 第一次存文件时确保 `data_test/` 存在 |
| **`Array.slice(-N)`** | 截取数组最后 N 个元素 | 只保留最近 `MAX_RECENT_MESSAGES` 条消息，控制文件大小 |
| **配置文件 `config.ts`** | 把路径常量和可调参数集中管理 | 路径和 N 值只在一处改 |
| **环境变量 `process.env`** | Node.js 读取系统环境变量的方式 | 通过 `USE_PROD_DATA=true` 切换数据目录 |
| **三层记忆架构** | 短期缓存 + 中期摘要 + 长期检索 | 分层解决「全记住 vs 上下文爆炸」的矛盾 |

## 验收标准

- [ ] `npm start` 首次运行自动创建 `data_test/` 目录
- [ ] `npm run start:real` 首次运行自动创建 `data/` 目录
- [ ] 两个目录同时存在、互不影响
- [ ] 对话后退出，对应目录下有 `user_profile.json`、`ai_profile.json` 和 `recent.json`
- [ ] 再次启动，用户画像和 AI 画像信息还在，最近对话也能续上
- [ ] `recent.json` 只保留最近 20 条消息，不会无限增长
- [ ] `npm run reset` / `npm run reset:real` 只清空对应目录下的 `recent.json`，`user_profile.json` 和 `ai_profile.json` 保留不受影响
- [ ] `index.ts` 改动控制在合理范围（主要在启动/退出流程）
- [ ] 不安装新依赖（只用 Node.js 内置 `fs`、`path`）

## 备注

- 代码量：新增 `config.ts`（~12行）、`store.ts`（~50行）、`reset.ts`（~7行）；修改 `agent.ts`（~15行）、`index.ts`（~15行）
- 用户画像和 AI 画像目前手动编辑 `user_profile.json` / `ai_profile.json`，自动提取留后续实现
- `fs` 的同步 API（`Sync` 后缀）在命令行场景没问题，后续做 Web 服务时改成异步版本
- `MAX_RECENT_MESSAGES = 20` 是推荐起步值，后面根据模型上下文窗口大小调整
- `reset` 只清空对话记录，不清画像——画像是稳定人设数据，聊天记录才是频繁重置的测试数据
