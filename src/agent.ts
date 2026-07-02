import { ChatOllama } from "@langchain/ollama";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
export class ChatAgent {
    private model: ChatOllama;
    private systemMessage: string; // 系统消息(角色设定)
    private history: (HumanMessage | AIMessage)[] = [];

    constructor(systemMessage: string, profile?: Record<string, string>, aiprofile?: Record<string, string>) {
        this.model = new ChatOllama({
            model: "qwen2.5",
            temperature: 0.7,
        });
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
        this.systemMessage = parts.length > 0
            ? `${systemMessage}\n${parts.join("\n")}`
            : systemMessage;
    }

    /** 接收用户消息，返回模型回复的纯文本 */
    async chat(userInput: string): Promise<string> {
        // 组成消息
        const messages = [
            new SystemMessage(this.systemMessage), // 手动组成SystemMessage
            ...this.history,
            new HumanMessage(userInput),    // 用户输入
        ];
        const response = await this.model.invoke(messages);
        // 更新历史
        this.history.push(new HumanMessage(userInput));
        this.history.push(new AIMessage(response.content as string));

        return response.content as string;
    }
    // 流式输出
    async *chatStream(userInput: string): AsyncGenerator<string> {
        const messages = [
            new SystemMessage(this.systemMessage),
            ...this.history,
            new HumanMessage(userInput),
        ];
        // 建立流连接，并返回流。
        const stream = await this.model.stream(messages);
        let fullReply = "";
        // 读取流,流上每一个chunk都会触发这个回调
        for await (const chunk of stream) {
            const piece = chunk.content as string
            fullReply += piece;
            yield piece;
        }
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
