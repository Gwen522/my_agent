import * as readline from "readline";
import { ChatAgent } from "../core/agent.js";
import { loadProfile, loadAiProfile, loadRecent, saveRecent } from "../utils/store.js";
import { DATA_DIR, getModelLabel, modelOptions, modelConfig } from "../config/index.js";
import * as fs from "fs";

// 启动：确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 读取画像和最近历史
const userProfile = loadProfile();
const aiPprofile = loadAiProfile();
const recentMessages = loadRecent();

const agent = new ChatAgent(userProfile, aiPprofile);
agent.loadHistory(recentMessages);

// 创建终端问答接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log(`\n ChatAgent 已启动:[${getModelLabel()}]。输入消息开始对话，输入 /help 查询命令，输入 quit 退出。\n`);

// 获取用户输入
function ask(): void {
    rl.question("你: ", async (input: string) => {
        const trimmed = input.trim();

        // 退出
        if (trimmed === "quit") {
            saveRecent(agent.getHistory());
            console.log(" 再见！");
            rl.close();
            return;
        }

        // 命令拦截
        if (trimmed.startsWith("/")) {
            if (trimmed === "/models") {
                console.log(`支持的模型: ${modelOptions.join(", ")}`);
            } else if (trimmed.startsWith("/model ")) {
                const modelName = trimmed.slice(7);
                if (modelOptions.includes(modelName)) {
                    agent.setModel({ ...modelConfig, model: modelName });
                    console.log(`已切换到模型: ${modelName}`);
                } else {
                    console.log(`不支持的模型: ${modelName}`);
                }
            } else if (trimmed === "/help") {
                console.log(
                    "支持的命令:\n" +
                    "  /models             列出支持的模型\n" +
                    "  /model [模型名]      切换模型\n" +
                    "  /help               显示帮助\n" +
                    "  quit                退出"
                );
            } else {
                console.log(`不支持的命令: ${trimmed}`);
            }
            ask();
            return;
        }

        // 正常对话
        console.log("AI: ");
        for await (const piece of agent.chatStream(input)) {
            process.stdout.write(piece);
        }
        console.log("\n");
        ask();
    });
}

ask();
