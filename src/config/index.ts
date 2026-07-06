import "dotenv/config" // 读取 .env 文件注入 process.env
import type { ModelConfig } from "../types/index.js";

// ===== 数据目录 =====
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

// ===== 模型配置 =====

/** 从 .env 读取模型配置，带默认值 */
export const modelConfig: ModelConfig = {
    provider: process.env.MODEL_PROVIDER || "ollama",
    model: process.env.OLLAMA_MODEL || "qwen2.5",
    temperature: Number(process.env.MODEL_TEMPERATURE) || 0.7,
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
};

/** 返回人类可读的模型标签，供启动日志显示 */
export function getModelLabel(): string {
    return `${modelConfig.provider}:${modelConfig.model}`;
}

/** 所有可选模型列表，从 .env 逗号分隔读取 */
export const modelOptions: string[] = (process.env.MODEL_OPTIONS || "")
    .split(",")
    .filter(Boolean);
