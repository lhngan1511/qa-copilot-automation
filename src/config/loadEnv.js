import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(configDirectory, "../..");
const configuredPath = process.env.QA_COPILOT_ENV_FILE?.trim();
const envFilePath = path.resolve(configuredPath || path.join(projectDirectory, ".env"));

if (fs.existsSync(envFilePath)) {
    dotenv.config({ path: envFilePath });
}

export const loadedEnvFilePath = envFilePath;
export const envFileExists = fs.existsSync(envFilePath);
