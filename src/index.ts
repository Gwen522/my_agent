import { ChatOllama } from "@langchain/ollama";

const model = new ChatOllama({
  model: "qwen2.5",
  temperature: 0.7,
});

const response = await model.invoke("你好！请用中文介绍一下你自己。");

console.log(response.content);
