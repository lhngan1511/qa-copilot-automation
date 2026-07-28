import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

export function createTempDataDir(prefix = "qa-copilot-http-") {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export async function startTestServer({
    dataDir = createTempDataDir(),
    repositoryType = "file"
} = {}) {
    process.env.ENABLE_AI = "false";
    const app = createApp({ dataDir, repositoryType });
    const server = await new Promise(resolve => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    return {
        app,
        server,
        dataDir,
        baseUrl,
        async request(method, url, body) {
            const response = await fetch(`${baseUrl}${url}`, {
                method,
                headers: body ? { "content-type": "application/json" } : {},
                body: body ? JSON.stringify(body) : undefined
            });
            return {
                status: response.status,
                body: await response.json()
            };
        },
        close() {
            return new Promise((resolve, reject) =>
                server.close(error => (error ? reject(error) : resolve()))
            );
        }
    };
}

export function getCurrentStageContext(applicationResult) {
    const stage = applicationResult.currentStage;
    return {
        stage,
        ...applicationResult.workflowContext[stage]
    };
}
