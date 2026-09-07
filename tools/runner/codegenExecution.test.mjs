import assert from "node:assert/strict";
import { startCodegen, stopCodegen } from "./codegenExecution.mjs";

/* Smoke test THẬT (spawn playwright codegen thật trên máy đang chạy test này) cho lifecycle
   start/stop — HTTP integration test ở repo chính (tests/runner-agent-routes-codegen-dispatch-
   test.js) mô phỏng agent nên không chạm code spawn/kill/capture thật ở đây. Không assert nội dung
   script (codegen về about:blank không thao tác gì có thể không sinh script nào) — chỉ assert
   lifecycle: spawn thành công có pid, stop() không throw, dọn session, an toàn khi gọi 2 lần. */

async function main() {
    const recordingId = `TEST-${Date.now()}`;

    const started = startCodegen({ recordingId, url: "about:blank", browser: "chromium" });
    assert.equal(started.status, "PASSED", JSON.stringify(started));
    assert.ok(Number.isInteger(started.pid) && started.pid > 0, "phải có pid sau khi spawn thành công");

    // Cho process kịp thật sự khởi động trước khi dừng ngay (tránh race dừng quá sớm).
    await new Promise(resolve => setTimeout(resolve, 1500));

    const stopped = await stopCodegen({ recordingId });
    assert.equal(stopped.status, "PASSED");
    assert.equal(typeof stopped.scriptContent, "string");
    assert.equal(typeof stopped.captured, "boolean");

    // Dừng lần 2 trên recordingId đã dọn -> soft-fail, không throw.
    const stoppedAgain = await stopCodegen({ recordingId });
    assert.equal(stoppedAgain.status, "PASSED");
    assert.equal(stoppedAgain.captured, false);
    assert.match(stoppedAgain.error, /Không tìm thấy phiên ghi/);

    // Thiếu recordingId/url -> FAILED rõ ràng, không throw/crash.
    const missing = startCodegen({});
    assert.equal(missing.status, "FAILED");

    console.log("codegenExecution lifecycle smoke test: PASS");
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
