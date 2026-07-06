import * as fs from "fs";
import { USER_PROFILE_PATH, AI_PROFILE_PATH, RECENT_PATH, MAX_RECENT_MESSAGES } from "../config/index.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// 加载用户资料
export function loadProfile(): Record<string, string> {
    if (!fs.existsSync(USER_PROFILE_PATH)) return {};
    const raw = fs.readFileSync(USER_PROFILE_PATH, "utf8");
    return JSON.parse(raw);
}

// 写入用户资料
export function saveProfile(data: Record<string, string>): void {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(USER_PROFILE_PATH, content, "utf-8");
}

// 加载 AI 画像
export function loadAiProfile(): Record<string, string> {
    if (!fs.existsSync(AI_PROFILE_PATH)) return {};
    const raw = fs.readFileSync(AI_PROFILE_PATH, "utf8");
    return JSON.parse(raw);
}

// 写入 AI 画像
export function saveAiProfile(data: Record<string, string>): void {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(AI_PROFILE_PATH, content, "utf-8");
}

// 加载最近对话
export function loadRecent(): (HumanMessage | AIMessage)[] {
    if (!fs.existsSync(RECENT_PATH)) return [];
    const raw = fs.readFileSync(RECENT_PATH, "utf8");
    return JSON.parse(raw);
}

// 写入最近对话（只保留最近 N 条）
export function saveRecent(data: (HumanMessage | AIMessage)[]): void {
    const trimmed = data.slice(-MAX_RECENT_MESSAGES);
    const content = JSON.stringify(trimmed, null, 2);
    fs.writeFileSync(RECENT_PATH, content, "utf-8");
}
