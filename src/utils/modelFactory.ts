import { ChatOllama } from "@langchain/ollama";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ModelConfig } from "../types/index.js";

/**
 * 模型工厂：根据配置创建对应的聊天模型实例。
 * 以后加 OpenAI / DeepSeek 等，只需要在这里加 case，Agent 不用改。
 */
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
