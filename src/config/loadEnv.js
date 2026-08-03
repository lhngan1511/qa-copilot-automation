/**
 * loadEnv — nạp biến môi trường cho qa-copilot-automation.
 *
 * Cơ chế (không hardcode đường dẫn local):
 *  - Ưu tiên đọc file cấu hình ngoài repository qua biến tùy chọn QA_COPILOT_ENV_FILE.
 *  - Nếu QA_COPILOT_ENV_FILE không được set, fallback về `.env` trong thư mục gốc.
 *
 *   Local:    QA_COPILOT_ENV_FILE=G:\qa-copilot-config\.env
 *   Server:   dùng Environment Variables / Secret Manager của môi trường triển khai
 *             (không cần file .env trong source), code vẫn chỉ đọc process.env.
 *
 * Lưu ý: dotenv không ghi đè biến môi trường đã tồn tại, nên server dùng Env Vars
 * trực tiếp vẫn ưu tiên.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultEnvFile = path.resolve(currentDir, "..", "..", ".env");

const envFilePath = process.env.QA_COPILOT_ENV_FILE || defaultEnvFile;

dotenv.config({
    path: envFilePath,
    quiet: true
});

export { envFilePath };

export default envFilePath;
