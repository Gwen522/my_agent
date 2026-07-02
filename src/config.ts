// 通过环境变量 USE_PROD_DATA 切换目录
// npm start           → data_test/
// npm run start:real  → data/
const USE_PROD = process.env.USE_PROD_DATA === "true";

export const DATA_DIR = USE_PROD ? "data" : "data_test";
export const USER_PROFILE_PATH = `${DATA_DIR}/user_profile.json`;
export const AI_PROFILE_PATH = `${DATA_DIR}/ai_profile.json`;
export const RECENT_PATH = `${DATA_DIR}/recent.json`;

// 短期缓存：最多保留多少条消息（1 条用户 + 1 条 AI = 1 轮）
// 20 条 ≈ 最近 10 轮对话，平衡记忆效果和上下文大小
export const MAX_RECENT_MESSAGES = 20;
