import assert from "node:assert/strict";
import createApp from "../src/server/createApp.js";
import { createTempDataDir, getCurrentStageContext } from "./http-test-helpers.js";

process.env.ENABLE_AI = "false";
const dataDir = createTempDataDir("qa-restart-");
const appA = createApp({ repositoryType: "file", dataDir });
const resultA = await appA.locals.dependencies.applicationService.start({
    requirementFile: "./requirements/thiet-bi.md"
});
const currentA = getCurrentStageContext(resultA);
assert.equal(currentA.stage, "requirementReview");

const appB = createApp({ repositoryType: "file", dataDir });
const serviceB = appB.locals.dependencies.applicationService;
const restored = serviceB.getCurrentReview({ sessionId: currentA.sessionId });
assert.equal(restored.artifactId, currentA.artifactId);
assert.equal(restored.approvalStatus, "pending");

const edited = serviceB.editArtifact({
    sessionId: currentA.sessionId,
    artifactId: currentA.artifactId,
    artifact: {
        ...restored.artifact,
        reviewMarker: "persisted edit"
    }
});
assert.equal(edited.reviewMarker, "persisted edit");
serviceB.approveReview({
    sessionId: currentA.sessionId,
    artifactId: currentA.artifactId,
    approvedBy: "restart-test"
});
const resumed = await serviceB.resumeSession({ sessionId: currentA.sessionId });
assert.equal(resumed.currentStage, "moduleReview");
assert.equal(
    appB.locals.dependencies.repositories.artifactRepository
        .findAll()
        .filter(artifact => artifact.artifactId === currentA.artifactId).length,
    1
);

console.log("Repository restart persistence test PASSED");
