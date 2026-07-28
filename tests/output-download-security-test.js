import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startTestServer, createTempDataDir } from "./http-test-helpers.js";

const outputDir = createTempDataDir("qa-copilot-outputs-");
const api = await startTestServer();

try {
    const { runtime } = api.app.locals.dependencies;
    const safeFile = path.join(outputDir, "testcases.json");
    fs.writeFileSync(safeFile, '{"testCases":[]}', "utf8");
    runtime.saveSession({
        sessionId: "SESSION-DOWNLOAD-001",
        status: "completed",
        pipelineStatus: "COMPLETED"
    });
    runtime.saveArtifact({
        artifactId: "TESTCASE-DOWNLOAD-001",
        artifactType: "TEST_CASE_REVIEW",
        sessionId: "SESSION-DOWNLOAD-001",
        approvalStatus: "approved",
        outputs: { json: safeFile }
    });

    const safeApp = api.app;
    void safeApp;
    const wrongRoot = await fetch(
        `${api.baseUrl}/api/workflows/SESSION-DOWNLOAD-001/outputs/json/download`
    );
    assert.equal(wrongRoot.status, 403);
} finally {
    await api.close();
}

const safeApi = await (async () => {
    const dataDir = createTempDataDir();
    const { default: createApp } = await import("../src/server/createApp.js");
    const app = createApp({ dataDir, outputDir });
    const server = await new Promise(resolve => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    return {
        app,
        server,
        baseUrl: `http://127.0.0.1:${server.address().port}`
    };
})();

try {
    const safeFile = path.join(outputDir, "testcases.json");
    const { runtime } = safeApi.app.locals.dependencies;
    runtime.saveSession({
        sessionId: "SESSION-DOWNLOAD-002",
        status: "completed",
        pipelineStatus: "COMPLETED"
    });
    runtime.saveArtifact({
        artifactId: "TESTCASE-DOWNLOAD-002",
        artifactType: "TEST_CASE_REVIEW",
        sessionId: "SESSION-DOWNLOAD-002",
        approvalStatus: "approved",
        outputs: {
            json: safeFile,
            markdown: path.resolve("package.json")
        }
    });

    const download = await fetch(
        `${safeApi.baseUrl}/api/workflows/SESSION-DOWNLOAD-002/outputs/json/download`
    );
    assert.equal(download.status, 200);
    assert.equal(await download.text(), '{"testCases":[]}');

    const forbidden = await fetch(
        `${safeApi.baseUrl}/api/workflows/SESSION-DOWNLOAD-002/outputs/markdown/download`
    );
    assert.equal(forbidden.status, 403);
} finally {
    await new Promise(resolve => safeApi.server.close(resolve));
}

console.log("Output download security test PASSED");
