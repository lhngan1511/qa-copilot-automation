import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

const originalWorkingDirectory = process.cwd();
const foreignWorkingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qa-copilot-static-root-"));
let server;

try {
    process.chdir(foreignWorkingDirectory);
    const app = createApp({
        repositoryType: "memory",
        dataDir: path.join(foreignWorkingDirectory, "data")
    });

    assert.equal(
        app.locals.dependencies.publicDirectory,
        path.resolve(originalWorkingDirectory, "public")
    );
    assert.equal(app.locals.dependencies.indexExists, true);

    server = await new Promise(resolve => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const root = await fetch(`${baseUrl}/`);
    assert.equal(root.status, 200);
    assert.match(root.headers.get("content-type"), /^text\/html/);
    assert.match(await root.text(), /QA Copilot V2/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type"), /javascript/);

    const styles = await fetch(`${baseUrl}/styles.css`);
    assert.equal(styles.status, 200);
    assert.match(styles.headers.get("content-type"), /text\/css/);
} finally {
    process.chdir(originalWorkingDirectory);
    if (server) {
        await new Promise((resolve, reject) =>
            server.close(error => (error ? reject(error) : resolve()))
        );
    }
}

console.log("Static root resolution test PASSED");
