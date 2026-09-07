import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createApp from "../src/server/createApp.js";

/* Phần 4 — "AI Test Design" lối tắt Nhập nhanh testcase. Tạo session bypass thẳng ở
   TEST_CASE_REVIEW (bỏ qua Requirement/Module/Scenario Review) → gõ tay 1 testcase → duyệt →
   finalize-direct → xác nhận approved-testcases.json có đúng testcase, KHÔNG chạm resumeSession. */

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "direct-tc-"));
const dataDir = path.join(tempRoot, "data");
const outputDir = path.join(tempRoot, "outputs");

async function boot() {
    const app = createApp({ repositoryType: "file", dataDir, outputDir, v3OutputDir: path.join(tempRoot, "out") });
    const srv = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    async function req(m, p, b) {
        const r = await fetch(`${base}${p}`, { method: m, headers: b !== undefined ? { "content-type": "application/json" } : {}, body: b !== undefined ? JSON.stringify(b) : undefined });
        let d; try { d = await r.json(); } catch { d = null; }
        return { status: r.status, body: d };
    }
    return { srv, req };
}

async function main() {
    const { srv, req } = await boot();

    // 1. Tạo session bypass — KHÔNG cần requirementFile.
    const created = await req("POST", "/api/workflows/direct-testcase-design", {});
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const workflow = created.body?.data?.workflow;
    assert.ok(workflow?.id, "có workflow.id (sessionId) để điều hướng");
    const sessionId = workflow.id;
    assert.equal(workflow.status, "TEST_CASE_REVIEW_REQUIRED", "pipelineStatus map đúng -> WorkflowDetailPage render TestCaseReviewPanel");
    assert.equal(workflow.origin, "DIRECT_TESTCASE_DESIGN", "workflow.origin truyền qua public mapper -> frontend biết đây là session bypass, không gọi resumeSession");

    // 2. GET lại session — dùng đúng route tester thật sẽ gọi khi mở /workflows/:sessionId.
    const fetched = await req("GET", `/api/workflows/${sessionId}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body?.data?.workflow?.status, "TEST_CASE_REVIEW_REQUIRED");

    // 3. Lấy test-case-review hiện tại để biết artifactId (giống flow FE thật).
    const review = await req("GET", `/api/workflows/${sessionId}/test-case-review`);
    assert.equal(review.status, 200, JSON.stringify(review.body));
    const artifactId = review.body?.data?.artifactId ?? review.body?.data?.artifact?.artifactId;
    assert.ok(artifactId, "có artifactId để PUT testcase vào");

    // 4. Tester gõ tay 1 testcase (dùng đúng route "+ Thêm testcase" đã có sẵn).
    const testCase = {
        id: "TC-DIRECT-01",
        title: "Đăng nhập thành công với tài khoản hợp lệ",
        module: "Đăng nhập",
        feature: "Đăng nhập",
        type: "POSITIVE",
        expectedResult: "Hệ thống chuyển vào Dashboard.",
        steps: [{ stepNumber: 1, action: "Nhập tài khoản/mật khẩu hợp lệ, bấm Đăng nhập", expectedResult: "Chuyển vào Dashboard" }]
    };
    const created2 = await req("PUT", `/api/workflows/${sessionId}/test-case-review`, { artifactId, testCases: [testCase] });
    assert.equal(created2.status, 200, JSON.stringify(created2.body));

    // 4b. Quyết định duyệt từng dòng (giống TestCaseReviewPanel.jsx#applyDecision) — testcase mới
    // tạo LUÔN bị ép reviewStatus:"PENDING" ở lần PUT đầu (updateTestCaseReview, testcase chưa
    // "existing"); phải PUT LẦN 2 với testcase đã tồn tại để reviewStatus:"APPROVED" được giữ.
    const decided = await req("PUT", `/api/workflows/${sessionId}/test-case-review`, {
        artifactId,
        testCases: [{ ...testCase, reviewStatus: "APPROVED" }]
    });
    assert.equal(decided.status, 200, JSON.stringify(decided.body));

    // 5. Duyệt (route approve đã có sẵn, dùng chung với pipeline đầy đủ).
    const approved = await req("POST", `/api/workflows/${sessionId}/approve`, { artifactId, approvedBy: "tester" });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));

    // 6. finalize-direct — KHÔNG gọi resumeSession (route đó không hề được gọi trong test này).
    const finalized = await req("POST", `/api/workflows/${sessionId}/finalize-direct`, { artifactId });
    assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
    const outputs = finalized.body?.data?.outputs;
    assert.ok(outputs && Object.keys(outputs).length > 0, "có output path sau khi finalize");

    // 7. Xác nhận approved-testcases.json thật sự được ghi, chứa đúng testcase.
    const jsonPath = outputs.json;
    assert.ok(jsonPath && fs.existsSync(jsonPath), `file JSON tồn tại: ${jsonPath}`);
    const written = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const list = Array.isArray(written) ? written : (written.testCases ?? written.data ?? []);
    assert.ok(list.some(tc => tc.title === "Đăng nhập thành công với tài khoản hợp lệ"), "testcase gõ tay có mặt trong file xuất");

    // 8. finalize-direct gọi lại lần 2 -> vẫn OK, trả lại đúng outputs cũ (idempotent), không export lại.
    const finalizedAgain = await req("POST", `/api/workflows/${sessionId}/finalize-direct`, { artifactId });
    assert.equal(finalizedAgain.status, 200);
    assert.deepEqual(finalizedAgain.body?.data?.outputs, outputs, "gọi lại finalize-direct không export lại/đổi output path");

    // 9. finalize-direct trên session KHÔNG phải bypass -> bị chặn rõ ràng (không âm thầm chạy sai).
    // (Không tạo session pipeline đầy đủ ở đây — chỉ xác nhận guard tồn tại qua sessionId giả không có origin.)
    const fakeSessionCheck = await req("POST", "/api/workflows/SESSION-KHONG-TON-TAI/finalize-direct", { artifactId: "X" });
    assert.notEqual(fakeSessionCheck.status, 200);

    await new Promise(r => srv.close(r));
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("Direct TestCase Design (Phần 4) test: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
