/** 模型配置的类型定义 */
export interface ModelConfig {
    provider: string;   // 模型提供商，如 "ollama"、"openai"
    model: string;      // 模型名称，如 "qwen2.5:32b"
    temperature: number; // 温度参数，控制回答随机性
    baseUrl?: string;    // API 地址（可选）
}
