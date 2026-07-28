import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import createApp from "./createApp.js";

const entryFile = fileURLToPath(import.meta.url);
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const repositoryType = process.env.REPOSITORY_TYPE || "file";
const dataDir = process.env.DATA_DIR || "./data";
const app = createApp({ repositoryType, dataDir });

const server = app.listen(port, host, () => {
    const url = `http://${host}:${port}`;
    console.log(`Server entry: ${entryFile}`);
    console.log(`Public directory: ${app.locals.dependencies.publicDirectory}`);
    console.log(`index.html exists: ${app.locals.dependencies.indexExists}`);
    console.log(`QA Copilot server listening on ${url}`);
    console.log(`Repository type: ${repositoryType}`);
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
