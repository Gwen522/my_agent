import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getCurrentTimeTool = tool(
    async () => {
        return new Date().toLocaleString("zh-CN");
    },
    {
        name: "get_current_time",
        description: "获取真实、精确的当前日期和时间。只要用户询问现在的时间/日期，无论之前对话中出现过什么时间，都必须重新调用本工具获取最新真实数据，禁止凭历史对话内容或记忆推算/编造时间。",
        schema: z.object({}), // 获取时间无需参数输入
    }
)