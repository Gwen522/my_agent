import { ChatOllama } from "@langchain/ollama";

export class ChatAgent {
  private model: ChatOllama;

  constructor() {
    this.model = new ChatOllama({
      model: "qwen2.5",
      temperature: 0.7,
    });
  }

  /** 接收用户消息，返回模型回复的纯文本 */
  async chat(userInput: string): Promise<string> {
    const response = await this.model.invoke(userInput);
    return response.content as string;
  }
}
