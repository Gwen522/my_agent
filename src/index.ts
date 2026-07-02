import * as readline from "readline";
import { ChatAgent } from "./agent.js";

const agent = new ChatAgent();

// 创建终端问答接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n ChatAgent 已启动。输入消息开始对话，输入 /exit 退出。\n");

// 获取用户输入的函数
function ask(): void {
  rl.question("你: ", async (input:string) => {
    if (input.trim() === "quit") {
      console.log("👋 再见！");
      rl.close();
      return;
    }

    const reply = await agent.chat(input);
    console.log("AI:", reply, "\n");
    ask(); // 递归——再问下一轮
  });
}

ask();
