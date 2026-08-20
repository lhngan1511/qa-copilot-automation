import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";
import FileProjectRepository from "../src/projects/FileProjectRepository.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-project-delete-"));

async function request(baseUrl, method, requestPath, body) {
    const response = await fetch(`${baseUrl}${requestPath}`, {
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
}

const projectRepository = new FileProjectRepository({ dataDir: tempRoot });
await projectRepository.initialize();
const app = createApp({ repositoryType: "file", dataDir: tempRoot, outputDir: path.join(tempRoot, "outputs"), projectRepository });
const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;

try {
    const created = await request(baseUrl, "POST", "/api/projects", { name: "Project cần xóa" });
    assert.equal(created.status, 201);
    const projectId = created.body.data.projectId;

    const deleted = await request(baseUrl, "DELETE", `/api/projects/${projectId}`);
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body.data, { projectId, deleted: true });

    const list = await request(baseUrl, "GET", "/api/projects");
    assert.equal(list.body.data.some(item => item.projectId === projectId), false, "project đã xóa không còn trong danh sách");

    const detail = await request(baseUrl, "GET", `/api/projects/${projectId}`);
    assert.equal(detail.status, 404, "project đã xóa không còn truy cập được");

    const repeated = await request(baseUrl, "DELETE", `/api/projects/${projectId}`);
    assert.equal(repeated.status, 404, "không thể xóa lặp lại project đã xóa");

    console.log("Project delete test: PASS");
} finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
