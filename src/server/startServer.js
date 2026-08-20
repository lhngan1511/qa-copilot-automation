import "../config/loadEnv.js";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadedEnvFilePath, envFileExists } from "../config/loadEnv.js";

const { default: createApp } = await import("./createApp.js");
const { default: createProjectRepository } = await import("../projects/createProjectRepository.js");

const entryFile = fileURLToPath(import.meta.url);
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const repositoryType = process.env.REPOSITORY_TYPE || "file";
const dataDir = process.env.DATA_DIR || "./data";
const projectRepository = await createProjectRepository({ dataDir });
const app = createApp({ repositoryType, dataDir, projectRepository });

const server = app.listen(port, host, () => {
    const url = `http://${host}:${port}`;
    console.log(`Server entry: ${entryFile}`);
    console.log(`Env file: ${loadedEnvFilePath} (${envFileExists ? "loaded" : "missing"})`);
    console.log(`ENABLE_AI: ${process.env.ENABLE_AI || "unset"}`);
    console.log(`AI_PROVIDER: ${process.env.AI_PROVIDER || "unset"}`);
    console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "CONFIGURED" : "MISSING"}`);
    console.log(`Public directory: ${app.locals.dependencies.publicDirectory}`);
    console.log(`index.html exists: ${app.locals.dependencies.indexExists}`);
    console.log(`QA Copilot server listening on ${url}`);
    console.log(`Repository type: ${repositoryType}`);
    console.log(`Project repository: ${process.env.PROJECT_REPOSITORY_TYPE || (process.env.DATABASE_URL ? "postgres" : "file")}`);
    console.log(`Data directory: ${app.locals.dependencies.config.dataDir}`);

    if (process.env.OPEN_BROWSER !== "false" && process.env.NODE_ENV !== "test") {
        const commands = {
            win32: ["cmd", ["/c", "start", "", url]],
            darwin: ["open", [url]],
            linux: ["xdg-open", [url]]
        };
        const [command, args] = commands[process.platform] ?? commands.linux;
        const child = spawn(command, args, {
            detached: true,
            stdio: "ignore",
            windowsHide: true
        });
        child.on("error", error => {
            console.warn(`Không thể tự mở trình duyệt: ${error.message}`);
        });
        child.unref();
    }
});

server.on("error", error => {
    if (error.code === "EADDRINUSE") {
        console.error(`Không thể khởi động: cổng ${port} đang được sử dụng.`);
        process.exitCode = 1;
        return;
    }
    console.error(`Không thể khởi động QA Copilot: ${error.message}`);
    process.exitCode = 1;
});
