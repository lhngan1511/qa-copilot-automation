import assert from "node:assert/strict";
import {
    MAX_REQUIREMENT_BYTES,
    validateRequirementFile
} from "../src/utils/requirementFileValidation.js";
import { extractWorkflowId } from "../src/utils/workflowResponse.js";

const validFile = {
    name: "requirement.md",
    type: "text/markdown",
    size: 1024
};

assert.equal(validateRequirementFile(validFile).valid, true);
assert.equal(
    validateRequirementFile({
        ...validFile,
        name: "requirement.txt",
        type: "text/plain"
    }).code,
    "INVALID_FILE_TYPE"
);
assert.equal(validateRequirementFile({ ...validFile, size: 0 }).code, "EMPTY_FILE");
assert.equal(
    validateRequirementFile({
        ...validFile,
        size: MAX_REQUIREMENT_BYTES + 1
    }).code,
    "FILE_TOO_LARGE"
);
assert.equal(
    extractWorkflowId({
        workflow: {
            id: "SESSION-UI-001"
        }
    }),
    "SESSION-UI-001"
);
assert.throws(() => extractWorkflowId({ workflow: {} }), /Không thể xác định workflow ID/);

console.log("New Workflow frontend validation PASSED");
