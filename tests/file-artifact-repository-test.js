import fs from "node:fs";
import assert from "node:assert/strict";
import FileArtifactRepository from "../src/repositories/FileArtifactRepository.js";
import { createTempDataDir } from "./http-test-helpers.js";

const dataDir = createTempDataDir("qa-artifacts-");
const repository = new FileArtifactRepository({ dataDir });
const source = {
    artifactId: "ART-001",
    workflowId: "WF-001",
    sessionId: "SESSION-001",
    approvalStatus: "pending",
    payload: { values: ["one"] }
};
repository.save(source);
source.payload.values.push("mutated");
const found = repository.findById("ART-001");
assert.deepEqual(found.payload.values, ["one"]);
found.payload.values.push("read mutation");
assert.deepEqual(repository.findById("ART-001").payload.values, ["one"]);
assert.equal(repository.exists("ART-001"), true);
assert.equal(repository.findByWorkflowId("WF-001").length, 1);
assert.equal(repository.findBySessionId("SESSION-001").length, 1);

fs.writeFileSync(repository.filePath, "{bad json", "utf8");
assert.throws(() => repository.findAll(), /Malformed artifact repository JSON/);

console.log("FileArtifactRepository test PASSED");
