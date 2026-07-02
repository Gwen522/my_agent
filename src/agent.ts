import { ChatOllama } from "@langchain/ollama";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
export class ChatAgent {
    private model: ChatOllama;
    private systemMessage: string; // 系统消息(角色设定)
    private history: (HumanMessage | AIMessage)[] = [];

    constructor(systemMessage = "你是一个有帮助的助手。") {
        this.model = new ChatOllama({
            model: "qwen2.5",
            temperature: 0.7,
        });
        this.systemMessage = systemMessage;
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

        this.history.push(new HumanMessage(userInput));
        this.history.push(new AIMessage(response.content as string));

        return response.content as string;
    }
}
