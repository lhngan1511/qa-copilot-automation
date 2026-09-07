import assert from "node:assert/strict";
import { sanitizeAnalyzeProposal, sanitizeAnalyzeProposals } from "../src/controllers/CodeGenController.js";

/* Phần 1 — phân loại 3 nhóm SETUP/ACTION/EXPECTED_RESULT cho analyzeRecording. Test thuần, không
   gọi AI thật — chỉ kiểm chứng hàm sanitize (đầu vào là JSON đã parse từ AI). */

// 1. kind hợp lệ giữ nguyên.
assert.equal(sanitizeAnalyzeProposal({ kind: "SETUP", startStep: 1, endStep: 2 }).kind, "SETUP");
assert.equal(sanitizeAnalyzeProposal({ kind: "ACTION", startStep: 1, endStep: 2 }).kind, "ACTION");
assert.equal(sanitizeAnalyzeProposal({ kind: "EXPECTED_RESULT", startStep: 4, endStep: 4 }).kind, "EXPECTED_RESULT");

// 2. kind lạ/thiếu -> fallback ACTION (tương thích ngược, không phá logic cũ).
assert.equal(sanitizeAnalyzeProposal({ startStep: 1, endStep: 2 }).kind, "ACTION");
assert.equal(sanitizeAnalyzeProposal({ kind: "unknown", startStep: 1, endStep: 2 }).kind, "ACTION");
assert.equal(sanitizeAnalyzeProposal({ kind: "expected_result", startStep: 4, endStep: 4 }).kind, "EXPECTED_RESULT", "không phân biệt hoa/thường");

// 3. resultStep chỉ giữ khi kind = EXPECTED_RESULT và là số nguyên hợp lệ.
const withResult = sanitizeAnalyzeProposal({ kind: "EXPECTED_RESULT", startStep: 4, endStep: 4, resultStep: 4 });
assert.equal(withResult.resultStep, 4);
const noResult = sanitizeAnalyzeProposal({ kind: "EXPECTED_RESULT", startStep: 4, endStep: 4 });
assert.equal(noResult.resultStep, null, "thiếu resultStep -> null, không đoán bừa");
const wrongKindResult = sanitizeAnalyzeProposal({ kind: "ACTION", startStep: 1, endStep: 2, resultStep: 1 });
assert.equal(wrongKindResult.resultStep, null, "resultStep chỉ áp dụng cho EXPECTED_RESULT, ACTION luôn null");
const nonIntResult = sanitizeAnalyzeProposal({ kind: "EXPECTED_RESULT", startStep: 4, endStep: 4, resultStep: "4" });
assert.equal(nonIntResult.resultStep, null, "resultStep không phải số nguyên -> null");

// 4. sanitizeAnalyzeProposals lọc bỏ proposal thiếu range, giữ nguyên thứ tự các proposal hợp lệ.
const proposals = sanitizeAnalyzeProposals({
    proposals: [
        { kind: "ACTION", startStep: 1, endStep: 2 },
        { kind: "EXPECTED_RESULT", startStep: 3, endStep: 3, resultStep: 3 },
        { kind: "SETUP" } // thiếu startStep/endStep -> bị loại
    ]
});
assert.equal(proposals.length, 2, "loại bỏ proposal thiếu range");
assert.deepEqual(proposals.map(p => p.kind), ["ACTION", "EXPECTED_RESULT"]);

// 5. Input không hợp lệ -> mảng rỗng, không throw.
assert.deepEqual(sanitizeAnalyzeProposals(null), []);
assert.deepEqual(sanitizeAnalyzeProposals({}), []);
assert.deepEqual(sanitizeAnalyzeProposals({ proposals: "not-an-array" }), []);

console.log("Analyze Proposal Classification (SETUP/ACTION/EXPECTED_RESULT) test: PASS");
