import * as readline from "readline";
import { ChatAgent } from "./agent.js";
import { loadProfile, loadAiProfile, loadRecent, saveRecent } from "./store.js";
import { DATA_DIR } from "./config.js";
import * as fs from "fs";
// 启动，确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
// 读取画像和最近历史
const userProfile = loadProfile();
const aiPprofile = loadAiProfile();
const recentMessages = loadRecent();

const agent = new ChatAgent(
    "你是一个 helpful assistant。",
    userProfile,
    aiPprofile
);
agent.loadHistory(recentMessages);
// 创建终端问答接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log("\n ChatAgent 已启动。输入消息开始对话，输入 quit 退出。\n");

// 获取用户输入的函数
function ask(): void {
    rl.question("你: ", async (input: string) => {
        if (input.trim() === "quit") {
            saveRecent(agent.getHistory()); // 退出前保存最近历史
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
