import { ChatOllama } from "@langchain/ollama";
import { allTools } from "./tools/index.js"
import { SystemMessage, HumanMessage, AIMessage, AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
export class ChatAgent {
    private model: ChatOllama; // 模型
    private systemMessage: string; // 系统消息(角色设定)
    private history: (HumanMessage | AIMessage)[] = []; // 历史消息
    private modelWithTools; // 模型带上工具

    // 构造函数，初始化模型 包括用户画像和 AI 画像
    constructor(profile?: Record<string, string>, aiprofile?: Record<string, string>) {
        this.model = new ChatOllama({
            model: "qwen2.5",
            temperature: 0.7,
        });
        this.modelWithTools = this.model.bindTools(allTools); // 绑定工具
        // 把用户画像和 AI 画像拼到 SystemPrompt 后面
        const parts: string[] = [];
        if (profile && Object.keys(profile).length > 0) {
            const userInfo = Object.entries(profile)
                .map(([k, v]) => `${k}: ${v}`)
                .join("，");
            parts.push(`用户信息：${userInfo}`);
        }
        if (aiprofile && Object.keys(aiprofile).length > 0) {
            const aiInfo = Object.entries(aiprofile)
                .map(([k, v]) => `${k}: ${v}`)
                .join("，");
            parts.push(`AI角色设定：${aiInfo}`);
        }
        this.systemMessage = parts.join("\n"); // 没有画像时就是空字符串
    }

    // 非流式输出
    async chat(userInput: string): Promise<string> {
        // 组成消息
        const messages = [
            new SystemMessage(this.systemMessage), // 手动组成SystemMessage
            ...this.history, //插入历史消息
            new HumanMessage(userInput),    // 用户输入
        ];
        const response = await this.model.invoke(messages);
        // 更新历史
        this.history.push(new HumanMessage(userInput));
        this.history.push(new AIMessage(response.content as string));

        return response.content as string;
    }
    // 流式输出（支持工具调用）
    async *chatStream(userInput: string): AsyncGenerator<string> {
        const messages: BaseMessage[] = [
            new SystemMessage(this.systemMessage),
            ...this.history,
            new HumanMessage(userInput),
        ];

        // 第一轮：用 modelWithTools 流式调用，边生成边 yield，同时用 concat 累加出完整消息
        let fullReply = "";
        let full: AIMessageChunk | undefined;
        for await (const chunk of await this.modelWithTools.stream(messages)) {
            const piece = chunk.content as string;
            if (piece) {
                fullReply += piece;
                yield piece;
            }
            full = full ? full.concat(chunk) : chunk; // 碎片累加，流结束后 full.tool_calls 才完整
        }

        // 模型要调用工具：执行工具 → 包装成 ToolMessage → 发起第二轮流式调用拿最终回复
        if (full?.tool_calls && full.tool_calls.length > 0) {
            messages.push(full); // 模型"我要调用工具"这条消息也要放进上下文，模型才知道自己刚才做了什么
            for (const toolCall of full.tool_calls) {
                const tool = allTools.find((t) => t.name === toolCall.name);
                if (!tool) continue;
                const toolMessage = await tool.invoke(toolCall); // 传完整 toolCall，自动包装成 ToolMessage
                messages.push(toolMessage);
            }

            fullReply = ""; // 第二轮才是真正的最终回复，重新累加
            for await (const chunk of await this.modelWithTools.stream(messages)) {
                const piece = chunk.content as string;
                fullReply += piece;
                yield piece;
            }
        }

        // 只存最终的用户问题 + 最终回复，中间的工具调用请求/ToolMessage 不进长期 history
        this.history.push(new HumanMessage(userInput));
        this.history.push(new AIMessage(fullReply));
    }
    // 向外暴露历史记录
    getHistory(): (HumanMessage | AIMessage)[] {
        return this.history;
    }
    // 恢复历史记录
    loadHistory(history: (HumanMessage | AIMessage)[]): void {
        this.history = history;
    }
}
