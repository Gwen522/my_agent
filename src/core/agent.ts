import { allTools } from "../tools/index.js";
import { createChatModel } from "../utils/modelFactory.js";
import type { ModelConfig } from "../types/index.js";
import { modelConfig } from "../config/index.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, AIMessageChunk } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export class ChatAgent {
    private model: BaseChatModel;                             // 模型（不关心底层厂商）
    private systemMessage: string;                            // 系统消息（角色设定）
    private history: (HumanMessage | AIMessage)[] = [];       // 历史消息
    private modelWithTools;                                   // 模型绑定工具后
    private promptTemplate: ChatPromptTemplate;               // Prompt 模板

    // 构造函数：初始化模型、画像、Prompt 模板
    constructor(profile?: Record<string, string>, aiprofile?: Record<string, string>) {
        // 通过工厂创建模型
        this.model = createChatModel(modelConfig);
        // 绑定工具（bindTools 在 BaseChatModel 上是可选的，用类型守卫）
        if (!this.model.bindTools) throw new Error("模型不支持工具调用");
        this.modelWithTools = this.model.bindTools(allTools);
        // 拼接 System Prompt
        const parts: string[] = [];
        if (profile && Object.keys(profile).length > 0) {
            const userInfo = Object.entries(profile).map(([k, v]) => `${k}: ${v}`).join("，");
            parts.push(`用户信息：${userInfo}`);
        }
        if (aiprofile && Object.keys(aiprofile).length > 0) {
            const aiInfo = Object.entries(aiprofile).map(([k, v]) => `${k}: ${v}`).join("，");
            parts.push(`AI角色设定：${aiInfo}`);
        }
        this.systemMessage = parts.join("\n");
        // 创建 Prompt 模板
        this.promptTemplate = ChatPromptTemplate.fromMessages([
            ["system", "{system_message}\n\n当前时间：{current_time}"],
            new MessagesPlaceholder("history"),
            ["human", "{user_input}"],
        ]);
    }

    // 非流式输出（支持工具调用）
    async chat(userInput: string): Promise<string> {
        const messages = await this.promptTemplate.formatMessages({
            system_message: this.systemMessage,
            current_time: new Date().toLocaleString("zh-CN"),
            history: this.history,
            user_input: userInput,
        });
        const response = await this.modelWithTools.invoke(messages);
        if (response.tool_calls && response.tool_calls.length > 0) {
            messages.push(response);
            for (const toolCall of response.tool_calls) {
                const tool = allTools.find((t) => t.name === toolCall.name);
                if (!tool) continue;
                const toolMessage = await tool.invoke(toolCall);
                messages.push(toolMessage);
            }
            const finalResponse = await this.modelWithTools.invoke(messages);
            this.history.push(new HumanMessage(userInput));
            this.history.push(new AIMessage(finalResponse.content as string));
            return finalResponse.content as string;
        }
        this.history.push(new HumanMessage(userInput));
        this.history.push(new AIMessage(response.content as string));
        return response.content as string;
    }

    // 流式输出（支持工具调用）
    async *chatStream(userInput: string): AsyncGenerator<string> {
        const messages = await this.promptTemplate.formatMessages({
            system_message: this.systemMessage,
            current_time: new Date().toLocaleString("zh-CN"),
            history: this.history,
            user_input: userInput,
        });
        let fullReply = "";
        let full: AIMessageChunk | undefined;
        for await (const chunk of await this.modelWithTools.stream(messages)) {
            const piece = chunk.content as string;
            if (piece) { fullReply += piece; yield piece; }
            full = full ? full.concat(chunk) : chunk;
        }
        if (full?.tool_calls && full.tool_calls.length > 0) {
            for (const tc of full.tool_calls) {
                yield `\n[调用工具: ${tc.name}, 参数: ${JSON.stringify(tc.args)}]\n`;
            }
            messages.push(full);
            for (const toolCall of full.tool_calls) {
                const tool = allTools.find((t) => t.name === toolCall.name);
                if (!tool) continue;
                const toolMessage = await tool.invoke(toolCall);
                messages.push(toolMessage);
            }
            fullReply = "";
            for await (const chunk of await this.modelWithTools.stream(messages)) {
                const piece = chunk.content as string;
                fullReply += piece;
                yield piece;
            }
        }
        this.history.push(new HumanMessage(userInput));
        this.history.push(new AIMessage(fullReply));
    }

    // 运行时切换模型
    setModel(model: ModelConfig): void {
        this.model = createChatModel(model);
        if (!this.model.bindTools) throw new Error("模型不支持工具调用");
        this.modelWithTools = this.model.bindTools(allTools);
    }

    // 暴露历史记录
    getHistory(): (HumanMessage | AIMessage)[] {
        return this.history;
    }

    // 恢复历史记录
    loadHistory(history: (HumanMessage | AIMessage)[]): void {
        this.history = history;
    }
}
