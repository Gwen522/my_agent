import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const calcTool = tool(
    async ({ expression }) => {
        // 用 Function 做安全的表达式求值（只允许数学运算符和数字）
        const sanitized = expression.replace(/[^0-9+\-*/%.() ]/g, "");
        const result = Function(`"use strict"; return (${sanitized})`)();
        return String(result);
    },
    {
        name: "calculator",
        description: "执行数学表达式计算。支持加减乘除、括号、小数点。传入一个合法的数学表达式字符串，返回计算结果。",
        schema: z.object({
            expression: z.string().describe("要计算的数学表达式，例如 '123 + 456' 或 '3.14 * 2'"),
        }),
    }
);