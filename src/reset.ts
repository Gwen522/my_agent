import * as fs from "fs";
import { RECENT_PATH } from "./config.js";

if (fs.existsSync(RECENT_PATH)) {
  fs.rmSync(RECENT_PATH);
  console.log(`✅ 已清空对话记录 ${RECENT_PATH}`);
} else {
  console.log(`📁 ${RECENT_PATH} 不存在，无需清空`);
}
