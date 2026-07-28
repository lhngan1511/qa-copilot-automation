import fs from "node:fs";
import assert from "node:assert/strict";
import FileWorkflowSessionRepository from "../src/repositories/FileWorkflowSessionRepository.js";
import { createTempDataDir } from "./http-test-helpers.js";

const dataDir = createTempDataDir("qa-sessions-");
const repository = new FileWorkflowSessionRepository({ dataDir });
const source = {
    sessionId: "SESSION-001",
    workflowId: "requirement-review",
    status: "started",
    metadata: { values: ["one"] }
};
repository.save(source);
source.metadata.values.push("mutated");
const found = repository.findById("SESSION-001");
assert.deepEqual(found.metadata.values, ["one"]);
found.metadata.values.push("read mutation");
assert.deepEqual(repository.findById("SESSION-001").metadata.values, ["one"]);
assert.equal(repository.exists("SESSION-001"), true);
assert.equal(repository.findByWorkflowId("requirement-review").length, 1);

fs.writeFileSync(repository.filePath, "not-json", "utf8");
assert.throws(() => repository.findAll(), /Malformed workflow session repository JSON/);

console.log("FileWorkflowSessionRepository test PASSED");
