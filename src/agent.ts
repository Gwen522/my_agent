import { ChatOllama } from "@langchain/ollama";
import { SystemMessage } from "@langchain/core/messages";
export class ChatAgent {
  private model: ChatOllama;
  private systemMessage: string;

  constructor(systemMessage = "你是一个有帮助的助手。") {
    this.model = new ChatOllama({
      model: "qwen2.5",
      temperature: 0.7,
    });
    this.systemMessage = systemMessage;
  }

  /** 接收用户消息，返回模型回复的纯文本 */
  async chat(userInput: string): Promise<string> {
    const messages = [
      new SystemMessage(this.systemMessage),
      userInput,
    ];
    const response = await this.model.invoke(messages);
    return response.content as string;
  }
}
